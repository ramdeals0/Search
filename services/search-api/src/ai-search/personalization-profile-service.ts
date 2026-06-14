import type {
  AiRankingConfigDto,
  SearchExplanationCode,
} from "@retailer-search/shared-types";
import type { ProductDocument } from "@retailer-search/shared-types";
import { prisma } from "../db.js";

const EVENT_WEIGHTS = {
  purchase: 8,
  add_to_cart: 5,
  click: 3,
  search: 1,
} as const;

type AffinityBucket = Record<string, { score: number; lastAt: string }>;

interface ShopperProfilePayload {
  products?: AffinityBucket;
  brands?: AffinityBucket;
  categories?: AffinityBucket;
  recentQueries?: Array<{ query: string; at: string; weight: number }>;
}

const inMemoryProfiles = new Map<string, ShopperProfilePayload>();
let persistenceEnabled = false;

function decayMultiplier(lastAt: string, halfLifeDays: number): number {
  const ageMs = Date.now() - new Date(lastAt).getTime();
  const halfLifeMs = halfLifeDays * 24 * 60 * 60 * 1000;
  if (halfLifeMs <= 0) {
    return 1;
  }
  return 0.5 ** (ageMs / halfLifeMs);
}

function bumpBucket(
  bucket: AffinityBucket,
  key: string,
  amount: number,
): AffinityBucket {
  const current = bucket[key];
  return {
    ...bucket,
    [key]: {
      score: (current?.score ?? 0) + amount,
      lastAt: new Date().toISOString(),
    },
  };
}

export async function hydratePersonalizationProfiles(): Promise<void> {
  try {
    const rows = await prisma.shopperProfile.findMany({
      take: 2000,
      orderBy: { updatedAt: "desc" },
    });
    inMemoryProfiles.clear();
    for (const row of rows) {
      inMemoryProfiles.set(row.sessionId, row.affinities as ShopperProfilePayload);
    }
    persistenceEnabled = true;
  } catch {
    persistenceEnabled = false;
  }
}

async function persistProfile(sessionId: string, profile: ShopperProfilePayload): Promise<void> {
  inMemoryProfiles.set(sessionId, profile);
  if (!persistenceEnabled) {
    return;
  }
  await prisma.shopperProfile.upsert({
    where: { sessionId },
    create: {
      sessionId,
      affinities: profile as object,
    },
    update: {
      affinities: profile as object,
    },
  });
}

export async function recordPersonalizationEvent(input: {
  sessionId: string;
  eventType: keyof typeof EVENT_WEIGHTS;
  query?: string;
  product?: Pick<ProductDocument, "id" | "brand" | "category">;
}): Promise<void> {
  const sessionId = input.sessionId.trim();
  if (!sessionId) {
    return;
  }

  const profile = inMemoryProfiles.get(sessionId) ?? {};
  const weight = EVENT_WEIGHTS[input.eventType];
  let next: ShopperProfilePayload = { ...profile };

  if (input.query?.trim()) {
    const recentQueries = [...(profile.recentQueries ?? [])];
    recentQueries.unshift({
      query: input.query.trim(),
      at: new Date().toISOString(),
      weight,
    });
    next.recentQueries = recentQueries.slice(0, 50);
  }

  if (input.product) {
    next.products = bumpBucket(profile.products ?? {}, input.product.id, weight);
    next.brands = bumpBucket(profile.brands ?? {}, input.product.brand, weight);
    next.categories = bumpBucket(
      profile.categories ?? {},
      input.product.category,
      weight,
    );
  }

  await persistProfile(sessionId, next);
}

function bucketScore(
  bucket: AffinityBucket | undefined,
  key: string,
  halfLifeDays: number,
): number {
  const entry = bucket?.[key];
  if (!entry) {
    return 0;
  }
  return entry.score * decayMultiplier(entry.lastAt, halfLifeDays);
}

export async function computePersonalizationScores(
  sessionId: string,
  products: ProductDocument[],
  config: AiRankingConfigDto,
): Promise<Map<string, { score: number; codes: SearchExplanationCode[] }>> {
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId || !config.personalizationEnabled) {
    return new Map();
  }

  let profile = inMemoryProfiles.get(normalizedSessionId);
  if (!profile && persistenceEnabled) {
    const row = await prisma.shopperProfile.findUnique({
      where: { sessionId: normalizedSessionId },
    });
    profile = (row?.affinities as ShopperProfilePayload | undefined) ?? undefined;
  }
  if (!profile) {
    return new Map();
  }

  const halfLife = config.personalizationDecayHalfLifeDays;
  const scores = new Map<string, { score: number; codes: SearchExplanationCode[] }>();

  for (const product of products) {
    const productAffinity = bucketScore(profile.products, product.id, halfLife);
    const brandAffinity = bucketScore(profile.brands, product.brand, halfLife);
    const categoryAffinity = bucketScore(profile.categories, product.category, halfLife);
    const raw =
      productAffinity * 0.5 + brandAffinity * 0.3 + categoryAffinity * 0.2;
    if (raw <= 0) {
      continue;
    }
    const codes: SearchExplanationCode[] = [];
    if (productAffinity > 0) {
      codes.push("user_product_affinity");
    }
    if (brandAffinity > 0) {
      codes.push("user_brand_affinity");
    }
    if (categoryAffinity > 0) {
      codes.push("user_category_affinity");
    }
    scores.set(product.id, {
      score: Math.min(20, Math.log1p(raw) * 4),
      codes,
    });
  }

  return scores;
}

export function buildUserProfileText(profile: ShopperProfilePayload | undefined): string {
  if (!profile) {
    return "";
  }
  const queries = (profile.recentQueries ?? [])
    .slice(0, 10)
    .map((entry) => entry.query)
    .join(" ");
  const brands = Object.entries(profile.brands ?? {})
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
    .map(([brand]) => brand)
    .join(" ");
  const categories = Object.entries(profile.categories ?? {})
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
    .map(([category]) => category)
    .join(" ");
  return [queries, brands ? `brands ${brands}` : undefined, categories ? `categories ${categories}` : undefined]
    .filter(Boolean)
    .join("\n");
}

/** Backward-compatible product-only affinity recording used by click events. */
export async function recordSearchAffinity(
  sessionId: string,
  query: string,
  product: ProductDocument,
): Promise<void> {
  await recordPersonalizationEvent({
    sessionId,
    eventType: "click",
    query,
    product,
  });
}

export async function getPersonalizationBoosts(
  sessionId: string,
  products: ProductDocument[],
  config: AiRankingConfigDto,
): Promise<Map<string, number>> {
  const scores = await computePersonalizationScores(sessionId, products, config);
  return new Map(
    [...scores.entries()].map(([productId, entry]) => [productId, entry.score]),
  );
}
