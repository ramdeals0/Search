import type { ProductAttributeMap, ProductDocument } from "@retailer-search/shared-types";

const SKIP_ATTRIBUTE_KEYS = new Set(["slug", "imageUrl"]);

function flattenAttributeValues(attributes: ProductAttributeMap | undefined): string[] {
  if (!attributes) {
    return [];
  }

  const values: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (SKIP_ATTRIBUTE_KEYS.has(key)) {
      continue;
    }

    if (Array.isArray(value)) {
      values.push(...value.map(String));
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      values.push(String(value));
    }
  }

  return values;
}

/** Flatten product fields and merchandising attributes into one lexical search blob. */
export function buildProductSearchText(product: ProductDocument): string {
  return [
    product.title,
    product.sku,
    product.brand,
    product.category,
    product.subcategory,
    product.description,
    ...flattenAttributeValues(product.attributes),
  ]
    .filter(Boolean)
    .join(" ");
}
