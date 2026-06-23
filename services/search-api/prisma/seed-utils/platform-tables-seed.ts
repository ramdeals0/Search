import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ProductDocument } from "@retailer-search/shared-types";
import { DEMO_USERS } from "../seed-data/demo-users.js";
import { DEMO_HERO_QUERIES, DEMO_ZERO_RESULT_FALLBACKS } from "../seed-data/search-rules.js";
import { createSeededRng, DEMO_RNG_SEED, isoDateDaysAgo, seedId } from "./random.js";
import type { WorkflowSeedBundle } from "./workflow-generator.js";

export const DEMO_API_KEY_SECRET = "rsp_demo_fleet_farm_search_read_key";
export const DEMO_API_KEY_ID = "apikey-demo-search-read";

const FLEET_FARM_QUERIES = [
  "deer hunting scope",
  "trail camera",
  "dog food",
  "carhartt jacket",
  "motor oil",
  "fishing rod",
  "wild bird seed",
  "snow blower",
  "work boots",
  "beef jerky",
];

function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export async function clearPlatformDemoData(prisma: PrismaClient): Promise<void> {
  await prisma.commerceEvent.deleteMany({ where: { id: { startsWith: "commerce-demo-" } } });
  await prisma.shopperProfile.deleteMany({ where: { sessionId: { startsWith: "session-demo-" } } });
  await prisma.searchClickEvent.deleteMany({ where: { id: { startsWith: "click-demo-" } } });
  await prisma.searchEvent.deleteMany({ where: { id: { startsWith: "search-demo-" } } });
  await prisma.apiUsageMeter.deleteMany({ where: { id: { startsWith: "meter-demo-" } } });
  await prisma.apiKey.deleteMany({ where: { id: { startsWith: "apikey-demo-" } } });
  await prisma.ruleDraft.deleteMany({ where: { id: { startsWith: "ruledraft-demo-" } } });
  await prisma.scheduledRelease.deleteMany({ where: { id: { startsWith: "release-demo-" } } });
  await prisma.accessRequest.deleteMany({ where: { id: { startsWith: "access-req-demo-" } } });
  await prisma.searchContentModule.deleteMany({ where: { id: { startsWith: "content-mod-demo-" } } });
  await prisma.experimentDecisionRecord.deleteMany({
    where: { experimentId: { startsWith: "exp-demo-" } },
  });
  await prisma.experimentScorecardRecord.deleteMany({
    where: { experimentId: { startsWith: "exp-demo-" } },
  });
  await prisma.experimentRunRecord.deleteMany({
    where: { experimentId: { startsWith: "exp-demo-" } },
  });
  await prisma.experimentRecord.deleteMany({ where: { id: { startsWith: "exp-demo-" } } });
  await prisma.evaluationQuerySet.deleteMany({ where: { id: { startsWith: "qset-demo-" } } });
  await prisma.embeddingJob.deleteMany({ where: { id: { startsWith: "embed-job-demo-" } } });
}

export interface PlatformSeedCounts {
  evaluationQuerySets: number;
  experiments: number;
  experimentRuns: number;
  experimentScorecards: number;
  experimentDecisions: number;
  accessRequests: number;
  apiKeys: number;
  searchEvents: number;
  searchClickEvents: number;
  scheduledReleases: number;
  ruleDrafts: number;
  apiUsageMeters: number;
  contentModules: number;
  shopperProfiles: number;
  commerceEvents: number;
  embeddingJobs: number;
}

export async function seedPlatformTables(
  prisma: PrismaClient,
  workflow: WorkflowSeedBundle,
  products: ProductDocument[],
  options: {
    seed?: number;
    productCount?: number;
    fleetFarmTheme?: boolean;
  } = {},
): Promise<PlatformSeedCounts> {
  const seed = options.seed ?? DEMO_RNG_SEED;
  const rng = createSeededRng(seed + 501);
  const fleetFarmTheme = options.fleetFarmTheme ?? true;
  const sampleProduct = (index: number) => products[index % products.length]!;

  const { experiments: experimentBundle } = workflow;

  await prisma.evaluationQuerySet.createMany({
    data: experimentBundle.querySets.map((querySet) => ({
      id: querySet.id,
      name: querySet.name,
      description: querySet.description,
      queries: querySet.queries as Prisma.InputJsonValue,
      createdAt: new Date(querySet.createdAt),
    })),
  });

  await prisma.experimentRecord.createMany({
    data: experimentBundle.experiments.map((experiment) => ({
      id: experiment.id,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      baselineSnapshotId: experiment.baselineSnapshotId,
      candidateSnapshotId: experiment.candidateSnapshotId,
      querySetId: experiment.querySetId,
      lastRunAt: experiment.lastRunAt ? new Date(experiment.lastRunAt) : null,
      onlineEnabled: experiment.id === "exp-demo-1",
      onlineTrafficPercent: experiment.id === "exp-demo-1" ? 25 : 50,
      createdAt: new Date(experiment.createdAt),
      updatedAt: new Date(experiment.createdAt),
    })),
  });

  const latestRunByExperiment = new Map<string, (typeof experimentBundle.runs)[number]>();
  for (const run of experimentBundle.runs) {
    const existing = latestRunByExperiment.get(run.experimentId);
    if (!existing || run.runAt > existing.runAt) {
      latestRunByExperiment.set(run.experimentId, run);
    }
  }

  const experimentRuns = Array.from(latestRunByExperiment.entries()).map(([experimentId, run]) => ({
    experimentId,
    runAt: new Date(run.runAt),
    payload: {
      experimentId,
      runAt: run.runAt,
      summary: {
        totalQueries: run.totalQueries,
        changedQueries: Math.max(1, Math.round(run.totalQueries * 0.45)),
        improvedQueries:
          run.winner === "candidate" ? Math.round(run.totalQueries * 0.3) : Math.round(run.totalQueries * 0.15),
        regressedQueries:
          run.winner === "baseline" ? Math.round(run.totalQueries * 0.2) : Math.round(run.totalQueries * 0.08),
        unchangedQueries: Math.max(0, run.totalQueries - Math.round(run.totalQueries * 0.45)),
      },
      results: [],
    } as Prisma.InputJsonValue,
  }));

  if (experimentRuns.length > 0) {
    await prisma.experimentRunRecord.createMany({ data: experimentRuns });
  }

  const completedExperimentIds = experimentBundle.experiments
    .filter((experiment) => experiment.status === "completed")
    .map((experiment) => experiment.id);

  const scorecards = completedExperimentIds.map((experimentId, index) => ({
    experimentId,
    generatedAt: new Date(isoDateDaysAgo(rng, 6 - index)),
    payload: {
      experimentId,
      generatedAt: isoDateDaysAgo(rng, 6 - index),
      headlineStatus: index % 2 === 0 ? "pass" : "review",
      metrics: [
        {
          key: "ndcg_at_5",
          label: "NDCG@5",
          value: 0.72 + index * 0.03,
          baseline: 0.68,
          delta: 0.04 + index * 0.01,
          status: "good",
        },
        {
          key: "zero_result_rate",
          label: "Zero-result rate",
          value: 0.04 - index * 0.005,
          baseline: 0.07,
          delta: -0.03,
          status: "good",
        },
      ],
      summary: `Demo scorecard for ${experimentId}.`,
      guardrailFindings: index === 0 ? [] : ["Monitor latency on broad category queries."],
    } as Prisma.InputJsonValue,
  }));

  if (scorecards.length > 0) {
    await prisma.experimentScorecardRecord.createMany({ data: scorecards });
  }

  const decisions = completedExperimentIds.map((experimentId, index) => ({
    experimentId,
    decidedAt: new Date(isoDateDaysAgo(rng, 4 - index)),
    payload: {
      experimentId,
      decidedAt: isoDateDaysAgo(rng, 4 - index),
      decision: index % 2 === 0 ? "ship" : "iterate",
      rationale:
        index % 2 === 0
          ? "Candidate improved relevance on target queries without guardrail regressions."
          : "Promising lift; iterate on seasonal assortment coverage before shipping.",
      linkedRunAt: latestRunByExperiment.get(experimentId)?.runAt,
    } as Prisma.InputJsonValue,
  }));

  if (decisions.length > 0) {
    await prisma.experimentDecisionRecord.createMany({ data: decisions });
  }

  const accessRequests: Prisma.AccessRequestCreateManyInput[] = [
    {
      id: "access-req-demo-01",
      requesterUserId: "user-merchandiser",
      requesterEmail: "merchandiser@example.com",
      requesterName: "Alex Morgan",
      requestedRole: "reviewer",
      justification: "Need reviewer access to validate Fleet Farm seasonal search rules.",
      status: "pending",
      createdAt: new Date(isoDateDaysAgo(rng, 5)),
      updatedAt: new Date(isoDateDaysAgo(rng, 5)),
    },
    {
      id: "access-req-demo-02",
      requesterUserId: "user-developer",
      requesterEmail: "developer@example.com",
      requesterName: "Casey Nguyen",
      requestedRole: "release_manager",
      justification: "Temporary release manager access for staging promotion window.",
      status: "approved",
      reviewerUserId: "user-admin",
      reviewerName: "Morgan Patel",
      reviewerNote: "Approved for 48-hour promotion sprint.",
      createdAt: new Date(isoDateDaysAgo(rng, 12)),
      updatedAt: new Date(isoDateDaysAgo(rng, 11)),
    },
    {
      id: "access-req-demo-03",
      requesterUserId: "user-merchandiser",
      requesterEmail: "merchandiser@example.com",
      requesterName: "Alex Morgan",
      requestedRole: "approver",
      justification: "Approver access requested for live merchandising changes.",
      status: "denied",
      reviewerUserId: "user-admin",
      reviewerName: "Morgan Patel",
      reviewerNote: "Use JIT elevation instead for short-lived approver access.",
      createdAt: new Date(isoDateDaysAgo(rng, 20)),
      updatedAt: new Date(isoDateDaysAgo(rng, 19)),
    },
  ];
  await prisma.accessRequest.createMany({ data: accessRequests });

  const apiKeys: Prisma.ApiKeyCreateManyInput[] = [
    {
      id: DEMO_API_KEY_ID,
      name: "Fleet Farm Storefront Search",
      keyHash: hashApiKey(DEMO_API_KEY_SECRET),
      keyPrefix: DEMO_API_KEY_SECRET.slice(0, 12),
      tenantId: "default",
      ownerUserId: "user-developer",
      scopes: ["search:read", "browse:read", "events:write"],
      enabled: true,
      rateLimitPerMinute: 120,
      createdAt: new Date(isoDateDaysAgo(rng, 90)),
      updatedAt: new Date(isoDateDaysAgo(rng, 1)),
    },
    {
      id: "apikey-demo-analytics",
      name: "Merchandising Analytics",
      keyHash: hashApiKey("rsp_demo_merchandising_analytics_key"),
      keyPrefix: "rsp_demo_mer",
      tenantId: "default",
      ownerUserId: "user-merchandiser",
      scopes: ["search:read", "events:write"],
      enabled: true,
      rateLimitPerMinute: 60,
      createdAt: new Date(isoDateDaysAgo(rng, 60)),
      updatedAt: new Date(isoDateDaysAgo(rng, 2)),
    },
    {
      id: "apikey-demo-readonly",
      name: "Read-only Browse Integration",
      keyHash: hashApiKey("rsp_demo_readonly_browse_key"),
      keyPrefix: "rsp_demo_rea",
      tenantId: "default",
      ownerUserId: "user-reviewer",
      scopes: ["browse:read"],
      enabled: true,
      createdAt: new Date(isoDateDaysAgo(rng, 45)),
      updatedAt: new Date(isoDateDaysAgo(rng, 3)),
    },
  ];
  await prisma.apiKey.createMany({ data: apiKeys });

  const searchQueries = [
    ...DEMO_HERO_QUERIES.map((entry) => entry.query),
    ...(fleetFarmTheme ? FLEET_FARM_QUERIES : []),
  ];

  const searchEvents: Prisma.SearchEventCreateManyInput[] = Array.from({ length: 240 }, (_, index) => {
    const query = searchQueries[index % searchQueries.length]!;
    const createdAt = new Date(isoDateDaysAgo(rng, 30 - (index % 28)));
    return {
      id: seedId("search-demo", index + 1),
      query,
      normalizedQuery: query.toLowerCase().trim(),
      resultCount: rng.int(3, 120),
      tenantId: "default",
      apiKeyId: index % 3 === 0 ? DEMO_API_KEY_ID : undefined,
      sessionId: `session-demo-${String((index % 20) + 1).padStart(2, "0")}`,
      createdAt,
    };
  });
  await prisma.searchEvent.createMany({ data: searchEvents });

  const searchClickEvents: Prisma.SearchClickEventCreateManyInput[] = Array.from({ length: 120 }, (_, index) => {
    const query = searchQueries[index % searchQueries.length]!;
    const product = sampleProduct(index + 3);
    const createdAt = new Date(isoDateDaysAgo(rng, 25 - (index % 20)));
    return {
      id: seedId("click-demo", index + 1),
      query,
      normalizedQuery: query.toLowerCase().trim(),
      productId: product.id,
      productTitle: product.title,
      position: rng.int(1, 12),
      tenantId: "default",
      apiKeyId: index % 4 === 0 ? DEMO_API_KEY_ID : undefined,
      sessionId: `session-demo-${String((index % 20) + 1).padStart(2, "0")}`,
      createdAt,
    };
  });
  await prisma.searchClickEvent.createMany({ data: searchClickEvents });

  const scheduledReleases: Prisma.ScheduledReleaseCreateManyInput[] = [
    {
      id: "release-demo-01",
      type: "promote_snapshot",
      status: "pending",
      snapshotId: "snapshot-demo-02",
      reason: "Promote Fleet Farm hunting season merchandising rules to live.",
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      linkedExperimentId: "exp-demo-1",
      approvalRequestId: "approval-demo-02",
      createdByUserId: "user-release-manager",
      createdByEmail: "release@example.com",
      createdAt: new Date(isoDateDaysAgo(rng, 2)),
      updatedAt: new Date(isoDateDaysAgo(rng, 1)),
    },
    {
      id: "release-demo-02",
      type: "promote_snapshot",
      status: "executed",
      snapshotId: "snapshot-demo-03",
      reason: "Executed spring lawn and garden promotion.",
      scheduledAt: new Date(isoDateDaysAgo(rng, 7)),
      executedAt: new Date(isoDateDaysAgo(rng, 7)),
      linkedExperimentId: "exp-demo-3",
      approvalRequestId: "approval-demo-03",
      createdByUserId: "user-release-manager",
      createdByEmail: "release@example.com",
      createdAt: new Date(isoDateDaysAgo(rng, 10)),
      updatedAt: new Date(isoDateDaysAgo(rng, 7)),
    },
    {
      id: "release-demo-03",
      type: "rollback_snapshot",
      status: "cancelled",
      snapshotId: "snapshot-demo-baseline-2",
      reason: "Cancelled rollback after candidate metrics recovered.",
      scheduledAt: new Date(isoDateDaysAgo(rng, 3)),
      createdByUserId: "user-admin",
      createdByEmail: "admin@example.com",
      createdAt: new Date(isoDateDaysAgo(rng, 5)),
      updatedAt: new Date(isoDateDaysAgo(rng, 4)),
    },
  ];
  await prisma.scheduledRelease.createMany({ data: scheduledReleases });

  const zeroResultQueries = Object.keys(DEMO_ZERO_RESULT_FALLBACKS).slice(0, 5);
  const ruleDraftStatuses = ["pending_review", "approved", "rejected", "applied", "pending_review"] as const;
  const ruleDrafts: Prisma.RuleDraftCreateManyInput[] = zeroResultQueries.map((query, index) => {
    const product = sampleProduct(index + 8);
    const createdAt = new Date(isoDateDaysAgo(rng, 14 - index));
    return {
      id: `ruledraft-demo-${String(index + 1).padStart(2, "0")}`,
      query,
      status: ruleDraftStatuses[index % ruleDraftStatuses.length]!,
      suggestedRule: {
        name: `Recover zero results for "${query}"`,
        action: index % 2 === 0 ? "boost" : "pin",
        condition: { query },
        productIds: [product.id],
        boostAmount: index % 2 === 0 ? 12 : undefined,
        rationale: `Demo rule draft to improve zero-result recovery for ${query}.`,
      },
      rationale: `Synthetic LLM draft for ${query}.`,
      source: "llm",
      createdByUserId: DEMO_USERS[index % DEMO_USERS.length]!.id,
      approvalRequestId: index % 2 === 0 ? `approval-demo-${String(index + 1).padStart(2, "0")}` : undefined,
      createdAt,
      updatedAt: createdAt,
    };
  });
  await prisma.ruleDraft.createMany({ data: ruleDrafts });

  const meterRoutes = ["/v1/search", "/v1/browse", "/v1/events/search", "/v1/events/click"];
  const apiUsageMeters: Prisma.ApiUsageMeterCreateManyInput[] = [];
  let meterIndex = 0;
  for (const apiKey of apiKeys) {
    for (const route of meterRoutes) {
      meterIndex += 1;
      const windowStart = new Date();
      windowStart.setMinutes(0, 0, 0);
      apiUsageMeters.push({
        id: seedId("meter-demo", meterIndex),
        apiKeyId: apiKey.id!,
        tenantId: "default",
        route,
        windowStart,
        requestCount: rng.int(12, 240),
      });
    }
  }
  await prisma.apiUsageMeter.createMany({ data: apiUsageMeters });

  const contentModules: Prisma.SearchContentModuleCreateManyInput[] = [
    {
      id: "content-mod-demo-hunting",
      name: fleetFarmTheme ? "Fleet Farm Hunting Season" : "Seasonal Tools Spotlight",
      active: true,
      environment: "live",
      moduleType: "banner",
      priority: 200,
      condition: { query: fleetFarmTheme ? "hunting" : "drill" },
      content: {
        title: fleetFarmTheme ? "Hunting & Shooting at Fleet Farm" : "Contractor Power Tools",
        body: fleetFarmTheme
          ? "Shop optics, trail cameras, safety gear, and seasonal hunting essentials."
          : "Browse cordless drills, impact drivers, and shop vacs for your next project.",
        href: fleetFarmTheme ? "https://www.fleetfarm.com/category/hunting-shooting" : undefined,
      },
      createdAt: new Date(isoDateDaysAgo(rng, 30)),
      updatedAt: new Date(isoDateDaysAgo(rng, 2)),
    },
    {
      id: "content-mod-demo-farm",
      name: fleetFarmTheme ? "Farm & Livestock Rail" : "Paint & Supplies Rail",
      active: true,
      environment: "staging",
      moduleType: "category_rail",
      priority: 150,
      condition: { category: fleetFarmTheme ? "Farm & Livestock" : "Paint" },
      content: {
        title: fleetFarmTheme ? "Farm & Ranch Essentials" : "Paint & Decorating",
        category: fleetFarmTheme ? "Farm & Livestock" : "Paint",
      },
      createdAt: new Date(isoDateDaysAgo(rng, 25)),
      updatedAt: new Date(isoDateDaysAgo(rng, 3)),
    },
    {
      id: "content-mod-demo-message",
      name: "Free Store Pickup Message",
      active: true,
      environment: "live",
      moduleType: "message",
      priority: 100,
      condition: {},
      content: {
        body: fleetFarmTheme
          ? "Fleet Farm demo catalog — 30,000 Midwest retail SKUs with in-store pickup available."
          : "Demo home improvement catalog with contractor-grade tools and seasonal assortments.",
      },
      createdAt: new Date(isoDateDaysAgo(rng, 20)),
      updatedAt: new Date(isoDateDaysAgo(rng, 1)),
    },
  ];
  await prisma.searchContentModule.createMany({ data: contentModules });

  const shopperProfiles: Prisma.ShopperProfileCreateManyInput[] = Array.from({ length: 24 }, (_, index) => ({
    sessionId: `session-demo-${String(index + 1).padStart(2, "0")}`,
    tenantId: "default",
    affinities: {
      brands: [sampleProduct(index).brand, sampleProduct(index + 5).brand],
      categories: [sampleProduct(index).category, sampleProduct(index + 2).category],
      recentQueries: searchQueries.slice(index % 4, (index % 4) + 3),
    },
    updatedAt: new Date(isoDateDaysAgo(rng, 7 - (index % 6))),
  }));
  await prisma.shopperProfile.createMany({ data: shopperProfiles });

  const commerceEventTypes = ["product_view", "add_to_cart", "purchase", "search"];
  const commerceEvents: Prisma.CommerceEventCreateManyInput[] = Array.from({ length: 96 }, (_, index) => {
    const product = sampleProduct(index + 2);
    const type = commerceEventTypes[index % commerceEventTypes.length]!;
    const createdAt = new Date(isoDateDaysAgo(rng, 21 - (index % 18)));
    return {
      id: seedId("commerce-demo", index + 1),
      type,
      sessionId: `session-demo-${String((index % 24) + 1).padStart(2, "0")}`,
      tenantId: "default",
      query: type === "search" ? searchQueries[index % searchQueries.length] : undefined,
      productId: type === "search" ? undefined : product.id,
      amountCents: type === "purchase" ? Math.round(product.price * 100) : undefined,
      metadata: { demo: true, source: fleetFarmTheme ? "fleet-farm" : "home-improvement" },
      createdAt,
    };
  });
  await prisma.commerceEvent.createMany({ data: commerceEvents });

  const productCount = options.productCount ?? products.length;
  await prisma.embeddingJob.create({
    data: {
      id: "embed-job-demo-backfill",
      status: "queued",
      jobType: "backfill",
      totalProducts: productCount,
      processedProducts: 0,
      failedProducts: 0,
      skippedProducts: 0,
      model: process.env.EMBEDDINGS_MODEL ?? "mock-hash-v1",
      provider: process.env.EMBEDDINGS_PROVIDER ?? "mock",
      maxRetries: 3,
      nextRunAt: new Date(),
    },
  });

  return {
    evaluationQuerySets: experimentBundle.querySets.length,
    experiments: experimentBundle.experiments.length,
    experimentRuns: experimentRuns.length,
    experimentScorecards: scorecards.length,
    experimentDecisions: decisions.length,
    accessRequests: accessRequests.length,
    apiKeys: apiKeys.length,
    searchEvents: searchEvents.length,
    searchClickEvents: searchClickEvents.length,
    scheduledReleases: scheduledReleases.length,
    ruleDrafts: ruleDrafts.length,
    apiUsageMeters: apiUsageMeters.length,
    contentModules: contentModules.length,
    shopperProfiles: shopperProfiles.length,
    commerceEvents: commerceEvents.length,
    embeddingJobs: 1,
  };
}
