import type { ProductDocument } from "@retailer-search/shared-types";

function readNumericAttribute(
  product: ProductDocument,
  key: "unitCost" | "profitMarginPercent",
): number | undefined {
  const value = product.attributes?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function resolveUnitCost(product: ProductDocument): number | undefined {
  if (typeof product.unitCost === "number" && Number.isFinite(product.unitCost)) {
    return product.unitCost;
  }
  return readNumericAttribute(product, "unitCost");
}

export function resolveProfitMarginPercent(product: ProductDocument): number | undefined {
  if (
    typeof product.profitMarginPercent === "number" &&
    Number.isFinite(product.profitMarginPercent)
  ) {
    return product.profitMarginPercent;
  }

  const attributeMargin = readNumericAttribute(product, "profitMarginPercent");
  if (attributeMargin !== undefined) {
    return attributeMargin;
  }

  const unitCost = resolveUnitCost(product);
  if (unitCost !== undefined && product.price > 0) {
    const margin = ((product.price - unitCost) / product.price) * 100;
    return Math.round(margin * 10) / 10;
  }

  return undefined;
}

/** Rewards in-stock items with healthy inventory depth (0-8). */
export function computeInventoryScore(product: ProductDocument): number {
  if (!product.inStock) {
    return 0;
  }
  return Math.min(product.inventory / 20, 8);
}

/** Rewards in-stock items with stronger unit economics (0-6). */
export function computeProfitMarginScore(product: ProductDocument): number {
  if (!product.inStock) {
    return 0;
  }

  const marginPercent = resolveProfitMarginPercent(product);
  if (marginPercent === undefined || marginPercent <= 0) {
    return 0;
  }

  return Math.min(6, (marginPercent / 50) * 6);
}

/** Combined commercial boost used by lexical and hybrid ranking (0-14). */
export function computeCommercialPriorityBoost(product: ProductDocument): number {
  return computeInventoryScore(product) + computeProfitMarginScore(product);
}
