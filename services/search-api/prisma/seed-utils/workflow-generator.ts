import { createHash } from "node:crypto";
import type {
  ExportFormat,
  ExportJobStatus,
  ExportTargetType,
  JitAccessStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import type { ProductDocument } from "@retailer-search/shared-types";
import { DEMO_USERS } from "../seed-data/demo-users.js";
import { DEMO_HERO_QUERIES } from "../seed-data/search-rules.js";
import { createSeededRng, DEMO_RNG_SEED, isoDateDaysAgo, seedId } from "./random.js";

export interface DemoExperimentBundle {
  querySets: Array<{
    id: string;
    name: string;
    description: string;
    queries: Array<{ query: string; expectedProductIds?: string[]; tags?: string[] }>;
    createdAt: string;
  }>;
  experiments: Array<{
    id: string;
    name: string;
    description: string;
    status: string;
    querySetId: string;
    baselineSnapshotId: string;
    candidateSnapshotId: string;
    createdAt: string;
    lastRunAt?: string;
  }>;
  runs: Array<{
    experimentId: string;
    runAt: string;
    totalQueries: number;
    avgLatencyMs: number;
    winner: "baseline" | "candidate" | "tie";
    notes: string;
  }>;
}

export interface WorkflowSeedBundle {
  approvals: Prisma.ApprovalRequestCreateManyInput[];
  accessReviews: Array<{
    run: Prisma.AccessReviewRunCreateManyInput;
    items: Prisma.AccessReviewItemCreateManyInput[];
  }>;
  jitRequests: Prisma.JitElevationRequestCreateManyInput[];
  notifications: Prisma.NotificationCreateManyInput[];
  comments: Prisma.CollaborationCommentCreateManyInput[];
  annotations: Prisma.CollaborationAnnotationCreateManyInput[];
  auditEntries: Prisma.AuditTrailEntryCreateManyInput[];
  webhooks: Prisma.WebhookEndpointCreateManyInput[];
  webhookDeliveries: Array<Prisma.WebhookDeliveryLogCreateManyInput & { endpointId: string }>;
  exportJobs: Prisma.ExportJobCreateManyInput[];
  experiments: DemoExperimentBundle;
}

const SEARCH_QUERIES = DEMO_HERO_QUERIES.map((entry) => entry.query);

const APPROVAL_SCENARIOS = [
  "Boost contractor-grade cordless drills",
  "Reduce out-of-stock pressure washer visibility",
  "Promote spring mulch assortment",
  "Improve zero-result recovery for sheetrock-related queries",
  "Promote high-efficiency smart thermostats",
  "Pin hero shop vac for wet dry vacuum searches",
  "Boost GFCI outlet pack for kitchen and bath remodel queries",
  "Hide out-of-stock ceiling fans on broad fan searches",
  "Boost LED shop lights for garage lighting queries",
  "Promote miter saw assortment for trim carpentry queries",
  "Boost bathroom faucet results for vanity upgrade queries",
  "Reduce clearance paint noise on budget interior paint searches",
];

function actor(userId: string) {
  const user = DEMO_USERS.find((entry) => entry.id === userId);
  return {
    actorId: userId,
    actorLabel: user?.email ?? userId,
    actorName: user?.name ?? userId,
  };
}

function computeAuditHashChain(
  entry: {
    id: string;
    timestamp: string;
    actorId: string;
    actionType: string;
    summary: string;
    outcome: string;
  },
  previousHash: string | null,
): string {
  return createHash("sha256")
    .update(JSON.stringify({ previousHash, ...entry }))
    .digest("hex");
}

export function buildWorkflowSeedBundle(
  products: ProductDocument[],
  seed: number = DEMO_RNG_SEED,
): WorkflowSeedBundle {
  const rng = createSeededRng(seed + 99);
  const heroIds = products.filter((p) => p.id.startsWith("prod-hero-")).map((p) => p.id);
  const sampleProduct = (index: number) => products[index % products.length]!;

  const approvals: Prisma.ApprovalRequestCreateManyInput[] = Array.from({ length: 12 }, (_, index) => {
    const statuses = ["pending", "approved", "rejected", "executed", "cancelled"] as const;
    const status = statuses[index % statuses.length]!;
    const createdAt = new Date(isoDateDaysAgo(rng, 45 - index));
    const requester = actor(index % 2 === 0 ? "user-release-manager" : "user-merchandiser");
    return {
      id: `approval-demo-${String(index + 1).padStart(2, "0")}`,
      createdAt,
      updatedAt: createdAt,
      status,
      sourceEnvironment: "staging",
      targetEnvironment: "live",
      snapshotId: `snapshot-demo-${String(index + 1).padStart(2, "0")}`,
      snapshotName: `Home Improvement Search Config ${index + 1}`,
      requestedBy: { actorId: requester.actorId, actorLabel: requester.actorLabel },
      reason: `${APPROVAL_SCENARIOS[index % APPROVAL_SCENARIOS.length]} (${SEARCH_QUERIES[index % SEARCH_QUERIES.length]}).`,
      assignedReviewerIds: ["user-reviewer", "user-approver"],
      requiredApprovalCount: 1,
      linkedExperimentId: index < 3 ? `exp-demo-${index + 1}` : undefined,
    };
  });

  const accessReviews = Array.from({ length: 2 }, (_, runIndex) => {
    const createdAt = new Date(isoDateDaysAgo(rng, 20 - runIndex * 5));
    const runId = `access-review-demo-${runIndex + 1}`;
    return {
      run: {
        id: runId,
        createdAt,
        updatedAt: createdAt,
        createdByUserId: "user-admin",
        createdByName: "Morgan Patel",
        status: runIndex === 0 ? "open" : "completed",
        scopeRoles: ["merchandiser", "reviewer", "approver"],
        completedAt: runIndex === 1 ? new Date(isoDateDaysAgo(rng, 10)) : null,
      },
      items: DEMO_USERS.map((user, itemIndex) => ({
        id: `${runId}-item-${itemIndex + 1}`,
        runId,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        currentRole: user.role,
        active: true,
        lastLoginAt: new Date(isoDateDaysAgo(rng, 30)),
        recommendedAction: itemIndex % 4 === 0 ? "review" : "keep",
      })),
    };
  });

  const jitRequests: Prisma.JitElevationRequestCreateManyInput[] = Array.from({ length: 5 }, (_, index) => {
    const createdAt = new Date(isoDateDaysAgo(rng, 14 - index));
    const statuses: JitAccessStatus[] = ["pending", "active", "denied", "expired", "revoked"];
    return {
      id: `jit-demo-${index + 1}`,
      createdAt,
      updatedAt: createdAt,
      requesterUserId: "user-merchandiser",
      requesterEmail: "merchandiser@example.com",
      requesterName: "Alex Morgan",
      baseRole: "merchandiser" satisfies UserRole,
      requestedRole: index % 2 === 0 ? ("approver" satisfies UserRole) : ("release_manager" satisfies UserRole),
      justification: `Temporary access for live promotion on ${SEARCH_QUERIES[index]}.`,
      requestedDurationMinutes: 30 + index * 15,
      status: statuses[index]!,
    };
  });

  const notifications: Prisma.NotificationCreateManyInput[] = Array.from({ length: 40 }, (_, index) => {
    const createdAt = new Date(isoDateDaysAgo(rng, 30 - (index % 20)));
    return {
      id: `notif-demo-${String(index + 1).padStart(3, "0")}`,
      createdAt,
      updatedAt: createdAt,
      type: ["approval_requested", "approval_approved", "jit_requested", "export_ready"][index % 4]!,
      title: `Demo notification ${index + 1}`,
      message: `Synthetic home improvement merchandising notification for ${SEARCH_QUERIES[index % SEARCH_QUERIES.length]}.`,
      relatedApprovalRequestId:
        index % 3 === 0 ? `approval-demo-${String((index % 12) + 1).padStart(2, "0")}` : undefined,
      recipientActorId: DEMO_USERS[index % DEMO_USERS.length]!.id,
      read: index % 4 === 0,
    };
  });

  const comments: Prisma.CollaborationCommentCreateManyInput[] = Array.from({ length: 40 }, (_, index) => {
    const createdAt = new Date(isoDateDaysAgo(rng, 25 - (index % 15)));
    const product = sampleProduct(index);
    const author = actor(DEMO_USERS[index % DEMO_USERS.length]!.id);
    return {
      id: `comment-demo-${String(index + 1).padStart(3, "0")}`,
      targetType: index % 2 === 0 ? "product" : "approval_request",
      targetId: index % 2 === 0 ? product.id : `approval-demo-${String((index % 12) + 1).padStart(2, "0")}`,
      author: { actorId: author.actorId, actorLabel: author.actorLabel, name: author.actorName },
      message: `Review ranking for ${SEARCH_QUERIES[index % SEARCH_QUERIES.length]} on ${product.title}.`,
      createdAt,
      updatedAt: createdAt,
      status: index % 5 === 0 ? "resolved" : "open",
      tags: ["demo"],
    };
  });

  const annotations: Prisma.CollaborationAnnotationCreateManyInput[] = Array.from({ length: 20 }, (_, index) => {
    const createdAt = new Date(isoDateDaysAgo(rng, 18 - (index % 10)));
    const product = sampleProduct(index + 4);
    const author = actor(DEMO_USERS[(index + 1) % DEMO_USERS.length]!.id);
    return {
      id: `annotation-demo-${String(index + 1).padStart(3, "0")}`,
      targetType: "product",
      targetId: product.id,
      author: { actorId: author.actorId, actorLabel: author.actorLabel, name: author.actorName },
      anchorLabel: "Search ranking",
      note: `Ranking annotation for "${SEARCH_QUERIES[index % SEARCH_QUERIES.length]}" on ${product.title}.`,
      createdAt,
      updatedAt: createdAt,
      tags: ["demo"],
    };
  });

  let previousHash: string | null = null;
  const auditEntries: Prisma.AuditTrailEntryCreateManyInput[] = Array.from({ length: 260 }, (_, index) => {
    const timestamp = isoDateDaysAgo(rng, 120 - (index % 90));
    const user = DEMO_USERS[index % DEMO_USERS.length]!;
    const product = sampleProduct(index);
    const entry = {
      id: seedId("audit-demo", index + 1),
      timestamp,
      actorId: user.id,
      actorLabel: user.email,
      actionType: ["user_login", "create_merchandising_rule", "create_approval_request", "promote_environment"][index % 4]!,
      entityType: "product",
      entityId: product.id,
      entityLabel: product.title,
      outcome: index % 17 === 0 ? "failure" : "success",
      summary: `Demo audit ${index + 1} for ${SEARCH_QUERIES[index % SEARCH_QUERIES.length]}`,
    };
    const hashChainPrev = previousHash;
    previousHash = computeAuditHashChain(entry, hashChainPrev);
    return { ...entry, timestamp: new Date(timestamp), hashChainPrev };
  });

  const webhooks: Prisma.WebhookEndpointCreateManyInput[] = [
    {
      id: "webhook-demo-primary",
      createdAt: new Date(isoDateDaysAgo(rng, 60)),
      updatedAt: new Date(isoDateDaysAgo(rng, 2)),
      name: "Merchandising Events Receiver",
      url: "https://example.com/webhooks/merchandising",
      active: true,
      subscribedEvents: ["approval.created", "approval.approved", "promotion.executed"],
      secret: "demo-webhook-primary-secret",
    },
    {
      id: "webhook-demo-secondary",
      createdAt: new Date(isoDateDaysAgo(rng, 45)),
      updatedAt: new Date(isoDateDaysAgo(rng, 3)),
      name: "Security Timeline Receiver",
      url: "https://example.com/webhooks/security",
      active: false,
      subscribedEvents: ["auth.login.succeeded", "auth.login.failed"],
      secret: "demo-webhook-secondary-secret",
    },
  ];

  const webhookDeliveries = Array.from({ length: 15 }, (_, index) => ({
    id: `webhook-delivery-demo-${String(index + 1).padStart(2, "0")}`,
    endpointId: index % 2 === 0 ? "webhook-demo-primary" : "webhook-demo-secondary",
    createdAt: new Date(isoDateDaysAgo(rng, 10 - (index % 8))),
    eventType: index % 2 === 0 ? "approval.created" : "auth.login.succeeded",
    status: index % 4 !== 0 ? "succeeded" : "failed",
    responseStatusCode: index % 4 !== 0 ? 200 : 500,
    errorMessage: index % 4 !== 0 ? null : "Demo receiver returned HTTP 500",
    attemptNumber: index % 4 !== 0 ? 1 : 2,
  }));

  const exportTargets: ExportTargetType[] = ["audit_trail", "approvals", "access_reviews", "security_timeline"];
  const exportJobs: Prisma.ExportJobCreateManyInput[] = Array.from({ length: 8 }, (_, index) => {
    const createdAt = new Date(isoDateDaysAgo(rng, 12 - index));
    const creator = actor(DEMO_USERS[index % DEMO_USERS.length]!.id);
    const status: ExportJobStatus = index % 5 === 0 ? "failed" : "generated";
    const format: ExportFormat = index % 2 === 0 ? "json" : "csv";
    return {
      id: `export-demo-${index + 1}`,
      createdAt,
      updatedAt: createdAt,
      createdByUserId: creator.actorId,
      createdByName: creator.actorName,
      targetType: exportTargets[index % exportTargets.length]!,
      format,
      status,
      filters: { demo: true },
      fileName: status === "generated" ? `demo-export-${index + 1}.${format}` : undefined,
      recordCount: status === "generated" ? 100 + index * 25 : undefined,
      errorMessage: status === "failed" ? "Demo export failure." : undefined,
    };
  });

  const querySets = [
    {
      id: "qset-demo-power-tools",
      name: "Power Tools Search Relevance",
      description: "Boost contractor-grade cordless drills and shop vac coverage.",
      queries: [
        { query: "cordless drill", expectedProductIds: heroIds.slice(0, 2), tags: ["power-tools", "contractor"] },
        { query: "impact driver", expectedProductIds: ["prod-hero-002"], tags: ["power-tools"] },
        { query: "shop vac", expectedProductIds: ["prod-hero-003"], tags: ["power-tools"] },
        { query: "miter saw", expectedProductIds: ["prod-hero-026"], tags: ["power-tools"] },
      ],
      createdAt: isoDateDaysAgo(rng, 30),
    },
    {
      id: "qset-demo-seasonal-lawn",
      name: "Seasonal Lawn & Garden",
      description: "Promote spring mulch assortment and outdoor power equipment.",
      queries: [
        { query: "mulch", expectedProductIds: ["prod-hero-017"], tags: ["seasonal", "lawn-garden"] },
        { query: "weed eater", expectedProductIds: ["prod-hero-021"], tags: ["outdoor-power"] },
        { query: "leaf blower", expectedProductIds: ["prod-hero-032"], tags: ["outdoor-power"] },
      ],
      createdAt: isoDateDaysAgo(rng, 25),
    },
    {
      id: "qset-demo-electrical-lighting",
      name: "Electrical & Lighting",
      description: "GFCI, ceiling fan, and LED shop light upgrade queries.",
      queries: [
        { query: "gfci outlet", expectedProductIds: ["prod-hero-008"], tags: ["electrical"] },
        { query: "ceiling fan", expectedProductIds: ["prod-hero-009"], tags: ["lighting"] },
        { query: "led shop light", expectedProductIds: ["prod-hero-013"], tags: ["lighting"] },
      ],
      createdAt: isoDateDaysAgo(rng, 20),
    },
    {
      id: "qset-demo-plumbing-paint",
      name: "Plumbing & Paint Recovery",
      description: "Improve zero-result recovery for sheetrock and bathroom upgrade queries.",
      queries: [
        { query: "sheetrock", expectedProductIds: ["prod-hero-025"], tags: ["building-materials"] },
        { query: "bathroom faucet", expectedProductIds: ["prod-hero-012"], tags: ["plumbing"] },
        { query: "paint sprayer", expectedProductIds: ["prod-hero-041"], tags: ["paint"] },
        { query: "interior paint", expectedProductIds: ["prod-hero-010"], tags: ["paint"] },
      ],
      createdAt: isoDateDaysAgo(rng, 15),
    },
    {
      id: "qset-demo-appliances-storage",
      name: "Appliances & Storage",
      description: "Smart thermostat and garage storage relevance checks.",
      queries: [
        { query: "smart thermostat", expectedProductIds: ["prod-hero-023", "prod-hero-050"], tags: ["smart-home"] },
        { query: "water heater", expectedProductIds: ["prod-hero-031"], tags: ["hvac"] },
        { query: "storage shelving", expectedProductIds: ["prod-hero-049"], tags: ["storage"] },
        { query: "pressure washer", expectedProductIds: ["prod-hero-018"], tags: ["outdoor-power"] },
      ],
      createdAt: isoDateDaysAgo(rng, 10),
    },
  ];

  const experiments = [
    {
      id: "exp-demo-1",
      name: "Boost contractor-grade cordless drills",
      description: "Compare baseline vs candidate ranking for drill/driver queries.",
      status: "run",
      querySetId: "qset-demo-power-tools",
      baselineSnapshotId: "snapshot-demo-baseline-1",
      candidateSnapshotId: "snapshot-demo-candidate-1",
      createdAt: querySets[0]!.createdAt,
      lastRunAt: isoDateDaysAgo(rng, 3),
    },
    {
      id: "exp-demo-2",
      name: "Reduce out-of-stock pressure washer visibility",
      description: "Candidate buries OOS pressure washers on broad searches.",
      status: "draft",
      querySetId: "qset-demo-appliances-storage",
      baselineSnapshotId: "snapshot-demo-baseline-2",
      candidateSnapshotId: "snapshot-demo-candidate-2",
      createdAt: querySets[4]!.createdAt,
    },
    {
      id: "exp-demo-3",
      name: "Promote spring mulch assortment",
      description: "Seasonal boost experiment for mulch and lawn queries.",
      status: "completed",
      querySetId: "qset-demo-seasonal-lawn",
      baselineSnapshotId: "snapshot-demo-baseline-3",
      candidateSnapshotId: "snapshot-demo-candidate-3",
      createdAt: querySets[1]!.createdAt,
      lastRunAt: isoDateDaysAgo(rng, 7),
    },
    {
      id: "exp-demo-4",
      name: "Improve zero-result recovery for sheetrock-related queries",
      description: "Synonym and fallback tuning for drywall vocabulary.",
      status: "completed",
      querySetId: "qset-demo-plumbing-paint",
      baselineSnapshotId: "snapshot-demo-baseline-4",
      candidateSnapshotId: "snapshot-demo-candidate-4",
      createdAt: querySets[3]!.createdAt,
      lastRunAt: isoDateDaysAgo(rng, 5),
    },
    {
      id: "exp-demo-5",
      name: "Promote high-efficiency smart thermostats",
      description: "Boost learning thermostats for smart home upgrade queries.",
      status: "run",
      querySetId: "qset-demo-appliances-storage",
      baselineSnapshotId: "snapshot-demo-baseline-5",
      candidateSnapshotId: "snapshot-demo-candidate-5",
      createdAt: querySets[4]!.createdAt,
      lastRunAt: isoDateDaysAgo(rng, 2),
    },
  ];

  const runs = Array.from({ length: 8 }, (_, index) => ({
    experimentId: `exp-demo-${(index % 5) + 1}`,
    runAt: isoDateDaysAgo(rng, 14 - index),
    totalQueries: 12 + index,
    avgLatencyMs: 35 + index * 4,
    winner: (index % 3 === 0 ? "candidate" : index % 3 === 1 ? "baseline" : "tie") as "baseline" | "candidate" | "tie",
    notes: `Demo run for "${experiments[(index % 5)]!.name}" on ${SEARCH_QUERIES[index % SEARCH_QUERIES.length]}.`,
  }));

  return {
    approvals,
    accessReviews,
    jitRequests,
    notifications,
    comments,
    annotations,
    auditEntries,
    webhooks,
    webhookDeliveries,
    exportJobs,
    experiments: { querySets, experiments, runs },
  };
}
