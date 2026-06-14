import type { ProductDocument } from "@retailer-search/shared-types";
import { ProductSearchIndex } from "@retailer-search/search-core";
import { getProductCatalog } from "../catalog-store.js";

export interface FederatedIndexRegistration {
  name: string;
  description?: string;
  getProducts: () => ProductDocument[];
}

const catalogIndex = new ProductSearchIndex();

const registry = new Map<string, FederatedIndexRegistration>([
  [
    "catalog",
    {
      name: "catalog",
      description: "Primary product catalog index",
      getProducts: () => getProductCatalog(),
    },
  ],
  [
    "content-stub",
    {
      name: "content-stub",
      description: "Placeholder content index for federated search demos",
      getProducts: () => [],
    },
  ],
]);

export function listRegisteredIndexes(): Array<{
  name: string;
  description?: string;
  productCount: number;
}> {
  return Array.from(registry.values()).map((entry) => ({
    name: entry.name,
    description: entry.description,
    productCount: entry.getProducts().length,
  }));
}

export function resolveFederatedSources(
  indexNames: string[],
): FederatedIndexRegistration[] {
  const names = indexNames.length > 0 ? indexNames : ["catalog"];
  return names
    .map((name) => registry.get(name))
    .filter((entry): entry is FederatedIndexRegistration => Boolean(entry));
}

export function getCatalogSearchIndex(): ProductSearchIndex {
  return catalogIndex;
}

export function registerFederatedIndex(
  registration: FederatedIndexRegistration,
): void {
  registry.set(registration.name, registration);
}
