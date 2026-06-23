import type { BrandTier, SyntheticBrand } from "./brands.js";
import { SYNTHETIC_BRANDS } from "./brands.js";

/** National and Fleet Farm exclusive brands carried at FleetFarm.com. */
export const FLEET_FARM_EXCLUSIVE_BRANDS: SyntheticBrand[] = [
  { name: "Fleet Farm", tier: "value", affinities: ["leaf-ff-fleet-farm-exclusive", "leaf-ff-wild-bird-seed", "leaf-ff-hay-bales"] },
  { name: "Carhartt", tier: "premium", affinities: ["leaf-ff-carhartt-jacket", "leaf-ff-work-boots", "leaf-ff-jeans", "leaf-ff-winter-gloves"] },
  { name: "Purina", tier: "mid", affinities: ["leaf-ff-dog-food", "leaf-ff-cat-food", "leaf-ff-poultry-feed", "leaf-ff-horse-feed", "leaf-ff-cattle-feed"] },
  { name: "Red Lake", tier: "value", affinities: ["leaf-ff-wild-bird-seed", "leaf-ff-deer-attractant"] },
  { name: "Vortex", tier: "premium", affinities: ["leaf-ff-rifle-scopes", "leaf-ff-binoculars"] },
  { name: "Yeti", tier: "premium", affinities: ["leaf-ff-yeti-cooler"] },
  { name: "Shimano", tier: "premium", affinities: ["leaf-ff-fishing-reels", "leaf-ff-fishing-rods"] },
  { name: "Berkley", tier: "mid", affinities: ["leaf-ff-fishing-line", "leaf-ff-live-bait"] },
  { name: "Plano", tier: "mid", affinities: ["leaf-ff-tackle-boxes"] },
  { name: "Mobil 1", tier: "premium", affinities: ["leaf-ff-motor-oil"] },
  { name: "Interstate Batteries", tier: "mid", affinities: ["leaf-ff-farm-batteries"] },
  { name: "Michelin", tier: "premium", affinities: ["leaf-ff-tire-chains"] },
  { name: "Reese", tier: "mid", affinities: ["leaf-ff-trailer-hitches"] },
  { name: "Winchester", tier: "mid", affinities: ["leaf-ff-ammo-storage", "leaf-ff-shooting-safety"] },
  { name: "Howard Leight", tier: "mid", affinities: ["leaf-ff-shooting-safety"] },
  { name: "Browning Trail Cameras", tier: "mid", affinities: ["leaf-ff-game-cameras"] },
  { name: "Morrell Targets", tier: "value", affinities: ["leaf-ff-archery-targets"] },
  { name: "Jack Link's", tier: "mid", affinities: ["leaf-ff-snacks"] },
  { name: "Wrangler", tier: "mid", affinities: ["leaf-ff-jeans", "leaf-ff-base-layers"] },
  { name: "Wolverine", tier: "premium", affinities: ["leaf-ff-work-boots"] },
  { name: "Toro", tier: "premium", affinities: ["leaf-ff-snow-blower", "leaf-ff-lawn-mowers"] },
  { name: "Husqvarna", tier: "premium", affinities: ["leaf-ff-chainsaw", "leaf-ff-string-trimmers"] },
  { name: "Behlen", tier: "mid", affinities: ["leaf-ff-farm-gates", "leaf-ff-livestock-fencing"] },
  { name: "Nutrena", tier: "mid", affinities: ["leaf-ff-horse-feed", "leaf-ff-cattle-feed"] },
  { name: "Blue Seal", tier: "mid", affinities: ["leaf-ff-poultry-feed"] },
];

export const FLEET_FARM_BRANDS: SyntheticBrand[] = [
  ...SYNTHETIC_BRANDS,
  ...FLEET_FARM_EXCLUSIVE_BRANDS.filter(
    (brand) => !SYNTHETIC_BRANDS.some((existing) => existing.name === brand.name),
  ),
];

export function pickFleetFarmBrand(
  leafId: string,
  rngPick: <T>(items: readonly T[]) => T,
): SyntheticBrand {
  const matches = FLEET_FARM_BRANDS.filter((brand) => brand.affinities.includes(leafId));
  if (matches.length > 0) {
    return rngPick(matches);
  }
  return rngPick(FLEET_FARM_BRANDS);
}

export function tierPriceMultiplier(tier: BrandTier): number {
  switch (tier) {
    case "value":
      return 0.85;
    case "mid":
      return 1;
    case "premium":
      return 1.25;
  }
}
