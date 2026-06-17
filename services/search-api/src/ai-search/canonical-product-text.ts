import { createHash } from "node:crypto";
import type { ProductDocument } from "@retailer-search/shared-types";

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(String).join(" ");
  }
  return undefined;
}

/** Build canonical text-only representation for embedding generation. */
export function buildCanonicalProductText(product: ProductDocument): string {
  const attributeParts = Object.entries(product.attributes ?? {})
    .map(([key, value]) => {
      const rendered = asString(value);
      return rendered ? `${key}: ${rendered}` : undefined;
    })
    .filter(Boolean);

  const aiSearchBlurb = asString(product.attributes?.aiSearchBlurb);
  const bullets = asString(product.attributes?.shortDescription);
  const longDescription =
    asString(product.attributes?.longDescription) ?? product.description?.trim();
  const useCases = product.attributes?.useCases;
  const searchCriteria = product.attributes?.searchCriteria;
  const keywords = product.attributes?.keywords;

  return [
    product.title,
    product.brand ? `Brand: ${product.brand}` : undefined,
    product.category
      ? `Category: ${product.category}${product.subcategory ? ` > ${product.subcategory}` : ""}`
      : undefined,
    aiSearchBlurb,
    bullets,
    longDescription,
    Array.isArray(keywords) && keywords.length > 0
      ? `Keywords: ${keywords.map(String).join(", ")}`
      : undefined,
    Array.isArray(useCases) && useCases.length > 0
      ? `Use cases: ${useCases.map(String).join(", ")}`
      : undefined,
    Array.isArray(searchCriteria) && searchCriteria.length > 0
      ? `Search criteria: ${searchCriteria.map(String).join(", ")}`
      : undefined,
    attributeParts.length > 0 ? attributeParts.join("; ") : undefined,
    product.inStock ? "in stock" : "out of stock",
  ]
    .filter(Boolean)
    .join("\n");
}

export function hashCanonicalText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
