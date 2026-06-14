import type { ProductDocument } from "@retailer-search/shared-types";
import {
  LUXURY_CLOTHING_TAXONOMY,
  getLuxuryLeafById,
  type LuxuryLeafCategory,
} from "../seed-data/luxury-clothing-taxonomy.js";
import {
  LUXURY_BRANDS,
  luxuryTierPriceMultiplier,
  pickLuxuryBrandForLeaf,
  type LuxuryBrand,
} from "../seed-data/luxury-brands.js";
import { LUXURY_CATALOG_ID } from "../../src/luxury-search-config.js";
import {
  createSeededRng,
  formatMoney,
  isoDateDaysAgo,
  slugify,
  type SeededRng,
} from "./random.js";

export const LUXURY_RNG_SEED = 20260616;
export const LUXURY_TARGET_PRODUCT_COUNT = readLuxuryTargetCount();

function readLuxuryTargetCount(): number {
  const raw = process.env.LUXURY_PRODUCT_COUNT ?? process.env.TARGET_PRODUCT_COUNT;
  if (!raw?.trim()) {
    return 6000;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6000;
}

export interface LuxuryHeroTemplate {
  id: string;
  leafId: string;
  brandName: string;
  title: string;
  description: string;
  price: number;
  keywords: string[];
}

export const LUXURY_HERO_TEMPLATES: LuxuryHeroTemplate[] = [
  {
    id: "lux-prod-hero-001",
    leafId: "lux-w-dresses",
    brandName: "Gucci",
    title: "Gucci Signature Silk Midi Dress",
    description: "Fluid silk midi dress with hand-finished seams and signature hardware.",
    price: 3890,
    keywords: ["silk dress", "designer dress", "evening"],
  },
  {
    id: "lux-prod-hero-002",
    leafId: "lux-w-outer",
    brandName: "Max Mara",
    title: "Max Mara Icon Cashmere Wrap Coat",
    description: "Double-faced cashmere coat with belted silhouette for cold-weather layering.",
    price: 4590,
    keywords: ["cashmere coat", "wool coat", "outerwear"],
  },
  {
    id: "lux-prod-hero-003",
    leafId: "lux-a-handbags",
    brandName: "Hermès",
    title: "Hermès Structured Leather Top-Handle Bag",
    description: "Hand-stitched calfskin top-handle bag with palladium hardware.",
    price: 6200,
    keywords: ["handbag", "leather", "top handle"],
  },
  {
    id: "lux-prod-hero-004",
    leafId: "lux-a-handbags",
    brandName: "Saint Laurent",
    title: "Saint Laurent Evening Clutch",
    description: "Compact lambskin clutch with chain strap for evening occasions.",
    price: 1890,
    keywords: ["purse", "clutch", "evening bag"],
  },
  {
    id: "lux-prod-hero-005",
    leafId: "lux-w-dresses",
    brandName: "Valentino",
    title: "Valentino Couture Evening Gown",
    description: "Floor-length evening gown with draped bodice and train detail.",
    price: 7800,
    keywords: ["evening gown", "formal dress", "gown"],
  },
  {
    id: "lux-prod-hero-006",
    leafId: "lux-a-watches",
    brandName: "Cartier",
    title: "Cartier Swiss Automatic Dress Watch",
    description: "Swiss automatic movement with sapphire crystal and alligator strap.",
    price: 12400,
    keywords: ["luxury watch", "swiss watch", "timepiece"],
  },
  {
    id: "lux-prod-hero-007",
    leafId: "lux-w-knit",
    brandName: "The Row",
    title: "The Row Pure Cashmere Crew Sweater",
    description: "Lightweight pure cashmere knit with relaxed tailored fit.",
    price: 1890,
    keywords: ["cashmere sweater", "cashmere knit", "knitwear"],
  },
  {
    id: "lux-prod-hero-008",
    leafId: "lux-a-sunglasses",
    brandName: "Bottega Veneta",
    title: "Bottega Veneta Acetate Sunglasses",
    description: "Bold acetate frame with UV-protective lenses and sculpted temples.",
    price: 520,
    keywords: ["designer eyewear", "sunglasses", "eyewear"],
  },
];

interface InternalLuxuryProduct extends ProductDocument {
  attributes: ProductDocument["attributes"] & {
    slug: string;
    shortDescription: string;
    longDescription: string;
    inventoryStatus: string;
    popularityScore: number;
    keywords: string[];
    department: string;
    productType: string;
    isHero?: boolean;
    shippingClass: string;
    fulfillmentPickup: boolean;
    fulfillmentDelivery: boolean;
    reviewCount: number;
    rating: number;
  };
}

function placeholderImageUrl(seed: string): string {
  return `https://placehold.co/640x640/png?text=${encodeURIComponent(seed.slice(0, 24))}`;
}

function inventoryFromStatus(
  status: "in_stock" | "low_stock" | "out_of_stock",
  rng: SeededRng,
): number {
  switch (status) {
    case "in_stock":
      return rng.int(8, 42);
    case "low_stock":
      return rng.int(1, 5);
    case "out_of_stock":
      return 0;
  }
}

function pickInventoryStatus(rng: SeededRng): "in_stock" | "low_stock" | "out_of_stock" {
  return rng.weightedPick(
    ["in_stock", "low_stock", "out_of_stock"],
    [0.82, 0.12, 0.06],
  );
}

function buildLuxurySku(index: number, suffix = ""): string {
  return `LUX-${String(index).padStart(6, "0")}${suffix ? `-${suffix}` : ""}`;
}

function mapHeroToProduct(hero: LuxuryHeroTemplate, rng: SeededRng): InternalLuxuryProduct {
  const leaf = getLuxuryLeafById(hero.leafId);
  if (!leaf) {
    throw new Error(`Unknown luxury leaf id: ${hero.leafId}`);
  }

  const inventoryStatus = pickInventoryStatus(rng);
  const inventory = inventoryFromStatus(inventoryStatus, rng);
  const inStock = inventoryStatus !== "out_of_stock" && inventory > 0;
  const createdAt = isoDateDaysAgo(rng, 180);
  const popularityScore = rng.int(78, 98);

  return {
    id: hero.id,
    sku: buildLuxurySku(1, hero.id.replace("lux-prod-hero-", "H")),
    title: hero.title,
    brand: hero.brandName,
    category: leaf.department,
    subcategory: leaf.subcategory,
    description: hero.description,
    price: formatMoney(hero.price),
    inventory,
    inStock,
    imageUrl: placeholderImageUrl(hero.id),
    catalogId: LUXURY_CATALOG_ID,
    createdAt,
    updatedAt: createdAt,
    attributes: {
      slug: slugify(hero.title),
      shortDescription: hero.description,
      longDescription: `${hero.description} Crafted for the ${leaf.department.toLowerCase()} collection.`,
      inventoryStatus,
      popularityScore,
      keywords: hero.keywords,
      department: leaf.department,
      productType: leaf.productType,
      isHero: true,
      shippingClass: "luxury",
      fulfillmentPickup: true,
      fulfillmentDelivery: rng.bool(0.92),
      reviewCount: rng.int(24, 180),
      rating: Math.round((4.2 + rng.float(0, 0.8)) * 10) / 10,
    },
  };
}

function mapSimpleLuxuryProduct(input: {
  leaf: LuxuryLeafCategory;
  brand: LuxuryBrand;
  productIndex: number;
  rng: SeededRng;
}): InternalLuxuryProduct {
  const adjectives = ["Heritage", "Signature", "Atelier", "Limited", "Essential", "Archive"];
  const title = `${input.brand.name} ${input.rng.pick(adjectives)} ${input.leaf.productType}`;
  const inventoryStatus = pickInventoryStatus(input.rng);
  const inventory = inventoryFromStatus(inventoryStatus, input.rng);
  const inStock = inventoryStatus !== "out_of_stock" && inventory > 0;
  const popularityScore = input.rng.int(40, 92);
  const basePrice =
    input.rng.float(input.leaf.priceRange[0], input.leaf.priceRange[1]) *
    luxuryTierPriceMultiplier(input.brand.tier);
  const price = formatMoney(basePrice);
  const createdAt = isoDateDaysAgo(input.rng, 540);
  const keywords = [
    input.leaf.productType.toLowerCase(),
    input.leaf.subcategory.toLowerCase(),
    input.brand.name.toLowerCase(),
    ...(input.leaf.keywords ?? []),
  ];

  return {
    id: `lux-prod-${String(input.productIndex).padStart(5, "0")}`,
    sku: buildLuxurySku(input.productIndex),
    title,
    brand: input.brand.name,
    category: input.leaf.department,
    subcategory: input.leaf.subcategory,
    description: `${title} from the ${input.leaf.department} ${input.leaf.subcategory} collection.`,
    price,
    inventory,
    inStock,
    imageUrl: placeholderImageUrl(`${input.brand.id}-${input.productIndex}`),
    catalogId: LUXURY_CATALOG_ID,
    createdAt,
    updatedAt: createdAt,
    attributes: {
      slug: slugify(title),
      shortDescription: `${input.brand.name} ${input.leaf.productType} in ${input.leaf.subcategory}.`,
      longDescription: `Premium ${input.leaf.productType.toLowerCase()} designed for modern luxury wardrobes.`,
      inventoryStatus,
      popularityScore,
      keywords,
      department: input.leaf.department,
      productType: input.leaf.productType,
      shippingClass: "luxury",
      fulfillmentPickup: true,
      fulfillmentDelivery: input.rng.bool(0.88),
      reviewCount: input.rng.int(3, 96),
      rating: Math.round((3.8 + input.rng.float(0, 1.1)) * 10) / 10,
    },
  };
}

export interface GeneratedLuxuryCatalog {
  products: ProductDocument[];
  heroCount: number;
  simpleProductCount: number;
}

export function generateLuxuryProductCatalog(
  seed: number = LUXURY_RNG_SEED,
  targetCount: number = LUXURY_TARGET_PRODUCT_COUNT,
): GeneratedLuxuryCatalog {
  const rng = createSeededRng(seed);
  const heroes = LUXURY_HERO_TEMPLATES.map((hero) => mapHeroToProduct(hero, rng));

  const remaining = Math.max(0, targetCount - heroes.length);
  const products: InternalLuxuryProduct[] = [...heroes];
  const leaves = rng.shuffle(LUXURY_CLOTHING_TAXONOMY);

  for (let count = 0; count < remaining; count += 1) {
    const leaf = leaves[count % leaves.length]!;
    const brand = pickLuxuryBrandForLeaf(leaf.id, leaf.department, (items) => rng.pick(items));
    products.push(
      mapSimpleLuxuryProduct({
        leaf,
        brand,
        productIndex: heroes.length + count + 1,
        rng,
      }),
    );
  }

  return {
    products: products.slice(0, targetCount),
    heroCount: heroes.length,
    simpleProductCount: Math.max(0, targetCount - heroes.length),
  };
}

export function summarizeLuxuryCatalog(catalog: GeneratedLuxuryCatalog): Record<string, number> {
  const inStock = catalog.products.filter((product) => product.inStock).length;
  return {
    products: catalog.products.length,
    heroes: catalog.heroCount,
    simpleProducts: catalog.simpleProductCount,
    inStock,
    outOfStock: catalog.products.length - inStock,
    brands: new Set(catalog.products.map((product) => product.brand)).size,
    categories: new Set(catalog.products.map((product) => product.category)).size,
  };
}

export { LUXURY_BRANDS, LUXURY_CLOTHING_TAXONOMY };
