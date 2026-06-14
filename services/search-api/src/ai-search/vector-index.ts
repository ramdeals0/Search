import type { ProductDocument } from "@retailer-search/shared-types";
import type { VectorSearchHit, VectorSearchProvider } from "@retailer-search/search-core";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
const prismaClient = prisma as any;
import {
  buildCanonicalProductText,
  hashCanonicalText,
} from "./canonical-product-text.js";
import {
  cosineSimilarity,
  resolveEmbeddingProviderFromEnv,
  type EmbeddingProvider,
} from "./embedding-provider.js";
import { getAiRankingConfig } from "./ai-ranking-config-store.js";

const embeddingByProductId = new Map<
  string,
  { vector: number[]; textHash: string; model: string; provider: string }
>();
let persistenceEnabled = false;

export async function hydrateVectorIndex(): Promise<void> {
  try {
    const rows = await prismaClient.productEmbedding.findMany();
    embeddingByProductId.clear();
    for (const row of rows) {
      embeddingByProductId.set(row.productId, {
        vector: row.embedding as number[],
        textHash: row.textHash ?? "",
        model: row.model,
        provider: row.provider,
      });
    }
    persistenceEnabled = true;
  } catch {
    persistenceEnabled = false;
  }
}

export function getEmbeddedProductCount(): number {
  return embeddingByProductId.size;
}

export async function upsertProductEmbedding(
  product: ProductDocument,
  provider: EmbeddingProvider,
): Promise<void> {
  const text = buildCanonicalProductText(product);
  const textHash = hashCanonicalText(text);
  const existing = embeddingByProductId.get(product.id);
  if (existing && existing.textHash === textHash && existing.model === provider.model) {
    return;
  }

  const [vector] = await provider.embedTexts([text]);
  embeddingByProductId.set(product.id, {
    vector,
    textHash,
    model: provider.model,
    provider: provider.name,
  });

  if (!persistenceEnabled) {
    return;
  }

  await prismaClient.productEmbedding.upsert({
    where: { productId: product.id },
    create: {
      productId: product.id,
      embedding: vector as unknown as Prisma.InputJsonValue,
      textHash,
      model: provider.model,
      provider: provider.name,
      dimensions: provider.dimensions,
    },
    update: {
      embedding: vector as unknown as Prisma.InputJsonValue,
      textHash,
      model: provider.model,
      provider: provider.name,
      dimensions: provider.dimensions,
    },
  });
}

export async function embedProductsBatch(
  products: ProductDocument[],
  batchSize?: number,
): Promise<{ processed: number; skipped: number; failed: number }> {
  const config = await getAiRankingConfig();
  const provider = resolveEmbeddingProviderFromEnv({
    provider: config.embeddingsProvider,
    model: config.embeddingsModel,
    dimensions: config.embeddingDimensions,
  });
  const size = batchSize ?? config.embeddingBatchSize;
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (let index = 0; index < products.length; index += size) {
    const batch = products.slice(index, index + size);
    const pending: Array<{ product: ProductDocument; text: string; textHash: string }> = [];

    for (const product of batch) {
      const text = buildCanonicalProductText(product);
      const textHash = hashCanonicalText(text);
      const existing = embeddingByProductId.get(product.id);
      if (
        existing &&
        existing.textHash === textHash &&
        existing.model === provider.model
      ) {
        skipped += 1;
        continue;
      }
      pending.push({ product, text, textHash });
    }

    if (pending.length === 0) {
      continue;
    }

    try {
      const vectors = await provider.embedTexts(pending.map((entry) => entry.text));
      for (const [itemIndex, item] of pending.entries()) {
        const vector = vectors[itemIndex];
        if (!vector) {
          failed += 1;
          continue;
        }
        embeddingByProductId.set(item.product.id, {
          vector,
          textHash: item.textHash,
          model: provider.model,
          provider: provider.name,
        });
        if (persistenceEnabled) {
          await prismaClient.productEmbedding.upsert({
            where: { productId: item.product.id },
            create: {
              productId: item.product.id,
              embedding: vector as unknown as Prisma.InputJsonValue,
              textHash: item.textHash,
              model: provider.model,
              provider: provider.name,
              dimensions: provider.dimensions,
            },
            update: {
              embedding: vector as unknown as Prisma.InputJsonValue,
              textHash: item.textHash,
              model: provider.model,
              provider: provider.name,
              dimensions: provider.dimensions,
            },
          });
        }
        processed += 1;
      }
    } catch {
      failed += pending.length;
    }
  }

  return { processed, skipped, failed };
}

export class StoredVectorSearchProvider implements VectorSearchProvider {
  private readonly provider: EmbeddingProvider;
  private readonly fallbackProducts?: ProductDocument[];

  constructor(provider?: EmbeddingProvider, fallbackProducts?: ProductDocument[]) {
    this.provider = provider ?? resolveEmbeddingProviderFromEnv();
    this.fallbackProducts = fallbackProducts;
  }

  async search(query: string, limit = 20): Promise<VectorSearchHit[]> {
    if (embeddingByProductId.size === 0 && this.fallbackProducts?.length) {
      await embedProductsBatch(this.fallbackProducts);
    }

    const queryVector = await this.provider.embedQuery(query);
    const hits: VectorSearchHit[] = [];
    for (const [productId, entry] of embeddingByProductId.entries()) {
      const score = cosineSimilarity(queryVector, entry.vector);
      if (score > 0) {
        hits.push({ productId, score });
      }
    }

    return hits
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(100, limit)));
  }
}

export async function getEmbeddingCoverage(
  totalProducts: number,
): Promise<{
  totalProducts: number;
  embeddedProducts: number;
  coveragePercent: number;
}> {
  const embeddedProducts = embeddingByProductId.size;
  return {
    totalProducts,
    embeddedProducts,
    coveragePercent:
      totalProducts === 0 ? 0 : Math.round((embeddedProducts / totalProducts) * 1000) / 10,
  };
}
