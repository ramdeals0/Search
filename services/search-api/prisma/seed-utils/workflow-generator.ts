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

const SEARCH_QUERIES = [
  "cordless drill",
  "ceiling fan",
  "weed eater",
  "drywall screws",
  "shop vac",
  "gfci outlet",
  "pressure washer",
  "mulch",
  "primer",
  "smoke detector",
  "extension cord",
  "breaker box",
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
      reason: `Promote merchandising updates for "${SEARCH_QUERIES[index % SEARCH_QUERIES.length]}".`,
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
      message: "Synthetic home improvement merchandising notification.",
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
      message: `Demo comment on ${product.title}.`,
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
      note: `Annotation for ${product.title}.`,
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
      description: "Cordless drill, impact driver, and shop vac queries.",
      queries: [
        { query: "cordless drill", expectedProductIds: heroIds.slice(0, 2), tags: ["power-tools"] },
        { query: "shop vac", tags: ["power-tools"] },
      ],
      createdAt: isoDateDaysAgo(rng, 30),
    },
    {
      id: "qset-demo-seasonal-lawn",
      name: "Seasonal Lawn & Garden",
      description: "Seasonal merchandising coverage.",
      queries: [{ query: "mulch" }, { query: "weed eater" }],
      createdAt: isoDateDaysAgo(rng, 25),
    },
    {
      id: "qset-demo-electrical-lighting",
      name: "Electrical & Lighting",
      description: "Electrical and lighting upgrade queries.",
      queries: [{ query: "gfci outlet" }, { query: "ceiling fan" }],
      createdAt: isoDateDaysAgo(rng, 20),
    },
  ];

  const experiments = querySets.map((querySet, index) => ({
    id: `exp-demo-${index + 1}`,
    name: `${querySet.name} Experiment`,
    description: querySet.description,
    status: index === 0 ? "run" : index === 1 ? "draft" : "completed",
    querySetId: querySet.id,
    baselineSnapshotId: `snapshot-demo-baseline-${index + 1}`,
    candidateSnapshotId: `snapshot-demo-candidate-${index + 1}`,
    createdAt: querySet.createdAt,
    lastRunAt: index === 0 ? isoDateDaysAgo(rng, 3) : undefined,
  }));

  const runs = Array.from({ length: 8 }, (_, index) => ({
    experimentId: `exp-demo-${(index % 3) + 1}`,
    runAt: isoDateDaysAgo(rng, 14 - index),
    totalQueries: 12 + index,
    avgLatencyMs: 35 + index * 4,
    winner: (index % 3 === 0 ? "candidate" : index % 3 === 1 ? "baseline" : "tie") as "baseline" | "candidate" | "tie",
    notes: `Demo experiment run ${index + 1}.`,
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
