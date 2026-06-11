import express from "express";
import { z } from "zod";
import { env } from "@retailer-search/config";
import { getAutocompleteSuggestions, searchProducts } from "@retailer-search/search-core";
import type {
  ApprovalEligibilityResponseDto,
  ApprovalListResponseDto,
  ApprovalOperationResponseDto,
  ApprovalPolicyDto,
  ApprovalRequestDto,
  ApprovalSlaOverviewDto,
  ApprovalSlaPolicyDto,
  AuditLogResponseDto,
  ActiveConfigurationDto,
  EnvironmentKey,
  EnvironmentListResponseDto,
  EnvironmentOperationResponseDto,
  ExperimentDetailResponseDto,
  HealthResponseDto,
  MerchandisingConfigSnapshotDto,
  NotificationListResponseDto,
  PromoteSnapshotResponseDto,
  PromotionHistoryResponseDto,
  QueryPreviewResponseDto,
  ReviewerListResponseDto,
  RollbackSnapshotResponseDto,
  SearchFiltersDto,
  SearchRequestDto,
  SnapshotDiffResponseDto,
  SnapshotListResponseDto,
  SuggestionsResponseDto,
} from "@retailer-search/shared-types";
import {
  approveApprovalRequest,
  assignReviewersToApprovalRequest,
  cancelApprovalRequest,
  computeApprovalSlaOverview,
  createApprovalRequest,
  getApprovalEligibility,
  getApprovalRequestById,
  getApprovalSlaPolicy,
  getLatestExecutedApprovalForSnapshot,
  listApprovalRequests,
  markApprovalRequestExecuted,
  maybeGenerateApprovalNotifications,
  notifyApprovalApproved,
  notifyApprovalExecuted,
  notifyApprovalRejected,
  notifyApprovalRequested,
  rejectApprovalRequest,
  updateApprovalSlaPolicy,
} from "./approval-store.js";
import {
  createReviewer,
  getApprovalPolicy,
  listReviewers,
  setReviewerActive,
  updateApprovalPolicy,
} from "./reviewer-store.js";
import {
  copyEnvironmentConfig,
  getRulesForEnvironment,
  getSynonymsForEnvironment,
  linkEnvironmentSnapshot,
  listEnvironmentConfigs,
  promoteEnvironmentConfig,
} from "./environment-config-store.js";
import {
  getActiveConfiguration,
  listPromotionHistory,
  promoteActiveConfiguration,
} from "./active-config-store.js";
import { listAuditLogs, recordAuditLog } from "./audit-log-store.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification-store.js";
import {
  getAnalyticsSummary,
  getQueryAnalytics,
  recordSearchClick,
  recordSearchEvent,
} from "./analytics-store.js";
import {
  createExperiment,
  createQuerySet,
  getExperimentById,
  getExperimentDecision,
  getExperimentScorecard,
  getLastExperimentRun,
  getQuerySetById,
  listExperiments,
  listQuerySets,
  saveExperimentDecision,
  saveExperimentRun,
  saveExperimentScorecard,
} from "./experiment-store.js";
import { runExperimentEvaluation } from "./evaluation-engine.js";
import { buildExperimentScorecard } from "./scorecard-engine.js";
import {
  applySuggestionAction,
  buildActionPreview,
  generateRuleSuggestions,
} from "./suggestion-engine.js";
import {
  buildSnapshotDiff,
  createConfigSnapshotFromEnvironment,
  getConfigSnapshotById,
  getSnapshotSearchConfig,
  listConfigSnapshots,
  restoreSnapshotById,
  rollbackToSnapshot,
} from "./snapshot-store.js";
import {
  createMerchandisingRule,
  deleteMerchandisingRule,
  getActiveMerchandisingRules,
  getAllMerchandisingRules,
  getMerchandisingRuleById,
  getRuleAuditContext,
  replaceAllMerchandisingRules,
  updateMerchandisingRule,
} from "./merchandising-rules.js";
import { replaceAllSynonyms } from "./synonyms.js";
import { seedProducts } from "./seed-products.js";

function toFilterArray(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(String).filter((item) => item.length > 0);
  }

  const single = String(value).trim();
  return single.length > 0 ? [single] : [];
}

function buildFilters(input: {
  brand?: unknown;
  category?: unknown;
  inStock?: unknown;
}): SearchFiltersDto | undefined {
  const filters: SearchFiltersDto = {};
  const brand = toFilterArray(input.brand);
  const category = toFilterArray(input.category);
  const inStock = toFilterArray(input.inStock);

  if (brand.length > 0) {
    filters.brand = brand;
  }
  if (category.length > 0) {
    filters.category = category;
  }
  if (inStock.length > 0) {
    filters.inStock = inStock;
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

const searchQuerySchema = z.object({
  query: z.string().default(""),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  brand: z.union([z.string(), z.array(z.string())]).optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  inStock: z.union([z.string(), z.array(z.string())]).optional(),
  debug: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

const autocompleteQuerySchema = z.object({
  query: z.string().default(""),
});

const environmentKeySchema = z.enum(["staging", "live"]);

const queryPreviewSchema = z.object({
  query: z.string().min(1),
  pageSize: z.coerce.number().int().positive().max(20).default(10),
  environment: environmentKeySchema.optional(),
});

const merchandisingRuleConditionSchema = z.object({
  query: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  inStock: z.boolean().optional(),
});

const createMerchandisingRuleSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().default(true),
  priority: z.number().int(),
  action: z.enum(["pin", "boost", "bury", "hide"]),
  condition: merchandisingRuleConditionSchema.default({}),
  productIds: z.array(z.string()).optional(),
  brand: z.string().optional(),
  boostAmount: z.number().optional(),
  buryAmount: z.number().optional(),
});

const updateMerchandisingRuleSchema = createMerchandisingRuleSchema.partial();

const searchEventBodySchema = z.object({
  query: z.string().min(1),
  resultCount: z.number().int().min(0),
});

const clickEventBodySchema = z.object({
  query: z.string().min(1),
  productId: z.string().min(1),
  productTitle: z.string().min(1),
});

const suggestionActionTypeSchema = z.enum([
  "create_rule",
  "create_synonym",
  "open_query_preview",
]);

const actionPreviewQuerySchema = z.object({
  actionType: suggestionActionTypeSchema,
});

const applySuggestionRequestSchema = z.object({
  suggestionId: z.string().min(1),
  actionType: suggestionActionTypeSchema,
});

const auditLogFilterSchema = z.object({
  actionType: z.string().optional(),
  entityType: z.string().optional(),
  outcome: z.enum(["success", "failure"]).optional(),
  actorId: z.string().optional(),
  keyword: z.string().optional(),
});

const createSnapshotSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  environment: z.enum(["staging", "live"]).optional(),
});

const environmentOperationSchema = z.object({
  fromEnvironment: environmentKeySchema,
  toEnvironment: environmentKeySchema,
  reason: z.string().min(1),
});

const rollbackSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  environment: environmentKeySchema.optional(),
});

const snapshotDiffQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const evaluationQuerySchema = z.object({
  query: z.string().min(1),
  expectedProductIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const createQuerySetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  queries: z.array(evaluationQuerySchema).min(1),
});

const createExperimentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  baselineSnapshotId: z.string().min(1),
  candidateSnapshotId: z.string().min(1),
  querySetId: z.string().min(1),
});

const saveExperimentDecisionSchema = z.object({
  decision: z.enum(["ship", "iterate", "rollback", "undecided"]),
  rationale: z.string().min(1),
});

const promoteSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  reason: z.string().min(1),
  sourceExperimentId: z.string().optional(),
});

const createApprovalRequestSchema = z.object({
  snapshotId: z.string().min(1),
  reason: z.string().min(1),
  linkedExperimentId: z.string().optional(),
  actorId: z.string().optional(),
  assignedReviewerIds: z.array(z.string()).optional(),
});

const resolveApprovalRequestSchema = z.object({
  decision: z.enum(["approved", "rejected", "cancelled"]),
  decisionNote: z.string().optional(),
  actorId: z.string().optional(),
  actorRole: z.enum(["requester", "reviewer", "approver", "release_manager"]).optional(),
});

const executeApprovalRequestSchema = z.object({
  actorId: z.string().optional(),
  actorRole: z.enum(["requester", "reviewer", "approver", "release_manager"]).optional(),
});

const createReviewerSchema = z.object({
  name: z.string().min(1),
  role: z.enum(["requester", "reviewer", "approver", "release_manager"]),
});

const updateApprovalPolicySchema = z.object({
  requireSecondApprover: z.boolean().optional(),
  requireDifferentActorForApproval: z.boolean().optional(),
  requireDifferentActorForExecution: z.boolean().optional(),
  allowedApproverRoles: z
    .array(z.enum(["requester", "reviewer", "approver", "release_manager"]))
    .optional(),
  allowedExecutorRoles: z
    .array(z.enum(["requester", "reviewer", "approver", "release_manager"]))
    .optional(),
});

const assignReviewersSchema = z.object({
  reviewerIds: z.array(z.string()).min(1),
});

const notificationListQuerySchema = z.object({
  recipientActorId: z.string().min(1).optional(),
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const updateApprovalSlaPolicySchema = z
  .object({
    enabled: z.boolean(),
    reminderAfterHours: z.number().positive(),
    overdueAfterHours: z.number().positive(),
    escalationAfterHours: z.number().positive().optional(),
  })
  .refine((data) => data.overdueAfterHours >= data.reminderAfterHours, {
    message: "overdueAfterHours must be greater than or equal to reminderAfterHours",
    path: ["overdueAfterHours"],
  });

const reviewerActiveSchema = z.object({
  active: z.boolean(),
});

function parseEnvironmentQuery(
  value: unknown,
  defaultEnvironment: EnvironmentKey = "staging",
): EnvironmentKey {
  const parsed = environmentKeySchema.safeParse(value);
  return parsed.success ? parsed.data : defaultEnvironment;
}

function buildSuggestionParams() {
  return {
    queryAnalytics: getQueryAnalytics(),
    rules: getAllMerchandisingRules("staging"),
    products: seedProducts,
  };
}

function promoteSnapshotToLive(input: {
  snapshotId: string;
  reason: string;
  linkedExperimentId?: string;
  approvalRequestId?: string;
}): {
  restored: MerchandisingConfigSnapshotDto;
  activeConfiguration: ActiveConfigurationDto;
} | null {
  const restored = restoreSnapshotById(
    input.snapshotId,
    (rules) => replaceAllMerchandisingRules(rules, "live"),
    (synonyms) => replaceAllSynonyms(synonyms, "live"),
  );

  if (!restored) {
    return null;
  }

  const activeConfiguration = promoteActiveConfiguration(
    restored,
    input.reason,
    input.linkedExperimentId,
  );
  linkEnvironmentSnapshot("live", restored.id, restored.name);

  return {
    restored,
    activeConfiguration: {
      ...activeConfiguration,
      promotedViaApprovalRequestId: input.approvalRequestId,
    },
  };
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.get("/health", (_req, res) => {
  const body: HealthResponseDto = {
    ok: true,
    service: "search-api",
    timestamp: new Date().toISOString(),
  };
  res.json(body);
});

app.get("/api/v1/search", (req, res) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.flatten(),
    });
    return;
  }

  const request: SearchRequestDto = {
    query: parsed.data.query,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    filters: buildFilters(parsed.data),
  };

  res.json(
    searchProducts(seedProducts, request, {
      rules: getActiveMerchandisingRules("live"),
      debug: parsed.data.debug ?? false,
    }),
  );
});

app.get("/api/v1/autocomplete", (req, res) => {
  const parsed = autocompleteQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.flatten(),
    });
    return;
  }

  res.json(getAutocompleteSuggestions(seedProducts, parsed.data.query));
});

app.get("/api/v1/admin/environments", (_req, res) => {
  const body: EnvironmentListResponseDto = listEnvironmentConfigs();
  res.json(body);
});

app.post("/api/v1/admin/environments/copy", (req, res) => {
  const parsed = environmentOperationSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "copy_environment",
      entityType: "environment",
      outcome: "failure",
      summary: "Failed environment copy: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid environment copy payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  if (parsed.data.fromEnvironment === parsed.data.toEnvironment) {
    res.status(400).json({
      error: "Source and target environments must differ",
    });
    return;
  }

  const target = copyEnvironmentConfig(
    parsed.data.fromEnvironment,
    parsed.data.toEnvironment,
    parsed.data.reason,
  );

  const auditSummary =
    parsed.data.fromEnvironment === "live" &&
    parsed.data.toEnvironment === "staging"
      ? "Copied live configuration to staging"
      : `Copied ${parsed.data.fromEnvironment} configuration to ${parsed.data.toEnvironment}`;

  recordAuditLog({
    actionType: "copy_environment",
    entityType: "environment",
    entityId: parsed.data.toEnvironment,
    entityLabel: parsed.data.toEnvironment,
    outcome: "success",
    summary: auditSummary,
    metadata: {
      fromEnvironment: parsed.data.fromEnvironment,
      toEnvironment: parsed.data.toEnvironment,
      reason: parsed.data.reason.trim(),
      counts: target.counts,
    },
  });

  const body: EnvironmentOperationResponseDto = {
    success: true,
    message: auditSummary,
    target,
  };
  res.json(body);
});

app.post("/api/v1/admin/environments/promote", (req, res) => {
  const parsed = environmentOperationSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "promote_environment",
      entityType: "environment",
      outcome: "failure",
      summary: "Failed environment promotion: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid environment promotion payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  if (
    parsed.data.fromEnvironment !== "staging" ||
    parsed.data.toEnvironment !== "live"
  ) {
    res.status(400).json({
      error: "Environment promotion currently supports staging -> live only",
    });
    return;
  }

  const target = promoteEnvironmentConfig(
    parsed.data.fromEnvironment,
    parsed.data.toEnvironment,
    parsed.data.reason,
  );

  recordAuditLog({
    actionType: "promote_environment",
    entityType: "environment",
    entityId: "live",
    entityLabel: "live",
    outcome: "success",
    summary: "Promoted staging configuration to live",
    metadata: {
      reason: parsed.data.reason.trim(),
      counts: target.counts,
      snapshotId: target.snapshotId,
      snapshotName: target.snapshotName,
    },
  });

  const body: EnvironmentOperationResponseDto = {
    success: true,
    message: "Promoted staging configuration to live",
    target,
  };
  res.json(body);
});

app.get("/api/v1/admin/rules", (req, res) => {
  const environment = parseEnvironmentQuery(req.query.environment, "staging");
  res.json(getAllMerchandisingRules(environment));
});

app.get("/api/v1/admin/rules/:id", (req, res) => {
  const environment = parseEnvironmentQuery(req.query.environment, "staging");
  const rule = getMerchandisingRuleById(req.params.id, environment);
  if (!rule) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  res.json(rule);
});

app.post("/api/v1/admin/rules", (req, res) => {
  const parsed = createMerchandisingRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "create_rule",
      entityType: "merchandising_rule",
      outcome: "failure",
      summary: "Failed to create merchandising rule: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid rule payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const environment = parseEnvironmentQuery(req.query.environment, "staging");
  const rule = createMerchandisingRule(parsed.data, environment);
  const audit = getRuleAuditContext(rule);
  recordAuditLog({
    actionType: "create_rule",
    entityType: "merchandising_rule",
    entityId: audit.id,
    entityLabel: audit.name,
    outcome: "success",
    summary: `Created ${audit.action} rule '${audit.name}' for ${audit.conditionSummary} in ${environment}`,
    metadata: {
      action: audit.action,
      conditionSummary: audit.conditionSummary,
      environment,
      rule,
    },
  });
  res.status(201).json(rule);
});

app.put("/api/v1/admin/rules/:id", (req, res) => {
  const parsed = updateMerchandisingRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "update_rule",
      entityType: "merchandising_rule",
      entityId: req.params.id,
      outcome: "failure",
      summary: `Failed to update merchandising rule '${req.params.id}': invalid payload`,
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid rule payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const environment = parseEnvironmentQuery(req.query.environment, "staging");
  const rule = updateMerchandisingRule(req.params.id, parsed.data, environment);
  if (!rule) {
    recordAuditLog({
      actionType: "update_rule",
      entityType: "merchandising_rule",
      entityId: req.params.id,
      outcome: "failure",
      summary: `Failed to update merchandising rule '${req.params.id}': rule not found`,
    });
    res.status(404).json({ error: "Rule not found" });
    return;
  }

  const audit = getRuleAuditContext(rule);
  recordAuditLog({
    actionType: "update_rule",
    entityType: "merchandising_rule",
    entityId: audit.id,
    entityLabel: audit.name,
    outcome: "success",
    summary: `Updated ${audit.action} rule '${audit.name}' (${audit.conditionSummary}) in ${environment}`,
    metadata: {
      action: audit.action,
      conditionSummary: audit.conditionSummary,
      environment,
      changes: parsed.data,
      rule,
    },
  });

  res.json(rule);
});

app.delete("/api/v1/admin/rules/:id", (req, res) => {
  const environment = parseEnvironmentQuery(req.query.environment, "staging");
  const deleted = deleteMerchandisingRule(req.params.id, environment);
  if (!deleted) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  res.status(204).send();
});

app.get("/api/v1/admin/analytics/summary", (_req, res) => {
  res.json(getAnalyticsSummary());
});

app.get("/api/v1/admin/suggestions", (_req, res) => {
  const body: SuggestionsResponseDto = {
    generatedAt: new Date().toISOString(),
    suggestions: generateRuleSuggestions(buildSuggestionParams()),
  };
  res.json(body);
});

app.get("/api/v1/admin/suggestions/:id/action-preview", (req, res) => {
  const parsed = actionPreviewQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "preview_suggestion_action",
      entityType: "suggestion",
      entityId: req.params.id,
      outcome: "failure",
      summary: `Failed to preview suggestion '${req.params.id}': invalid query parameters`,
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.flatten(),
    });
    return;
  }

  const preview = buildActionPreview(
    req.params.id,
    parsed.data.actionType,
    buildSuggestionParams(),
  );

  if (!preview) {
    recordAuditLog({
      actionType: "preview_suggestion_action",
      entityType: "suggestion",
      entityId: req.params.id,
      outcome: "failure",
      summary: `Failed to preview suggestion '${req.params.id}' with action ${parsed.data.actionType}`,
      metadata: { actionType: parsed.data.actionType },
    });
    res.status(404).json({
      error: "Suggestion or action preview not available for this combination.",
    });
    return;
  }

  recordAuditLog({
    actionType: "preview_suggestion_action",
    entityType: "suggestion",
    entityId: req.params.id,
    entityLabel: preview.query,
    outcome: "success",
    summary: `Previewed suggestion ${req.params.id} with action ${parsed.data.actionType}`,
    metadata: {
      actionType: parsed.data.actionType,
      preview,
    },
  });

  res.json(preview);
});

app.post("/api/v1/admin/suggestions/apply", (req, res) => {
  const parsed = applySuggestionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "apply_suggestion",
      entityType: "suggestion",
      outcome: "failure",
      summary: "Failed to apply suggestion: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid apply payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const result = applySuggestionAction(
    parsed.data.suggestionId,
    parsed.data.actionType,
    buildSuggestionParams(),
  );

  if (!result.success) {
    recordAuditLog({
      actionType: "apply_suggestion",
      entityType: "suggestion",
      entityId: parsed.data.suggestionId,
      outcome: "failure",
      summary: `Failed to apply suggestion ${parsed.data.suggestionId} with action ${parsed.data.actionType}`,
      metadata: {
        actionType: parsed.data.actionType,
        message: result.message,
      },
    });
    res.status(400).json(result);
    return;
  }

  recordAuditLog({
    actionType: "apply_suggestion",
    entityType: "suggestion",
    entityId: parsed.data.suggestionId,
    entityLabel: result.previewQuery,
    outcome: "success",
    summary: `Applied suggestion ${parsed.data.suggestionId} with action ${parsed.data.actionType}`,
    metadata: {
      actionType: parsed.data.actionType,
      result,
    },
  });

  if (result.createdSynonymKey) {
    recordAuditLog({
      actionType: "create_synonym",
      entityType: "synonym",
      entityId: result.createdSynonymKey,
      entityLabel: result.createdSynonymKey,
      outcome: "success",
      summary: result.message,
      metadata: {
        suggestionId: parsed.data.suggestionId,
        actionType: parsed.data.actionType,
        createdSynonymKey: result.createdSynonymKey,
      },
    });
  }

  if (result.createdRuleId) {
    const rule = getMerchandisingRuleById(result.createdRuleId, "staging");
    if (rule) {
      const audit = getRuleAuditContext(rule);
      recordAuditLog({
        actionType: "create_rule",
        entityType: "merchandising_rule",
        entityId: audit.id,
        entityLabel: audit.name,
        outcome: "success",
        summary: `Created ${audit.action} rule '${audit.name}' via suggestion apply`,
        metadata: {
          suggestionId: parsed.data.suggestionId,
          actionType: parsed.data.actionType,
          conditionSummary: audit.conditionSummary,
          rule,
        },
      });
    }
  }

  res.json(result);
});

app.get("/api/v1/admin/query-preview", (req, res) => {
  const parsed = queryPreviewSchema.safeParse(req.query);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "query_preview",
      entityType: "search_query",
      outcome: "failure",
      summary: "Failed query preview: invalid query parameters",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.flatten(),
    });
    return;
  }

  const previewEnvironment = parseEnvironmentQuery(
    parsed.data.environment,
    "staging",
  );

  const result = searchProducts(
    seedProducts,
    {
      query: parsed.data.query,
      page: 1,
      pageSize: parsed.data.pageSize,
    },
    { rules: getActiveMerchandisingRules(previewEnvironment) },
  );

  const response: QueryPreviewResponseDto = {
    query: parsed.data.query,
    total: result.totalHits,
    appliedRuleNames: result.appliedRuleNames ?? [],
    hits: result.hits.map((hit) => ({
      id: hit.id,
      title: hit.title,
      brand: hit.brand,
      category: hit.category,
      score: hit.score,
      inStock: hit.inStock,
    })),
  };

  recordAuditLog({
    actionType: "query_preview",
    entityType: "search_query",
    entityId: parsed.data.query,
    entityLabel: parsed.data.query,
    outcome: "success",
    summary: `Previewed search query '${parsed.data.query}' (${result.totalHits} results) in ${previewEnvironment}`,
    metadata: {
      query: parsed.data.query,
      pageSize: parsed.data.pageSize,
      environment: previewEnvironment,
      total: result.totalHits,
      appliedRuleNames: response.appliedRuleNames,
    },
  });

  res.json(response);
});

app.get("/api/v1/admin/snapshots", (_req, res) => {
  const body: SnapshotListResponseDto = listConfigSnapshots();
  res.json(body);
});

app.post("/api/v1/admin/snapshots", (req, res) => {
  const parsed = createSnapshotSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "create_snapshot",
      entityType: "config_snapshot",
      outcome: "failure",
      summary: "Failed to create merchandising snapshot: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid snapshot payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const snapshotEnvironment = parsed.data.environment ?? "staging";
  const snapshot = createConfigSnapshotFromEnvironment(
    snapshotEnvironment,
    parsed.data,
    () => getRulesForEnvironment(snapshotEnvironment),
    () => getSynonymsForEnvironment(snapshotEnvironment),
  );

  recordAuditLog({
    actionType: "create_snapshot",
    entityType: "config_snapshot",
    entityId: snapshot.id,
    entityLabel: snapshot.name,
    outcome: "success",
    summary: `Created snapshot from ${snapshotEnvironment} environment`,
    metadata: {
      environment: snapshotEnvironment,
      counts: snapshot.counts,
      ruleIds: snapshot.ruleIds,
      synonymKeys: snapshot.synonymKeys,
    },
  });

  res.status(201).json(snapshot);
});

app.get("/api/v1/admin/snapshots/diff", (req, res) => {
  const parsed = snapshotDiffQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid diff query parameters",
      details: parsed.error.flatten(),
    });
    return;
  }

  const diff = buildSnapshotDiff(parsed.data.from, parsed.data.to);
  if (!diff) {
    recordAuditLog({
      actionType: "view_snapshot_diff",
      entityType: "config_snapshot",
      outcome: "failure",
      summary: "Failed to view snapshot diff: snapshot not found",
      metadata: {
        fromSnapshotId: parsed.data.from,
        toSnapshotId: parsed.data.to,
      },
    });
    res.status(404).json({ error: "One or both snapshots were not found" });
    return;
  }

  recordAuditLog({
    actionType: "view_snapshot_diff",
    entityType: "config_snapshot",
    entityId: diff.toSnapshotId,
    outcome: "success",
    summary: `Viewed snapshot diff from '${parsed.data.from}' to '${parsed.data.to}'`,
    metadata: {
      fromSnapshotId: diff.fromSnapshotId,
      toSnapshotId: diff.toSnapshotId,
      summary: diff.summary,
    },
  });

  const body: SnapshotDiffResponseDto = diff;
  res.json(body);
});

app.post("/api/v1/admin/snapshots/rollback", (req, res) => {
  const parsed = rollbackSnapshotSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "rollback_snapshot",
      entityType: "config_snapshot",
      outcome: "failure",
      summary: "Failed rollback: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid rollback payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const rollbackEnvironment = parsed.data.environment ?? "staging";

  const restored = rollbackToSnapshot(
    parsed.data.snapshotId,
    (rules) => replaceAllMerchandisingRules(rules, rollbackEnvironment),
    (synonyms) => replaceAllSynonyms(synonyms, rollbackEnvironment),
  );

  if (!restored) {
    recordAuditLog({
      actionType: "rollback_snapshot",
      entityType: "config_snapshot",
      entityId: parsed.data.snapshotId,
      outcome: "failure",
      summary: `Failed rollback: snapshot '${parsed.data.snapshotId}' not found`,
    });
    res.status(404).json({ error: "Snapshot not found" });
    return;
  }

  recordAuditLog({
    actionType: "rollback_snapshot",
    entityType: "config_snapshot",
    entityId: restored.id,
    entityLabel: restored.name,
    outcome: "success",
    summary: `Rolled back ${rollbackEnvironment} configuration to snapshot '${restored.name}'`,
    metadata: {
      environment: rollbackEnvironment,
      counts: restored.counts,
      ruleIds: restored.ruleIds,
      synonymKeys: restored.synonymKeys,
    },
  });

  const body: RollbackSnapshotResponseDto = {
    success: true,
    message: `Restored ${rollbackEnvironment} configuration from snapshot '${restored.name}'.`,
    restoredSnapshotId: restored.id,
  };
  res.json(body);
});

app.get("/api/v1/admin/active-configuration", (_req, res) => {
  const activeConfiguration = getActiveConfiguration();
  if (!activeConfiguration) {
    res.status(404).json({
      error: "No active configuration has been promoted yet",
    });
    return;
  }

  const executedApproval = getLatestExecutedApprovalForSnapshot(
    activeConfiguration.snapshotId,
  );

  res.json({
    ...activeConfiguration,
    promotedViaApprovalRequestId: executedApproval?.id,
  });
});

app.get("/api/v1/admin/promotions", (_req, res) => {
  const body: PromotionHistoryResponseDto = listPromotionHistory();
  res.json(body);
});

app.get("/api/v1/admin/approvals", (_req, res) => {
  const body: ApprovalListResponseDto = listApprovalRequests();
  res.json(body);
});

app.get("/api/v1/admin/reviewers", (_req, res) => {
  const body: ReviewerListResponseDto = listReviewers();
  res.json(body);
});

app.post("/api/v1/admin/reviewers", (req, res) => {
  const parsed = createReviewerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid reviewer payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const reviewer = createReviewer(parsed.data);
  res.status(201).json(reviewer);
});

app.post("/api/v1/admin/reviewers/:id/active", (req, res) => {
  const parsed = reviewerActiveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid reviewer active payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const reviewer = setReviewerActive(req.params.id, parsed.data.active);
  if (!reviewer) {
    res.status(404).json({ error: "Reviewer not found" });
    return;
  }

  res.json(reviewer);
});

app.get("/api/v1/admin/approval-policy", (_req, res) => {
  const body: ApprovalPolicyDto = getApprovalPolicy();
  res.json(body);
});

app.post("/api/v1/admin/approval-policy", (req, res) => {
  const parsed = updateApprovalPolicySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid approval policy payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const body: ApprovalPolicyDto = updateApprovalPolicy(parsed.data);
  res.json(body);
});

app.get("/api/v1/admin/approvals/:id/eligibility", (req, res) => {
  const actorId = typeof req.query.actorId === "string" ? req.query.actorId : "";
  if (!actorId) {
    res.status(400).json({ error: "actorId query parameter is required" });
    return;
  }

  const actorRole = z
    .enum(["requester", "reviewer", "approver", "release_manager"])
    .optional()
    .safeParse(req.query.actorRole).data;

  const body: ApprovalEligibilityResponseDto = getApprovalEligibility(
    req.params.id,
    actorId,
    actorRole,
  );
  res.json(body);
});

app.post("/api/v1/admin/approvals/:id/assign-reviewers", (req, res) => {
  const parsed = assignReviewersSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid assign reviewers payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const request = assignReviewersToApprovalRequest(
    req.params.id,
    parsed.data.reviewerIds,
  );

  if (!request) {
    res.status(400).json({
      error: "Could not assign reviewers to this approval request",
    });
    return;
  }

  const body: ApprovalOperationResponseDto = {
    success: true,
    message: "Assigned reviewers to approval request.",
    request,
  };
  res.json(body);
});

app.post("/api/v1/admin/approvals", (req, res) => {
  const parsed = createApprovalRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "create_approval_request",
      entityType: "approval_request",
      outcome: "failure",
      summary: "Failed to create approval request: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid approval request payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const request = createApprovalRequest(parsed.data);
  if (!request) {
    recordAuditLog({
      actionType: "create_approval_request",
      entityType: "approval_request",
      entityId: parsed.data.snapshotId,
      outcome: "failure",
      summary: `Failed to create approval request for snapshot '${parsed.data.snapshotId}'`,
    });
    res.status(400).json({
      error: "Snapshot not found or requester identity is invalid/inactive",
    });
    return;
  }

  recordAuditLog({
    actionType: "create_approval_request",
    entityType: "approval_request",
    entityId: request.id,
    entityLabel: request.snapshotName,
    outcome: "success",
    summary: `Created approval request for promoting snapshot '${request.snapshotName}' to live`,
    metadata: {
      snapshotId: request.snapshotId,
      linkedExperimentId: request.linkedExperimentId,
      reason: request.reason,
    },
  });

  const requestedNotifications = notifyApprovalRequested(request);
  for (const notification of requestedNotifications) {
    recordAuditLog({
      actionType: "generate_approval_notification",
      entityType: "notification",
      entityId: notification.id,
      outcome: "success",
      summary: `Generated approval_requested notification for approval ${request.id}`,
      metadata: {
        notificationType: notification.type,
        relatedApprovalRequestId: request.id,
      },
    });
  }

  const body: ApprovalOperationResponseDto = {
    success: true,
    message: `Approval request created for snapshot '${request.snapshotName}'.`,
    request,
  };
  res.status(201).json(body);
});

app.post("/api/v1/admin/approvals/:id/resolve", (req, res) => {
  const parsed = resolveApprovalRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "resolve_approval_request",
      entityType: "approval_request",
      entityId: req.params.id,
      outcome: "failure",
      summary: "Failed to resolve approval request: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid approval resolution payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const existing = getApprovalRequestById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }

  let request: ApprovalRequestDto | null | undefined;
  let resolveError: string | undefined;
  if (parsed.data.decision === "approved") {
    const result = approveApprovalRequest(
      req.params.id,
      parsed.data.actorId,
      parsed.data.actorRole,
      parsed.data.decisionNote,
    );
    request = result.request;
    resolveError = result.error;
  } else if (parsed.data.decision === "rejected") {
    const result = rejectApprovalRequest(
      req.params.id,
      parsed.data.actorId,
      parsed.data.actorRole,
      parsed.data.decisionNote,
    );
    request = result.request;
    resolveError = result.error;
  } else {
    request = cancelApprovalRequest(req.params.id, parsed.data.decisionNote);
  }

  if (!request) {
    recordAuditLog({
      actionType: "resolve_approval_request",
      entityType: "approval_request",
      entityId: req.params.id,
      outcome: "failure",
      summary: `Failed to ${parsed.data.decision} approval request '${req.params.id}'`,
      metadata: {
        decision: parsed.data.decision,
        error: resolveError,
      },
    });
    res.status(400).json({
      error:
        resolveError ??
        "Only pending approval requests can be approved, rejected, or cancelled",
    });
    return;
  }

  const auditSummaryByDecision: Record<string, string> = {
    approved: `Approved release request for snapshot '${request.snapshotName ?? request.snapshotId}'`,
    rejected: `Rejected release request for snapshot '${request.snapshotName ?? request.snapshotId}'`,
    cancelled: `Cancelled release request for snapshot '${request.snapshotName ?? request.snapshotId}'`,
  };

  recordAuditLog({
    actionType: "resolve_approval_request",
    entityType: "approval_request",
    entityId: request.id,
    entityLabel: request.snapshotName,
    outcome: "success",
    summary: auditSummaryByDecision[parsed.data.decision],
    metadata: {
      decision: parsed.data.decision,
      decisionNote: parsed.data.decisionNote,
      snapshotId: request.snapshotId,
    },
  });

  if (parsed.data.decision === "approved" && request.status === "approved") {
    const notification = notifyApprovalApproved(request);
    if (notification) {
      recordAuditLog({
        actionType: "generate_approval_notification",
        entityType: "notification",
        entityId: notification.id,
        outcome: "success",
        summary: `Generated approval_approved notification for approval ${request.id}`,
        metadata: { notificationType: notification.type },
      });
    }
  } else if (parsed.data.decision === "rejected") {
    const notification = notifyApprovalRejected(request);
    if (notification) {
      recordAuditLog({
        actionType: "generate_approval_notification",
        entityType: "notification",
        entityId: notification.id,
        outcome: "success",
        summary: `Generated approval_rejected notification for approval ${request.id}`,
        metadata: { notificationType: notification.type },
      });
    }
  }

  const body: ApprovalOperationResponseDto = {
    success: true,
    message: auditSummaryByDecision[parsed.data.decision],
    request,
  };
  res.json(body);
});

app.post("/api/v1/admin/approvals/:id/execute", (req, res) => {
  const parsed = executeApprovalRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid execute approval payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const approvalRequest = getApprovalRequestById(req.params.id);
  if (!approvalRequest) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }

  if (approvalRequest.status !== "approved") {
    recordAuditLog({
      actionType: "execute_approval_request",
      entityType: "approval_request",
      entityId: approvalRequest.id,
      outcome: "failure",
      summary: `Failed to execute approval request '${approvalRequest.id}': status is ${approvalRequest.status}`,
    });
    res.status(400).json({
      error: "Only approved requests can be executed",
    });
    return;
  }

  if (!approvalRequest.snapshotId) {
    res.status(400).json({ error: "Approval request is missing snapshot reference" });
    return;
  }

  const actorId = parsed.data.actorId;
  if (!actorId) {
    res.status(400).json({ error: "actorId is required to execute an approval request" });
    return;
  }

  const eligibility = getApprovalEligibility(
    approvalRequest.id,
    actorId,
    parsed.data.actorRole,
  );
  if (!eligibility.canExecute) {
    recordAuditLog({
      actionType: "execute_approval_request",
      entityType: "approval_request",
      entityId: approvalRequest.id,
      outcome: "failure",
      summary: `Failed to execute approval request '${approvalRequest.id}': reviewer not eligible`,
      metadata: { reasons: eligibility.reasons },
    });
    res.status(400).json({
      error: eligibility.reasons[0] ?? "Reviewer is not eligible to execute",
      reasons: eligibility.reasons,
    });
    return;
  }

  const promotion = promoteSnapshotToLive({
    snapshotId: approvalRequest.snapshotId,
    reason: approvalRequest.reason,
    linkedExperimentId: approvalRequest.linkedExperimentId,
    approvalRequestId: approvalRequest.id,
  });

  if (!promotion) {
    recordAuditLog({
      actionType: "execute_approval_request",
      entityType: "approval_request",
      entityId: approvalRequest.id,
      outcome: "failure",
      summary: `Failed to execute approval request '${approvalRequest.id}': snapshot not found`,
    });
    res.status(404).json({ error: "Snapshot not found" });
    return;
  }

  const executeResult = markApprovalRequestExecuted(
    approvalRequest.id,
    parsed.data.actorId,
    parsed.data.actorRole,
  );

  if (!executeResult.request) {
    recordAuditLog({
      actionType: "execute_approval_request",
      entityType: "approval_request",
      entityId: approvalRequest.id,
      outcome: "failure",
      summary: `Failed to execute approval request '${approvalRequest.id}'`,
      metadata: { error: executeResult.error },
    });
    res.status(400).json({
      error: executeResult.error ?? "Failed to mark approval request as executed",
    });
    return;
  }

  const executed = executeResult.request;

  recordAuditLog({
    actionType: "execute_approval_request",
    entityType: "approval_request",
    entityId: executed.id,
    entityLabel: executed.snapshotName,
    outcome: "success",
    summary: `Executed approved release request for snapshot '${executed.snapshotName ?? executed.snapshotId}'`,
    metadata: {
      snapshotId: executed.snapshotId,
      linkedExperimentId: executed.linkedExperimentId,
      activeConfiguration: promotion.activeConfiguration,
    },
  });

  const executedNotification = notifyApprovalExecuted(executed);
  if (executedNotification) {
    recordAuditLog({
      actionType: "generate_approval_notification",
      entityType: "notification",
      entityId: executedNotification.id,
      outcome: "success",
      summary: `Generated approval_executed notification for approval ${executed.id}`,
      metadata: { notificationType: executedNotification.type },
    });
  }

  const body: ApprovalOperationResponseDto = {
    success: true,
    message: `Executed approved release request for snapshot '${executed.snapshotName ?? executed.snapshotId}'.`,
    request: executed,
  };
  res.json(body);
});

function auditGeneratedApprovalNotifications(
  notifications: ReturnType<typeof maybeGenerateApprovalNotifications>,
): void {
  for (const notification of notifications) {
    recordAuditLog({
      actionType: "generate_approval_notification",
      entityType: "notification",
      entityId: notification.id,
      outcome: "success",
      summary: `Generated ${notification.type} notification for approval ${notification.relatedApprovalRequestId ?? "unknown"}`,
      metadata: {
        notificationType: notification.type,
        relatedApprovalRequestId: notification.relatedApprovalRequestId,
      },
    });
  }
}

app.get("/api/v1/admin/notifications", (req, res) => {
  const parsed = notificationListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid notification query parameters",
      details: parsed.error.flatten(),
    });
    return;
  }

  const generated = maybeGenerateApprovalNotifications();
  auditGeneratedApprovalNotifications(generated);

  const body: NotificationListResponseDto = listNotifications({
    recipientActorId: parsed.data.recipientActorId,
    unreadOnly: parsed.data.unreadOnly,
  });
  res.json(body);
});

app.post("/api/v1/admin/notifications/:id/read", (req, res) => {
  const notification = markNotificationRead(req.params.id);
  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  recordAuditLog({
    actionType: "mark_notification_read",
    entityType: "notification",
    entityId: notification.id,
    outcome: "success",
    summary: `Marked notification ${notification.id} as read`,
    metadata: {
      notificationType: notification.type,
      relatedApprovalRequestId: notification.relatedApprovalRequestId,
    },
  });

  res.json(notification);
});

app.post("/api/v1/admin/notifications/read-all", (_req, res) => {
  const updatedCount = markAllNotificationsRead();

  recordAuditLog({
    actionType: "mark_notification_read",
    entityType: "notification",
    outcome: "success",
    summary:
      updatedCount > 0
        ? `Marked ${updatedCount} notifications as read`
        : "No unread notifications to mark as read",
    metadata: { updatedCount },
  });

  const body: NotificationListResponseDto = listNotifications();
  res.json(body);
});

app.get("/api/v1/admin/approval-sla", (_req, res) => {
  const generated = maybeGenerateApprovalNotifications();
  auditGeneratedApprovalNotifications(generated);

  const body: ApprovalSlaOverviewDto = computeApprovalSlaOverview();
  res.json(body);
});

app.get("/api/v1/admin/approval-sla/policy", (_req, res) => {
  const body: ApprovalSlaPolicyDto = getApprovalSlaPolicy();
  res.json(body);
});

app.post("/api/v1/admin/approval-sla/policy", (req, res) => {
  const parsed = updateApprovalSlaPolicySchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "update_approval_sla_policy",
      entityType: "approval_request",
      outcome: "failure",
      summary: "Failed to update approval SLA policy: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid approval SLA policy payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const body: ApprovalSlaPolicyDto = updateApprovalSlaPolicy(parsed.data);

  recordAuditLog({
    actionType: "update_approval_sla_policy",
    entityType: "approval_request",
    outcome: "success",
    summary: `Updated approval SLA policy: reminder ${body.reminderAfterHours}h, overdue ${body.overdueAfterHours}h`,
    metadata: {
      enabled: body.enabled,
      reminderAfterHours: body.reminderAfterHours,
      overdueAfterHours: body.overdueAfterHours,
      escalationAfterHours: body.escalationAfterHours,
    },
  });

  res.json(body);
});

app.post("/api/v1/admin/promote-snapshot", (req, res) => {
  const parsed = promoteSnapshotSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "promote_snapshot",
      entityType: "config_snapshot",
      outcome: "failure",
      summary: "Failed promotion: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid promotion payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const promotion = promoteSnapshotToLive({
    snapshotId: parsed.data.snapshotId,
    reason: parsed.data.reason,
    linkedExperimentId: parsed.data.sourceExperimentId,
  });

  if (!promotion) {
    recordAuditLog({
      actionType: "promote_snapshot",
      entityType: "config_snapshot",
      entityId: parsed.data.snapshotId,
      outcome: "failure",
      summary: `Failed promotion: could not restore snapshot '${parsed.data.snapshotId}'`,
    });
    res.status(404).json({ error: "Snapshot not found" });
    return;
  }

  const { restored, activeConfiguration } = promotion;

  let warning: string | undefined;
  if (parsed.data.sourceExperimentId) {
    const experiment = getExperimentById(parsed.data.sourceExperimentId);
    const decision = getExperimentDecision(parsed.data.sourceExperimentId);

    if (!experiment) {
      warning = "Linked source experiment was not found.";
    } else if (!decision || decision.decision !== "ship") {
      warning =
        "Linked experiment does not have a recorded ship decision yet.";
    }
  } else {
    warning =
      "Snapshot promoted without linking a source experiment or ship decision.";
  }

  const auditSummary = parsed.data.sourceExperimentId
    ? `Promoted snapshot '${restored.name}' from experiment ${parsed.data.sourceExperimentId}`
    : `Promoted snapshot '${restored.name}' to active configuration`;

  recordAuditLog({
    actionType: "promote_snapshot",
    entityType: "config_snapshot",
    entityId: restored.id,
    entityLabel: restored.name,
    outcome: "success",
    summary: auditSummary,
    metadata: {
      reason: parsed.data.reason.trim(),
      sourceExperimentId: parsed.data.sourceExperimentId,
      counts: restored.counts,
      warning,
    },
  });

  const message = warning
    ? `Promoted '${restored.name}' to active configuration. Warning: ${warning}`
    : `Promoted '${restored.name}' to active configuration.`;

  const body: PromoteSnapshotResponseDto = {
    success: true,
    message,
    activeConfiguration,
    warning,
  };
  res.json(body);
});

app.get("/api/v1/admin/snapshots/:id", (req, res) => {
  const snapshot = getConfigSnapshotById(req.params.id);
  if (!snapshot) {
    res.status(404).json({ error: "Snapshot not found" });
    return;
  }
  res.json(snapshot);
});

app.get("/api/v1/admin/query-sets", (_req, res) => {
  res.json({ total: listQuerySets().length, querySets: listQuerySets() });
});

app.post("/api/v1/admin/query-sets", (req, res) => {
  const parsed = createQuerySetSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "create_query_set",
      entityType: "query_set",
      outcome: "failure",
      summary: "Failed to create evaluation query set: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid query set payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const querySet = createQuerySet(parsed.data);
  recordAuditLog({
    actionType: "create_query_set",
    entityType: "query_set",
    entityId: querySet.id,
    entityLabel: querySet.name,
    outcome: "success",
    summary: `Created evaluation query set '${querySet.name}' with ${querySet.queries.length} queries`,
    metadata: { queryCount: querySet.queries.length },
  });
  res.status(201).json(querySet);
});

app.get("/api/v1/admin/experiments", (_req, res) => {
  res.json({ total: listExperiments().length, experiments: listExperiments() });
});

app.post("/api/v1/admin/experiments", (req, res) => {
  const parsed = createExperimentSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "create_experiment",
      entityType: "experiment",
      outcome: "failure",
      summary: "Failed to create experiment: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid experiment payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  if (!getConfigSnapshotById(parsed.data.baselineSnapshotId)) {
    res.status(400).json({ error: "Baseline snapshot not found" });
    return;
  }
  if (!getConfigSnapshotById(parsed.data.candidateSnapshotId)) {
    res.status(400).json({ error: "Candidate snapshot not found" });
    return;
  }
  if (!getQuerySetById(parsed.data.querySetId)) {
    res.status(400).json({ error: "Query set not found" });
    return;
  }

  const experiment = createExperiment(parsed.data);
  recordAuditLog({
    actionType: "create_experiment",
    entityType: "experiment",
    entityId: experiment.id,
    entityLabel: experiment.name,
    outcome: "success",
    summary: `Created experiment '${experiment.name}'`,
    metadata: {
      baselineSnapshotId: experiment.baselineSnapshotId,
      candidateSnapshotId: experiment.candidateSnapshotId,
      querySetId: experiment.querySetId,
    },
  });
  res.status(201).json(experiment);
});

app.get("/api/v1/admin/experiments/:id", (req, res) => {
  const experiment = getExperimentById(req.params.id);
  if (!experiment) {
    res.status(404).json({ error: "Experiment not found" });
    return;
  }

  const body: ExperimentDetailResponseDto = {
    experiment,
    lastRun: getLastExperimentRun(experiment.id),
    scorecard: getExperimentScorecard(experiment.id),
    decision: getExperimentDecision(experiment.id),
  };
  res.json(body);
});

app.post("/api/v1/admin/experiments/:id/scorecard/generate", (req, res) => {
  const experiment = getExperimentById(req.params.id);
  if (!experiment) {
    res.status(404).json({ error: "Experiment not found" });
    return;
  }

  const run = getLastExperimentRun(experiment.id);
  if (!run) {
    recordAuditLog({
      actionType: "generate_scorecard",
      entityType: "experiment",
      entityId: experiment.id,
      entityLabel: experiment.name,
      outcome: "failure",
      summary: `Failed to generate scorecard for '${experiment.name}': no experiment run available`,
    });
    res.status(400).json({ error: "Run the experiment before generating a scorecard" });
    return;
  }

  const scorecard = buildExperimentScorecard(run);
  saveExperimentScorecard(experiment.id, scorecard);

  recordAuditLog({
    actionType: "generate_scorecard",
    entityType: "experiment",
    entityId: experiment.id,
    entityLabel: experiment.name,
    outcome: "success",
    summary: `Generated scorecard for experiment '${experiment.name}' (${scorecard.headlineStatus})`,
    metadata: {
      headlineStatus: scorecard.headlineStatus,
      linkedRunAt: run.runAt,
      guardrailFindings: scorecard.guardrailFindings,
    },
  });

  res.json(scorecard);
});

app.get("/api/v1/admin/experiments/:id/scorecard", (req, res) => {
  const experiment = getExperimentById(req.params.id);
  if (!experiment) {
    res.status(404).json({ error: "Experiment not found" });
    return;
  }

  const scorecard = getExperimentScorecard(experiment.id);
  if (!scorecard) {
    res.status(404).json({ error: "Scorecard not found for this experiment" });
    return;
  }

  res.json(scorecard);
});

app.get("/api/v1/admin/experiments/:id/decision", (req, res) => {
  const experiment = getExperimentById(req.params.id);
  if (!experiment) {
    res.status(404).json({ error: "Experiment not found" });
    return;
  }

  const decision = getExperimentDecision(experiment.id);
  if (!decision) {
    res.status(404).json({ error: "Decision not found for this experiment" });
    return;
  }

  res.json(decision);
});

app.post("/api/v1/admin/experiments/:id/decision", (req, res) => {
  const parsed = saveExperimentDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "save_experiment_decision",
      entityType: "experiment",
      entityId: req.params.id,
      outcome: "failure",
      summary: "Failed to save experiment decision: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid decision payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const experiment = getExperimentById(req.params.id);
  if (!experiment) {
    res.status(404).json({ error: "Experiment not found" });
    return;
  }

  const lastRun = getLastExperimentRun(experiment.id);
  const decision = saveExperimentDecision(
    experiment.id,
    parsed.data,
    lastRun?.runAt,
  );

  const decisionSummaryByType: Record<string, string> = {
    ship: `Recorded ship decision for experiment '${experiment.name}'`,
    iterate: `Recorded iterate decision for experiment '${experiment.name}'`,
    rollback: `Recorded rollback decision for experiment '${experiment.name}'`,
    undecided: `Recorded undecided decision for experiment '${experiment.name}'`,
  };

  recordAuditLog({
    actionType: "save_experiment_decision",
    entityType: "experiment",
    entityId: experiment.id,
    entityLabel: experiment.name,
    outcome: "success",
    summary: decisionSummaryByType[parsed.data.decision],
    metadata: {
      decision: parsed.data.decision,
      rationale: parsed.data.rationale,
      linkedRunAt: decision.linkedRunAt,
    },
  });

  res.json(decision);
});

app.post("/api/v1/admin/experiments/:id/run", (req, res) => {
  const experiment = getExperimentById(req.params.id);
  if (!experiment) {
    recordAuditLog({
      actionType: "run_experiment",
      entityType: "experiment",
      entityId: req.params.id,
      outcome: "failure",
      summary: `Failed to run experiment '${req.params.id}': not found`,
    });
    res.status(404).json({ error: "Experiment not found" });
    return;
  }

  const querySet = getQuerySetById(experiment.querySetId);
  const baseline = getSnapshotSearchConfig(experiment.baselineSnapshotId);
  const candidate = getSnapshotSearchConfig(experiment.candidateSnapshotId);

  if (!querySet || !baseline || !candidate) {
    recordAuditLog({
      actionType: "run_experiment",
      entityType: "experiment",
      entityId: experiment.id,
      entityLabel: experiment.name,
      outcome: "failure",
      summary: `Failed to run experiment '${experiment.name}': missing query set or snapshot config`,
    });
    res.status(400).json({ error: "Missing query set or snapshot configuration" });
    return;
  }

  const run = runExperimentEvaluation({
    experimentId: experiment.id,
    baseline,
    candidate,
    querySet,
    products: seedProducts,
  });

  saveExperimentRun(run);

  recordAuditLog({
    actionType: "run_experiment",
    entityType: "experiment",
    entityId: experiment.id,
    entityLabel: experiment.name,
    outcome: "success",
    summary: `Ran experiment '${experiment.name}' across ${run.summary.totalQueries} evaluation queries`,
    metadata: {
      summary: run.summary,
      runAt: run.runAt,
    },
  });

  res.json(run);
});

app.get("/api/v1/admin/audit-logs", (req, res) => {
  const parsed = auditLogFilterSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid audit log filters",
      details: parsed.error.flatten(),
    });
    return;
  }

  const body: AuditLogResponseDto = listAuditLogs(parsed.data);
  res.json(body);
});

app.post("/api/v1/events/search", (req, res) => {
  const parsed = searchEventBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid search event payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const event = recordSearchEvent(parsed.data);
  res.status(201).json(event);
});

app.post("/api/v1/events/click", (req, res) => {
  const parsed = clickEventBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid click event payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const event = recordSearchClick(parsed.data);
  res.status(201).json(event);
});

app.get("/api/v1/analytics/summary", (_req, res) => {
  res.json(getAnalyticsSummary());
});

app.listen(env.SEARCH_API_PORT, env.SEARCH_API_HOST, () => {
  console.log(
    `search-api listening on http://${env.SEARCH_API_HOST}:${env.SEARCH_API_PORT}`,
  );
});
