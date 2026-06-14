import type { ProductDocument } from "@retailer-search/shared-types";
import type { ProductSearchIndexStats } from "./types.js";

const MIN_TOKEN_LENGTH = 2;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH);
}

function collectSearchableText(product: ProductDocument): string[] {
  const attributeValues = Object.values(product.attributes).flatMap((value) =>
    Array.isArray(value) ? value.map(String) : [String(value)],
  );

  return [
    product.title,
    product.sku,
    product.brand,
    product.category,
    product.subcategory,
    product.description,
    ...attributeValues,
  ];
}

export class ProductSearchIndex {
  private productsById = new Map<string, ProductDocument>();
  private tokenToIds = new Map<string, Set<string>>();
  private lastRebuiltAt?: string;
  private lastIncrementalAt?: string;

  getStats(): ProductSearchIndexStats {
    return {
      productCount: this.productsById.size,
      tokenCount: this.tokenToIds.size,
      lastRebuiltAt: this.lastRebuiltAt,
      lastIncrementalAt: this.lastIncrementalAt,
    };
  }

  getProduct(id: string): ProductDocument | undefined {
    return this.productsById.get(id);
  }

  getAllProducts(): ProductDocument[] {
    return Array.from(this.productsById.values());
  }

  rebuild(products: ProductDocument[]): void {
    this.productsById.clear();
    this.tokenToIds.clear();

    for (const product of products) {
      this.upsert(product);
    }

    this.lastRebuiltAt = new Date().toISOString();
    this.lastIncrementalAt = undefined;
  }

  upsert(product: ProductDocument): void {
    const existing = this.productsById.get(product.id);
    if (existing) {
      this.removeTokensForProduct(existing);
    }

    this.productsById.set(product.id, product);
    this.indexProductTokens(product);
    this.lastIncrementalAt = new Date().toISOString();
  }

  remove(productId: string): void {
    const existing = this.productsById.get(productId);
    if (!existing) {
      return;
    }

    this.removeTokensForProduct(existing);
    this.productsById.delete(productId);
    this.lastIncrementalAt = new Date().toISOString();
  }

  syncDelta(
    products: ProductDocument[],
    sinceIso?: string,
  ): { upserted: number; removed: number } {
    if (!sinceIso) {
      this.rebuild(products);
      return { upserted: products.length, removed: 0 };
    }

    const since = Date.parse(sinceIso);
    if (Number.isNaN(since)) {
      this.rebuild(products);
      return { upserted: products.length, removed: 0 };
    }

    const incomingIds = new Set(products.map((product) => product.id));
    let removed = 0;

    for (const id of this.productsById.keys()) {
      if (!incomingIds.has(id)) {
        this.remove(id);
        removed += 1;
      }
    }

    let upserted = 0;
    for (const product of products) {
      const updatedAt = Date.parse(product.updatedAt);
      const isNew = !this.productsById.has(product.id);
      if (isNew || (!Number.isNaN(updatedAt) && updatedAt >= since)) {
        this.upsert(product);
        upserted += 1;
      }
    }

    return { upserted, removed };
  }

  findCandidateIds(query: string): string[] | null {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const tokens = tokenize(normalized);
    if (tokens.length === 0) {
      if (normalized.length >= MIN_TOKEN_LENGTH) {
        return Array.from(this.findIdsForToken(normalized));
      }
      return null;
    }

    let candidateIds: Set<string> | null = null;

    for (const token of tokens) {
      const ids = this.findIdsForToken(token);
      if (candidateIds === null) {
        candidateIds = new Set(ids);
        continue;
      }

      const intersection = new Set<string>();
      for (const id of candidateIds) {
        if (ids.has(id)) {
          intersection.add(id);
        }
      }
      candidateIds = intersection;
      if (candidateIds.size === 0) {
        break;
      }
    }

    if (candidateIds && candidateIds.size > 0) {
      return Array.from(candidateIds);
    }

    return this.findSubstringFallback(normalized);
  }

  getCandidates(query: string): ProductDocument[] {
    const ids = this.findCandidateIds(query);
    if (ids === null) {
      return this.getAllProducts();
    }

    const products: ProductDocument[] = [];
    for (const id of ids) {
      const product = this.productsById.get(id);
      if (product) {
        products.push(product);
      }
    }
    return products;
  }

  private findIdsForToken(token: string): Set<string> {
    const exact = this.tokenToIds.get(token);
    if (exact) {
      return new Set(exact);
    }

    const partial = new Set<string>();
    for (const [indexedToken, ids] of this.tokenToIds.entries()) {
      if (indexedToken.includes(token) || token.includes(indexedToken)) {
        for (const id of ids) {
          partial.add(id);
        }
      }
    }
    return partial;
  }

  private findSubstringFallback(query: string): string[] {
    const matches: string[] = [];
    for (const product of this.productsById.values()) {
      const haystack = collectSearchableText(product)
        .map((text) => text.toLowerCase())
        .join(" ");
      if (haystack.includes(query)) {
        matches.push(product.id);
      }
    }
    return matches;
  }

  private indexProductTokens(product: ProductDocument): void {
    const tokens = new Set<string>();
    for (const text of collectSearchableText(product)) {
      for (const token of tokenize(text)) {
        tokens.add(token);
      }
    }

    for (const token of tokens) {
      let ids = this.tokenToIds.get(token);
      if (!ids) {
        ids = new Set<string>();
        this.tokenToIds.set(token, ids);
      }
      ids.add(product.id);
    }
  }

  private removeTokensForProduct(product: ProductDocument): void {
    const tokens = new Set<string>();
    for (const text of collectSearchableText(product)) {
      for (const token of tokenize(text)) {
        tokens.add(token);
      }
    }

    for (const token of tokens) {
      const ids = this.tokenToIds.get(token);
      if (!ids) {
        continue;
      }
      ids.delete(product.id);
      if (ids.size === 0) {
        this.tokenToIds.delete(token);
      }
    }
  }
}
