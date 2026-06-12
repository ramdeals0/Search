export type BrandTier = "value" | "mid" | "premium";

export interface SyntheticBrand {
  name: string;
  tier: BrandTier;
  affinities: string[];
}

export const SYNTHETIC_BRANDS: SyntheticBrand[] = [
  { name: "RidgeLine Tools", tier: "mid", affinities: ["leaf-cordless-drills", "leaf-impact-drivers", "leaf-circular-saws", "leaf-hammers", "leaf-screwdriver-sets"] },
  { name: "IronPeak", tier: "premium", affinities: ["leaf-cordless-drills", "leaf-circular-saws", "leaf-shop-vacs", "leaf-socket-sets"] },
  { name: "BlueForge", tier: "mid", affinities: ["leaf-hammers", "leaf-screwdriver-sets", "leaf-socket-sets", "leaf-fasteners"] },
  { name: "NorthTrail", tier: "value", affinities: ["leaf-hammers", "leaf-screwdriver-sets", "leaf-work-gloves"] },
  { name: "Summit Electric", tier: "mid", affinities: ["leaf-gfci-outlets", "leaf-breaker-panels", "leaf-extension-cords", "leaf-led-bulbs"] },
  { name: "EverVolt", tier: "premium", affinities: ["leaf-gfci-outlets", "leaf-extension-cords", "leaf-shop-lights", "leaf-smart-thermostats"] },
  { name: "CedarWorks", tier: "mid", affinities: ["leaf-dimension-lumber", "leaf-plywood", "leaf-storage-racks"] },
  { name: "StoneMill Home", tier: "mid", affinities: ["leaf-kitchen-faucets", "leaf-kitchen-sinks", "leaf-bath-vanities"] },
  { name: "PrimeFlow", tier: "premium", affinities: ["leaf-kitchen-faucets", "leaf-toilet-parts", "leaf-pvc-fittings"] },
  { name: "OakRiver", tier: "value", affinities: ["leaf-mulch", "leaf-string-trimmers", "leaf-lawn-mowers"] },
  { name: "HarborForge", tier: "mid", affinities: ["leaf-pressure-washers", "leaf-shop-vacs", "leaf-storage-racks"] },
  { name: "BrightSpan Lighting", tier: "mid", affinities: ["leaf-ceiling-fans", "leaf-led-bulbs", "leaf-shop-lights"] },
  { name: "TrueCoat Paints", tier: "mid", affinities: ["leaf-interior-paint", "leaf-exterior-paint", "leaf-primer"] },
  { name: "ApexCoat", tier: "premium", affinities: ["leaf-interior-paint", "leaf-exterior-paint", "leaf-primer"] },
  { name: "GridStone Flooring", tier: "mid", affinities: ["leaf-vinyl-flooring"] },
  { name: "ColdFront HVAC", tier: "mid", affinities: ["leaf-portable-ac", "leaf-smoke-detectors"] },
  { name: "GuardRail Safety", tier: "value", affinities: ["leaf-work-gloves", "leaf-safety-glasses"] },
  { name: "CopperCreek Plumbing", tier: "mid", affinities: ["leaf-kitchen-faucets", "leaf-pvc-fittings", "leaf-toilet-parts"] },
  { name: "Redwood Supply", tier: "value", affinities: ["leaf-dimension-lumber", "leaf-plywood", "leaf-drywall"] },
  { name: "BuildCore Materials", tier: "mid", affinities: ["leaf-drywall", "leaf-insulation", "leaf-fasteners"] },
  { name: "AnchorPro", tier: "value", affinities: ["leaf-anchors", "leaf-fasteners", "leaf-drywall"] },
  { name: "VoltWorks", tier: "premium", affinities: ["leaf-breaker-panels", "leaf-gfci-outlets"] },
  { name: "TrailBlade Outdoor", tier: "mid", affinities: ["leaf-string-trimmers", "leaf-lawn-mowers", "leaf-pressure-washers"] },
  { name: "GreenHaven Garden", tier: "value", affinities: ["leaf-mulch", "leaf-string-trimmers"] },
  { name: "StudioKitchen", tier: "premium", affinities: ["leaf-kitchen-sinks", "leaf-kitchen-faucets", "leaf-bath-vanities"] },
  { name: "HomePulse Smart", tier: "premium", affinities: ["leaf-smart-thermostats", "leaf-smoke-detectors"] },
  { name: "SteelRiver Fasteners", tier: "value", affinities: ["leaf-fasteners", "leaf-anchors"] },
  { name: "ProSaw Industrial", tier: "premium", affinities: ["leaf-circular-saws", "leaf-cordless-drills"] },
  { name: "ClearView Safety", tier: "mid", affinities: ["leaf-safety-glasses", "leaf-work-gloves"] },
  { name: "TitanGrip", tier: "mid", affinities: ["leaf-work-gloves", "leaf-hammers"] },
  { name: "LumenPath", tier: "value", affinities: ["leaf-led-bulbs", "leaf-shop-lights"] },
  { name: "AirStream Comfort", tier: "mid", affinities: ["leaf-ceiling-fans", "leaf-portable-ac"] },
  { name: "FreshCoat Studio", tier: "value", affinities: ["leaf-interior-paint", "leaf-primer"] },
  { name: "WeatherShield Coatings", tier: "premium", affinities: ["leaf-exterior-paint", "leaf-primer"] },
  { name: "PipeLine Essentials", tier: "value", affinities: ["leaf-pvc-fittings", "leaf-toilet-parts"] },
  { name: "FlowMaster Bath", tier: "mid", affinities: ["leaf-bath-vanities", "leaf-kitchen-faucets"] },
  { name: "PantryFresh Appliances", tier: "mid", affinities: ["leaf-refrigerators"] },
  { name: "IceBox Pro", tier: "premium", affinities: ["leaf-refrigerators"] },
  { name: "TurboClean Outdoor", tier: "mid", affinities: ["leaf-pressure-washers", "leaf-shop-vacs"] },
  { name: "EcoTrim Power", tier: "premium", affinities: ["leaf-string-trimmers", "leaf-lawn-mowers"] },
  { name: "ShelfLogic", tier: "value", affinities: ["leaf-storage-racks"] },
  { name: "GarageGrid", tier: "mid", affinities: ["leaf-storage-racks"] },
  { name: "ThermoLink", tier: "mid", affinities: ["leaf-smart-thermostats"] },
  { name: "SparkSafe", tier: "value", affinities: ["leaf-smoke-detectors", "leaf-gfci-outlets"] },
  { name: "CircuitCraft", tier: "mid", affinities: ["leaf-breaker-panels", "leaf-extension-cords"] },
  { name: "PowerReach Cords", tier: "value", affinities: ["leaf-extension-cords"] },
  { name: "BladeRunner Saws", tier: "mid", affinities: ["leaf-circular-saws"] },
  { name: "TorqueLine Drivers", tier: "mid", affinities: ["leaf-impact-drivers", "leaf-cordless-drills"] },
  { name: "PrecisionMechanic", tier: "premium", affinities: ["leaf-socket-sets"] },
  { name: "DrywallDirect", tier: "value", affinities: ["leaf-drywall", "leaf-fasteners"] },
  { name: "InsulGuard", tier: "mid", affinities: ["leaf-insulation"] },
  { name: "PlankHaus Flooring", tier: "premium", affinities: ["leaf-vinyl-flooring"] },
  { name: "QuickMount Hardware", tier: "value", affinities: ["leaf-anchors"] },
  { name: "FanCraft Air", tier: "mid", affinities: ["leaf-ceiling-fans"] },
  { name: "GlowWorks Bulbs", tier: "value", affinities: ["leaf-led-bulbs"] },
  { name: "BenchBright", tier: "mid", affinities: ["leaf-shop-lights"] },
  { name: "MulchMate", tier: "value", affinities: ["leaf-mulch"] },
  { name: "YardForce", tier: "mid", affinities: ["leaf-lawn-mowers", "leaf-mulch"] },
  { name: "WashWorks", tier: "premium", affinities: ["leaf-pressure-washers"] },
  { name: "TrimLine Garden", tier: "value", affinities: ["leaf-string-trimmers"] },
  { name: "HammerHaus", tier: "value", affinities: ["leaf-hammers"] },
  { name: "DriverDock", tier: "mid", affinities: ["leaf-screwdriver-sets"] },
  { name: "StudPro Lumber", tier: "mid", affinities: ["leaf-dimension-lumber"] },
  { name: "PanelCraft", tier: "value", affinities: ["leaf-plywood"] },
  { name: "AquaRoute", tier: "premium", affinities: ["leaf-kitchen-faucets", "leaf-pvc-fittings"] },
  { name: "VanityWorks", tier: "mid", affinities: ["leaf-bath-vanities"] },
  { name: "SinkStone", tier: "mid", affinities: ["leaf-kitchen-sinks"] },
  { name: "CoolBreeze Portable", tier: "value", affinities: ["leaf-portable-ac"] },
  { name: "SafeHome Detect", tier: "mid", affinities: ["leaf-smoke-detectors"] },
  { name: "BrushWorks Paint", tier: "value", affinities: ["leaf-interior-paint"] },
  { name: "ContractorSelect", tier: "premium", affinities: ["leaf-dimension-lumber", "leaf-drywall", "leaf-insulation", "leaf-fasteners"] },
  { name: "WeekendDIY", tier: "value", affinities: ["leaf-hammers", "leaf-primer", "leaf-led-bulbs", "leaf-mulch"] },
  { name: "ProGrade Tools", tier: "premium", affinities: ["leaf-cordless-drills", "leaf-impact-drivers", "leaf-shop-vacs"] },
  { name: "Zenith Workshop", tier: "mid", affinities: ["leaf-shop-vacs", "leaf-shop-lights", "leaf-storage-racks"] },
  { name: "RiverStone Bath", tier: "premium", affinities: ["leaf-bath-vanities", "leaf-kitchen-faucets"] },
  { name: "BrightNest Smart", tier: "mid", affinities: ["leaf-smart-thermostats", "leaf-led-bulbs"] },
  { name: "ForgeLine Impact", tier: "mid", affinities: ["leaf-impact-drivers"] },
  { name: "TimberCore", tier: "value", affinities: ["leaf-dimension-lumber", "leaf-plywood"] },
  { name: "SealTight Plumbing", tier: "mid", affinities: ["leaf-toilet-parts", "leaf-pvc-fittings"] },
  { name: "OutletWorks", tier: "value", affinities: ["leaf-gfci-outlets"] },
  { name: "LoadCenter Pro", tier: "premium", affinities: ["leaf-breaker-panels"] },
  { name: "GardenPro Seasonal", tier: "mid", affinities: ["leaf-mulch", "leaf-string-trimmers", "leaf-lawn-mowers"] },
  { name: "CleanSweep Vac", tier: "value", affinities: ["leaf-shop-vacs"] },
  { name: "PaintPro Contractor", tier: "premium", affinities: ["leaf-interior-paint", "leaf-exterior-paint"] },
  { name: "FloorCraft LVP", tier: "mid", affinities: ["leaf-vinyl-flooring"] },
  { name: "KitchenCraft Select", tier: "mid", affinities: ["leaf-kitchen-sinks", "leaf-kitchen-faucets"] },
  { name: "AllSeason HVAC", tier: "value", affinities: ["leaf-portable-ac", "leaf-ceiling-fans"] },
  { name: "RapidDrive Tools", tier: "mid", affinities: ["leaf-cordless-drills", "leaf-screwdriver-sets"] },
  { name: "GripSafe Workwear", tier: "value", affinities: ["leaf-work-gloves", "leaf-safety-glasses"] },
];

export function pickBrandForLeaf(
  leafId: string,
  rngPick: <T>(items: readonly T[]) => T,
): SyntheticBrand {
  const matches = SYNTHETIC_BRANDS.filter((brand) => brand.affinities.includes(leafId));
  if (matches.length > 0) {
    return rngPick(matches);
  }
  return rngPick(SYNTHETIC_BRANDS);
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
