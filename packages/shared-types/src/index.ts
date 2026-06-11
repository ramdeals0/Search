export type ProductId = string;
export type SKU = string;
export type ISODateString = string;

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

export type MerchandisingRuleDto = MerchandisingRule;

export type CreateMerchandisingRuleDto = Omit<MerchandisingRule, "id">;

export type UpdateMerchandisingRuleDto = Partial<Omit<MerchandisingRule, "id">>;

export interface QueryPreviewHitDto {
  id: string;
  title: string;
  brand: string;
  category: string;
  score: number;
  inStock: boolean;
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
  | "mark_notification_read";

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
  | "notification";

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
  createdAt: ISODateString;
  lastRunAt?: ISODateString;
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
  | "approval_executed";

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
