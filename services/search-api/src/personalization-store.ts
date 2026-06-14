/** Backward-compatible facade for legacy imports. */
import type { ProductDocument } from "@retailer-search/shared-types";
import { getProductCatalog, ensureProductCatalogLoaded } from "./catalog-store.js";
import { getAiRankingConfig } from "./ai-search/ai-ranking-config-store.js";
import {
  hydratePersonalizationProfiles,
  recordPersonalizationEvent,
  getPersonalizationBoosts as getPersonalizationBoostsForProducts,
} from "./ai-search/personalization-profile-service.js";

export { recordPersonalizationEvent };

export async function recordSearchAffinity(
  sessionId: string,
  query: string,
  productId: string,
): Promise<void> {
  await ensureProductCatalogLoaded();
  const product = getProductCatalog().find((entry) => entry.id === productId);
  if (!product) {
    return;
  }
  await recordPersonalizationEvent({
    sessionId,
    eventType: "click",
    query,
    product,
  });
}

export async function getPersonalizationBoosts(
  sessionId: string,
  products?: ProductDocument[],
): Promise<Map<string, number>> {
  const catalog = products ?? getProductCatalog();
  const config = await getAiRankingConfig();
  return getPersonalizationBoostsForProducts(sessionId, catalog, config);
}

export async function hydratePersonalizationStore(): Promise<void> {
  await hydratePersonalizationProfiles();
}

export async function recordCommerceAffinity(
  sessionId: string,
  eventType: "add_to_cart" | "purchase",
  productId: string,
  query?: string,
): Promise<void> {
  await ensureProductCatalogLoaded();
  const product = getProductCatalog().find((entry) => entry.id === productId);
  if (!product) {
    return;
  }
  await recordPersonalizationEvent({
    sessionId,
    eventType,
    query,
    product,
  });
}

export async function recordQueryAffinity(sessionId: string, query: string): Promise<void> {
  if (!query.trim()) {
    return;
  }
  await recordPersonalizationEvent({
    sessionId,
    eventType: "search",
    query,
  });
}
