import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { DEMO_PASSWORD, DEMO_USERS } from "./seed-data/demo-users.js";
import { HOME_IMPROVEMENT_TAXONOMY } from "./seed-data/home-improvement-taxonomy.js";
import { SYNTHETIC_BRANDS } from "./seed-data/brands.js";
import {
  buildDemoMerchandisingRules,
  buildSynonymMap,
  DEMO_HERO_QUERIES,
  DEMO_QUERY_CATEGORY_HINTS,
  DEMO_TYPO_CORRECTIONS,
  DEMO_ZERO_RESULT_FALLBACKS,
  getDemoRuleCounts,
} from "./seed-data/search-rules.js";
import { generateProductCatalog, generateSimpleProductBatch, summarizeCatalog, TARGET_PRODUCT_COUNT } from "./seed-utils/product-generator.js";
import {
  FLEET_FARM_BRANDS,
  FLEET_FARM_TAXONOMY,
  generateFleetFarmCatalog,
  isFleetFarmCatalogTheme,
  readCatalogTheme,
} from "./seed-utils/fleet-farm-catalog.js";
import { seedCatalogTables, seedLargeCatalogTables, purgeAllProductCatalogData } from "./seed-utils/catalog-db.js";
import {
  clearPlatformDemoData,
  DEMO_API_KEY_SECRET,
  seedPlatformTables,
} from "./seed-utils/platform-tables-seed.js";
import { buildWorkflowSeedBundle } from "./seed-utils/workflow-generator.js";
import { DEMO_RNG_SEED } from "./seed-utils/random.js";

const prisma = new PrismaClient();
const seedDir = dirname(fileURLToPath(import.meta.url));

async function clearDemoData(): Promise<void> {
  await prisma.webhookDeliveryLog.deleteMany({
    where: { id: { startsWith: "webhook-delivery-demo-" } },
  });
  await prisma.webhookEndpoint.deleteMany({
    where: { id: { startsWith: "webhook-demo-" } },
  });
  await prisma.exportJob.deleteMany({ where: { id: { startsWith: "export-demo-" } } });
  await prisma.collaborationAnnotation.deleteMany({
    where: { id: { startsWith: "annotation-demo-" } },
  });
  await prisma.collaborationComment.deleteMany({
    where: { id: { startsWith: "comment-demo-" } },
  });
  await prisma.notification.deleteMany({ where: { id: { startsWith: "notif-demo-" } } });
  await prisma.jitElevationRequest.deleteMany({ where: { id: { startsWith: "jit-demo-" } } });
  await prisma.accessReviewItem.deleteMany({ where: { runId: { startsWith: "access-review-demo-" } } });
  await prisma.accessReviewRun.deleteMany({ where: { id: { startsWith: "access-review-demo-" } } });
  await prisma.approvalRequest.deleteMany({ where: { id: { startsWith: "approval-demo-" } } });
  await prisma.auditTrailEntry.deleteMany({ where: { id: { startsWith: "audit-demo-" } } });
  await prisma.systemConfig.deleteMany({ where: { key: { startsWith: "demo." } } });
  await clearPlatformDemoData(prisma);
  await purgeAllProductCatalogData(prisma);
}

async function seedUsers(): Promise<void> {
  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: true,
        password: DEMO_PASSWORD,
      },
      update: {
        email: user.email,
        name: user.name,
        role: user.role,
        active: true,
        password: DEMO_PASSWORD,
      },
    });
  }
}

function writeCatalogArtifacts(products: ReturnType<typeof generateProductCatalog>["products"]): void {
  const generatedDir = join(seedDir, "seed-data", "generated");
  mkdirSync(generatedDir, { recursive: true });

  const catalogPath = join(generatedDir, "catalog.json");
  writeFileSync(
    catalogPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      seed: DEMO_RNG_SEED,
      targetCount: TARGET_PRODUCT_COUNT,
      products,
    }),
    "utf8",
  );
}

async function seedSystemConfig(
  catalog: ReturnType<typeof generateProductCatalog>,
  workflow: ReturnType<typeof buildWorkflowSeedBundle>,
  taxonomy = HOME_IMPROVEMENT_TAXONOMY,
  brands = SYNTHETIC_BRANDS,
): Promise<void> {
  const synonymMap = buildSynonymMap();
  const merchandisingRules = buildDemoMerchandisingRules();
  const entries: Array<{ key: string; value: unknown }> = [
    { key: "demo.catalog.meta", value: summarizeCatalog(catalog) },
    { key: "demo.taxonomy.leaves", value: taxonomy },
    { key: "demo.brands", value: brands },
    { key: "demo.search.synonyms.staging", value: synonymMap },
    { key: "demo.search.synonyms.live", value: synonymMap },
    { key: "demo.search.rules.staging", value: merchandisingRules },
    { key: "demo.search.rules.live", value: merchandisingRules },
    { key: "demo.search.typoMap", value: DEMO_TYPO_CORRECTIONS },
    { key: "demo.search.zeroResultFallbacks", value: DEMO_ZERO_RESULT_FALLBACKS },
    { key: "demo.search.heroQueries", value: DEMO_HERO_QUERIES },
    { key: "demo.search.queryCategoryHints", value: DEMO_QUERY_CATEGORY_HINTS },
    { key: "demo.experiments", value: workflow.experiments },
    {
      key: "bootstrap.security",
      value: {
        passwordMinLength: 8,
        loginAttemptLimit: 5,
        lockoutWindowMinutes: 15,
        sessionTtlHours: 8,
        sessionInactivityMinutes: 30,
        auditLoggingEnabled: true,
      },
    },
  ];

  for (const entry of entries) {
    await prisma.systemConfig.upsert({
      where: { key: entry.key },
      create: { key: entry.key, value: entry.value as object },
      update: { value: entry.value as object },
    });
  }
}

async function seedWorkflow(workflow: ReturnType<typeof buildWorkflowSeedBundle>): Promise<void> {
  await prisma.approvalRequest.createMany({ data: workflow.approvals });
  for (const review of workflow.accessReviews) {
    await prisma.accessReviewRun.create({ data: review.run });
    await prisma.accessReviewItem.createMany({ data: review.items });
  }
  await prisma.jitElevationRequest.createMany({ data: workflow.jitRequests });
  await prisma.notification.createMany({ data: workflow.notifications });
  await prisma.collaborationComment.createMany({ data: workflow.comments });
  await prisma.collaborationAnnotation.createMany({ data: workflow.annotations });
  await prisma.auditTrailEntry.createMany({ data: workflow.auditEntries });
  await prisma.webhookEndpoint.createMany({ data: workflow.webhooks });
  for (const delivery of workflow.webhookDeliveries) {
    await prisma.webhookDeliveryLog.create({ data: delivery });
  }
  await prisma.exportJob.createMany({ data: workflow.exportJobs });
}

async function seedAllSupportingTables(
  workflow: ReturnType<typeof buildWorkflowSeedBundle>,
  products: ReturnType<typeof generateProductCatalog>["products"],
  fleetFarmTheme: boolean,
): Promise<ReturnType<typeof seedPlatformTables>> {
  await seedWorkflow(workflow);
  return seedPlatformTables(prisma, workflow, products, {
    seed: DEMO_RNG_SEED,
    productCount: TARGET_PRODUCT_COUNT,
    fleetFarmTheme,
  });
}

async function markDemoBootstrapComplete(): Promise<void> {
  await prisma.bootstrapState.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      status: "completed",
      initializedAt: new Date("2026-03-15T12:00:00.000Z"),
      initializedByUserId: "user-admin",
      initializedByEmail: "admin@example.com",
      instanceName: "Retail Discovery Platform Demo",
      firstAdminEmail: "admin@example.com",
      securityDefaultsApplied: true,
      governanceDefaultsApplied: true,
    },
    update: {
      status: "completed",
      initializedAt: new Date("2026-03-15T12:00:00.000Z"),
      initializedByUserId: "user-admin",
      initializedByEmail: "admin@example.com",
      instanceName: "Retail Discovery Platform Demo",
      firstAdminEmail: "admin@example.com",
      securityDefaultsApplied: true,
      governanceDefaultsApplied: true,
    },
  });
}

const STREAMING_SEED_THRESHOLD = 100_000;

function generateCatalogForTheme(seed: number) {
  return isFleetFarmCatalogTheme() ? generateFleetFarmCatalog(seed) : generateProductCatalog(seed);
}

async function main(): Promise<void> {
  const catalogTheme = readCatalogTheme();
  console.log(
    `Seeding ${catalogTheme} demo catalog (${TARGET_PRODUCT_COUNT.toLocaleString()} products, seed=${DEMO_RNG_SEED})...`,
  );

  await clearDemoData();
  await seedUsers();

  const taxonomy = isFleetFarmCatalogTheme() ? FLEET_FARM_TAXONOMY : HOME_IMPROVEMENT_TAXONOMY;
  const brands = isFleetFarmCatalogTheme() ? FLEET_FARM_BRANDS : SYNTHETIC_BRANDS;

  if (TARGET_PRODUCT_COUNT > STREAMING_SEED_THRESHOLD) {
    console.log(
      `Large catalog seed (${TARGET_PRODUCT_COUNT.toLocaleString()} products) using streaming DB batches...`,
    );
    const catalogCounts = await seedLargeCatalogTables(
      prisma,
      TARGET_PRODUCT_COUNT,
      DEMO_RNG_SEED,
    );
    const sampleProducts = generateSimpleProductBatch(1, Math.min(1000, TARGET_PRODUCT_COUNT), DEMO_RNG_SEED);
    const catalog = {
      products: sampleProducts,
      heroCount: 0,
      variantProductCount: 0,
      simpleProductCount: TARGET_PRODUCT_COUNT,
      variantGroupCount: 0,
    };
    const workflow = buildWorkflowSeedBundle(sampleProducts, DEMO_RNG_SEED);
    const platformCounts = await seedAllSupportingTables(
      workflow,
      sampleProducts,
      isFleetFarmCatalogTheme(),
    );
    await seedSystemConfig(catalog, workflow, taxonomy, brands);
    await markDemoBootstrapComplete();

    console.log("Large demo seed completed.");
    console.log(
      JSON.stringify(
        {
          users: DEMO_USERS.length,
          products: catalogCounts.products,
          brands: catalogCounts.brands,
          categories: catalogCounts.categories,
          catalogScaleMode: "database",
          ...platformCounts,
          demoApiKeySecret: DEMO_API_KEY_SECRET,
        },
        null,
        2,
      ),
    );
    return;
  }

  const catalog = generateCatalogForTheme(DEMO_RNG_SEED);
  if (catalog.products.length !== TARGET_PRODUCT_COUNT) {
    throw new Error(`Expected ${TARGET_PRODUCT_COUNT} products, got ${catalog.products.length}`);
  }

  writeCatalogArtifacts(catalog.products);
  const workflow = buildWorkflowSeedBundle(catalog.products, DEMO_RNG_SEED);

  const catalogCounts = await seedCatalogTables(prisma, catalog.products);
  const platformCounts = await seedAllSupportingTables(
    workflow,
    catalog.products,
    isFleetFarmCatalogTheme(),
  );
  await seedSystemConfig(catalog, workflow, taxonomy, brands);
  await markDemoBootstrapComplete();

  const ruleCounts = getDemoRuleCounts();
  const counts = {
    users: DEMO_USERS.length,
    products: catalogCounts.products,
    brands: catalogCounts.brands,
    categories: catalogCounts.categories,
    heroProducts: catalog.heroCount,
    variantProducts: catalog.variantProductCount,
    simpleProducts: catalog.simpleProductCount,
    leafCategories: taxonomy.length,
    syntheticBrands: brands.length,
    catalogTheme,
    approvals: workflow.approvals.length,
    accessReviewRuns: workflow.accessReviews.length,
    jitRequests: workflow.jitRequests.length,
    notifications: workflow.notifications.length,
    comments: workflow.comments.length,
    annotations: workflow.annotations.length,
    auditEntries: workflow.auditEntries.length,
    webhooks: workflow.webhooks.length,
    webhookDeliveries: workflow.webhookDeliveries.length,
    exportJobs: workflow.exportJobs.length,
    experiments: workflow.experiments.experiments.length,
    experimentRuns: workflow.experiments.runs.length,
    ...platformCounts,
    demoApiKeySecret: DEMO_API_KEY_SECRET,
    ...ruleCounts,
  };

  console.log("Demo seed completed.");
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
