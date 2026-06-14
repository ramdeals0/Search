export type LuxuryBrandTier = "maison" | "contemporary" | "accessories";

export interface LuxuryBrand {
  id: string;
  name: string;
  tier: LuxuryBrandTier;
  departments: string[];
}

export const LUXURY_BRANDS: LuxuryBrand[] = [
  { id: "lux-brand-gucci", name: "Gucci", tier: "maison", departments: ["Women", "Men", "Accessories"] },
  { id: "lux-brand-prada", name: "Prada", tier: "maison", departments: ["Women", "Men", "Accessories"] },
  { id: "lux-brand-burberry", name: "Burberry", tier: "maison", departments: ["Women", "Men", "Accessories"] },
  { id: "lux-brand-dior", name: "Dior", tier: "maison", departments: ["Women", "Men", "Accessories"] },
  { id: "lux-brand-saint-laurent", name: "Saint Laurent", tier: "maison", departments: ["Women", "Men", "Accessories"] },
  { id: "lux-brand-valentino", name: "Valentino", tier: "maison", departments: ["Women", "Men", "Accessories"] },
  { id: "lux-brand-bottega-veneta", name: "Bottega Veneta", tier: "maison", departments: ["Women", "Men", "Accessories"] },
  { id: "lux-brand-hermes", name: "Hermès", tier: "maison", departments: ["Women", "Men", "Accessories"] },
  { id: "lux-brand-loewe", name: "Loewe", tier: "contemporary", departments: ["Women", "Men", "Accessories"] },
  { id: "lux-brand-balenciaga", name: "Balenciaga", tier: "contemporary", departments: ["Women", "Men", "Accessories"] },
  { id: "lux-brand-moncler", name: "Moncler", tier: "contemporary", departments: ["Women", "Men"] },
  { id: "lux-brand-max-mara", name: "Max Mara", tier: "contemporary", departments: ["Women"] },
  { id: "lux-brand-the-row", name: "The Row", tier: "contemporary", departments: ["Women", "Men"] },
  { id: "lux-brand-cartier", name: "Cartier", tier: "accessories", departments: ["Accessories"] },
  { id: "lux-brand-tiffany", name: "Tiffany & Co.", tier: "accessories", departments: ["Accessories"] },
  { id: "lux-brand-chloe", name: "Chloé", tier: "contemporary", departments: ["Women", "Accessories"] },
];

export function pickLuxuryBrandForLeaf(
  leafId: string,
  department: string,
  pick: <T>(items: readonly T[]) => T,
): LuxuryBrand {
  void leafId;
  const eligible = LUXURY_BRANDS.filter((brand) => brand.departments.includes(department));
  const pool = eligible.length > 0 ? eligible : LUXURY_BRANDS;
  return pick(pool);
}

export function luxuryTierPriceMultiplier(tier: LuxuryBrandTier): number {
  switch (tier) {
    case "maison":
      return 1.35;
    case "contemporary":
      return 1.1;
    case "accessories":
      return 1.25;
  }
}
