import express from "express";
import { z } from "zod";
import { env } from "@retailer-search/config";
import { getAutocompleteSuggestions, searchFederatedIndexes, searchProducts } from "@retailer-search/search-core";
import type {
  ApprovalEligibilityResponseDto,
  ApprovalListResponseDto,
  ApprovalOperationResponseDto,
  ApprovalPolicyDto,
  ApprovalRequestDto,
  ApprovalAssignmentHistoryResponseDto,
  ApprovalExceptionDto,
  ApprovalExceptionListResponseDto,
  ApprovalSlaOverviewDto,
  ApprovalSlaPolicyDto,
  AuditLogResponseDto,
  ActiveConfigurationDto,
  BootstrapAdminResponseDto,
  BootstrapStateDto,
  CollaborationCommentDto,
  CollaborationThreadDto,
  DelegationListResponseDto,
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
  RuleDraftListResponseDto,
  ScheduledReleaseListResponseDto,
  SavedViewListResponseDto,
  SearchFiltersDto,
  SearchRequestDto,
  SearchMetricsSnapshotDto,
  SnapshotDiffResponseDto,
  SnapshotListResponseDto,
  SuggestionsResponseDto,
  AccessRequestListResponseDto,
  AccessReviewListResponseDto,
  CurrentUserResponseDto,
  LoginResponseDto,
  UserDto,
  ActivePrivilegeListResponseDto,
  ApiKeyListResponseDto,
  AuditHashChainReportDto,
  BackgroundJobDto,
  BrowseResponseDto,
  FederatedSearchDebugDto,
  ExportJobListResponseDto,
  ExportTargetType,
  JitElevationRequestListResponseDto,
  JitPolicyDto,
  SecurityTimelineResponseDto,
  WebhookDeliveryLogListResponseDto,
  WebhookEndpointListResponseDto,
  WebhookEventType,
  ZeroResultInsightsResponseDto,
  WorkspaceStateDto,
} from "@retailer-search/shared-types";
import {
  getLatestExecutedApprovalForSnapshot,
  approveApprovalRequest,
  assignReviewersToApprovalRequest,
  cancelApprovalRequest,
  computeApprovalSlaOverview,
  createApprovalRequest,
  getApprovalEligibility,
  getApprovalRequestById,
  getApprovalSlaPolicy,
  listApprovalRequests,
  listApprovalAssignmentHistory,
  listOpenApprovalExceptions,
  manuallyReassignApprovalRequest,
  markApprovalRequestExecuted,
  maybeGenerateApprovalNotifications,
  notifyApprovalApproved,
  notifyApprovalExecuted,
  notifyApprovalRejected,
  notifyApprovalRequested,
  rejectApprovalRequest,
  resolveApprovalException,
  updateApprovalSlaPolicy,
} from "./approval-store.js";
import {
  createDelegationRule,
  deactivateDelegationRule,
  listDelegationRules,
} from "./delegation-store.js";
import {
  addAnnotation,
  addComment,
  getCollaborationThread,
  getCommentById,
  hydrateCollaborationStore,
  updateCommentStatus,
} from "./collaboration-store.js";
import {
  createSavedView,
  getWorkspaceState,
  listSavedViews,
  setDefaultSavedView,
  updateSavedView,
} from "./workspace-store.js";
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
import {
  hydrateAuditTrailStore,
  listAuditLogs,
  recordAuditLog,
  recordForbiddenAccess,
  recordRateLimitExceeded,
  recordUnauthorizedAccess,
  verifyAuditHashChain,
} from "./audit-trail-store.js";
import {
  completeBootstrap,
  configureBootstrapPlatform,
  configureBootstrapSecurity,
  createBootstrapAdmin,
  ensureBootstrapState,
  hydrateBootstrapStore,
  getPlatformConfig,
  isSetupRequired,
} from "./bootstrap-store.js";
import { connectDatabase } from "./db.js";
import {
  attachRateLimitHeaders,
  attachSecurityHeaders,
  applyRateLimit,
  createAdminMutationRateLimitPolicy,
  createAdminReadRateLimitPolicy,
  createAuthLoginRateLimitPolicy,
  getRequestId,
  isAdminMutationRequest,
  requireHttpsInProduction,
  requireJsonContentType,
} from "./api-security.js";
import {
  forbidden as forbiddenError,
  internalError,
  conflict as conflictError,
  rateLimited as rateLimitedError,
  unauthenticated as unauthenticatedError,
  validationError as validationErrorBody,
} from "./error-response.js";
import { cleanupExpiredRateLimitEntries } from "./rate-limit-store.js";
import {
  createNotification,
  hydrateNotificationStore,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification-store.js";
import {
  getAnalyticsSummary,
  getQueryAnalytics,
  getZeroResultInsights,
  hydrateAnalyticsStore,
  recordSearchClick,
  recordSearchEvent,
} from "./analytics-store.js";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "./auth/api-key-store.js";
import {
  attachApiKeyContext,
  enforceApiKeyRateLimit,
  requireApiKeyScope,
} from "./auth/require-api-key.js";
import { enqueueCatalogReindex } from "./jobs/handlers/reindex-catalog.js";
import { getJobById, listJobs } from "./jobs/job-queue.js";
import { startReleaseScheduler } from "./jobs/release-scheduler.js";
import {
  approveRuleDraft,
  generateRuleDraft,
  getRuleDraftById,
  listRuleDrafts,
  markRuleDraftApplied,
  rejectRuleDraft,
} from "./llm/rule-draft-service.js";
import {
  listRegisteredIndexes,
  resolveFederatedSources,
} from "./index/federated-index-registry.js";
import {
  cancelScheduledRelease,
  createScheduledRelease,
  listScheduledReleases,
} from "./scheduled-release-store.js";
import { hybridSearchProducts } from "./search/hybrid-search.js";
import { isHybridVectorEnabled } from "./search/search-feature-flags.js";
import {
  browseCategoriesResponse,
  browseProducts,
} from "./browse/browse-service.js";
import { getCatalogAnalyticsInsights } from "./catalog-analytics.js";
import { getCatalogVocabulary } from "./catalog-vocabulary.js";
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
import {
  getProductCatalog,
  getProductCatalogCount,
  getProductCatalogSource,
  ensureProductCatalogLoaded,
  hydrateProductCatalog,
} from "./catalog-store.js";
import {
  getProductSearchIndex,
  syncProductSearchIndexFromCatalog,
} from "./index/product-index-manager.js";
import {
  getSearchMetricsSnapshot,
  recordAutocompleteRequest,
  recordBrowseRequest,
  recordSearchRequest,
  renderPrometheusMetrics,
} from "./observability/search-metrics.js";
import { buildLiveQueryProcessorConfig } from "./ranking/query-processor.js";
import {
  buildEvalContext,
  buildSnapshotScopeKey,
  createCompiledRuleSnapshot,
  evaluateMerchandisingRules,
  formatMerchRuntimeBenchmarkReport,
  formatSnapshotCacheBenchmarkReport,
  formatSnapshotManagerBenchmarkReport,
  getDefaultSnapshotManager,
  getSnapshotMetrics,
  runMerchRuntimeBenchmark,
  runSnapshotCacheBenchmark,
  runSnapshotManagerBenchmark,
  type CompiledRuleSnapshot,
  type SearchCandidate,
} from "./merch-runtime/index.js";
import { registerInternalLlmDebugRoutes } from "./routes/internal-llm-debug.js";
import { llmEnhancedSearch } from "./search/llm-enhanced-search.js";
import { isAnyLlmFeatureEnabled } from "./search/search-feature-flags.js";
import {
  completeAccessReviewRun,
  createAccessRequest,
  createAccessReviewRun,
  getAccessRequestById,
  getAccessReviewRunById,
  hydrateAccessGovernanceStore,
  listAccessRequests,
  listAccessReviewRuns,
  resolveAccessRequest,
  resolveAccessReviewItem,
} from "./access-governance-store.js";
import {
  createAuthenticatedUserContext,
  createSession,
  deleteSession,
  findUserByEmail,
  getCurrentUserFromAuthHeader,
  hydrateAuthStore,
  isLoginAllowedDuringSetup,
  listUsers,
  userCount,
  validatePassword,
} from "./auth-store.js";
import { hydrateEnvironmentConfigStore } from "./environment-config-store.js";
import { hydrateApprovalStore } from "./approval-store.js";
import {
  createJitElevationRequest,
  expireJitAccess,
  getActivePrivilegeForUser,
  getActivePrivileges,
  getEffectiveRoleForUser,
  getJitElevationRequestById,
  getJitPolicy,
  hydrateJitAccessStore,
  listJitElevationRequests,
  resolveJitElevationRequest,
  revokeJitAccess,
  updateJitPolicy,
} from "./jit-access-store.js";
import {
  buildSecurityTimelineEntries,
  createExportJob,
  generateExportData,
  getExportJobById,
  hydrateExportStore,
  listExportJobs,
} from "./export-store.js";
import {
  createWebhookEndpoint,
  emitWebhookEvent,
  getDefaultTestPayload,
  getWebhookEndpointById,
  listWebhookDeliveryLogs,
  listWebhookEndpoints,
  setWebhookEndpointActive,
} from "./webhook-store.js";
import { getPermissionsForUser, getPermissionDeniedMessage, hasPermissionForUser } from "./rbac.js";

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

function getSearchPipelineOptions() {
  return {
    index: getProductSearchIndex(),
    queryProcessorConfig: buildLiveQueryProcessorConfig(),
  };
}

function getAnalyticsContext(req: express.Request) {
  return {
    tenantId: req.apiKey?.tenantId ?? "default",
    apiKeyId: req.apiKey?.id,
    sessionId: req.header("x-session-id") ?? undefined,
  };
}

function parseIndexNames(
  raw: string | string[] | undefined,
): string[] {
  if (!raw) {
    return ["catalog"];
  }
  const values = Array.isArray(raw) ? raw : raw.split(",");
  return values.map((value) => value.trim()).filter(Boolean);
}

async function assertDirectLivePromotionAllowed(
  snapshotId: string,
  approvalRequestId?: string,
): Promise<string | null> {
  const platform = await getPlatformConfig();
  if (!platform?.requireApprovalForLivePromotion) {
    return null;
  }

  const executed = getLatestExecutedApprovalForSnapshot(snapshotId);
  if (executed && (!approvalRequestId || executed.id === approvalRequestId)) {
    return null;
  }

  return "Live promotion requires an executed approval request when policy is enabled.";
}

const searchQuerySchema = z.object({
  query: z.string().default(""),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  brand: z.union([z.string(), z.array(z.string())]).optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  inStock: z.union([z.string(), z.array(z.string())]).optional(),
  indexes: z.union([z.string(), z.array(z.string())]).optional(),
  debug: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

const autocompleteQuerySchema = z.object({
  query: z.string().default(""),
});

const browseQuerySchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  inStock: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      return value === true || value === "true";
    }),
  sort: z
    .enum(["relevance", "price_asc", "price_desc", "title_asc"])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const createApiKeySchema = z.object({
  name: z.string().min(1),
  tenantId: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  rateLimitPerMinute: z.coerce.number().int().positive().max(10_000).optional(),
  expiresAt: z.string().datetime().optional(),
});

const createScheduledReleaseSchema = z.object({
  type: z.enum(["promote_snapshot", "rollback_snapshot"]),
  snapshotId: z.string().min(1),
  reason: z.string().min(1),
  scheduledAt: z.string().datetime(),
  linkedExperimentId: z.string().optional(),
  approvalRequestId: z.string().optional(),
});

const generateRuleDraftSchema = z.object({
  query: z.string().min(1),
  productId: z.string().optional(),
});

const environmentKeySchema = z.enum(["staging", "live"]);

const queryPreviewSchema = z.object({
  query: z.string().min(1),
  pageSize: z.coerce.number().int().positive().max(20).default(10),
  environment: environmentKeySchema.optional(),
});

const merchRuntimeEvaluateSchema = z.object({
  query: z.string().min(1),
  environment: environmentKeySchema.default("staging"),
  tenantId: z.string().default("default"),
  candidateLimit: z.coerce.number().int().positive().max(250).default(50),
});

function buildDemoCompiledMerchSnapshot(version = "1.0.0"): CompiledRuleSnapshot {
  return createCompiledRuleSnapshot({
    snapshotId: "demo-runtime-v1",
    tenantId: "default",
    environment: "staging",
    version,
    generatedAtEpochMs: Date.now(),
    queryExactMap: {
      drill: [
        {
          ruleId: "demo-boost-drill",
          ruleVersionId: "demo-boost-drill-v1",
          priority: 100,
          scopeType: "query_exact",
          stackingMode: "additive",
        },
      ],
    },
    ruleEffectsMap: {
      "demo-boost-drill": [
        {
          productId: "prod-00821",
          effectType: "boost",
          effectValue: 25,
          reasonCode: "demo_drill_boost",
        },
        {
          productId: "prod-00185",
          effectType: "pin",
          effectValue: 0,
          pinPosition: 1,
          reasonCode: "demo_drill_pin",
        },
      ],
    },
  });
}

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

const experimentLlmOverridesSchema = z
  .object({
    queryRewriteEnabled: z.boolean().optional(),
    zeroResultsEnabled: z.boolean().optional(),
    rerankEnabled: z.boolean().optional(),
  })
  .optional();

const createExperimentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  baselineSnapshotId: z.string().min(1),
  candidateSnapshotId: z.string().min(1),
  querySetId: z.string().min(1),
  candidateLlmOverrides: experimentLlmOverridesSchema,
});

const saveExperimentDecisionSchema = z.object({
  decision: z.enum(["ship", "iterate", "rollback", "undecided"]),
  rationale: z.string().min(1),
});

const promoteSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  reason: z.string().min(1),
  sourceExperimentId: z.string().optional(),
  approvalRequestId: z.string().optional(),
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

const createDelegationRuleSchema = z.object({
  fromReviewerId: z.string().min(1),
  toReviewerId: z.string().min(1),
  mode: z.enum(["delegate", "reassign"]),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  reason: z.string().optional(),
});

const reassignApprovalSchema = z.object({
  nextReviewerIds: z.array(z.string().min(1)).min(1),
  reason: z.string().min(1),
});

const resolveApprovalExceptionSchema = z.object({
  note: z.string().optional(),
});

const collaborationTargetTypeSchema = z.enum([
  "approval_request",
  "experiment",
  "experiment_run",
  "snapshot",
  "promotion",
  "exception",
]);

const collaborationThreadQuerySchema = z.object({
  targetType: collaborationTargetTypeSchema,
  targetId: z.string().min(1),
});

const createCommentSchema = z.object({
  targetType: collaborationTargetTypeSchema,
  targetId: z.string().min(1),
  actorId: z.string().min(1),
  actorLabel: z.string().min(1),
  message: z.string().min(1),
  parentCommentId: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

const createAnnotationSchema = z.object({
  targetType: collaborationTargetTypeSchema,
  targetId: z.string().min(1),
  actorId: z.string().min(1),
  actorLabel: z.string().min(1),
  anchorLabel: z.string().min(1),
  note: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

const resolveCommentSchema = z.object({
  status: z.enum(["open", "resolved"]),
});

const workspaceRoleSchema = z.enum([
  "merchandiser",
  "reviewer",
  "approver",
  "release_manager",
  "admin",
]);

const savedViewsQuerySchema = z.object({
  role: workspaceRoleSchema.optional(),
});

const workspaceQuerySchema = z.object({
  activeRole: workspaceRoleSchema.optional(),
});

const createSavedViewSchema = z.object({
  name: z.string().min(1),
  role: workspaceRoleSchema,
  description: z.string().optional(),
  filters: z.record(z.unknown()),
  isDefault: z.boolean().optional(),
});

const updateSavedViewSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
});

const setDefaultSavedViewSchema = z.object({
  role: workspaceRoleSchema,
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

async function buildSuggestionParams() {
  return {
    queryAnalytics: getQueryAnalytics(),
    rules: getAllMerchandisingRules("staging"),
    products: await getSearchProductCatalog(),
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

const userRoleSchema = z.enum([
  "merchandiser",
  "reviewer",
  "approver",
  "release_manager",
  "admin",
]);

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createBootstrapAdminSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(1),
});

const configureBootstrapSecuritySchema = z.object({
  passwordMinLength: z.coerce.number().int().min(8).max(128),
  loginAttemptLimit: z.coerce.number().int().min(1).max(100),
  lockoutWindowMinutes: z.coerce.number().int().min(1).max(1440),
  sessionTtlHours: z.coerce.number().int().min(1).max(720),
  auditLoggingEnabled: z.boolean(),
});

const configureBootstrapPlatformSchema = z.object({
  instanceName: z.string().trim().min(1),
  stagingEnvironmentLabel: z.string().trim().min(1),
  liveEnvironmentLabel: z.string().trim().min(1),
  requireApprovalForLivePromotion: z.boolean(),
  jitEnabled: z.boolean(),
  defaultJitDurationMinutes: z.coerce.number().int().positive(),
  accessReviewCadenceDays: z.coerce.number().int().positive(),
  defaultWorkspaceRole: z.literal("admin"),
});

const completeBootstrapSchema = z.object({
  confirm: z.literal(true),
});

const createAccessRequestSchema = z.object({
  requestedRole: userRoleSchema,
  justification: z.string().min(8),
});

const resolveAccessRequestSchema = z.object({
  decision: z.enum(["approved", "denied", "cancelled"]),
  reviewerNote: z.string().optional(),
});

const createAccessReviewRunSchema = z.object({
  roles: z.array(userRoleSchema).optional(),
});

const resolveAccessReviewItemSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["keep", "downgrade", "disable"]),
  note: z.string().optional(),
});

const createJitElevationRequestSchema = z.object({
  requestedRole: userRoleSchema,
  justification: z.string().min(8),
  requestedDurationMinutes: z.coerce.number().int().positive(),
});

const resolveJitElevationRequestSchema = z.object({
  decision: z.enum(["approve", "deny", "cancel"]),
  reviewerNote: z.string().optional(),
});

const updateJitPolicySchema = z.object({
  enabled: z.boolean(),
  defaultDurationMinutes: z.coerce.number().int().positive(),
  maxDurationMinutes: z.coerce.number().int().positive(),
  approvalRequiredRoles: z.array(userRoleSchema),
  elevatableRoles: z.array(userRoleSchema).min(1),
});

const exportTargetTypeSchema = z.enum([
  "audit_trail",
  "approvals",
  "access_reviews",
  "security_timeline",
  "audit_review_findings",
]);

const exportFormatSchema = z.enum(["json", "csv"]);

const createExportJobSchema = z.object({
  targetType: exportTargetTypeSchema,
  format: exportFormatSchema,
  filters: z.record(z.unknown()).optional(),
});

const webhookEventTypeSchema = z.enum([
  "auth.login.succeeded",
  "auth.login.failed",
  "rbac.access.denied",
  "approval.created",
  "approval.approved",
  "approval.rejected",
  "promotion.executed",
  "jit.request.approved",
  "jit.request.revoked",
  "audit.review.completed",
]);

const createWebhookEndpointSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  subscribedEvents: z.array(webhookEventTypeSchema).min(1),
  secret: z.string().optional(),
});

const toggleWebhookEndpointSchema = z.object({
  active: z.boolean(),
});

const testWebhookFireSchema = z.object({
  eventType: webhookEventTypeSchema,
  payload: z.record(z.unknown()).optional(),
});

async function dispatchWebhookEvent(
  type: WebhookEventType,
  payload: Record<string, unknown>,
  actorId?: string,
  actorLabel?: string,
): Promise<void> {
  const deliveries = await emitWebhookEvent({ type, payload });

  for (const delivery of deliveries) {
    const endpoint = getWebhookEndpointById(delivery.endpointId);
    recordAuditLog({
      actionType: "webhook_delivery",
      entityType: "webhook_delivery",
      entityId: delivery.id,
      actorId,
      actorLabel,
      outcome: delivery.status === "succeeded" ? "success" : "failure",
      summary:
        delivery.status === "succeeded"
          ? `Webhook delivery succeeded for endpoint ${endpoint?.name ?? delivery.endpointId} on event ${delivery.eventType}`
          : `Webhook delivery failed for endpoint ${endpoint?.name ?? delivery.endpointId} on event ${delivery.eventType}`,
      metadata: {
        endpointId: delivery.endpointId,
        endpointName: endpoint?.name,
        eventType: delivery.eventType,
        responseStatusCode: delivery.responseStatusCode,
        errorMessage: delivery.errorMessage,
      },
    });
  }
}

function sendValidationError(
  res: express.Response,
  req: express.Request,
  message: string,
  details?: Record<string, unknown>,
): void {
  res
    .status(400)
    .json(validationErrorBody(message, details, getRequestId(req)));
}

function assertValidBody<T>(
  parsed: z.SafeParseReturnType<unknown, T>,
  res: express.Response,
  req: express.Request,
  message = "Invalid request payload",
): parsed is z.SafeParseSuccess<T> {
  if (parsed.success) {
    return true;
  }

  sendValidationError(res, req, message, parsed.error.flatten());
  return false;
}

function sendForbidden(
  res: express.Response,
  req: express.Request,
  message: string,
  details?: Record<string, unknown>,
): void {
  res.status(403).json(forbiddenError(message, getRequestId(req), details));
}

function sendSetupRequired(
  res: express.Response,
  req: express.Request,
  message = "Initial setup must be completed before using this endpoint",
): void {
  res.status(423).json(
    forbiddenError(message, getRequestId(req), { reason: "setup_required" }),
  );
}

function requireSetupComplete(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (isSetupRequired()) {
    sendSetupRequired(res, _req);
    return;
  }

  next();
}

function sendBootstrapError(
  res: express.Response,
  req: express.Request,
  error: unknown,
): void {
  const message =
    error instanceof Error ? error.message : "Bootstrap operation failed";

  if (message.includes("already been completed")) {
    res.status(409).json(conflictError(message, getRequestId(req)));
    return;
  }

  sendValidationError(res, req, message);
}

function enforceAdminRateLimit(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  cleanupExpiredRateLimitEntries();

  const policy = isAdminMutationRequest(req)
    ? createAdminMutationRateLimitPolicy()
    : createAdminReadRateLimitPolicy();
  const result = applyRateLimit(req, policy);
  attachRateLimitHeaders(res, result.status);

  if (!result.allowed) {
    const user = getCurrentUserFromAuthHeader(req.headers.authorization);
    recordRateLimitExceeded({
      summary: `Admin ${policy.name} rate limit exceeded for ${req.method} ${req.path}`,
      path: req.path,
      method: req.method,
      policyName: policy.name,
      actorId: user?.id,
      actorLabel: user?.email,
      metadata: { resetAt: result.status.resetAt },
    });
    res.status(429).json(
      rateLimitedError(
        "Too many admin requests. Please slow down and try again.",
        { policy: policy.name, resetAt: result.status.resetAt },
        getRequestId(req),
      ),
    );
    return;
  }

  next();
}

function enforceAdminJsonContentType(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (isAdminMutationRequest(req) && !requireJsonContentType(req, res)) {
    return;
  }

  next();
}

function requireExportAccess(
  req: express.Request,
  res: express.Response,
  targetType: ExportTargetType,
): UserDto | null {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return null;
  }

  const effectiveRole = getEffectiveRoleForUser(user);

  if (targetType === "access_reviews" || targetType === "audit_review_findings") {
    if (user.role !== "admin" && effectiveRole !== "admin") {
      recordForbiddenAccess({
        summary: `User ${user.email} attempted unauthorized export of ${targetType}`,
        path: req.path,
        method: req.method,
        actorId: user.id,
        actorLabel: user.email,
        metadata: { targetType },
      });
      sendForbidden(res, req, "Admin access required for this export");
      return null;
    }
    return user;
  }

  const permissionByTarget: Partial<
    Record<ExportTargetType, "view_audit_logs" | "view_approvals">
  > = {
    audit_trail: "view_audit_logs",
    security_timeline: "view_audit_logs",
    approvals: "view_approvals",
  };

  const permission = permissionByTarget[targetType];
  if (permission && !hasPermissionForUser(user, permission, effectiveRole)) {
    recordAuditLog({
      actionType: "authorization_denied",
      entityType: "export_job",
      actorId: user.id,
      actorLabel: user.email,
      outcome: "failure",
      summary: `User ${user.email} attempted unauthorized export of ${targetType}`,
      metadata: { targetType, path: req.path },
    });
    void dispatchWebhookEvent(
      "rbac.access.denied",
      {
        email: user.email,
        path: req.path,
        action: "export",
        targetType,
      },
      user.id,
      user.email,
    );
    res.status(403).json(
      forbiddenError(
        getPermissionDeniedMessage(permission),
        getRequestId(req),
        { targetType, path: req.path },
      ),
    );
    return null;
  }

  return user;
}

function syncJitAccess(): void {
  const expiredRequests = expireJitAccess();
  for (const request of expiredRequests) {
    recordAuditLog({
      actionType: "expire_jit_elevation",
      entityType: "jit_elevation_request",
      entityId: request.id,
      actorId: request.requesterUserId,
      actorLabel: request.requesterEmail,
      outcome: "success",
      summary: `JIT elevation ${request.id} expired automatically`,
      metadata: {
        requestedRole: request.requestedRole,
        expiresAt: request.expiresAt,
      },
    });
  }
}

function requireAuthenticatedUser(
  req: express.Request,
  res: express.Response,
): UserDto | null {
  syncJitAccess();
  const user = getCurrentUserFromAuthHeader(req.headers.authorization);
  if (!user) {
    recordUnauthorizedAccess({
      summary: `Unauthenticated request to ${req.method} ${req.path}`,
      path: req.path,
      method: req.method,
    });
    res
      .status(401)
      .json(unauthenticatedError(undefined, getRequestId(req)));
    return null;
  }

  return user;
}

function getAuthenticatedContext(user: UserDto) {
  syncJitAccess();
  const effectiveRole = getEffectiveRoleForUser(user);
  return createAuthenticatedUserContext(user, effectiveRole);
}

function requireAdminUser(
  req: express.Request,
  res: express.Response,
): UserDto | null {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return null;
  }

  if (user.role !== "admin") {
    recordForbiddenAccess({
      summary: `User ${user.email} attempted unauthorized admin action`,
      path: req.path,
      method: req.method,
      actorId: user.id,
      actorLabel: user.email,
    });
    void dispatchWebhookEvent(
      "rbac.access.denied",
      {
        email: user.email,
        path: req.path,
        method: req.method,
      },
      user.id,
      user.email,
    );
    sendForbidden(res, req, "Admin access required");
    return null;
  }

  return user;
}

const app = express();
app.set("trust proxy", true);
app.use(express.json());
app.use(attachApiKeyContext);

app.use((req, res, next) => {
  attachSecurityHeaders(req, res);
  if (!requireHttpsInProduction(req, res)) {
    return;
  }
  next();
});

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Request-Id, X-API-Key, X-Session-Id",
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use("/api/v1/admin", requireSetupComplete);
app.use("/api/v1/admin", enforceAdminRateLimit);
app.use("/api/v1/admin", enforceAdminJsonContentType);

app.get("/health", async (_req, res) => {
  await ensureProductCatalogLoaded();
  const body: HealthResponseDto = {
    ok: true,
    service: "search-api",
    timestamp: new Date().toISOString(),
    database: {
      connected: databaseConnected,
      userCount: databaseConnected ? userCount() : 0,
      productCount: getProductCatalogCount(),
      catalogSource: getProductCatalogSource(),
    },
  };
  res.json(body);
});

app.get("/metrics", (_req, res) => {
  res.type("text/plain; version=0.0.4; charset=utf-8");
  res.send(renderPrometheusMetrics());
});

app.get("/api/v1/internal/metrics", (_req, res) => {
  const body: SearchMetricsSnapshotDto = getSearchMetricsSnapshot();
  res.json(body);
});

app.get("/api/v1/setup/status", async (_req, res) => {
  try {
    const state = await ensureBootstrapState();
    res.json(state satisfies BootstrapStateDto);
  } catch (error) {
    console.error("Failed to load bootstrap status", error);
    res
      .status(500)
      .json(internalError("Failed to load setup status", undefined, getRequestId(_req)));
  }
});

app.post("/api/v1/setup/admin", async (req, res) => {
  if (!requireJsonContentType(req, res)) {
    return;
  }

  if (!isSetupRequired()) {
    res.status(409).json(
      conflictError("Initial setup has already been completed", getRequestId(req)),
    );
    return;
  }

  const parsed = createBootstrapAdminSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid bootstrap admin payload")) {
    return;
  }

  try {
    const result = await createBootstrapAdmin(parsed.data);
    const body: BootstrapAdminResponseDto = result;
    res.status(201).json(body);
  } catch (error) {
    sendBootstrapError(res, req, error);
  }
});

app.post("/api/v1/setup/security", async (req, res) => {
  if (!requireJsonContentType(req, res)) {
    return;
  }

  if (!isSetupRequired()) {
    res.status(409).json(
      conflictError("Initial setup has already been completed", getRequestId(req)),
    );
    return;
  }

  const user = requireAuthenticatedUser(req, res);
  if (!user || user.role !== "admin") {
    if (user) {
      sendForbidden(res, req, "Admin access required for setup");
    }
    return;
  }

  const parsed = configureBootstrapSecuritySchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid bootstrap security payload")) {
    return;
  }

  try {
    const state = await configureBootstrapSecurity(parsed.data);
    res.json(state);
  } catch (error) {
    sendBootstrapError(res, req, error);
  }
});

app.post("/api/v1/setup/platform", async (req, res) => {
  if (!requireJsonContentType(req, res)) {
    return;
  }

  if (!isSetupRequired()) {
    res.status(409).json(
      conflictError("Initial setup has already been completed", getRequestId(req)),
    );
    return;
  }

  const user = requireAuthenticatedUser(req, res);
  if (!user || user.role !== "admin") {
    if (user) {
      sendForbidden(res, req, "Admin access required for setup");
    }
    return;
  }

  const parsed = configureBootstrapPlatformSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid bootstrap platform payload")) {
    return;
  }

  try {
    const state = await configureBootstrapPlatform(parsed.data);
    res.json(state);
  } catch (error) {
    sendBootstrapError(res, req, error);
  }
});

app.post("/api/v1/setup/complete", async (req, res) => {
  if (!requireJsonContentType(req, res)) {
    return;
  }

  if (!isSetupRequired()) {
    res.status(409).json(
      conflictError("Initial setup has already been completed", getRequestId(req)),
    );
    return;
  }

  const user = requireAuthenticatedUser(req, res);
  if (!user || user.role !== "admin") {
    if (user) {
      sendForbidden(res, req, "Admin access required for setup");
    }
    return;
  }

  const parsed = completeBootstrapSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid bootstrap completion payload")) {
    return;
  }

  try {
    const state = await completeBootstrap(user);
    res.json(state);
  } catch (error) {
    sendBootstrapError(res, req, error);
  }
});

app.get("/api/v1/search", requireApiKeyScope("search:read"), enforceApiKeyRateLimit("search"), async (req, res) => {
  const started = Date.now();
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!assertValidBody(parsed, res, req, "Invalid query parameters")) {
    return;
  }

  const request: SearchRequestDto = {
    query: parsed.data.query,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    filters: buildFilters(parsed.data),
  };

  const products = await getSearchProductCatalog();
  const rules = getActiveMerchandisingRules("live");
  const debug = parsed.data.debug ?? false;
  const pipeline = getSearchPipelineOptions();
  const indexNames = parseIndexNames(parsed.data.indexes);
  const federatedSources = resolveFederatedSources(indexNames);

  if (
    federatedSources.length > 1 ||
    (indexNames.length === 1 && indexNames[0] !== "catalog")
  ) {
    const result = searchFederatedIndexes(request, {
      sources: federatedSources.map((source) => ({
        name: source.name,
        getProducts: source.getProducts,
      })),
      rules,
      debug,
      ...pipeline,
    });
    const federatedDebug: FederatedSearchDebugDto = {
      indexes: indexNames,
      mergedHitCount: result.totalHits,
      hybridVectorEnabled: isHybridVectorEnabled(),
    };
    res.json({ ...result, federatedDebug });
    recordSearchRequest(Date.now() - started);
    return;
  }

  if (isAnyLlmFeatureEnabled()) {
    res.json(
      await llmEnhancedSearch(products, request, {
        rules,
        debug,
        ...pipeline,
      }),
    );
    recordSearchRequest(Date.now() - started);
    return;
  }

  if (isHybridVectorEnabled()) {
    res.json(
      await hybridSearchProducts(products, request, {
        rules,
        debug,
        ...pipeline,
      }),
    );
    recordSearchRequest(Date.now() - started);
    return;
  }

  res.json(
    searchProducts(products, request, {
      rules,
      debug,
      ...pipeline,
    }),
  );
  recordSearchRequest(Date.now() - started);
});

app.get("/api/v1/autocomplete", requireApiKeyScope("search:read"), enforceApiKeyRateLimit("autocomplete"), async (req, res) => {
  const started = Date.now();
  const parsed = autocompleteQuerySchema.safeParse(req.query);
  if (!assertValidBody(parsed, res, req, "Invalid query parameters")) {
    return;
  }

  const products = await getSearchProductCatalog();
  res.json(
    getAutocompleteSuggestions(products, parsed.data.query, getSearchPipelineOptions()),
  );
  recordAutocompleteRequest(Date.now() - started);
});

app.get("/api/v1/browse", requireApiKeyScope("browse:read"), enforceApiKeyRateLimit("browse"), async (req, res) => {
  const started = Date.now();
  const parsed = browseQuerySchema.safeParse(req.query);
  if (!assertValidBody(parsed, res, req, "Invalid browse parameters")) {
    return;
  }

  const products = await getSearchProductCatalog();
  const body: BrowseResponseDto = browseProducts(products, parsed.data);
  res.json(body);
  recordBrowseRequest(Date.now() - started);
});

app.get("/api/v1/browse/categories", requireApiKeyScope("browse:read"), async (_req, res) => {
  const products = await getSearchProductCatalog();
  res.json(browseCategoriesResponse(products));
});

app.post("/api/v1/auth/login", (req, res) => {
  if (!requireJsonContentType(req, res)) {
    return;
  }

  const parsed = loginBodySchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid login payload")) {
    return;
  }

  const loginPolicy = createAuthLoginRateLimitPolicy(parsed.data.email);
  const rateLimitResult = applyRateLimit(req, loginPolicy);
  attachRateLimitHeaders(res, rateLimitResult.status);

  if (!rateLimitResult.allowed) {
    recordRateLimitExceeded({
      summary: `Login rate limit exceeded for ${parsed.data.email}`,
      path: req.path,
      method: req.method,
      policyName: loginPolicy.name,
      actorLabel: parsed.data.email,
      metadata: {
        email: parsed.data.email,
        resetAt: rateLimitResult.status.resetAt,
      },
    });
    recordAuditLog({
      actionType: "user_login",
      entityType: "user",
      outcome: "failure",
      summary: `Login rate limit exceeded for ${parsed.data.email}`,
      metadata: { email: parsed.data.email, reason: "rate_limited" },
    });
    res.status(429).json(
      rateLimitedError(
        "Too many login attempts. Please wait and try again.",
        { resetAt: rateLimitResult.status.resetAt },
        getRequestId(req),
      ),
    );
    return;
  }

  const user = findUserByEmail(parsed.data.email);
  if (!user || !validatePassword(user, parsed.data.password)) {
    if (isSetupRequired()) {
      sendSetupRequired(
        res,
        req,
        "This instance requires initial setup before sign-in.",
      );
      return;
    }

    recordAuditLog({
      actionType: "user_login",
      entityType: "user",
      outcome: "failure",
      summary: `Failed login attempt for ${parsed.data.email}`,
    });
    void dispatchWebhookEvent("auth.login.failed", {
      email: parsed.data.email,
      reason: "invalid_credentials",
    });
    const body: LoginResponseDto = {
      success: false,
      message: "Invalid email or password",
    };
    res.status(401).json(body);
    return;
  }

  if (isSetupRequired() && !isLoginAllowedDuringSetup(user)) {
    sendSetupRequired(
      res,
      req,
      "Only the bootstrap admin can sign in until initial setup is complete.",
    );
    return;
  }

  const session = createSession(user);
  recordAuditLog({
    actionType: "user_login",
    entityType: "user",
    entityId: user.id,
    actorId: user.id,
    actorLabel: user.email,
    outcome: "success",
    summary: `User ${user.email} logged in`,
  });
  void dispatchWebhookEvent(
    "auth.login.succeeded",
    { email: user.email, userId: user.id },
    user.id,
    user.email,
  );

  const body: LoginResponseDto = {
    success: true,
    session,
  };
  res.json(body);
});

app.post("/api/v1/auth/logout", (req, res) => {
  const header = req.headers.authorization;
  const user = getCurrentUserFromAuthHeader(header);
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";

  if (token) {
    deleteSession(token);
  }

  if (user) {
    recordAuditLog({
      actionType: "user_logout",
      entityType: "user",
      entityId: user.id,
      actorId: user.id,
      actorLabel: user.email,
      outcome: "success",
      summary: `User ${user.email} logged out`,
    });
  }

  res.json({ success: true });
});

app.get("/api/v1/auth/me", (req, res) => {
  syncJitAccess();
  const user = getCurrentUserFromAuthHeader(req.headers.authorization);
  if (!user) {
    const body: CurrentUserResponseDto = { authenticated: false };
    res.json(body);
    return;
  }

  const context = getAuthenticatedContext(user);
  const activePrivilege = getActivePrivilegeForUser(user);

  const body: CurrentUserResponseDto = {
    authenticated: true,
    user,
    standingRole: context.standingRole,
    effectiveRole: context.effectiveRole,
    activePrivilege,
    permissions: getPermissionsForUser(user, context.effectiveRole),
  };
  res.json(body);
});

app.get("/api/v1/admin/access-requests", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const allRequests = listAccessRequests();
  const requests =
    user.role === "admin"
      ? allRequests.requests
      : allRequests.requests.filter(
          (request) => request.requesterUserId === user.id,
        );

  const body: AccessRequestListResponseDto = {
    total: requests.length,
    requests,
  };
  res.json(body);
});

app.post("/api/v1/admin/access-requests", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const parsed = createAccessRequestSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid access request payload")) {
    return;
  }

  const result = createAccessRequest(user, parsed.data);
  if (!result.success || !result.request) {
    recordAuditLog({
      actionType: "create_access_request",
      entityType: "access_request",
      outcome: "failure",
      actorId: user.id,
      actorLabel: user.email,
      summary: `Failed access request from ${user.email}`,
      metadata: { error: result.error },
    });
    res.status(400).json({ error: result.error ?? "Failed to create access request" });
    return;
  }

  recordAuditLog({
    actionType: "create_access_request",
    entityType: "access_request",
    entityId: result.request.id,
    actorId: user.id,
    actorLabel: user.email,
    outcome: "success",
    summary: `User ${user.email} requested role ${result.request.requestedRole}`,
    metadata: {
      requestedRole: result.request.requestedRole,
      justification: result.request.justification,
    },
  });

  res.status(201).json(result.request);
});

app.post("/api/v1/admin/access-requests/:id/resolve", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const parsed = resolveAccessRequestSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid access request resolution payload")) {
    return;
  }

  const existing = getAccessRequestById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Access request not found" });
    return;
  }

  const result = resolveAccessRequest(
    req.params.id,
    parsed.data.decision,
    user,
    parsed.data.reviewerNote,
  );

  if (!result.success || !result.request) {
    recordAuditLog({
      actionType: "resolve_access_request",
      entityType: "access_request",
      entityId: req.params.id,
      actorId: user.id,
      actorLabel: user.email,
      outcome: "failure",
      summary: `Failed to ${parsed.data.decision} access request ${req.params.id}`,
      metadata: { error: result.error, decision: parsed.data.decision },
    });
    res.status(400).json({ error: result.error ?? "Failed to resolve access request" });
    return;
  }

  recordAuditLog({
    actionType: "resolve_access_request",
    entityType: "access_request",
    entityId: result.request.id,
    actorId: user.id,
    actorLabel: user.email,
    outcome: "success",
    summary:
      parsed.data.decision === "approved"
        ? `Admin approved access request ${result.request.id} for role ${result.request.requestedRole}`
        : parsed.data.decision === "denied"
          ? `Admin denied access request ${result.request.id}`
          : `Access request ${result.request.id} cancelled`,
    metadata: {
      decision: parsed.data.decision,
      reviewerNote: parsed.data.reviewerNote,
      requestedRole: result.request.requestedRole,
    },
  });

  if (parsed.data.decision === "approved") {
    recordAuditLog({
      actionType: "update_user_role",
      entityType: "user",
      entityId: result.request.requesterUserId,
      actorId: user.id,
      actorLabel: user.email,
      outcome: "success",
      summary: `Updated ${result.request.requesterEmail} role to ${result.request.requestedRole}`,
      metadata: {
        requestedRole: result.request.requestedRole,
        accessRequestId: result.request.id,
      },
    });
  }

  res.json(result.request);
});

app.get("/api/v1/admin/access-reviews", (req, res) => {
  const user = requireAdminUser(req, res);
  if (!user) {
    return;
  }

  const body: AccessReviewListResponseDto = listAccessReviewRuns();
  res.json(body);
});

app.post("/api/v1/admin/access-reviews", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const parsed = createAccessReviewRunSchema.safeParse(req.body ?? {});
  if (!assertValidBody(parsed, res, req, "Invalid access review payload")) {
    return;
  }

  const users = listUsers().users;
  const run = createAccessReviewRun(admin, users, parsed.data.roles);

  const scopeLabel =
    run.scope.roles.length === 5
      ? "all roles"
      : run.scope.roles.join(", ");

  recordAuditLog({
    actionType: "create_access_review",
    entityType: "access_review",
    entityId: run.id,
    actorId: admin.id,
    actorLabel: admin.email,
    outcome: "success",
    summary: `Started access review run for roles ${scopeLabel}`,
    metadata: {
      roles: run.scope.roles,
      totalUsers: run.items.length,
    },
  });

  res.status(201).json(run);
});

app.get("/api/v1/admin/access-reviews/:id", (req, res) => {
  const user = requireAdminUser(req, res);
  if (!user) {
    return;
  }

  const run = getAccessReviewRunById(req.params.id);
  if (!run) {
    res.status(404).json({ error: "Access review run not found" });
    return;
  }

  res.json(run);
});

app.post("/api/v1/admin/access-reviews/:id/items/resolve", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const parsed = resolveAccessReviewItemSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid access review item payload")) {
    return;
  }

  const result = resolveAccessReviewItem(
    req.params.id,
    parsed.data.userId,
    parsed.data.action,
    parsed.data.note,
  );

  if (!result.success || !result.run) {
    recordAuditLog({
      actionType: "resolve_access_review_item",
      entityType: "access_review",
      entityId: req.params.id,
      actorId: admin.id,
      actorLabel: admin.email,
      outcome: "failure",
      summary: `Failed access review item action for user ${parsed.data.userId}`,
      metadata: { error: result.error, action: parsed.data.action },
    });
    res.status(400).json({ error: result.error ?? "Failed to resolve review item" });
    return;
  }

  const item = result.run.items.find((entry) => entry.userId === parsed.data.userId);
  const itemEmail = item?.userEmail ?? parsed.data.userId;

  recordAuditLog({
    actionType: "resolve_access_review_item",
    entityType: "access_review",
    entityId: req.params.id,
    actorId: admin.id,
    actorLabel: admin.email,
    outcome: "success",
    summary:
      parsed.data.action === "disable"
        ? `Disabled inactive user ${itemEmail} during access review`
        : parsed.data.action === "downgrade"
          ? `Downgraded ${itemEmail} from ${result.previousRole} to ${result.nextRole} during access review`
          : `Kept access for ${itemEmail} during access review`,
    metadata: {
      userId: parsed.data.userId,
      action: parsed.data.action,
      note: parsed.data.note,
      previousRole: result.previousRole,
      nextRole: result.nextRole,
    },
  });

  if (parsed.data.action === "disable") {
    recordAuditLog({
      actionType: "disable_user",
      entityType: "user",
      entityId: parsed.data.userId,
      actorId: admin.id,
      actorLabel: admin.email,
      outcome: "success",
      summary: `Disabled user ${itemEmail} during access review`,
      metadata: { accessReviewRunId: req.params.id },
    });
  } else if (
    parsed.data.action === "downgrade" &&
    result.previousRole &&
    result.nextRole &&
    result.previousRole !== result.nextRole
  ) {
    recordAuditLog({
      actionType: "update_user_role",
      entityType: "user",
      entityId: parsed.data.userId,
      actorId: admin.id,
      actorLabel: admin.email,
      outcome: "success",
      summary: `Updated ${itemEmail} role to ${result.nextRole} during access review`,
      metadata: {
        previousRole: result.previousRole,
        nextRole: result.nextRole,
        accessReviewRunId: req.params.id,
      },
    });
  }

  res.json(result.run);
});

app.post("/api/v1/admin/access-reviews/:id/complete", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const result = completeAccessReviewRun(req.params.id);
  if (!result.success || !result.run) {
    recordAuditLog({
      actionType: "complete_access_review",
      entityType: "access_review",
      entityId: req.params.id,
      actorId: admin.id,
      actorLabel: admin.email,
      outcome: "failure",
      summary: `Failed to complete access review ${req.params.id}`,
      metadata: { error: result.error },
    });
    res.status(400).json({ error: result.error ?? "Failed to complete access review" });
    return;
  }

  recordAuditLog({
    actionType: "complete_access_review",
    entityType: "access_review",
    entityId: result.run.id,
    actorId: admin.id,
    actorLabel: admin.email,
    outcome: "success",
    summary: `Completed access review run ${result.run.id}`,
    metadata: result.run.summary,
  });
  void dispatchWebhookEvent(
    "audit.review.completed",
    {
      reviewRunId: result.run.id,
      totalUsers: result.run.summary?.totalUsers,
      createdByName: result.run.createdByName,
    },
    admin.id,
    admin.email,
  );

  res.json(result.run);
});

app.get("/api/v1/admin/jit-policy", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const body: JitPolicyDto = getJitPolicy();
  res.json(body);
});

app.post("/api/v1/admin/jit-policy", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const parsed = updateJitPolicySchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid JIT policy payload")) {
    return;
  }

  try {
    const policy = updateJitPolicy(parsed.data);
    recordAuditLog({
      actionType: "update_jit_policy",
      entityType: "jit_policy",
      entityId: "default",
      actorId: admin.id,
      actorLabel: admin.email,
      outcome: "success",
      summary: "Updated JIT elevation policy",
      metadata: { ...policy },
    });
    res.json(policy);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update JIT policy",
    });
  }
});

app.get("/api/v1/admin/jit-requests", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const allRequests = listJitElevationRequests();
  const requests =
    user.role === "admin"
      ? allRequests.requests
      : allRequests.requests.filter(
          (request) => request.requesterUserId === user.id,
        );

  const body: JitElevationRequestListResponseDto = {
    total: requests.length,
    requests,
  };
  res.json(body);
});

app.post("/api/v1/admin/jit-requests", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const parsed = createJitElevationRequestSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid JIT elevation request payload")) {
    return;
  }

  const result = createJitElevationRequest(parsed.data, user);
  if (!result.success || !result.request) {
    recordAuditLog({
      actionType: "create_jit_elevation_request",
      entityType: "jit_elevation_request",
      outcome: "failure",
      actorId: user.id,
      actorLabel: user.email,
      summary: `Failed JIT elevation request from ${user.email}`,
      metadata: { error: result.error },
    });
    res.status(400).json({ error: result.error ?? "Failed to create JIT elevation request" });
    return;
  }

  recordAuditLog({
    actionType: "create_jit_elevation_request",
    entityType: "jit_elevation_request",
    entityId: result.request.id,
    actorId: user.id,
    actorLabel: user.email,
    outcome: "success",
    summary: `User ${user.email} requested temporary role ${result.request.requestedRole} for ${result.request.requestedDurationMinutes} minutes`,
    metadata: {
      requestedRole: result.request.requestedRole,
      requestedDurationMinutes: result.request.requestedDurationMinutes,
      status: result.request.status,
      justification: result.request.justification,
    },
  });

  if (result.request.status === "active") {
    recordAuditLog({
      actionType: "resolve_jit_elevation_request",
      entityType: "jit_elevation_request",
      entityId: result.request.id,
      actorId: user.id,
      actorLabel: user.email,
      outcome: "success",
      summary: `JIT elevation ${result.request.id} auto-activated for ${user.email}`,
      metadata: {
        requestedRole: result.request.requestedRole,
        expiresAt: result.request.expiresAt,
      },
    });
    void dispatchWebhookEvent(
      "jit.request.approved",
      {
        requestId: result.request.id,
        requesterEmail: result.request.requesterEmail,
        requestedRole: result.request.requestedRole,
        expiresAt: result.request.expiresAt,
        autoActivated: true,
      },
      user.id,
      user.email,
    );
  }

  res.status(201).json(result.request);
});

app.post("/api/v1/admin/jit-requests/:id/resolve", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const parsed = resolveJitElevationRequestSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid JIT elevation resolution payload")) {
    return;
  }

  const existing = getJitElevationRequestById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "JIT elevation request not found" });
    return;
  }

  const result = resolveJitElevationRequest(
    req.params.id,
    parsed.data.decision,
    user,
    parsed.data.reviewerNote,
  );

  if (!result.success || !result.request) {
    recordAuditLog({
      actionType: "resolve_jit_elevation_request",
      entityType: "jit_elevation_request",
      entityId: req.params.id,
      actorId: user.id,
      actorLabel: user.email,
      outcome: "failure",
      summary: `Failed to ${parsed.data.decision} JIT elevation ${req.params.id}`,
      metadata: { error: result.error, decision: parsed.data.decision },
    });
    res.status(400).json({ error: result.error ?? "Failed to resolve JIT elevation request" });
    return;
  }

  const decisionSummary: Record<string, string> = {
    approve: `Admin approved JIT elevation ${result.request.id} for ${result.request.requesterEmail}`,
    deny: `Admin denied JIT elevation ${result.request.id} for ${result.request.requesterEmail}`,
    cancel: `JIT elevation ${result.request.id} cancelled`,
  };

  recordAuditLog({
    actionType: "resolve_jit_elevation_request",
    entityType: "jit_elevation_request",
    entityId: result.request.id,
    actorId: user.id,
    actorLabel: user.email,
    outcome: "success",
    summary: decisionSummary[parsed.data.decision],
    metadata: {
      decision: parsed.data.decision,
      reviewerNote: parsed.data.reviewerNote,
      requestedRole: result.request.requestedRole,
      expiresAt: result.request.expiresAt,
    },
  });

  if (parsed.data.decision === "approve" && result.request.status === "active") {
    void dispatchWebhookEvent(
      "jit.request.approved",
      {
        requestId: result.request.id,
        requesterEmail: result.request.requesterEmail,
        requestedRole: result.request.requestedRole,
        expiresAt: result.request.expiresAt,
      },
      user.id,
      user.email,
    );
  }

  res.json(result.request);
});

app.post("/api/v1/admin/jit-requests/:id/revoke", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const existing = getJitElevationRequestById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "JIT elevation request not found" });
    return;
  }

  const result = revokeJitAccess(req.params.id, admin);
  if (!result.success || !result.request) {
    recordAuditLog({
      actionType: "revoke_jit_elevation",
      entityType: "jit_elevation_request",
      entityId: req.params.id,
      actorId: admin.id,
      actorLabel: admin.email,
      outcome: "failure",
      summary: `Failed to revoke JIT elevation ${req.params.id}`,
      metadata: { error: result.error },
    });
    res.status(400).json({ error: result.error ?? "Failed to revoke JIT elevation" });
    return;
  }

  recordAuditLog({
    actionType: "revoke_jit_elevation",
    entityType: "jit_elevation_request",
    entityId: result.request.id,
    actorId: admin.id,
    actorLabel: admin.email,
    outcome: "success",
    summary: `Admin revoked active JIT elevation ${result.request.id}`,
    metadata: {
      requesterEmail: result.request.requesterEmail,
      requestedRole: result.request.requestedRole,
    },
  });
  void dispatchWebhookEvent(
    "jit.request.revoked",
    {
      requestId: result.request.id,
      requesterEmail: result.request.requesterEmail,
      requestedRole: result.request.requestedRole,
    },
    admin.id,
    admin.email,
  );

  res.json(result.request);
});

app.get("/api/v1/admin/active-privileges", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  syncJitAccess();
  const privileges = getActivePrivileges();

  const body: ActivePrivilegeListResponseDto = {
    total: privileges.length,
    privileges:
      user.role === "admin"
        ? privileges
        : privileges.filter((privilege) => privilege.userId === user.id),
  };
  res.json(body);
});

app.get("/api/v1/admin/security-timeline", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const effectiveRole = getEffectiveRoleForUser(user);
  if (!hasPermissionForUser(user, "view_audit_logs", effectiveRole)) {
    recordForbiddenAccess({
      summary: `User ${user.email} attempted unauthorized security timeline access`,
      path: req.path,
      method: req.method,
      actorId: user.id,
      actorLabel: user.email,
    });
    sendForbidden(
      res,
      req,
      getPermissionDeniedMessage("view_audit_logs"),
    );
    return;
  }

  const filters: Record<string, unknown> = {};
  if (typeof req.query.category === "string") {
    filters.category = req.query.category;
  }
  if (typeof req.query.severity === "string") {
    filters.severity = req.query.severity;
  }

  const entries = buildSecurityTimelineEntries(filters);
  const body: SecurityTimelineResponseDto = {
    total: entries.length,
    entries,
  };
  res.json(body);
});

app.get("/api/v1/admin/exports", (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const body: ExportJobListResponseDto = listExportJobs();
  res.json(body);
});

app.post("/api/v1/admin/exports", async (req, res) => {
  const parsed = createExportJobSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid export job payload")) {
    return;
  }

  const user = requireExportAccess(req, res, parsed.data.targetType);
  if (!user) {
    return;
  }

  const job = await createExportJob(parsed.data, user);

  if (job.status === "generated") {
    recordAuditLog({
      actionType: "create_export_job",
      entityType: "export_job",
      entityId: job.id,
      actorId: user.id,
      actorLabel: user.email,
      outcome: "success",
      summary: `User ${user.email} exported ${job.targetType} as ${job.format.toUpperCase()}`,
      metadata: {
        targetType: job.targetType,
        format: job.format,
        fileName: job.fileName,
        recordCount: job.recordCount,
        filters: job.filters,
      },
    });
    res.status(201).json(job);
    return;
  }

  recordAuditLog({
    actionType: "create_export_job",
    entityType: "export_job",
    entityId: job.id,
    actorId: user.id,
    actorLabel: user.email,
    outcome: "failure",
    summary: `Failed export of ${job.targetType} for ${user.email}`,
    metadata: { errorMessage: job.errorMessage },
  });
  res.status(400).json({ error: job.errorMessage ?? "Failed to create export job" });
});

app.get("/api/v1/admin/exports/:id/download", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const job = getExportJobById(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Export job not found" });
    return;
  }

  if (
    job.createdByUserId !== user.id &&
    user.role !== "admin" &&
    getEffectiveRoleForUser(user) !== "admin"
  ) {
    res.status(403).json({ error: "You do not have permission to download this export" });
    return;
  }

  if (job.status !== "generated") {
    res.status(400).json({ error: job.errorMessage ?? "Export job did not generate successfully" });
    return;
  }

  try {
    const generated = await generateExportData(
      job.targetType,
      job.format,
      job.filters ?? {},
    );

    recordAuditLog({
      actionType: "download_export",
      entityType: "export_job",
      entityId: job.id,
      actorId: user.id,
      actorLabel: user.email,
      outcome: "success",
      summary: `User ${user.email} downloaded export ${job.id}`,
      metadata: {
        fileName: job.fileName,
        targetType: job.targetType,
        format: job.format,
        recordCount: generated.recordCount,
      },
    });

    res.setHeader("Content-Type", generated.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${job.fileName ?? `${job.targetType}.${job.format}`}"`,
    );
    res.send(generated.content);
  } catch (error) {
    recordAuditLog({
      actionType: "download_export",
      entityType: "export_job",
      entityId: job.id,
      actorId: user.id,
      actorLabel: user.email,
      outcome: "failure",
      summary: `Failed download of export ${job.id} for ${user.email}`,
      metadata: {
        error: error instanceof Error ? error.message : "Download failed",
      },
    });
    res.status(500).json({ error: "Failed to generate export download" });
  }
});

app.get("/api/v1/admin/webhooks", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const body: WebhookEndpointListResponseDto = listWebhookEndpoints();
  res.json(body);
});

app.post("/api/v1/admin/webhooks", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const parsed = createWebhookEndpointSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid webhook endpoint payload")) {
    return;
  }

  const endpoint = createWebhookEndpoint(parsed.data);
  recordAuditLog({
    actionType: "create_webhook_endpoint",
    entityType: "webhook_endpoint",
    entityId: endpoint.id,
    actorId: admin.id,
    actorLabel: admin.email,
    outcome: "success",
    summary: `Created webhook endpoint ${endpoint.name}`,
    metadata: {
      url: endpoint.url,
      subscribedEvents: endpoint.subscribedEvents,
    },
  });
  res.status(201).json(endpoint);
});

app.post("/api/v1/admin/webhooks/:id/toggle", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const parsed = toggleWebhookEndpointSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid webhook toggle payload")) {
    return;
  }

  const endpoint = setWebhookEndpointActive(req.params.id, parsed.data.active);
  if (!endpoint) {
    res.status(404).json({ error: "Webhook endpoint not found" });
    return;
  }

  recordAuditLog({
    actionType: "toggle_webhook_endpoint",
    entityType: "webhook_endpoint",
    entityId: endpoint.id,
    actorId: admin.id,
    actorLabel: admin.email,
    outcome: "success",
    summary: `${parsed.data.active ? "Activated" : "Deactivated"} webhook endpoint ${endpoint.name}`,
    metadata: { active: endpoint.active },
  });
  res.json(endpoint);
});

app.get("/api/v1/admin/webhook-deliveries", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const body: WebhookDeliveryLogListResponseDto = listWebhookDeliveryLogs();
  res.json(body);
});

app.post("/api/v1/admin/webhooks/test-fire", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const parsed = testWebhookFireSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid webhook test payload")) {
    return;
  }

  const payload =
    parsed.data.payload ?? getDefaultTestPayload(parsed.data.eventType);

  void dispatchWebhookEvent(
    parsed.data.eventType,
    payload,
    admin.id,
    admin.email,
  );

  recordAuditLog({
    actionType: "webhook_test_fire",
    entityType: "webhook_endpoint",
    actorId: admin.id,
    actorLabel: admin.email,
    outcome: "success",
    summary: `Triggered webhook test-fire for event ${parsed.data.eventType}`,
    metadata: { eventType: parsed.data.eventType, payload },
  });

  res.json({
    success: true,
    message: `Test event ${parsed.data.eventType} dispatched to active subscribers`,
  });
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

app.get("/api/v1/admin/analytics/zero-results", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }

  const limit = z.coerce.number().int().positive().max(100).default(25).parse(
    req.query.limit ?? 25,
  );
  const body: ZeroResultInsightsResponseDto = await getZeroResultInsights(limit);
  res.json(body);
});

app.get("/api/v1/admin/api-keys", async (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const apiKeys = await listApiKeys();
  const body: ApiKeyListResponseDto = {
    total: apiKeys.length,
    apiKeys,
  };
  res.json(body);
});

app.post("/api/v1/admin/api-keys", async (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  if (!requireJsonContentType(req, res)) {
    return;
  }

  const parsed = createApiKeySchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid API key payload")) {
    return;
  }

  const body = await createApiKey(parsed.data);
  res.status(201).json(body);
});

app.delete("/api/v1/admin/api-keys/:id", async (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const revoked = await revokeApiKey(req.params.id);
  if (!revoked) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  res.json({ apiKey: revoked });
});

app.post("/api/v1/admin/search-index/rebuild", async (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }

  const job = enqueueCatalogReindex();
  res.status(202).json(job satisfies BackgroundJobDto);
});

app.get("/api/v1/admin/jobs", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }
  res.json({ total: listJobs().length, jobs: listJobs() });
});

app.get("/api/v1/admin/jobs/:id", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }
  const job = getJobById(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job satisfies BackgroundJobDto);
});

app.get("/api/v1/admin/search-indexes", async (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }
  res.json({ indexes: listRegisteredIndexes() });
});

app.get("/api/v1/admin/scheduled-releases", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }
  const releases = await listScheduledReleases();
  const body: ScheduledReleaseListResponseDto = {
    total: releases.length,
    releases,
  };
  res.json(body);
});

app.post("/api/v1/admin/scheduled-releases", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }
  if (!requireJsonContentType(req, res)) {
    return;
  }
  const parsed = createScheduledReleaseSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid scheduled release payload")) {
    return;
  }
  const release = await createScheduledRelease(parsed.data, {
    userId: user.id,
    email: user.email,
  });
  res.status(201).json(release);
});

app.delete("/api/v1/admin/scheduled-releases/:id", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }
  const cancelled = await cancelScheduledRelease(req.params.id);
  if (!cancelled) {
    res.status(404).json({ error: "Scheduled release not found" });
    return;
  }
  res.json(cancelled);
});

app.get("/api/v1/admin/rule-drafts", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }
  const drafts = await listRuleDrafts();
  const body: RuleDraftListResponseDto = {
    total: drafts.length,
    drafts,
  };
  res.json(body);
});

app.post("/api/v1/admin/rule-drafts/generate", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }
  if (!requireJsonContentType(req, res)) {
    return;
  }
  const parsed = generateRuleDraftSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid rule draft payload")) {
    return;
  }
  const draft = await generateRuleDraft(parsed.data, user.id);
  res.status(201).json(draft);
});

app.post("/api/v1/admin/rule-drafts/:id/approve", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }
  const draft = await approveRuleDraft(req.params.id);
  if (!draft) {
    res.status(404).json({ error: "Rule draft not found" });
    return;
  }
  res.json(draft);
});

app.post("/api/v1/admin/rule-drafts/:id/reject", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }
  const draft = await rejectRuleDraft(req.params.id);
  if (!draft) {
    res.status(404).json({ error: "Rule draft not found" });
    return;
  }
  res.json(draft);
});

app.post("/api/v1/admin/rule-drafts/:id/apply", async (req, res) => {
  const user = requireAuthenticatedUser(req, res);
  if (!user) {
    return;
  }
  const draft = await getRuleDraftById(req.params.id);
  if (!draft || draft.status !== "approved") {
    res.status(400).json({ error: "Approved rule draft required before apply" });
    return;
  }

  const ruleInput = draft.suggestedRule as {
    name?: string;
    action?: "pin" | "boost" | "bury" | "hide";
    condition?: Record<string, unknown>;
    productIds?: string[];
    boostAmount?: number;
    buryAmount?: number;
  };

  if (!ruleInput.name || !ruleInput.action) {
    res.status(400).json({ error: "Draft is missing required rule fields" });
    return;
  }

  createMerchandisingRule(
    {
      name: ruleInput.name,
      active: true,
      priority: 100,
      action: ruleInput.action,
      condition: ruleInput.condition ?? { query: draft.query },
      productIds: ruleInput.productIds,
      boostAmount: ruleInput.boostAmount,
      buryAmount: ruleInput.buryAmount,
    },
    "staging",
  );

  const applied = await markRuleDraftApplied(draft.id);
  res.json(applied);
});

app.get("/api/v1/admin/audit/hash-chain", async (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) {
    return;
  }
  const report = await verifyAuditHashChain();
  const body: AuditHashChainReportDto = {
    ...report,
    verifiedAt: new Date().toISOString(),
  };
  res.json(body);
});

app.get("/api/v1/admin/analytics/catalog-insights", async (_req, res) => {
  const products = await getSearchProductCatalog();
  res.json(getCatalogAnalyticsInsights(products, 10));
});

app.get("/api/v1/admin/catalog/vocabulary", async (_req, res) => {
  const products = await getSearchProductCatalog();
  res.json(getCatalogVocabulary(products));
});

app.get("/api/v1/admin/suggestions", async (_req, res) => {
  const body: SuggestionsResponseDto = {
    generatedAt: new Date().toISOString(),
    suggestions: generateRuleSuggestions(await buildSuggestionParams()),
  };
  res.json(body);
});

app.get("/api/v1/admin/suggestions/:id/action-preview", async (req, res) => {
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
    await buildSuggestionParams(),
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

app.post("/api/v1/admin/suggestions/apply", async (req, res) => {
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
    await buildSuggestionParams(),
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

app.get("/api/v1/admin/query-preview", async (req, res) => {
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

  const products = await getSearchProductCatalog();
  const result = searchProducts(
    products,
    {
      query: parsed.data.query,
      page: 1,
      pageSize: parsed.data.pageSize,
    },
    { rules: getActiveMerchandisingRules(previewEnvironment), debug: true },
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
      rankingDebug: hit.rankingDebug,
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

registerInternalLlmDebugRoutes(app, {
  getProducts: getSearchProductCatalog,
  getRules: () => getActiveMerchandisingRules("live"),
});

app.get("/api/v1/internal/merch-runtime/benchmark", (_req, res) => {
  const report = runMerchRuntimeBenchmark();
  res.json({
    report,
    formatted: formatMerchRuntimeBenchmarkReport(report),
  });
});

app.get("/api/v1/internal/merch-runtime/cache/benchmark", (_req, res) => {
  const report = runSnapshotCacheBenchmark();
  res.json({
    report,
    formatted: formatSnapshotCacheBenchmarkReport(report),
  });
});

app.get("/api/v1/internal/merch-runtime/snapshot/benchmark", (_req, res) => {
  const report = runSnapshotManagerBenchmark();
  res.json({
    report,
    formatted: formatSnapshotManagerBenchmarkReport(report),
  });
});

app.get("/api/v1/internal/merch-runtime/snapshot/stats", (req, res) => {
  const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : "default";
  const environment =
    req.query.environment === "live" || req.query.environment === "staging"
      ? req.query.environment
      : "staging";
  const scopeKey = buildSnapshotScopeKey({ tenantId, environment });
  const manager = getDefaultSnapshotManager();
  const activeEntry = manager.getActiveEntry(scopeKey);

  res.json({
    scopeKey,
    activeVersion: activeEntry?.version ?? null,
    activeEntryKey: activeEntry?.entryKey ?? null,
    stats: manager.getStats(),
    scopeEntries: manager.getScopeEntries(scopeKey).map((entry) => ({
      entryKey: entry.entryKey,
      version: entry.version,
      isActive: entry.isActive,
      inFlightReaders: entry.inFlightReaders,
      estimatedBytes: entry.estimatedBytes,
    })),
    metrics: getSnapshotMetrics(),
  });
});

app.get("/api/v1/internal/merch-runtime/cache/stats", (_req, res) => {
  const manager = getDefaultSnapshotManager();
  res.json({
    stats: manager.getStats(),
    metrics: getSnapshotMetrics(),
  });
});

app.post("/api/v1/internal/merch-runtime/snapshot/publish-demo", (req, res) => {
  const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : "default";
  const environment =
    req.query.environment === "live" || req.query.environment === "staging"
      ? req.query.environment
      : "staging";
  const version =
    typeof req.query.version === "string" ? req.query.version : `demo-${Date.now()}`;

  const manager = getDefaultSnapshotManager();
  const scopeKey = buildSnapshotScopeKey({ tenantId, environment });
  const snapshot = buildDemoCompiledMerchSnapshot(version);
  const result = manager.publish(scopeKey, snapshot);

  res.json({
    scopeKey,
    activeVersion: result.nextVersion,
    publish: result,
    stats: manager.getStats(),
    metrics: getSnapshotMetrics(),
  });
});

app.post("/api/v1/internal/merch-runtime/cache/publish-demo", (req, res) => {
  const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : "default";
  const environment =
    req.query.environment === "live" || req.query.environment === "staging"
      ? req.query.environment
      : "staging";
  const version =
    typeof req.query.version === "string" ? req.query.version : `demo-${Date.now()}`;

  const manager = getDefaultSnapshotManager();
  const scopeKey = buildSnapshotScopeKey({ tenantId, environment });
  const snapshot = buildDemoCompiledMerchSnapshot(version);
  const result = manager.publish(scopeKey, snapshot);

  res.json({
    scopeKey,
    activeVersion: result.nextVersion,
    publish: result,
    stats: manager.getStats(),
  });
});

app.get("/api/v1/internal/merch-runtime/evaluate", async (req, res) => {
  const parsed = merchRuntimeEvaluateSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.flatten(),
    });
    return;
  }

  const scopeKey = buildSnapshotScopeKey({
    tenantId: parsed.data.tenantId,
    environment: parsed.data.environment,
  });

  const manager = getDefaultSnapshotManager();
  if (!manager.getActiveEntry(scopeKey)) {
    manager.publish(
      scopeKey,
      buildDemoCompiledMerchSnapshot(`demo-${parsed.data.environment}`),
    );
  }

  const handle = manager.acquire(scopeKey);
  if (!handle) {
    res.status(503).json({ error: "Compiled merchandising snapshot unavailable" });
    return;
  }

  const products = await getSearchProductCatalog();
  const retrieval = searchProducts(
    products,
    {
      query: parsed.data.query,
      page: 1,
      pageSize: parsed.data.candidateLimit,
    },
    { rules: [] },
  );

  const candidates: SearchCandidate[] = retrieval.hits.map((hit) => ({
    productId: hit.id,
    baseScore: hit.score,
    inStock: hit.inStock,
  }));

  const context = buildEvalContext({
    tenantId: parsed.data.tenantId,
    environment: parsed.data.environment,
    query: parsed.data.query,
  });

  try {
    const evaluated = evaluateMerchandisingRules(
      context,
      candidates,
      handle.snapshot,
    );

    res.json({
      query: parsed.data.query,
      scopeKey,
      snapshotId: handle.snapshot.snapshotId,
      activeVersion: handle.entry.version,
      candidateCount: candidates.length,
      results: evaluated.map((row) => ({
        productId: row.productId,
        baseScore: row.baseScore,
        finalScore: row.finalScore,
        appliedPinPosition: row.appliedPinPosition,
        matchedRuleIds: row.matchedRuleIds,
        matchedReasonCodes: row.matchedReasonCodes,
      })),
    });
  } finally {
    handle.release();
  }
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
  if (!assertValidBody(parsed, res, req, "Invalid diff query parameters")) {
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
  if (!assertValidBody(parsed, res, req, "Invalid reviewer payload")) {
    return;
  }

  const reviewer = createReviewer(parsed.data);
  res.status(201).json(reviewer);
});

app.post("/api/v1/admin/reviewers/:id/active", (req, res) => {
  const parsed = reviewerActiveSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid reviewer active payload")) {
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
  if (!assertValidBody(parsed, res, req, "Invalid approval policy payload")) {
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
  if (!assertValidBody(parsed, res, req, "Invalid assign reviewers payload")) {
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

  void dispatchWebhookEvent("approval.created", {
    approvalRequestId: request.id,
    snapshotId: request.snapshotId,
    snapshotName: request.snapshotName,
    requestedBy: request.requestedBy.actorLabel,
    reason: request.reason,
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
    void dispatchWebhookEvent("approval.approved", {
      approvalRequestId: request.id,
      snapshotName: request.snapshotName,
      snapshotId: request.snapshotId,
      decisionNote: parsed.data.decisionNote,
    });
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
    void dispatchWebhookEvent("approval.rejected", {
      approvalRequestId: request.id,
      snapshotName: request.snapshotName,
      snapshotId: request.snapshotId,
      decisionNote: parsed.data.decisionNote,
    });
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
  if (!assertValidBody(parsed, res, req, "Invalid execute approval payload")) {
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

  void dispatchWebhookEvent("promotion.executed", {
    approvalRequestId: executed.id,
    snapshotId: executed.snapshotId,
    snapshotName: executed.snapshotName,
    activeConfigurationSnapshotId: promotion.activeConfiguration.snapshotId,
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
  if (!assertValidBody(parsed, res, req, "Invalid notification query parameters")) {
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

app.get("/api/v1/admin/delegations", (_req, res) => {
  const body: DelegationListResponseDto = listDelegationRules();
  res.json(body);
});

app.post("/api/v1/admin/delegations", (req, res) => {
  const parsed = createDelegationRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "create_delegation_rule",
      entityType: "delegation_rule",
      outcome: "failure",
      summary: "Failed to create delegation rule: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid delegation rule payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const rule = createDelegationRule(parsed.data);
  if (!rule) {
    recordAuditLog({
      actionType: "create_delegation_rule",
      entityType: "delegation_rule",
      outcome: "failure",
      summary: "Failed to create delegation rule: invalid reviewers",
      metadata: parsed.data,
    });
    res.status(400).json({
      error: "Reviewers must be active, distinct, and valid.",
    });
    return;
  }

  recordAuditLog({
    actionType: "create_delegation_rule",
    entityType: "delegation_rule",
    entityId: rule.id,
    outcome: "success",
    summary: `Delegated reviewer ${rule.fromReviewerId} to ${rule.toReviewerId} for live approvals`,
    metadata: {
      mode: rule.mode,
      startAt: rule.startAt,
      endAt: rule.endAt,
      reason: rule.reason,
    },
  });

  createNotification({
    type: "approval_delegated",
    title: "Reviewer delegation rule created",
    message: `${rule.mode === "delegate" ? "Backup delegation" : "Reassignment rule"} from ${rule.fromReviewerId} to ${rule.toReviewerId} is active.`,
    recipientActorId: rule.toReviewerId,
  });

  res.status(201).json(rule);
});

app.post("/api/v1/admin/delegations/:id/deactivate", (req, res) => {
  const rule = deactivateDelegationRule(req.params.id);
  if (!rule) {
    res.status(404).json({ error: "Delegation rule not found" });
    return;
  }

  recordAuditLog({
    actionType: "deactivate_delegation_rule",
    entityType: "delegation_rule",
    entityId: rule.id,
    outcome: "success",
    summary: `Deactivated delegation rule ${rule.id} from ${rule.fromReviewerId} to ${rule.toReviewerId}`,
    metadata: { mode: rule.mode },
  });

  res.json(rule);
});

app.post("/api/v1/admin/approvals/:id/reassign", (req, res) => {
  const parsed = reassignApprovalSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "reassign_approval_request",
      entityType: "approval_request",
      entityId: req.params.id,
      outcome: "failure",
      summary: "Failed to reassign approval request: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid reassignment payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const result = manuallyReassignApprovalRequest(
    req.params.id,
    parsed.data.nextReviewerIds,
    parsed.data.reason,
  );

  if (!result.request) {
    recordAuditLog({
      actionType: "reassign_approval_request",
      entityType: "approval_request",
      entityId: req.params.id,
      outcome: "failure",
      summary: `Failed to reassign approval ${req.params.id}`,
      metadata: { error: result.error },
    });
    res.status(400).json({ error: result.error ?? "Reassignment failed" });
    return;
  }

  const fromLabel = result.change?.previousReviewerIds.join(", ") ?? "unknown";
  const toLabel = result.change?.nextReviewerIds.join(", ") ?? "unknown";

  recordAuditLog({
    actionType: "reassign_approval_request",
    entityType: "approval_request",
    entityId: result.request.id,
    entityLabel: result.request.snapshotName,
    outcome: "success",
    summary: `Reassigned approval ${result.request.id} from ${fromLabel} to ${toLabel}`,
    metadata: {
      reason: parsed.data.reason,
      previousReviewerIds: result.change?.previousReviewerIds,
      nextReviewerIds: result.change?.nextReviewerIds,
    },
  });

  const body: ApprovalOperationResponseDto = {
    success: true,
    message: `Reassigned approval request to ${toLabel}.`,
    request: result.request,
  };
  res.json(body);
});

app.get("/api/v1/admin/approvals/:id/assignment-history", (req, res) => {
  const body = listApprovalAssignmentHistory(req.params.id);
  if (!body) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }

  res.json(body satisfies ApprovalAssignmentHistoryResponseDto);
});

app.get("/api/v1/admin/approval-exceptions", (_req, res) => {
  const body: ApprovalExceptionListResponseDto = listOpenApprovalExceptions();
  res.json(body);
});

app.post("/api/v1/admin/approval-exceptions/:id/resolve", (req, res) => {
  const parsed = resolveApprovalExceptionSchema.safeParse(req.body ?? {});
  if (!assertValidBody(parsed, res, req, "Invalid resolve exception payload")) {
    return;
  }

  const exception = resolveApprovalException(req.params.id, parsed.data.note);
  if (!exception) {
    res.status(404).json({ error: "Open approval exception not found" });
    return;
  }

  recordAuditLog({
    actionType: "resolve_approval_exception",
    entityType: "approval_exception",
    entityId: exception.id,
    outcome: "success",
    summary: `Resolved exception ${exception.id} for approval ${exception.approvalRequestId}`,
    metadata: {
      note: parsed.data.note,
      type: exception.type,
    },
  });

  res.json(exception satisfies ApprovalExceptionDto);
});

app.get("/api/v1/admin/collaboration/thread", (req, res) => {
  const parsed = collaborationThreadQuerySchema.safeParse(req.query);
  if (!assertValidBody(parsed, res, req, "Invalid collaboration thread query")) {
    return;
  }

  const body: CollaborationThreadDto = getCollaborationThread(
    parsed.data.targetType,
    parsed.data.targetId,
  );
  res.json(body);
});

app.post("/api/v1/admin/collaboration/comments", (req, res) => {
  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "add_collaboration_comment",
      entityType: "collaboration_comment",
      outcome: "failure",
      summary: "Failed to add collaboration comment: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid comment payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const result = addComment(parsed.data);
  if (!result.comment) {
    recordAuditLog({
      actionType: "add_collaboration_comment",
      entityType: "collaboration_comment",
      outcome: "failure",
      summary: `Failed to add comment to ${parsed.data.targetType} ${parsed.data.targetId}`,
      metadata: { error: result.error },
    });
    res.status(400).json({ error: result.error ?? "Failed to add comment" });
    return;
  }

  recordAuditLog({
    actionType: "add_collaboration_comment",
    entityType: "collaboration_comment",
    entityId: result.comment.id,
    outcome: "success",
    summary: `Added comment to ${parsed.data.targetType} ${parsed.data.targetId}`,
    metadata: {
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      parentCommentId: parsed.data.parentCommentId,
    },
  });

  res.status(201).json(result.comment);
});

app.post("/api/v1/admin/collaboration/comments/:id/status", (req, res) => {
  const parsed = resolveCommentSchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid comment status payload")) {
    return;
  }

  const existing = getCommentById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  const comment = updateCommentStatus(req.params.id, parsed.data.status);
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  const actionLabel =
    parsed.data.status === "resolved" ? "Resolved" : "Reopened";

  recordAuditLog({
    actionType: "update_collaboration_comment_status",
    entityType: "collaboration_comment",
    entityId: comment.id,
    outcome: "success",
    summary: `${actionLabel} collaboration comment ${comment.id}`,
    metadata: {
      status: parsed.data.status,
      targetType: comment.targetType,
      targetId: comment.targetId,
    },
  });

  res.json(comment satisfies CollaborationCommentDto);
});

app.post("/api/v1/admin/collaboration/annotations", (req, res) => {
  const parsed = createAnnotationSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "add_collaboration_annotation",
      entityType: "collaboration_annotation",
      outcome: "failure",
      summary: "Failed to add collaboration annotation: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid annotation payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const result = addAnnotation(parsed.data);
  if (!result.annotation) {
    recordAuditLog({
      actionType: "add_collaboration_annotation",
      entityType: "collaboration_annotation",
      outcome: "failure",
      summary: `Failed to add annotation to ${parsed.data.targetType} ${parsed.data.targetId}`,
      metadata: { error: result.error },
    });
    res.status(400).json({ error: result.error ?? "Failed to add annotation" });
    return;
  }

  recordAuditLog({
    actionType: "add_collaboration_annotation",
    entityType: "collaboration_annotation",
    entityId: result.annotation.id,
    outcome: "success",
    summary: `Added annotation to ${parsed.data.targetType} ${parsed.data.targetId}`,
    metadata: {
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      anchorLabel: parsed.data.anchorLabel,
    },
  });

  res.status(201).json(result.annotation);
});

app.get("/api/v1/admin/workspaces", (req, res) => {
  const parsed = workspaceQuerySchema.safeParse(req.query);
  if (!assertValidBody(parsed, res, req, "Invalid workspace query")) {
    return;
  }

  const body: WorkspaceStateDto = getWorkspaceState(
    parsed.data.activeRole ?? "merchandiser",
  );
  res.json(body);
});

app.get("/api/v1/admin/saved-views", (req, res) => {
  const parsed = savedViewsQuerySchema.safeParse(req.query);
  if (!assertValidBody(parsed, res, req, "Invalid saved views query")) {
    return;
  }

  const body: SavedViewListResponseDto = listSavedViews(parsed.data.role);
  res.json(body);
});

app.post("/api/v1/admin/saved-views", (req, res) => {
  const parsed = createSavedViewSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "create_saved_view",
      entityType: "saved_view",
      outcome: "failure",
      summary: "Failed to create saved view: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid saved view payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const view = createSavedView(parsed.data);

  recordAuditLog({
    actionType: "create_saved_view",
    entityType: "saved_view",
    entityId: view.id,
    entityLabel: view.name,
    outcome: "success",
    summary: `Created saved view '${view.name}' for role ${view.role}`,
    metadata: { role: view.role, filters: view.filters },
  });

  res.status(201).json(view);
});

app.post("/api/v1/admin/saved-views/:id", (req, res) => {
  const parsed = updateSavedViewSchema.safeParse(req.body);
  if (!parsed.success) {
    recordAuditLog({
      actionType: "update_saved_view",
      entityType: "saved_view",
      entityId: req.params.id,
      outcome: "failure",
      summary: "Failed to update saved view: invalid payload",
      metadata: { errors: parsed.error.flatten() },
    });
    res.status(400).json({
      error: "Invalid saved view update payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const view = updateSavedView(req.params.id, parsed.data);
  if (!view) {
    res.status(404).json({ error: "Saved view not found" });
    return;
  }

  recordAuditLog({
    actionType: "update_saved_view",
    entityType: "saved_view",
    entityId: view.id,
    entityLabel: view.name,
    outcome: "success",
    summary: `Updated saved view '${view.name}' for role ${view.role}`,
    metadata: { role: view.role, filters: view.filters },
  });

  res.json(view);
});

app.post("/api/v1/admin/saved-views/:id/default", (req, res) => {
  const parsed = setDefaultSavedViewSchema.safeParse(req.body ?? {});
  if (!assertValidBody(parsed, res, req, "Invalid set default saved view payload")) {
    return;
  }

  const view = setDefaultSavedView(parsed.data.role, req.params.id);
  if (!view) {
    res.status(404).json({ error: "Saved view not found for this role" });
    return;
  }

  recordAuditLog({
    actionType: "set_default_saved_view",
    entityType: "saved_view",
    entityId: view.id,
    entityLabel: view.name,
    outcome: "success",
    summary: `Set default saved view '${view.name}' for role ${view.role}`,
    metadata: { role: view.role },
  });

  res.json(view);
});

app.post("/api/v1/admin/promote-snapshot", async (req, res) => {
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

  const policyError = await assertDirectLivePromotionAllowed(
    parsed.data.snapshotId,
    parsed.data.approvalRequestId,
  );
  if (policyError) {
    recordAuditLog({
      actionType: "promote_snapshot",
      entityType: "config_snapshot",
      entityId: parsed.data.snapshotId,
      outcome: "failure",
      summary: policyError,
    });
    res.status(403).json({ error: policyError, code: "APPROVAL_REQUIRED" });
    return;
  }

  const promotion = promoteSnapshotToLive({
    snapshotId: parsed.data.snapshotId,
    reason: parsed.data.reason,
    linkedExperimentId: parsed.data.sourceExperimentId,
    approvalRequestId: parsed.data.approvalRequestId,
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

  void dispatchWebhookEvent("promotion.executed", {
    snapshotId: restored.id,
    snapshotName: restored.name,
    environment: "live",
    sourceExperimentId: parsed.data.sourceExperimentId,
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

app.post("/api/v1/admin/experiments/:id/run", async (req, res) => {
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

  const products = await getSearchProductCatalog();
  const run = await runExperimentEvaluation({
    experimentId: experiment.id,
    baseline,
    candidate,
    querySet,
    products,
    candidateLlmOverrides: experiment.candidateLlmOverrides,
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
  if (!assertValidBody(parsed, res, req, "Invalid audit log filters")) {
    return;
  }

  const body: AuditLogResponseDto = listAuditLogs(parsed.data);
  res.json(body);
});

app.post("/api/v1/events/search", requireApiKeyScope("events:write"), (req, res) => {
  const parsed = searchEventBodySchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid search event payload")) {
    return;
  }

  const event = recordSearchEvent(parsed.data, getAnalyticsContext(req));
  res.status(201).json(event);
});

app.post("/api/v1/events/click", requireApiKeyScope("events:write"), (req, res) => {
  const parsed = clickEventBodySchema.safeParse(req.body);
  if (!assertValidBody(parsed, res, req, "Invalid click event payload")) {
    return;
  }

  const event = recordSearchClick(parsed.data, getAnalyticsContext(req));
  res.status(201).json(event);
});

app.get("/api/v1/analytics/summary", (_req, res) => {
  res.json(getAnalyticsSummary());
});

app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(`[${getRequestId(req)}]`, error);
    if (res.headersSent) {
      return;
    }

    res
      .status(500)
      .json(internalError(undefined, undefined, getRequestId(req)));
  },
);

let databaseConnected = false;

async function hydratePersistentStores(): Promise<void> {
  await hydrateBootstrapStore();
  await ensureBootstrapState();
  await hydrateAuthStore();
  await hydrateAuditTrailStore();
  await hydrateApprovalStore();
  await hydrateAccessGovernanceStore();
  await hydrateJitAccessStore();
  await hydrateCollaborationStore();
  await hydrateNotificationStore();
  await hydrateExportStore();
  await hydrateEnvironmentConfigStore();
  await hydrateAnalyticsStore();
}

async function loadProductCatalogAtStartup(): Promise<number> {
  const productCount = await hydrateProductCatalog();
  syncProductSearchIndexFromCatalog();
  if (productCount === 0) {
    console.warn(
      "Product catalog is empty. Run: pnpm prisma:seed (from repo root)",
    );
  } else {
    console.log(
      `Loaded ${productCount} products (${getProductCatalogSource()}).`,
    );
  }
  return productCount;
}

async function getSearchProductCatalog() {
  await ensureProductCatalogLoaded();
  return getProductCatalog();
}

async function startServer(): Promise<void> {
  app.listen(env.SEARCH_API_PORT, env.SEARCH_API_HOST, () => {
    console.log(
      `search-api listening on http://${env.SEARCH_API_HOST}:${env.SEARCH_API_PORT}`,
    );
  });

  let dbConnected = false;

  try {
    await connectDatabase();
    dbConnected = true;
  } catch (error) {
    console.warn(
      "Database connection failed; governance data unavailable until DATABASE_URL is configured.",
      error,
    );
  }

  if (dbConnected) {
    try {
      await hydratePersistentStores();
    } catch (error) {
      console.warn(
        "Some persistent stores failed to hydrate; catalog search will still attempt to load products.",
        error,
      );
    }
  }

  await loadProductCatalogAtStartup();
  databaseConnected = dbConnected;

  startReleaseScheduler({
    promoteSnapshot: (input) => {
      const promotion = promoteSnapshotToLive(input);
      return promotion
        ? { restored: promotion.restored }
        : null;
    },
  });

  if (dbConnected) {
    if (userCount() === 0 && !isSetupRequired()) {
      console.warn(
        "Database connected but has no users. Run: pnpm prisma:seed (from repo root)",
      );
    } else if (isSetupRequired()) {
      console.log(
        "Initial setup required. Open the admin app at /setup to configure this instance.",
      );
    }
  }
}

void startServer();
