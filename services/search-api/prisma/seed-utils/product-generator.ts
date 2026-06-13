import type { ProductDocument } from "@retailer-search/shared-types";
import {
  HOME_IMPROVEMENT_TAXONOMY,
  getLeafCategoryById,
  type LeafCategory,
} from "../seed-data/home-improvement-taxonomy.js";
import {
  pickBrandForLeaf,
  tierPriceMultiplier,
  type SyntheticBrand,
} from "../seed-data/brands.js";
import {
  HERO_PRODUCT_TEMPLATES,
  LEAF_SEARCH_KEYWORDS,
  VARIANT_FAMILY_TEMPLATES,
  type HeroProductTemplate,
  type VariantFamilyTemplate,
} from "../seed-data/product-templates.js";
import {
  createSeededRng,
  DEMO_RNG_SEED,
  formatMoney,
  isoDateDaysAgo,
  seedId,
  slugify,
  type SeededRng,
} from "./random.js";

export const TARGET_PRODUCT_COUNT = 1000;

export interface GeneratedCatalog {
  products: ProductDocument[];
  heroCount: number;
  variantProductCount: number;
  simpleProductCount: number;
  variantGroupCount: number;
}

interface InternalProduct extends ProductDocument {
  attributes: ProductDocument["attributes"] & {
    slug: string;
    shortDescription: string;
    longDescription: string;
    productGroupId?: string;
    inventoryStatus: string;
    popularityScore: number;
    compareAtPrice?: number;
    keywords: string[];
    department: string;
    productType: string;
    isHero?: boolean;
    isContractorGrade?: boolean;
    isSeasonal?: boolean;
    shippingClass: string;
    fulfillmentPickup: boolean;
    fulfillmentDelivery: boolean;
    reviewCount: number;
    rating: number;
  };
}

const TITLE_ADJECTIVES = [
  "Heavy-Duty",
  "Professional",
  "Compact",
  "Premium",
  "Essential",
  "Contractor",
  "All-Purpose",
  "Performance",
  "Pro-Series",
  "Everyday",
];

const TITLE_DESCRIPTORS = [
  "Kit",
  "Set",
  "Pack",
  "System",
  "Bundle",
  "Value",
  "Select",
  "Series",
];

function placeholderImageUrl(seed: string): string {
  return `https://placehold.co/640x640/png?text=${encodeURIComponent(seed.slice(0, 24))}`;
}

function inventoryFromStatus(
  status: "in_stock" | "low_stock" | "out_of_stock",
  rng: SeededRng,
): number {
  switch (status) {
    case "in_stock":
      return rng.int(25, 240);
    case "low_stock":
      return rng.int(3, 18);
    case "out_of_stock":
      return 0;
  }
}

function pickInventoryStatus(rng: SeededRng): "in_stock" | "low_stock" | "out_of_stock" {
  return rng.weightedPick(
    ["in_stock", "low_stock", "out_of_stock"],
    [70, 20, 10],
  );
}

function buildSku(leaf: LeafCategory, index: number, variantSuffix = ""): string {
  const leafCode = leaf.id.replace("leaf-", "").slice(0, 8).toUpperCase();
  const suffix = variantSuffix ? `-${slugify(variantSuffix).slice(0, 8).toUpperCase()}` : "";
  return `SKU-${leafCode}-${String(index).padStart(5, "0")}${suffix}`;
}

function ratingForPopularity(popularity: number, rng: SeededRng): number {
  const base = 3.6 + (popularity / 100) * 1.2;
  return Math.min(5, Math.round((base + rng.float(-0.2, 0.2)) * 10) / 10);
}

function reviewCountForPopularity(popularity: number, rng: SeededRng): number {
  return Math.max(3, Math.round(popularity * rng.float(1.2, 4.8)));
}

function shippingClassForLeaf(leaf: LeafCategory): string {
  if (leaf.department.includes("Lumber") || leaf.department.includes("Building")) {
    return "oversized";
  }
  if (leaf.department === "Appliances" || leaf.department.includes("Outdoor Power")) {
    return "freight_candidate";
  }
  return "standard";
}

function mapHeroToProduct(hero: HeroProductTemplate, rng: SeededRng): InternalProduct {
  const leaf = getLeafCategoryById(hero.leafId);
  if (!leaf) {
    throw new Error(`Hero references unknown leaf ${hero.leafId}`);
  }

  const createdAt = isoDateDaysAgo(rng, 540);
  const slug = slugify(hero.title);
  const inStock = hero.inventoryStatus !== "out_of_stock" && hero.inventory > 0;

  return {
    id: hero.id,
    sku: buildSku(leaf, Number(hero.id.replace("prod-hero-", ""))),
    title: hero.title,
    brand: hero.brand,
    category: leaf.department,
    subcategory: leaf.subcategory,
    description: hero.longDescription,
    price: hero.price,
    inventory: hero.inventory,
    inStock,
    imageUrl: placeholderImageUrl(hero.id),
    createdAt,
    updatedAt: createdAt,
    attributes: {
      ...hero.specs,
      slug,
      shortDescription: hero.shortDescription,
      longDescription: hero.longDescription,
      inventoryStatus: hero.inventoryStatus,
      popularityScore: hero.popularityScore,
      compareAtPrice: hero.compareAtPrice,
      keywords: hero.keywords,
      department: leaf.department,
      productType: leaf.productType,
      isHero: true,
      isContractorGrade: hero.isContractorGrade ?? leaf.contractorOriented ?? false,
      isSeasonal: hero.isSeasonal ?? leaf.seasonal ?? false,
      shippingClass: shippingClassForLeaf(leaf),
      fulfillmentPickup: true,
      fulfillmentDelivery: rng.bool(0.65),
      reviewCount: reviewCountForPopularity(hero.popularityScore, rng),
      rating: ratingForPopularity(hero.popularityScore, rng),
    },
  };
}

function mapVariantProduct(input: {
  leaf: LeafCategory;
  brand: SyntheticBrand;
  family: VariantFamilyTemplate;
  variantIndex: number;
  productIndex: number;
  suffix: string;
  specs: Record<string, string | number | boolean>;
  price: number;
  inventoryStatus: "in_stock" | "low_stock" | "out_of_stock";
  inventory: number;
  popularityScore: number;
  rng: SeededRng;
}): InternalProduct {
  const title = `${input.family.baseTitle} - ${input.suffix}`;
  const slug = slugify(title);
  const createdAt = isoDateDaysAgo(input.rng, 720);
  const inStock = input.inventoryStatus !== "out_of_stock" && input.inventory > 0;

  return {
    id: seedId("prod", input.productIndex),
    sku: buildSku(input.leaf, input.productIndex, input.suffix),
    title,
    brand: input.family.brand,
    category: input.leaf.department,
    subcategory: input.leaf.subcategory,
    description: `${input.family.description} Selected option: ${input.suffix}.`,
    price: input.price,
    inventory: input.inventory,
    inStock,
    imageUrl: placeholderImageUrl(`${input.family.id}-${input.variantIndex}`),
    createdAt,
    updatedAt: createdAt,
    attributes: {
      ...input.specs,
      slug,
      shortDescription: input.family.description,
      longDescription: `${input.family.description} Available configuration: ${input.suffix}.`,
      productGroupId: input.family.id,
      inventoryStatus: input.inventoryStatus,
      popularityScore: input.popularityScore,
      keywords: input.family.keywords,
      department: input.leaf.department,
      productType: input.leaf.productType,
      isContractorGrade: input.leaf.contractorOriented ?? false,
      isSeasonal: input.leaf.seasonal ?? false,
      shippingClass: shippingClassForLeaf(input.leaf),
      fulfillmentPickup: true,
      fulfillmentDelivery: input.rng.bool(0.55),
      reviewCount: reviewCountForPopularity(input.popularityScore, input.rng),
      rating: ratingForPopularity(input.popularityScore, input.rng),
    },
  };
}

function mapSimpleProduct(input: {
  leaf: LeafCategory;
  brand: SyntheticBrand;
  productIndex: number;
  rng: SeededRng;
}): InternalProduct {
  const adjective = input.rng.pick(TITLE_ADJECTIVES);
  const descriptor = input.rng.pick(TITLE_DESCRIPTORS);
  const title = `${input.brand.name} ${adjective} ${input.leaf.productType} ${descriptor}`;
  const slug = slugify(title);
  const inventoryStatus = pickInventoryStatus(input.rng);
  const inventory = inventoryFromStatus(inventoryStatus, input.rng);
  const inStock = inventoryStatus !== "out_of_stock" && inventory > 0;
  const popularityScore = input.rng.int(35, 88);
  const basePrice =
    input.rng.float(input.leaf.priceRange[0], input.leaf.priceRange[1]) *
    tierPriceMultiplier(input.brand.tier);
  const price = formatMoney(basePrice);
  const createdAt = isoDateDaysAgo(input.rng, 900);
  const keywords = [
    input.leaf.productType.toLowerCase(),
    input.leaf.subcategory.toLowerCase(),
    input.brand.name.toLowerCase(),
    ...(LEAF_SEARCH_KEYWORDS[input.leaf.id] ?? []),
  ];

  return {
    id: seedId("prod", input.productIndex),
    sku: buildSku(input.leaf, input.productIndex),
    title,
    brand: input.brand.name,
    category: input.leaf.department,
    subcategory: input.leaf.subcategory,
    description: `${title} is built for ${input.leaf.diyFriendly ? "DIY homeowners" : "professional trade use"} in ${input.leaf.subcategory.toLowerCase()} projects.`,
    price,
    inventory,
    inStock,
    imageUrl: placeholderImageUrl(`simple-${input.productIndex}`),
    createdAt,
    updatedAt: createdAt,
    attributes: {
      slug,
      shortDescription: `${input.brand.name} ${input.leaf.productType} for ${input.leaf.subcategory.toLowerCase()}.`,
      longDescription: `Reliable ${input.leaf.productType.toLowerCase()} from ${input.brand.name} with category-specific specs for ${input.leaf.department.toLowerCase()} applications.`,
      inventoryStatus,
      popularityScore,
      keywords,
      department: input.leaf.department,
      productType: input.leaf.productType,
      isContractorGrade: input.leaf.contractorOriented ?? false,
      isSeasonal: input.leaf.seasonal ?? false,
      shippingClass: shippingClassForLeaf(input.leaf),
      fulfillmentPickup: true,
      fulfillmentDelivery: input.rng.bool(0.5),
      reviewCount: reviewCountForPopularity(popularityScore, input.rng),
      rating: ratingForPopularity(popularityScore, input.rng),
      audience: input.leaf.contractorOriented ? "contractor" : "consumer",
    },
  };
}

function expandVariantFamilies(
  rng: SeededRng,
  startIndex: number,
  targetVariantProducts: number,
): { products: InternalProduct[]; nextIndex: number } {
  const products: InternalProduct[] = [];
  let productIndex = startIndex;
  let generated = 0;
  let familyCursor = 0;

  while (generated < targetVariantProducts) {
    const family = VARIANT_FAMILY_TEMPLATES[familyCursor % VARIANT_FAMILY_TEMPLATES.length]!;
    const leaf = getLeafCategoryById(family.leafId);
    if (!leaf) {
      familyCursor += 1;
      continue;
    }

    const brand = pickBrandForLeaf(leaf.id, (items) => rng.pick(items));
    const basePrice =
      rng.float(leaf.priceRange[0], leaf.priceRange[1]) * tierPriceMultiplier(brand.tier);

    for (const [variantIndex, variant] of family.variants.entries()) {
      if (generated >= targetVariantProducts) {
        break;
      }

      const inventoryStatus = pickInventoryStatus(rng);
      const inventory =
        inventoryStatus === "out_of_stock"
          ? 0
          : Math.max(1, Math.round(inventoryFromStatus(inventoryStatus, rng) * variant.inventoryWeight * 0.35));

      products.push(
        mapVariantProduct({
          leaf,
          brand,
          family,
          variantIndex,
          productIndex,
          suffix: variant.suffix,
          specs: variant.specs,
          price: formatMoney(basePrice * variant.priceMultiplier),
          inventoryStatus,
          inventory,
          popularityScore: rng.int(45, 92),
          rng,
        }),
      );

      productIndex += 1;
      generated += 1;
    }

    familyCursor += 1;
  }

  return { products, nextIndex: productIndex };
}

function generateSimpleProducts(
  rng: SeededRng,
  startIndex: number,
  targetSimpleProducts: number,
): { products: InternalProduct[]; nextIndex: number } {
  const products: InternalProduct[] = [];
  let productIndex = startIndex;
  const leaves = rng.shuffle(HOME_IMPROVEMENT_TAXONOMY);

  for (let count = 0; count < targetSimpleProducts; count += 1) {
    const leaf = leaves[count % leaves.length]!;
    const brand = pickBrandForLeaf(leaf.id, (items) => rng.pick(items));
    products.push(
      mapSimpleProduct({
        leaf,
        brand,
        productIndex,
        rng,
      }),
    );
    productIndex += 1;
  }

  return { products, nextIndex: productIndex };
}

export function generateProductCatalog(
  seed: number = DEMO_RNG_SEED,
): GeneratedCatalog {
  const rng = createSeededRng(seed);
  const heroes = HERO_PRODUCT_TEMPLATES.map((hero) => mapHeroToProduct(hero, rng));

  const remaining = TARGET_PRODUCT_COUNT - heroes.length;
  const targetVariantProducts = Math.round(remaining * 0.35);
  const targetSimpleProducts = remaining - targetVariantProducts;

  let nextIndex = heroes.length + 1;
  const variantResult = expandVariantFamilies(rng, nextIndex, targetVariantProducts);
  nextIndex = variantResult.nextIndex;

  const simpleResult = generateSimpleProducts(rng, nextIndex, targetSimpleProducts);

  const products = [...heroes, ...variantResult.products, ...simpleResult.products].slice(
    0,
    TARGET_PRODUCT_COUNT,
  );

  return {
    products,
    heroCount: heroes.length,
    variantProductCount: variantResult.products.length,
    simpleProductCount: simpleResult.products.length,
    variantGroupCount: VARIANT_FAMILY_TEMPLATES.length,
  };
}

export function summarizeCatalog(catalog: GeneratedCatalog): Record<string, number> {
  const inStock = catalog.products.filter((product) => product.inStock).length;
  const outOfStock = catalog.products.length - inStock;
  const brands = new Set(catalog.products.map((product) => product.brand)).size;
  const categories = new Set(catalog.products.map((product) => product.category)).size;

  return {
    products: catalog.products.length,
    heroes: catalog.heroCount,
    variantProducts: catalog.variantProductCount,
    simpleProducts: catalog.simpleProductCount,
    variantGroups: catalog.variantGroupCount,
    inStock,
    outOfStock,
    brands,
    categories,
  };
}
