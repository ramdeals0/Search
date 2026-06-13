import type { CatalogVocabularyDto, ProductDocument } from "@retailer-search/shared-types";

export function getCatalogVocabulary(products: ProductDocument[]): CatalogVocabularyDto {
  const brands = new Set<string>();
  const categories = new Set<string>();

  for (const product of products) {
    if (product.brand.trim()) {
      brands.add(product.brand.trim());
    }
    if (product.category.trim()) {
      categories.add(product.category.trim());
    }
  }

  return {
    brands: Array.from(brands).sort((a, b) => a.localeCompare(b)),
    categories: Array.from(categories).sort((a, b) => a.localeCompare(b)),
  };
}
