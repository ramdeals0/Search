import type { BrandTier } from "../seed-data/brands.js";
import { SYNTHETIC_BRANDS } from "../seed-data/brands.js";
import type { LeafCategory } from "../seed-data/home-improvement-taxonomy.js";
import type { SyntheticBrand } from "../seed-data/brands.js";
import { formatMoney, type SeededRng } from "./random.js";

export interface ProductProfitMetrics {
  unitCost: number;
  profitMarginPercent: number;
}

function tierBaseMargin(tier: BrandTier): number {
  switch (tier) {
    case "value":
      return 24;
    case "premium":
      return 42;
    default:
      return 33;
  }
}

export function resolveBrandTier(brandName: string): BrandTier {
  return SYNTHETIC_BRANDS.find((brand) => brand.name === brandName)?.tier ?? "mid";
}

export function generateProfitMetrics(input: {
  price: number;
  brand: SyntheticBrand | { name: string; tier?: BrandTier };
  leaf: LeafCategory;
  rng: SeededRng;
}): ProductProfitMetrics {
  const tier = input.brand.tier ?? resolveBrandTier(input.brand.name);
  const categoryAdjust = input.leaf.contractorOriented ? -3 : 2;
  const seasonalAdjust = input.leaf.seasonal ? 1.5 : 0;
  const marginPercent = Math.min(
    58,
    Math.max(
      12,
      tierBaseMargin(tier) + categoryAdjust + seasonalAdjust + input.rng.float(-6, 6),
    ),
  );
  const roundedMargin = Math.round(marginPercent * 10) / 10;
  const unitCost = formatMoney(input.price * (1 - roundedMargin / 100));

  return {
    unitCost,
    profitMarginPercent: roundedMargin,
  };
}
