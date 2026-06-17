import type { ProductDocument } from "@retailer-search/shared-types";
import type { VectorSearchHit, VectorSearchProvider } from "@retailer-search/search-core";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { isLargeCatalogMode } from "../catalog-store.js";
import {
  countProductEmbeddingsInDatabase,
  searchEmbeddingsFromDatabase,
  syncEmbeddingVectorColumn,
} from "../catalog/catalog-db-queries.js";
import {
  CATALOG_VECTOR_SEARCH_LIMIT,
  EMBEDDING_IN_MEMORY_THRESHOLD,
} from "../catalog/catalog-scale-config.js";
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
import { getVectorSearchRuntimeConfig } from "./vector-config.js";

const prismaClient = prisma as any;

const embeddingByProductId = new Map<
  string,
  { vector: number[]; textHash: string; model: string; provider: string }
>();
let persistenceEnabled = false;
let databaseVectorSearchEnabled = false;

export async function hydrateVectorIndex(): Promise<void> {
  if (isLargeCatalogMode()) {
    persistenceEnabled = true;
    databaseVectorSearchEnabled = true;
    embeddingByProductId.clear();
    return;
  }

  try {
    const embeddingCount = await prismaClient.productEmbedding.count();
    if (embeddingCount > EMBEDDING_IN_MEMORY_THRESHOLD) {
      persistenceEnabled = true;
      databaseVectorSearchEnabled = true;
      embeddingByProductId.clear();
      console.log(
        `Vector index: database mode (${embeddingCount.toLocaleString()} embeddings; in-memory threshold ${EMBEDDING_IN_MEMORY_THRESHOLD.toLocaleString()}).`,
      );
      return;
    }

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
    databaseVectorSearchEnabled = false;
  } catch {
    persistenceEnabled = false;
    databaseVectorSearchEnabled = false;
  }
}

export function getEmbeddedProductCount(): number {
  if (isLargeCatalogMode()) {
    return 0;
  }
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
  if (!isLargeCatalogMode()) {
    embeddingByProductId.set(product.id, {
      vector,
      textHash,
      model: provider.model,
      provider: provider.name,
    });
  }

  if (!persistenceEnabled) {
    return;
  }

  await prismaClient.productEmbedding.upsert({
    where: { productId: product.id },
    create: {
      productId: product.id,
      embedding: vector as unknown as Prisma.InputJsonValue,
      textHash,
      sourceText: text,
      model: provider.model,
      provider: provider.name,
      dimensions: provider.dimensions,
      lastIndexedAt: new Date(),
    },
    update: {
      embedding: vector as unknown as Prisma.InputJsonValue,
      textHash,
      sourceText: text,
      model: provider.model,
      provider: provider.name,
      dimensions: provider.dimensions,
      lastIndexedAt: new Date(),
    },
  });

  if (databaseVectorSearchEnabled) {
    try {
      const pgvectorDimensions = getVectorSearchRuntimeConfig().dimensions;
      if (vector.length === pgvectorDimensions) {
        await syncEmbeddingVectorColumn(product.id, vector, { sourceText: text, textHash });
      }
    } catch {
      // pgvector column may be unavailable until migration runs.
    }
  }
}

export async function embedProductsBatch(
  products: ProductDocument[],
  batchSize?: number,
): Promise<{ processed: number; skipped: number; failed: number; lastError?: string }> {
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
  let lastError: string | undefined;

  for (let index = 0; index < products.length; index += size) {
    const batch = products.slice(index, index + size);
    const pending: Array<{ product: ProductDocument; text: string; textHash: string }> = [];

    for (const product of batch) {
      const text = buildCanonicalProductText(product);
      const textHash = hashCanonicalText(text);
      if (!isLargeCatalogMode()) {
        const existing = embeddingByProductId.get(product.id);
        if (
          existing &&
          existing.textHash === textHash &&
          existing.model === provider.model
        ) {
          skipped += 1;
          continue;
        }
      } else if (persistenceEnabled) {
        const existingRow = await prismaClient.productEmbedding.findUnique({
          where: { productId: product.id },
          select: { textHash: true, model: true },
        });
        if (
          existingRow?.textHash === textHash &&
          existingRow?.model === provider.model
        ) {
          skipped += 1;
          continue;
        }
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
        if (!isLargeCatalogMode()) {
          embeddingByProductId.set(item.product.id, {
            vector,
            textHash: item.textHash,
            model: provider.model,
            provider: provider.name,
          });
        }
        if (persistenceEnabled) {
          await prismaClient.productEmbedding.upsert({
            where: { productId: item.product.id },
            create: {
              productId: item.product.id,
              embedding: vector as unknown as Prisma.InputJsonValue,
              textHash: item.textHash,
              sourceText: item.text,
              model: provider.model,
              provider: provider.name,
              dimensions: provider.dimensions,
              lastIndexedAt: new Date(),
            },
            update: {
              embedding: vector as unknown as Prisma.InputJsonValue,
              textHash: item.textHash,
              sourceText: item.text,
              model: provider.model,
              provider: provider.name,
              dimensions: provider.dimensions,
              lastIndexedAt: new Date(),
            },
          });
          if (databaseVectorSearchEnabled) {
            try {
              const pgvectorDimensions = getVectorSearchRuntimeConfig().dimensions;
              if (vector.length === pgvectorDimensions) {
                await syncEmbeddingVectorColumn(item.product.id, vector, {
                  sourceText: item.text,
                  textHash: item.textHash,
                });
              }
            } catch {
              // Ignore pgvector sync failures for individual rows.
            }
          }
        }
        processed += 1;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Embedding batch failed";
      console.warn("[embedProductsBatch] batch failed:", lastError);
      failed += pending.length;
    }
  }

  return { processed, skipped, failed, lastError };
}

export class StoredVectorSearchProvider implements VectorSearchProvider {
  private readonly provider: EmbeddingProvider;
  private readonly fallbackProducts?: ProductDocument[];
  private readonly candidateProductIds?: string[];

  constructor(
    provider?: EmbeddingProvider,
    fallbackProducts?: ProductDocument[],
    candidateProductIds?: string[],
  ) {
    this.provider = provider ?? resolveEmbeddingProviderFromEnv();
    this.fallbackProducts = fallbackProducts;
    this.candidateProductIds = candidateProductIds;
  }

  async search(query: string, limit = 20): Promise<VectorSearchHit[]> {
    const cappedLimit = Math.max(
      1,
      Math.min(isLargeCatalogMode() ? CATALOG_VECTOR_SEARCH_LIMIT : 100, limit),
    );
    const queryVector = await this.provider.embedQuery(query);

    if (databaseVectorSearchEnabled) {
      const candidateIds =
        this.candidateProductIds ??
        this.fallbackProducts?.map((product) => product.id);
      const hits = await searchEmbeddingsFromDatabase(
        queryVector,
        cappedLimit,
        candidateIds,
      );
      if (hits.length > 0) {
        return hits;
      }
    }

    if (embeddingByProductId.size === 0 && this.fallbackProducts?.length) {
      await embedProductsBatch(this.fallbackProducts);
    }

    const hits: VectorSearchHit[] = [];
    for (const [productId, entry] of embeddingByProductId.entries()) {
      if (
        this.candidateProductIds &&
        !this.candidateProductIds.includes(productId)
      ) {
        continue;
      }
      const score = cosineSimilarity(queryVector, entry.vector);
      if (score > 0) {
        hits.push({ productId, score });
      }
    }

    return hits
      .sort((a, b) => b.score - a.score)
      .slice(0, cappedLimit);
  }
}

export async function getEmbeddingCoverage(
  totalProducts: number,
): Promise<{
  totalProducts: number;
  embeddedProducts: number;
  coveragePercent: number;
}> {
  const embeddedProducts = isLargeCatalogMode()
    ? await countProductEmbeddingsInDatabase()
    : embeddingByProductId.size;
  return {
    totalProducts,
    embeddedProducts,
    coveragePercent:
      totalProducts === 0 ? 0 : Math.round((embeddedProducts / totalProducts) * 1000) / 10,
  };
}
