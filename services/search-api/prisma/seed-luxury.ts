import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MerchandisingRule } from "@retailer-search/shared-types";
import { PrismaClient } from "@prisma/client";
import {
  buildDemoMerchandisingRules,
  buildSynonymMap,
} from "./seed-data/search-rules.js";
import {
  buildLuxuryMerchandisingRules,
  buildLuxurySynonymMap,
  getLuxuryRuleCounts,
  LUXURY_CATALOG_ID,
} from "../src/luxury-search-config.js";
import {
  generateLuxuryProductCatalog,
  LUXURY_RNG_SEED,
  LUXURY_TARGET_PRODUCT_COUNT,
  summarizeLuxuryCatalog,
} from "./seed-utils/luxury-product-generator.js";
import { seedLuxuryCatalogTables } from "./seed-utils/luxury-catalog-db.js";

const prisma = new PrismaClient();
const seedDir = dirname(fileURLToPath(import.meta.url));

function mergeSynonymMaps(
  base: Record<string, string>,
  extra: Record<string, string>,
): Record<string, string> {
  return { ...base, ...extra };
}

function mergeMerchandisingRules(
  base: MerchandisingRule[],
  extra: MerchandisingRule[],
): MerchandisingRule[] {
  const existingIds = new Set(base.map((rule) => rule.id));
  const merged = [...base];
  for (const rule of extra) {
    if (!existingIds.has(rule.id)) {
      merged.push(rule);
      existingIds.add(rule.id);
    }
  }
  return merged;
}

function writeLuxuryCatalogArtifacts(
  products: ReturnType<typeof generateLuxuryProductCatalog>["products"],
): void {
  const generatedDir = join(seedDir, "seed-data", "generated");
  mkdirSync(generatedDir, { recursive: true });

  writeFileSync(
    join(generatedDir, "luxury-catalog.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        seed: LUXURY_RNG_SEED,
        catalogId: LUXURY_CATALOG_ID,
        targetCount: LUXURY_TARGET_PRODUCT_COUNT,
        products,
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function mergeLuxurySearchConfig(): Promise<void> {
  const [stagingRulesRow, liveRulesRow, stagingSynonymsRow, liveSynonymsRow] =
    await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: "demo.search.rules.staging" } }),
      prisma.systemConfig.findUnique({ where: { key: "demo.search.rules.live" } }),
      prisma.systemConfig.findUnique({ where: { key: "demo.search.synonyms.staging" } }),
      prisma.systemConfig.findUnique({ where: { key: "demo.search.synonyms.live" } }),
    ]);

  const baseRules =
    (stagingRulesRow?.value as MerchandisingRule[] | undefined) ??
    buildDemoMerchandisingRules();
  const baseSynonyms =
    (stagingSynonymsRow?.value as Record<string, string> | undefined) ??
    buildSynonymMap();
  const luxuryRules = buildLuxuryMerchandisingRules();
  const luxurySynonyms = buildLuxurySynonymMap();

  const mergedRules = mergeMerchandisingRules(baseRules, luxuryRules);
  const mergedSynonyms = mergeSynonymMaps(baseSynonyms, luxurySynonyms);

  const entries = [
    { key: "demo.search.rules.staging", value: mergedRules },
    { key: "demo.search.rules.live", value: mergedRules },
    { key: "demo.search.synonyms.staging", value: mergedSynonyms },
    { key: "demo.search.synonyms.live", value: mergedSynonyms },
  ];

  for (const entry of entries) {
    await prisma.systemConfig.upsert({
      where: { key: entry.key },
      create: { key: entry.key, value: entry.value as object },
      update: { value: entry.value as object },
    });
  }
}

async function main(): Promise<void> {
  console.log(
    `Seeding luxury clothing catalog (${LUXURY_TARGET_PRODUCT_COUNT.toLocaleString()} products, catalog=${LUXURY_CATALOG_ID})...`,
  );

  const catalog = generateLuxuryProductCatalog(LUXURY_RNG_SEED, LUXURY_TARGET_PRODUCT_COUNT);
  if (catalog.products.length !== LUXURY_TARGET_PRODUCT_COUNT) {
    throw new Error(
      `Expected ${LUXURY_TARGET_PRODUCT_COUNT} luxury products, got ${catalog.products.length}`,
    );
  }

  writeLuxuryCatalogArtifacts(catalog.products);
  const counts = await seedLuxuryCatalogTables(prisma, catalog.products);
  await mergeLuxurySearchConfig();

  await prisma.systemConfig.upsert({
    where: { key: "demo.catalog.luxury.meta" },
    create: {
      key: "demo.catalog.luxury.meta",
      value: {
        catalogId: LUXURY_CATALOG_ID,
        ...summarizeLuxuryCatalog(catalog),
      },
    },
    update: {
      value: {
        catalogId: LUXURY_CATALOG_ID,
        ...summarizeLuxuryCatalog(catalog),
      },
    },
  });

  console.log("Luxury catalog seed completed.");
  console.log(
    JSON.stringify(
      {
        catalogId: LUXURY_CATALOG_ID,
        products: counts.products,
        brands: counts.brands,
        categories: counts.categories,
        heroProducts: catalog.heroCount,
        simpleProducts: catalog.simpleProductCount,
        ...getLuxuryRuleCounts(),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error("Luxury seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
