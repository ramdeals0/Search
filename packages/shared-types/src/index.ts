export type ProductId = string;
export type SKU = string;
export type ISODateString = string;

export type { UserRole } from "./user-role.js";
export type {
  AccessRequestDto,
  AccessRequestListResponseDto,
  AccessRequestStatus,
  AccessReviewItemDto,
  AccessReviewListResponseDto,
  AccessReviewRunDto,
  AccessReviewStatus,
  ActivePrivilegeDto,
  ActivePrivilegeListResponseDto,
  CreateAccessRequestDto,
  CreateAccessReviewRunDto,
  CreateJitElevationRequestDto,
  JitAccessStatus,
  JitElevationRequestDto,
  JitElevationRequestListResponseDto,
  JitPolicyDto,
  ResolveAccessRequestDto,
  ResolveAccessReviewItemDto,
  ResolveJitElevationRequestDto,
  UpdateJitPolicyRequestDto,
} from "./access-governance.js";
export type {
  LlmCredentialsStatusDto,
  LlmProviderName,
  LlmSettingsDto,
  UpdateLlmSettingsRequestDto,
} from "./llm-settings.js";

import type { UserRole } from "./user-role.js";
import type { ActivePrivilegeDto } from "./access-governance.js";

export interface ProductAttributeMap {
  [key: string]: string | number | boolean | string[];
}

export interface ProductDocument {
  id: ProductId;
  sku: SKU;
  title: string;
  brand: string;
  category: string;
  subcategory: string;
  description: string;
  price: number;
  inventory: number;
  inStock: boolean;
  imageUrl?: string;
  attributes: ProductAttributeMap;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SearchFiltersDto {
  brand?: string[];
  category?: string[];
  inStock?: string[];
}

export interface SearchRequestDto {
  query: string;
  page: number;
  pageSize: number;
  filters?: SearchFiltersDto;
}

export interface FacetOptionDto {
  value: string;
  count: number;
}

export interface AvailableFacetsDto {
  brand: FacetOptionDto[];
  category: FacetOptionDto[];
  inStock: FacetOptionDto[];
}

export interface SearchHitDto {
  id: ProductId;
  sku: SKU;
  title: string;
  brand: string;
  category: string;
  subcategory: string;
  description: string;
  price: number;
  imageUrl?: string;
  inStock: boolean;
  score: number;
  rankingDebug?: RankingDebugDto;
}

export type MerchandisingRuleAction = "pin" | "boost" | "bury" | "hide";

export interface MerchandisingRuleCondition {
  query?: string;
  brand?: string;
  category?: string;
  inStock?: boolean;
}

export interface MerchandisingRule {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  action: MerchandisingRuleAction;
  condition: MerchandisingRuleCondition;
  productIds?: string[];
  brand?: string;
  boostAmount?: number;
  buryAmount?: number;
}

export interface RankingDebugDto {
  productId: string;
  baseScore: number;
  exactMatchScore: number;
  inventoryScore: number;
  popularityScore: number;
  merchandisingAdjustment: number;
  finalScore: number;
  appliedRuleNames: string[];
}

export interface SearchResponseDto {
  query: string;
  normalizedQuery?: string;
  correctedQuery?: string;
  page: number;
  pageSize: number;
  totalHits: number;
  totalPages: number;
  processingTimeMs: number;
  hits: SearchHitDto[];
  availableFacets: AvailableFacetsDto;
  appliedRuleNames?: string[];
}

export interface AutocompleteSuggestionDto {
  value: string;
  type: "query" | "brand" | "category" | "product";
}

export interface AutocompleteResponseDto {
  query: string;
  normalizedQuery: string;
  correctedQuery?: string;
  suggestions: AutocompleteSuggestionDto[];
}

export interface HealthResponseDto {
  ok: boolean;
  service: string;
  timestamp: ISODateString;
  database?: {
    connected: boolean;
    userCount: number;
    productCount?: number;
    catalogSource?: "database" | "generated-json" | "empty";
  };
}

export type ApiErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "validation_error"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal_error";

export interface ApiErrorResponseDto {
  success: false;
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface RateLimitStatusDto {
  key: string;
  limit: number;
  remaining: number;
  resetAt: ISODateString;
  windowSeconds: number;
}

export type BootstrapStatus =
  | "not_started"
  | "admin_created"
  | "security_configured"
  | "platform_configured"
  | "completed";

export type BootstrapNextStep =
  | "welcome"
  | "create_admin"
  | "security"
  | "platform"
  | "review"
  | "done";

export interface BootstrapStateDto {
  status: BootstrapStatus;
  setupRequired: boolean;
  initializedAt?: ISODateString;
  initializedByUserId?: string;
  initializedByEmail?: string;
  instanceName?: string;
  firstAdminEmail?: string;
  securityDefaultsApplied: boolean;
  governanceDefaultsApplied: boolean;
  nextStep: BootstrapNextStep;
}

export interface CreateBootstrapAdminRequestDto {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ConfigureBootstrapSecurityRequestDto {
  passwordMinLength: number;
  loginAttemptLimit: number;
  lockoutWindowMinutes: number;
  sessionTtlHours: number;
  auditLoggingEnabled: boolean;
}

export interface ConfigureBootstrapPlatformRequestDto {
  instanceName: string;
  stagingEnvironmentLabel: string;
  liveEnvironmentLabel: string;
  requireApprovalForLivePromotion: boolean;
  jitEnabled: boolean;
  defaultJitDurationMinutes: number;
  accessReviewCadenceDays: number;
  defaultWorkspaceRole: "admin";
}

export interface CompleteBootstrapRequestDto {
  confirm: boolean;
}

export interface BootstrapAdminResponseDto {
  user: UserDto;
  session: SessionDto;
}

export interface SearchEventDto {
  query: string;
  resultCount: number;
  timestamp: ISODateString;
}

export interface SearchClickEventDto {
  query: string;
  productId: string;
  productTitle: string;
  timestamp: ISODateString;
}

export interface TopQueryDto {
  query: string;
  count: number;
}

export interface NoResultQueryDto {
  query: string;
  count: number;
}

export interface SearchAnalyticsSummaryDto {
  totalSearches: number;
  totalClicks: number;
  topQueries: TopQueryDto[];
  noResultQueries: NoResultQueryDto[];
}

export interface TopProductInsightDto {
  productId: string;
  title: string;
  brand: string;
  category: string;
  count: number;
  source: "clicks" | "popularity";
}

export interface TopBrandInsightDto {
  brand: string;
  count: number;
  source: "clicks" | "searches" | "popularity";
}

export interface TopCategoryInsightDto {
  category: string;
  count: number;
  source: "clicks" | "searches" | "popularity";
}

export interface CatalogAnalyticsInsightsDto {
  topProducts: TopProductInsightDto[];
  topBrands: TopBrandInsightDto[];
  topQueries: TopQueryDto[];
  topCategories: TopCategoryInsightDto[];
}

export interface CatalogVocabularyDto {
  brands: string[];
  categories: string[];
}

export type MerchandisingRuleDto = MerchandisingRule;

export type CreateMerchandisingRuleDto = Omit<MerchandisingRule, "id">;

export type UpdateMerchandisingRuleDto = Partial<Omit<MerchandisingRule, "id">>;

export interface SynonymEntryDto {
  key: string;
  value: string;
}

export interface SynonymListResponseDto {
  environment: EnvironmentKey;
  total: number;
  synonyms: SynonymEntryDto[];
}

export interface CreateSynonymDto {
  key: string;
  value: string;
}

export interface UpdateSynonymDto {
  value: string;
}

export interface QueryPreviewHitDto {
  id: string;
  title: string;
  brand: string;
  category: string;
  score: number;
  inStock: boolean;
  rankingDebug?: RankingDebugDto;
}

export interface QueryPreviewResponseDto {
  query: string;
  total: number;
  appliedRuleNames: string[];
  hits: QueryPreviewHitDto[];
}

export type SuggestionType =
  | "add_synonym"
  | "pin_product"
  | "boost_brand"
  | "improve_zero_results"
  | "review_low_ctr"
  | "expand_catalog";

export type SuggestionPriority = "high" | "medium" | "low";

export interface RuleSuggestionDto {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  query: string;
  reason: string;
  recommendedAction: string;
  suggestedActionTypes?: SuggestionActionType[];
  metrics?: {
    searches?: number;
    clicks?: number;
    ctr?: number;
    zeroResults?: number;
  };
}

export interface SuggestionsResponseDto {
  generatedAt: ISODateString;
  suggestions: RuleSuggestionDto[];
}

export type SuggestionActionType =
  | "create_rule"
  | "create_synonym"
  | "open_query_preview";

export interface ApplySuggestionRequestDto {
  suggestionId: string;
  actionType: SuggestionActionType;
}

export interface ApplySuggestionResponseDto {
  success: boolean;
  message: string;
  createdRuleId?: string;
  createdSynonymKey?: string;
  previewQuery?: string;
}

export interface ActionPreviewDto {
  suggestionId: string;
  query: string;
  actionType: SuggestionActionType;
  summary: string;
  payloadPreview: Record<string, unknown>;
}

export type AuditActionType =
  | "create_rule"
  | "update_rule"
  | "create_synonym"
  | "update_synonym"
  | "delete_synonym"
  | "apply_suggestion"
  | "preview_suggestion_action"
  | "query_preview"
  | "create_snapshot"
  | "view_snapshot_diff"
  | "rollback_snapshot"
  | "create_query_set"
  | "create_experiment"
  | "run_experiment"
  | "generate_scorecard"
  | "save_experiment_decision"
  | "promote_snapshot"
  | "copy_environment"
  | "promote_environment"
  | "create_approval_request"
  | "resolve_approval_request"
  | "execute_approval_request"
  | "update_approval_sla_policy"
  | "generate_approval_notification"
  | "mark_notification_read"
  | "create_delegation_rule"
  | "deactivate_delegation_rule"
  | "reassign_approval_request"
  | "create_approval_exception"
  | "resolve_approval_exception"
  | "add_collaboration_comment"
  | "update_collaboration_comment_status"
  | "add_collaboration_annotation"
  | "create_saved_view"
  | "update_saved_view"
  | "set_default_saved_view"
  | "user_login"
  | "user_logout"
  | "authorization_denied"
  | "create_access_request"
  | "resolve_access_request"
  | "create_access_review"
  | "resolve_access_review_item"
  | "complete_access_review"
  | "update_user_role"
  | "disable_user"
  | "create_jit_elevation_request"
  | "resolve_jit_elevation_request"
  | "expire_jit_elevation"
  | "revoke_jit_elevation"
  | "update_jit_policy"
  | "update_llm_settings"
  | "create_export_job"
  | "download_export"
  | "create_webhook_endpoint"
  | "toggle_webhook_endpoint"
  | "webhook_delivery"
  | "webhook_test_fire"
  | "bootstrap_admin_created"
  | "bootstrap_security_configured"
  | "bootstrap_platform_configured"
  | "bootstrap_completed";

export type AuditEntityType =
  | "merchandising_rule"
  | "synonym"
  | "suggestion"
  | "search_query"
  | "config_snapshot"
  | "query_set"
  | "experiment"
  | "environment"
  | "approval_request"
  | "notification"
  | "delegation_rule"
  | "approval_exception"
  | "collaboration_comment"
  | "collaboration_annotation"
  | "saved_view"
  | "user"
  | "access_request"
  | "access_review"
  | "jit_elevation_request"
  | "jit_policy"
  | "llm_settings"
  | "export_job"
  | "webhook_endpoint"
  | "webhook_delivery"
  | "bootstrap";

export type AuditOutcome = "success" | "failure";

export interface AuditLogEntryDto {
  id: string;
  timestamp: ISODateString;
  actorId: string;
  actorLabel: string;
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId?: string;
  entityLabel?: string;
  outcome: AuditOutcome;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogResponseDto {
  total: number;
  entries: AuditLogEntryDto[];
}

export interface AuditLogFilterDto {
  actionType?: string;
  entityType?: string;
  outcome?: string;
  actorId?: string;
  keyword?: string;
}

export type EnvironmentKey = "staging" | "live";

export interface MerchandisingConfigSnapshotDto {
  id: string;
  name: string;
  description?: string;
  createdAt: ISODateString;
  createdBy: {
    actorId: string;
    actorLabel: string;
  };
  counts: {
    rules: number;
    synonyms: number;
  };
  ruleIds: string[];
  synonymKeys: string[];
  sourceEnvironment?: EnvironmentKey;
}

export interface SnapshotListResponseDto {
  total: number;
  snapshots: MerchandisingConfigSnapshotDto[];
}

export interface CreateSnapshotRequestDto {
  name: string;
  description?: string;
  environment?: EnvironmentKey;
}

export interface RollbackSnapshotRequestDto {
  snapshotId: string;
}

export interface RollbackSnapshotResponseDto {
  success: boolean;
  message: string;
  restoredSnapshotId: string;
}

export type SnapshotDiffItemType =
  | "rule_added"
  | "rule_removed"
  | "rule_changed"
  | "synonym_added"
  | "synonym_removed"
  | "synonym_changed";

export interface SnapshotDiffItemDto {
  type: SnapshotDiffItemType;
  key: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface SnapshotDiffResponseDto {
  fromSnapshotId: string;
  toSnapshotId: string;
  generatedAt: ISODateString;
  summary: {
    rulesAdded: number;
    rulesRemoved: number;
    rulesChanged: number;
    synonymsAdded: number;
    synonymsRemoved: number;
    synonymsChanged: number;
  };
  items: SnapshotDiffItemDto[];
}

export type ExperimentStatus = "draft" | "run" | "archived";

export interface EvaluationQueryDto {
  query: string;
  expectedProductIds?: string[];
  notes?: string;
  tags?: string[];
}

export interface EvaluationQuerySetDto {
  id: string;
  name: string;
  description?: string;
  queries: EvaluationQueryDto[];
  createdAt: ISODateString;
}

export interface ExperimentDto {
  id: string;
  name: string;
  description?: string;
  status: ExperimentStatus;
  baselineSnapshotId: string;
  candidateSnapshotId: string;
  querySetId: string;
  candidateLlmOverrides?: ExperimentLlmOverridesDto;
  createdAt: ISODateString;
  lastRunAt?: ISODateString;
}

export interface ExperimentLlmOverridesDto {
  queryRewriteEnabled?: boolean;
  zeroResultsEnabled?: boolean;
  rerankEnabled?: boolean;
}

export interface QueryEvaluationResultDto {
  query: string;
  totalBaseline: number;
  totalCandidate: number;
  topBaselineIds: string[];
  topCandidateIds: string[];
  overlapCount: number;
  expectedMatchesInTopBaseline?: number;
  expectedMatchesInTopCandidate?: number;
  changed: boolean;
  notes?: string;
}

export interface ExperimentRunSummaryDto {
  experimentId: string;
  runAt: ISODateString;
  summary: {
    totalQueries: number;
    changedQueries: number;
    improvedQueries: number;
    regressedQueries: number;
    unchangedQueries: number;
  };
  results: QueryEvaluationResultDto[];
}

export interface CreateExperimentRequestDto {
  name: string;
  description?: string;
  baselineSnapshotId: string;
  candidateSnapshotId: string;
  querySetId: string;
  candidateLlmOverrides?: ExperimentLlmOverridesDto;
}

export interface CreateQuerySetRequestDto {
  name: string;
  description?: string;
  queries: EvaluationQueryDto[];
}

export interface ExperimentDetailResponseDto {
  experiment: ExperimentDto;
  lastRun?: ExperimentRunSummaryDto;
  scorecard?: ExperimentScorecardDto;
  decision?: ExperimentDecisionDto;
}

export type ExperimentDecisionStatus = "ship" | "iterate" | "rollback" | "undecided";

export interface ScorecardMetricDto {
  key: string;
  label: string;
  value: number;
  baseline?: number;
  delta?: number;
  status: "good" | "warning" | "bad" | "neutral";
  description?: string;
}

export interface ExperimentScorecardDto {
  experimentId: string;
  generatedAt: ISODateString;
  headlineStatus: "pass" | "fail" | "review";
  metrics: ScorecardMetricDto[];
  summary: string;
  guardrailFindings: string[];
}

export interface ExperimentDecisionDto {
  experimentId: string;
  decidedAt: ISODateString;
  decision: ExperimentDecisionStatus;
  rationale: string;
  linkedRunAt?: ISODateString;
}

export interface SaveExperimentDecisionRequestDto {
  decision: ExperimentDecisionStatus;
  rationale: string;
}

export interface ActiveConfigurationDto {
  snapshotId: string;
  snapshotName: string;
  promotedAt: ISODateString;
  promotedBy: {
    actorId: string;
    actorLabel: string;
  };
  counts: {
    rules: number;
    synonyms: number;
  };
  promotedViaApprovalRequestId?: string;
}

export interface PromoteSnapshotRequestDto {
  snapshotId: string;
  reason: string;
  sourceExperimentId?: string;
}

export interface PromoteSnapshotResponseDto {
  success: boolean;
  message: string;
  activeConfiguration: ActiveConfigurationDto;
  warning?: string;
}

export interface PromotionHistoryEntryDto {
  id: string;
  snapshotId: string;
  snapshotName: string;
  promotedAt: ISODateString;
  promotedBy: {
    actorId: string;
    actorLabel: string;
  };
  reason: string;
  sourceExperimentId?: string;
}

export interface PromotionHistoryResponseDto {
  total: number;
  entries: PromotionHistoryEntryDto[];
}

export interface EnvironmentConfigurationDto {
  environment: EnvironmentKey;
  snapshotId?: string;
  snapshotName?: string;
  updatedAt: ISODateString;
  counts: {
    rules: number;
    synonyms: number;
  };
}

export interface EnvironmentListResponseDto {
  environments: EnvironmentConfigurationDto[];
}

export interface PromoteEnvironmentRequestDto {
  fromEnvironment: EnvironmentKey;
  toEnvironment: EnvironmentKey;
  reason: string;
}

export interface CopyEnvironmentRequestDto {
  fromEnvironment: EnvironmentKey;
  toEnvironment: EnvironmentKey;
  reason: string;
}

export interface EnvironmentOperationResponseDto {
  success: boolean;
  message: string;
  target: EnvironmentConfigurationDto;
}

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed"
  | "cancelled";

export type ReviewerRole =
  | "requester"
  | "reviewer"
  | "approver"
  | "release_manager";

export interface ReviewerDto {
  id: string;
  name: string;
  role: ReviewerRole;
  active: boolean;
}

export interface ApprovalPolicyDto {
  requireSecondApprover: boolean;
  requireDifferentActorForApproval: boolean;
  requireDifferentActorForExecution: boolean;
  allowedApproverRoles: ReviewerRole[];
  allowedExecutorRoles: ReviewerRole[];
}

export interface ApprovalDecisionEntryDto {
  actorId: string;
  actorLabel: string;
  decision: "approved" | "rejected";
  note?: string;
  decidedAt: ISODateString;
}

export interface ApprovalRequestDto {
  id: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  status: ApprovalStatus;
  sourceEnvironment: "staging";
  targetEnvironment: "live";
  snapshotId?: string;
  snapshotName?: string;
  requestedBy: {
    actorId: string;
    actorLabel: string;
  };
  approvedBy?: {
    actorId: string;
    actorLabel: string;
  };
  rejectedBy?: {
    actorId: string;
    actorLabel: string;
  };
  reason: string;
  decisionNote?: string;
  linkedExperimentId?: string;
  assignedReviewerIds?: string[];
  decisions?: ApprovalDecisionEntryDto[];
  requiredApprovalCount?: number;
  executedBy?: {
    actorId: string;
    actorLabel: string;
  };
}

export interface ApprovalListResponseDto {
  total: number;
  requests: ApprovalRequestDto[];
}

export interface CreateApprovalRequestDto {
  snapshotId: string;
  reason: string;
  linkedExperimentId?: string;
  actorId?: string;
  assignedReviewerIds?: string[];
}

export interface ResolveApprovalRequestDto {
  decision: "approved" | "rejected" | "cancelled";
  decisionNote?: string;
  actorId?: string;
  actorRole?: ReviewerRole;
}

export interface ExecuteApprovalRequestDto {
  approvalRequestId: string;
  actorId?: string;
  actorRole?: ReviewerRole;
}

export interface UpdateApprovalPolicyRequestDto {
  requireSecondApprover?: boolean;
  requireDifferentActorForApproval?: boolean;
  requireDifferentActorForExecution?: boolean;
  allowedApproverRoles?: ReviewerRole[];
  allowedExecutorRoles?: ReviewerRole[];
}

export interface CreateReviewerRequestDto {
  name: string;
  role: ReviewerRole;
}

export interface ReviewerListResponseDto {
  total: number;
  reviewers: ReviewerDto[];
}

export interface ApprovalEligibilityResponseDto {
  canApprove: boolean;
  canExecute: boolean;
  reasons: string[];
}

export interface AssignReviewersRequestDto {
  reviewerIds: string[];
}

export interface ApprovalOperationResponseDto {
  success: boolean;
  message: string;
  request: ApprovalRequestDto;
}

export type NotificationType =
  | "approval_requested"
  | "approval_reminder"
  | "approval_overdue"
  | "approval_approved"
  | "approval_rejected"
  | "approval_executed"
  | "approval_delegated"
  | "approval_reassigned"
  | "approval_exception_opened";

export interface NotificationDto {
  id: string;
  createdAt: ISODateString;
  type: NotificationType;
  title: string;
  message: string;
  relatedApprovalRequestId?: string;
  recipientActorId?: string;
  read: boolean;
}

export interface NotificationListResponseDto {
  total: number;
  notifications: NotificationDto[];
}

export interface ApprovalSlaPolicyDto {
  reminderAfterHours: number;
  overdueAfterHours: number;
  escalationAfterHours?: number;
  enabled: boolean;
}

export type ApprovalSlaItemStatus =
  | "on_track"
  | "due_soon"
  | "overdue"
  | "completed";

export interface ApprovalSlaStatusDto {
  approvalRequestId: string;
  status: ApprovalSlaItemStatus;
  ageHours: number;
  reminderDue: boolean;
  overdue: boolean;
  targetReminderAt?: ISODateString;
  targetOverdueAt?: ISODateString;
}

export interface ApprovalSlaOverviewDto {
  generatedAt: ISODateString;
  summary: {
    pendingCount: number;
    dueSoonCount: number;
    overdueCount: number;
    completedCount: number;
  };
  items: ApprovalSlaStatusDto[];
}

export interface UpdateApprovalSlaPolicyRequestDto {
  enabled: boolean;
  reminderAfterHours: number;
  overdueAfterHours: number;
  escalationAfterHours?: number;
}

export type DelegationMode = "delegate" | "reassign";

export type ExceptionType =
  | "reviewer_unavailable"
  | "request_overdue"
  | "role_mismatch"
  | "manual_intervention";

export type ExceptionStatus = "open" | "resolved";

export interface DelegationRuleDto {
  id: string;
  fromReviewerId: string;
  toReviewerId: string;
  mode: DelegationMode;
  startAt?: ISODateString;
  endAt?: ISODateString;
  active: boolean;
  reason?: string;
  createdAt: ISODateString;
}

export interface CreateDelegationRuleRequestDto {
  fromReviewerId: string;
  toReviewerId: string;
  mode: DelegationMode;
  startAt?: ISODateString;
  endAt?: ISODateString;
  reason?: string;
}

export interface DelegationListResponseDto {
  total: number;
  rules: DelegationRuleDto[];
}

export interface ApprovalAssignmentChangeDto {
  approvalRequestId: string;
  previousReviewerIds: string[];
  nextReviewerIds: string[];
  reason: string;
  changedAt: ISODateString;
  changeType: "delegated" | "reassigned" | "escalated";
}

export interface ApprovalAssignmentHistoryResponseDto {
  approvalRequestId: string;
  assignedReviewerIds: string[];
  effectiveReviewerIds: string[];
  delegatedReviewerIds: string[];
  total: number;
  changes: ApprovalAssignmentChangeDto[];
}

export interface ReassignApprovalRequestDto {
  nextReviewerIds: string[];
  reason: string;
}

export interface ApprovalExceptionDto {
  id: string;
  approvalRequestId: string;
  type: ExceptionType;
  status: ExceptionStatus;
  summary: string;
  createdAt: ISODateString;
  resolvedAt?: ISODateString;
  metadata?: Record<string, unknown>;
}

export interface ApprovalExceptionListResponseDto {
  total: number;
  exceptions: ApprovalExceptionDto[];
}

export interface ResolveApprovalExceptionRequestDto {
  note?: string;
}

export type CollaborationTargetType =
  | "approval_request"
  | "experiment"
  | "experiment_run"
  | "snapshot"
  | "promotion"
  | "exception";

export type CommentStatus = "open" | "resolved";

export interface CollaborationCommentDto {
  id: string;
  targetType: CollaborationTargetType;
  targetId: string;
  author: {
    actorId: string;
    actorLabel: string;
  };
  message: string;
  createdAt: ISODateString;
  status?: CommentStatus;
  parentCommentId?: string;
  tags?: string[];
}

export interface CollaborationAnnotationDto {
  id: string;
  targetType: CollaborationTargetType;
  targetId: string;
  author: {
    actorId: string;
    actorLabel: string;
  };
  anchorLabel: string;
  note: string;
  createdAt: ISODateString;
  tags?: string[];
}

export interface CollaborationThreadDto {
  targetType: CollaborationTargetType;
  targetId: string;
  comments: CollaborationCommentDto[];
  annotations: CollaborationAnnotationDto[];
}

export interface CreateCommentRequestDto {
  targetType: CollaborationTargetType;
  targetId: string;
  actorId: string;
  actorLabel: string;
  message: string;
  parentCommentId?: string;
  tags?: string[];
}

export interface CreateAnnotationRequestDto {
  targetType: CollaborationTargetType;
  targetId: string;
  actorId: string;
  actorLabel: string;
  anchorLabel: string;
  note: string;
  tags?: string[];
}

export interface ResolveCommentRequestDto {
  status: CommentStatus;
}

export type WorkspaceRole =
  | "merchandiser"
  | "reviewer"
  | "approver"
  | "release_manager"
  | "admin";

export interface SavedViewDto {
  id: string;
  name: string;
  role: WorkspaceRole;
  description?: string;
  filters: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  isDefault?: boolean;
}

export interface WorkspacePresetDto {
  role: WorkspaceRole;
  title: string;
  description: string;
  visibleSections: string[];
  defaultFilters: Record<string, unknown>;
}

export interface WorkspaceStateDto {
  activeRole: WorkspaceRole;
  availableRoles: WorkspaceRole[];
  presets: WorkspacePresetDto[];
  savedViews: SavedViewDto[];
}

export interface CreateSavedViewRequestDto {
  name: string;
  role: WorkspaceRole;
  description?: string;
  filters: Record<string, unknown>;
  isDefault?: boolean;
}

export interface UpdateSavedViewRequestDto {
  name?: string;
  description?: string;
  filters?: Record<string, unknown>;
  isDefault?: boolean;
}

export interface SavedViewListResponseDto {
  total: number;
  savedViews: SavedViewDto[];
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: ISODateString;
  lastLoginAt?: ISODateString;
}

export interface SessionDto {
  token: string;
  user: UserDto;
  createdAt: ISODateString;
  expiresAt: ISODateString;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  success: boolean;
  session?: SessionDto;
  message?: string;
}

export interface CurrentUserResponseDto {
  authenticated: boolean;
  user?: UserDto;
  standingRole?: UserRole;
  effectiveRole?: UserRole;
  activePrivilege?: ActivePrivilegeDto;
  permissions?: PermissionKey[];
}

export type PermissionKey =
  | "view_dashboard"
  | "manage_rules"
  | "manage_synonyms"
  | "view_approvals"
  | "approve_release"
  | "execute_release"
  | "manage_reviewers"
  | "manage_policy"
  | "manage_snapshots"
  | "promote_live"
  | "view_audit_logs"
  | "manage_saved_views"
  | "comment"
  | "annotate";

export interface RolePermissionsDto {
  role: UserRole;
  permissions: PermissionKey[];
}

export interface UserListResponseDto {
  total: number;
  users: UserDto[];
}

export type ExportFormat = "json" | "csv";

export type ExportTargetType =
  | "audit_trail"
  | "approvals"
  | "access_reviews"
  | "security_timeline"
  | "audit_review_findings"
  | "soc2_audit_package"
  | "audit_hash_chain_report"
  | "api_usage_meters";

export type ExportJobStatus = "generated" | "failed";

export interface ExportJobDto {
  id: string;
  createdAt: ISODateString;
  createdByUserId: string;
  createdByName: string;
  targetType: ExportTargetType;
  format: ExportFormat;
  status: ExportJobStatus;
  filters?: Record<string, unknown>;
  fileName?: string;
  recordCount?: number;
  errorMessage?: string;
}

export interface CreateExportJobRequestDto {
  targetType: ExportTargetType;
  format: ExportFormat;
  filters?: Record<string, unknown>;
}

export interface ExportJobListResponseDto {
  total: number;
  jobs: ExportJobDto[];
}

export type WebhookEventType =
  | "auth.login.succeeded"
  | "auth.login.failed"
  | "rbac.access.denied"
  | "approval.created"
  | "approval.approved"
  | "approval.rejected"
  | "promotion.executed"
  | "jit.request.approved"
  | "jit.request.revoked"
  | "audit.review.completed";

export interface WebhookEndpointDto {
  id: string;
  createdAt: ISODateString;
  name: string;
  url: string;
  active: boolean;
  subscribedEvents: WebhookEventType[];
  secret?: string;
  lastDeliveryAt?: ISODateString;
  lastDeliveryStatus?: "succeeded" | "failed";
}

export interface CreateWebhookEndpointRequestDto {
  name: string;
  url: string;
  subscribedEvents: WebhookEventType[];
  secret?: string;
}

export interface WebhookEndpointListResponseDto {
  total: number;
  endpoints: WebhookEndpointDto[];
}

export interface WebhookDeliveryLogDto {
  id: string;
  createdAt: ISODateString;
  endpointId: string;
  eventType: WebhookEventType;
  status: "succeeded" | "failed";
  responseStatusCode?: number;
  errorMessage?: string;
  attemptNumber: number;
}

export interface WebhookDeliveryLogListResponseDto {
  total: number;
  deliveries: WebhookDeliveryLogDto[];
}

export interface EmitWebhookEventDto {
  type: WebhookEventType;
  payload: Record<string, unknown>;
}

export interface TestWebhookFireRequestDto {
  eventType: WebhookEventType;
  payload?: Record<string, unknown>;
}

export interface TestWebhookFireRequestDto {
  eventType: WebhookEventType;
  payload?: Record<string, unknown>;
}

export interface SecurityTimelineEntryDto {
  id: string;
  occurredAt: ISODateString;
  category: string;
  severity: "info" | "warning" | "critical";
  summary: string;
  actorLabel: string;
  entityType: string;
  entityId?: string;
  actionType: string;
  outcome: AuditOutcome;
}

export interface SecurityTimelineResponseDto {
  total: number;
  entries: SecurityTimelineEntryDto[];
}

export interface BrowseRequestDto {
  category?: string;
  brand?: string;
  inStock?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "title_asc";
  page: number;
  pageSize: number;
}

export interface BrowseHitDto {
  id: string;
  sku: string;
  title: string;
  brand: string;
  category: string;
  subcategory: string;
  description: string;
  price: number;
  imageUrl?: string;
  inStock: boolean;
}

export interface BrowseCategoryDto {
  category: string;
  subcategories: string[];
  productCount: number;
}

export interface BrowseResponseDto {
  page: number;
  pageSize: number;
  totalHits: number;
  totalPages: number;
  processingTimeMs: number;
  hits: BrowseHitDto[];
  categories?: BrowseCategoryDto[];
}

export interface ApiKeyDto {
  id: string;
  name: string;
  keyPrefix: string;
  tenantId: string;
  scopes: string[];
  enabled: boolean;
  lastUsedAt?: ISODateString;
  expiresAt?: ISODateString;
  createdAt: ISODateString;
}

export interface CreateApiKeyRequestDto {
  name: string;
  tenantId?: string;
  scopes?: string[];
  rateLimitPerMinute?: number;
  expiresAt?: ISODateString;
}

export interface CreateApiKeyResponseDto {
  apiKey: ApiKeyDto;
  /** Plaintext key — shown once at creation. */
  secret: string;
}

export interface ApiKeyListResponseDto {
  total: number;
  apiKeys: ApiKeyDto[];
}

export interface SearchMetricsSnapshotDto {
  searchRequests: number;
  autocompleteRequests: number;
  browseRequests: number;
  searchLatencyMsTotal: number;
  autocompleteLatencyMsTotal: number;
  browseLatencyMsTotal: number;
  indexProductCount: number;
  indexTokenCount: number;
  analyticsEventsPersisted: number;
}

export interface ZeroResultQueryInsightDto {
  query: string;
  count: number;
  lastSeenAt: ISODateString;
}

export interface ZeroResultInsightsResponseDto {
  total: number;
  queries: ZeroResultQueryInsightDto[];
}

export type ScheduledReleaseType = "promote_snapshot" | "rollback_snapshot";
export type ScheduledReleaseStatus = "pending" | "executed" | "cancelled" | "failed";

export interface ScheduledReleaseDto {
  id: string;
  type: ScheduledReleaseType;
  status: ScheduledReleaseStatus;
  snapshotId: string;
  reason: string;
  scheduledAt: ISODateString;
  executedAt?: ISODateString;
  linkedExperimentId?: string;
  approvalRequestId?: string;
  errorMessage?: string;
  createdByUserId?: string;
  createdByEmail?: string;
  createdAt: ISODateString;
}

export interface CreateScheduledReleaseRequestDto {
  type: ScheduledReleaseType;
  snapshotId: string;
  reason: string;
  scheduledAt: ISODateString;
  linkedExperimentId?: string;
  approvalRequestId?: string;
}

export interface ScheduledReleaseListResponseDto {
  total: number;
  releases: ScheduledReleaseDto[];
}

export type RuleDraftStatus = "pending_review" | "approved" | "rejected" | "applied";

export interface RuleDraftDto {
  id: string;
  query: string;
  status: RuleDraftStatus;
  suggestedRule: Record<string, unknown>;
  rationale?: string;
  source: string;
  createdByUserId?: string;
  approvalRequestId?: string;
  createdAt: ISODateString;
}

export interface GenerateRuleDraftRequestDto {
  query: string;
  productId?: string;
}

export interface RuleDraftListResponseDto {
  total: number;
  drafts: RuleDraftDto[];
}

export interface AuditHashChainReportDto {
  valid: boolean;
  entryCount: number;
  brokenAtEntryId?: string;
  verifiedAt: ISODateString;
}

export interface ApiUsageMeterDto {
  apiKeyId: string;
  tenantId: string;
  route: string;
  windowStart: ISODateString;
  requestCount: number;
}

export interface ApiUsageSummaryDto {
  totalRequests: number;
  meters: ApiUsageMeterDto[];
}

export interface BackgroundJobDto {
  id: string;
  type: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: ISODateString;
  startedAt?: ISODateString;
  completedAt?: ISODateString;
  errorMessage?: string;
}

export interface FederatedSearchDebugDto {
  indexes: string[];
  mergedHitCount: number;
  hybridVectorEnabled: boolean;
}
