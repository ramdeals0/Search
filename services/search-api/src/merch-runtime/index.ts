export type {
  AggregatedEffect,
  BuildEvalContextInput,
  BuildSnapshotEntryKeyParams,
  CachedSnapshotEntry,
  CacheStatsSnapshot,
  CompiledEffect,
  CompiledRuleSnapshot,
  EvalContext,
  EvaluatedCandidate,
  MatchScopeType,
  MerchRuleEffectType,
  RuleRef,
  RuntimeEnvironment,
  SearchCandidate,
  SnapshotAcquireHandle,
  SnapshotCacheConfig,
  SnapshotCacheKeyParams,
  SnapshotCacheScopeKey,
  SnapshotCacheState,
  SnapshotEntry,
  SnapshotManagerAcquireHandle,
  SnapshotManagerConfig,
  SnapshotManagerPublishResult,
  SnapshotPublishResult,
  SnapshotScopeKey,
  SnapshotScopeParams,
  SnapshotScopeState,
  SnapshotStats,
  SnapshotVersion,
} from "./types.js";

export {
  buildEvalContext,
  canonicalizeQuery,
  normalizeBrandKey,
  normalizeCategoryKey,
  normalizeQuery,
} from "./normalization.js";

export {
  createCompiledRuleSnapshot,
  estimateSnapshotBytes,
  freezeCompiledRuleSnapshot,
  validateCompiledRuleSnapshot,
} from "./compiled-rule-snapshot.js";
export type { CreateCompiledRuleSnapshotInput } from "./compiled-rule-snapshot.js";

export {
  loadCompiledRuleSnapshot,
  loadCompiledSnapshotForScope,
  maybeReloadCompiledRuleSnapshot,
  preloadCompiledSnapshotForScope,
  registerSnapshotLoader,
} from "./snapshot-loader.js";
export type {
  LoadCompiledRuleSnapshotParams,
  LoadCompiledSnapshotForScopeParams,
  MaybeReloadCompiledRuleSnapshotParams,
  PreloadCompiledSnapshotForScopeParams,
} from "./snapshot-loader.js";

export {
  buildSnapshotCacheKey,
  buildSnapshotEntryKey,
  buildSnapshotScopeKey,
  createRuntimeSnapshotCache,
  DEFAULT_SNAPSHOT_CACHE_CONFIG,
  getActiveSnapshot,
  getActiveSnapshotHandle,
  getActiveSnapshotMetadata,
  getDefaultRuntimeSnapshotCache,
  getCacheStats,
  invalidateScope as invalidateRuntimeCacheScope,
  invalidateSnapshot,
  publishSnapshot,
  resetDefaultRuntimeSnapshotCache,
  setActiveSnapshot,
  swapActiveSnapshot,
} from "./runtime-cache.js";
export type {
  RuntimeSnapshotCache,
  SnapshotCacheEntry,
} from "./runtime-cache.js";

export {
  buildSnapshotScopeKey as buildManagerScopeKey,
  buildSnapshotEntryKey as buildManagerEntryKey,
  createSnapshotManager,
  DEFAULT_SNAPSHOT_MANAGER_CONFIG,
  getDefaultSnapshotManager,
  resetDefaultSnapshotManager,
} from "./snapshot-manager.js";
export type { SnapshotManager } from "./snapshot-manager.js";

export {
  collectExpiredInactiveEntryKeys,
  collectRetirableEntriesForScope,
  isEntryRetirable,
  markEntryInactive,
  pruneGlobalEntries,
  pruneScopeEntries,
} from "./snapshot-retirement.js";

export {
  getSnapshotMetrics,
  recordAcquire,
  recordEviction as recordSnapshotEviction,
  recordInvalidate,
  recordPublish as recordSnapshotPublish,
  recordRelease,
  recordRetire,
  resetSnapshotMetricsForTests,
  syncSnapshotInventoryMetrics,
} from "./snapshot-metrics.js";
export type { SnapshotMetricsSnapshot } from "./snapshot-metrics.js";

export {
  canForceRetireInactiveEntry,
  collectScopeEvictions,
  getOrCreateScopeState,
  isEvictableEntry,
  markPreviousActiveAsInactive,
  pruneGlobalToEstimatedBytes,
  pruneGlobalToSnapshotLimit,
  pruneScopeToGenerationLimit,
  retireExpiredSnapshots,
} from "./cache-invalidation.js";

export {
  getCacheMetricsSnapshot,
  recordAcquisition,
  recordCacheHit,
  recordCacheMiss,
  recordEviction,
  recordInvalidation,
  recordPublish,
  recordRelease as recordCacheRelease,
  resetCacheMetricsForTests,
  syncCacheInventoryMetrics,
} from "./cache-metrics.js";
export type { CacheEvictionType, CacheMetricsSnapshot } from "./cache-metrics.js";

export { aggregateMatchedRuleEffects } from "./merge-effects.js";
export { mergePinnedResults } from "./merge-pins.js";
export { evaluateMerchandisingRules } from "./evaluate-rules.js";

export {
  formatMerchRuntimeBenchmarkReport,
  formatSnapshotCacheBenchmarkReport,
  formatSnapshotManagerBenchmarkReport,
  runMerchRuntimeBenchmark,
  runSnapshotCacheBenchmark,
  runSnapshotManagerBenchmark,
} from "./benchmark.js";
export type {
  MerchRuntimeBenchmarkReport,
  SnapshotCacheBenchmarkReport,
  SnapshotManagerBenchmarkReport,
} from "./benchmark.js";
