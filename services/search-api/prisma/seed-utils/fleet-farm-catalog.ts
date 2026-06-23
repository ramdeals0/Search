import {
  FLEET_FARM_TAXONOMY,
  getFleetFarmLeafById,
} from "../seed-data/fleet-farm-taxonomy.js";
import {
  FLEET_FARM_HERO_TEMPLATES,
  FLEET_FARM_VARIANT_FAMILIES,
} from "../seed-data/fleet-farm-product-templates.js";
import { FLEET_FARM_BRANDS, pickFleetFarmBrand } from "../seed-data/fleet-farm-brands.js";
import {
  HERO_PRODUCT_TEMPLATES,
  VARIANT_FAMILY_TEMPLATES,
} from "../seed-data/product-templates.js";
import {
  generateProductCatalogFromConfig,
  type GeneratedCatalog,
  type ProductCatalogSeedConfig,
} from "./product-generator.js";
import { DEMO_RNG_SEED } from "./random.js";

export const FLEET_FARM_RETAILER = {
  name: "Fleet Farm",
  website: "https://www.fleetfarm.com",
  catalogLabel: "Fleet Farm Midwest retail assortment",
} as const;

export const FLEET_FARM_CATALOG_CONFIG: ProductCatalogSeedConfig = {
  taxonomy: FLEET_FARM_TAXONOMY,
  heroes: [...HERO_PRODUCT_TEMPLATES, ...FLEET_FARM_HERO_TEMPLATES],
  variantFamilies: [...VARIANT_FAMILY_TEMPLATES, ...FLEET_FARM_VARIANT_FAMILIES],
  pickBrand: pickFleetFarmBrand,
  getLeafById: getFleetFarmLeafById,
  retailer: FLEET_FARM_RETAILER,
};

export function readCatalogTheme(): "fleet-farm" | "home-improvement" {
  const raw = process.env.CATALOG_THEME?.trim().toLowerCase();
  if (raw === "home-improvement" || raw === "home" || raw === "homeimprovement") {
    return "home-improvement";
  }
  return "fleet-farm";
}

export function isFleetFarmCatalogTheme(): boolean {
  return readCatalogTheme() === "fleet-farm";
}

export function generateFleetFarmCatalog(seed: number = DEMO_RNG_SEED): GeneratedCatalog {
  return generateProductCatalogFromConfig(FLEET_FARM_CATALOG_CONFIG, seed);
}

export { FLEET_FARM_BRANDS, FLEET_FARM_TAXONOMY };
