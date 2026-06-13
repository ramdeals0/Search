export type RuntimeEnvironment = "staging" | "live";

export type MerchRuleEffectType = "boost" | "bury" | "pin";

export type MatchScopeType =
  | "query_exact"
  | "category"
  | "brand"
  | "global";

export type SnapshotScopeKey = string;
export type SnapshotVersion = string;

/** @deprecated Use SnapshotScopeKey */
export type SnapshotCacheScopeKey = SnapshotScopeKey;

export interface EvalContext {
  tenantId: string;
  environment: RuntimeEnvironment;
  locale?: string;
  channel?: string;
  queryRaw: string;
  queryNormalized: string;
  queryCanonical: string;
  categoryKey?: string;
  brandKeys?: string[];
  nowEpochMs: number;
}

export interface SearchCandidate {
  productId: string;
  variantId?: string;
  baseScore: number;
  inStock?: boolean;
  rating?: number;
  popularity?: number;
  metadata?: Record<string, unknown>;
}

export interface RuleRef {
  ruleId: string;
  ruleVersionId: string;
  priority: number;
  scopeType: MatchScopeType;
  stackingMode: "additive" | "max" | "override";
  activeFromEpochMs?: number;
  activeToEpochMs?: number;
}

export interface CompiledEffect {
  productId: string;
  variantId?: string;
  effectType: MerchRuleEffectType;
  effectValue: number;
  pinPosition?: number;
  reasonCode?: string;
}

export interface AggregatedEffect {
  scoreDelta: number;
  pinPosition?: number;
  pinRulePriority?: number;
  matchedRuleIds: string[];
  matchedReasonCodes: string[];
}

export interface CompiledRuleSnapshot {
  snapshotId: string;
  tenantId: string;
  environment: RuntimeEnvironment;
  locale?: string;
  channel?: string;
  version: SnapshotVersion;
  generatedAtEpochMs: number;
  queryExactMap: Map<string, RuleRef[]>;
  categoryMap: Map<string, RuleRef[]>;
  brandMap: Map<string, RuleRef[]>;
  globalRules: readonly RuleRef[];
  ruleEffectsMap: Map<string, CompiledEffect[]>;
}

export interface EvaluatedCandidate extends SearchCandidate {
  finalScore: number;
  appliedPinPosition?: number;
  matchedRuleIds: string[];
  matchedReasonCodes: string[];
}

export interface BuildEvalContextInput {
  tenantId: string;
  environment: RuntimeEnvironment;
  query: string;
  locale?: string;
  channel?: string;
  categoryKey?: string;
  brandKeys?: string[];
  nowEpochMs?: number;
}

export interface SnapshotCacheKeyParams {
  tenantId: string;
  environment: RuntimeEnvironment;
  locale?: string;
  channel?: string;
}

export interface SnapshotEntry {
  entryKey: string;
  scopeKey: SnapshotScopeKey;
  version: SnapshotVersion;
  snapshot: CompiledRuleSnapshot;
  loadedAtEpochMs: number;
  lastAccessedAtEpochMs: number;
  inactiveSinceEpochMs?: number;
  expiresAtEpochMs?: number;
  inFlightReaders: number;
  isActive: boolean;
  estimatedBytes?: number;
}

export interface SnapshotManagerAcquireHandle {
  entry: SnapshotEntry;
  snapshot: CompiledRuleSnapshot;
  release: () => void;
}

export interface SnapshotManagerConfig {
  inactiveTtlMs: number;
  maxSnapshotsPerScope: number;
  maxTotalSnapshots: number;
  maxEstimatedBytes?: number;
  deepFreezeSnapshots?: boolean;
}

export interface SnapshotManagerPublishResult {
  scopeKey: SnapshotScopeKey;
  previousActiveEntryKey?: string;
  nextActiveEntryKey: string;
  nextVersion: SnapshotVersion;
  evictedEntryKeys: string[];
}

export interface SnapshotStats {
  activeScopes: number;
  totalSnapshots: number;
  activeSnapshots: number;
  inactiveSnapshots: number;
  inFlightReaders: number;
  estimatedBytes?: number;
}

/** Legacy cache-layer types retained for runtime-cache compatibility */
export interface CachedSnapshotEntry {
  key: string;
  scopeKey: SnapshotCacheScopeKey;
  version: SnapshotVersion;
  snapshot: CompiledRuleSnapshot;
  loadedAtEpochMs: number;
  lastAccessedAtEpochMs: number;
  expiresAtEpochMs: number;
  inFlightReaders: number;
  isActive: boolean;
  estimatedBytes?: number;
}

export interface SnapshotScopeState {
  scopeKey: SnapshotCacheScopeKey;
  activeKey?: string;
  entriesByKey: Map<string, CachedSnapshotEntry>;
}

export interface SnapshotCacheConfig {
  inactiveTtlMs: number;
  maxSnapshotsPerScope: number;
  maxTotalSnapshots: number;
  maxEstimatedBytes?: number;
}

export interface SnapshotPublishResult {
  scopeKey: string;
  previousActiveKey?: string;
  nextActiveKey: string;
  evictedKeys: string[];
}

export interface SnapshotAcquireHandle {
  entry: CachedSnapshotEntry;
  release: () => void;
}

export interface SnapshotCacheState {
  config: SnapshotCacheConfig;
  scopes: Map<SnapshotCacheScopeKey, SnapshotScopeState>;
}

export interface CacheStatsSnapshot {
  activeScopes: number;
  totalCachedSnapshots: number;
  totalEstimatedBytes: number;
  scopes: Array<{
    scopeKey: SnapshotCacheScopeKey;
    activeKey?: string;
    activeVersion?: SnapshotVersion;
    entryCount: number;
    estimatedBytes: number;
  }>;
}

export interface BuildSnapshotEntryKeyParams {
  scopeKey: SnapshotCacheScopeKey;
  version: SnapshotVersion;
}

export interface SnapshotScopeParams extends SnapshotCacheKeyParams {}
