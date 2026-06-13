import { validateCompiledRuleSnapshot } from "./compiled-rule-snapshot.js";
import {
  collectScopeEvictions,
  getOrCreateScopeState,
  markPreviousActiveAsInactive,
  pruneGlobalToEstimatedBytes,
  pruneGlobalToSnapshotLimit,
  retireExpiredSnapshots,
} from "./cache-invalidation.js";
import {
  recordAcquisition,
  recordCacheHit,
  recordCacheMiss,
  recordEviction,
  recordInvalidation,
  recordPublish,
  recordRelease,
  syncCacheInventoryMetrics,
} from "./cache-metrics.js";
import type {
  BuildSnapshotEntryKeyParams,
  CachedSnapshotEntry,
  CacheStatsSnapshot,
  CompiledRuleSnapshot,
  SnapshotAcquireHandle,
  SnapshotCacheConfig,
  SnapshotCacheKeyParams,
  SnapshotCacheScopeKey,
  SnapshotCacheState,
  SnapshotPublishResult,
  SnapshotScopeState,
  SnapshotVersion,
} from "./types.js";

export const DEFAULT_SNAPSHOT_CACHE_CONFIG: SnapshotCacheConfig = {
  inactiveTtlMs: 300_000,
  maxSnapshotsPerScope: 3,
  maxTotalSnapshots: 200,
  maxEstimatedBytes: undefined,
};

export interface RuntimeSnapshotCache {
  readonly state: SnapshotCacheState;
  buildSnapshotScopeKey(params: SnapshotCacheKeyParams): SnapshotCacheScopeKey;
  buildSnapshotEntryKey(params: BuildSnapshotEntryKeyParams): string;
  getScopeState(scopeKey: SnapshotCacheScopeKey): SnapshotScopeState | undefined;
  getActiveSnapshotHandle(
    scopeKey: SnapshotCacheScopeKey,
    nowEpochMs?: number,
  ): SnapshotAcquireHandle | undefined;
  publishSnapshot(
    scopeKey: SnapshotCacheScopeKey,
    snapshot: CompiledRuleSnapshot,
    version: SnapshotVersion,
    nowEpochMs?: number,
  ): SnapshotPublishResult;
  invalidateScope(scopeKey: SnapshotCacheScopeKey, nowEpochMs?: number): string[];
  evictInactiveSnapshots(
    scopeKey: SnapshotCacheScopeKey,
    nowEpochMs?: number,
  ): string[];
  evictGlobally(nowEpochMs?: number): string[];
  getCacheStats(): CacheStatsSnapshot;
}

export function buildSnapshotScopeKey(
  params: SnapshotCacheKeyParams,
): SnapshotCacheScopeKey {
  const locale = params.locale?.trim().toLowerCase() || "_";
  const channel = params.channel?.trim().toLowerCase() || "_";
  return `${params.tenantId}|${params.environment}|${locale}|${channel}`;
}

export function buildSnapshotEntryKey(params: BuildSnapshotEntryKeyParams): string {
  return `${params.scopeKey}@v=${params.version}`;
}

export function estimateSnapshotBytes(snapshot: CompiledRuleSnapshot): number {
  let bytes = 512;
  bytes += snapshot.globalRules.length * 128;

  for (const map of [
    snapshot.queryExactMap,
    snapshot.categoryMap,
    snapshot.brandMap,
  ]) {
    for (const refs of map.values()) {
      bytes += refs.length * 128;
    }
  }

  for (const effects of snapshot.ruleEffectsMap.values()) {
    bytes += effects.length * 96;
  }

  return bytes;
}

function syncInventoryMetrics(cacheState: SnapshotCacheState): void {
  let totalCachedSnapshots = 0;
  let totalEstimatedBytes = 0;

  for (const scope of cacheState.scopes.values()) {
    totalCachedSnapshots += scope.entriesByKey.size;
    for (const entry of scope.entriesByKey.values()) {
      totalEstimatedBytes += entry.estimatedBytes ?? 0;
    }
  }

  syncCacheInventoryMetrics({
    activeScopes: cacheState.scopes.size,
    totalCachedSnapshots,
    totalEstimatedBytes,
  });
}

function runGlobalEviction(
  cacheState: SnapshotCacheState,
  nowEpochMs: number,
): string[] {
  const evictedKeys: string[] = [];

  for (const evicted of pruneGlobalToSnapshotLimit(
    cacheState,
    cacheState.config.maxTotalSnapshots,
    nowEpochMs,
  )) {
    recordEviction(evicted.type);
    evictedKeys.push(evicted.key);
  }

  for (const evicted of pruneGlobalToEstimatedBytes(
    cacheState,
    cacheState.config.maxEstimatedBytes,
    nowEpochMs,
  )) {
    recordEviction(evicted.type);
    evictedKeys.push(evicted.key);
  }

  return evictedKeys;
}

function runScopeEviction(
  cacheState: SnapshotCacheState,
  scopeState: SnapshotScopeState,
  nowEpochMs: number,
): string[] {
  const evictedKeys: string[] = [];

  for (const evicted of collectScopeEvictions(scopeState, nowEpochMs, cacheState.config)) {
    recordEviction(evicted.type);
    evictedKeys.push(evicted.key);
  }

  evictedKeys.push(...runGlobalEviction(cacheState, nowEpochMs));
  return evictedKeys;
}

function createAcquireHandle(entry: CachedSnapshotEntry): SnapshotAcquireHandle {
  let released = false;
  entry.inFlightReaders += 1;
  recordAcquisition();

  return {
    entry,
    release: () => {
      if (released) {
        return;
      }
      released = true;
      entry.inFlightReaders = Math.max(0, entry.inFlightReaders - 1);
      recordRelease();
    },
  };
}

export function createRuntimeSnapshotCache(
  config: Partial<SnapshotCacheConfig> = {},
): RuntimeSnapshotCache {
  const cacheState: SnapshotCacheState = {
    config: {
      ...DEFAULT_SNAPSHOT_CACHE_CONFIG,
      ...config,
    },
    scopes: new Map(),
  };

  const api: RuntimeSnapshotCache = {
    state: cacheState,

    buildSnapshotScopeKey(params: SnapshotCacheKeyParams): SnapshotCacheScopeKey {
      return buildSnapshotScopeKey(params);
    },

    buildSnapshotEntryKey(params: BuildSnapshotEntryKeyParams): string {
      return buildSnapshotEntryKey(params);
    },

    getScopeState(scopeKey: SnapshotCacheScopeKey): SnapshotScopeState | undefined {
      return cacheState.scopes.get(scopeKey);
    },

    getActiveSnapshotHandle(
      scopeKey: SnapshotCacheScopeKey,
      nowEpochMs: number = Date.now(),
    ): SnapshotAcquireHandle | undefined {
      const scopeState = cacheState.scopes.get(scopeKey);
      if (!scopeState?.activeKey) {
        recordCacheMiss();
        return undefined;
      }

      const entry = scopeState.entriesByKey.get(scopeState.activeKey);
      if (!entry || !entry.isActive) {
        recordCacheMiss();
        return undefined;
      }

      entry.lastAccessedAtEpochMs = nowEpochMs;
      recordCacheHit();
      return createAcquireHandle(entry);
    },

    publishSnapshot(
      scopeKey: SnapshotCacheScopeKey,
      snapshot: CompiledRuleSnapshot,
      version: SnapshotVersion,
      nowEpochMs: number = Date.now(),
    ): SnapshotPublishResult {
      validateCompiledRuleSnapshot(snapshot);

      const scopeState = getOrCreateScopeState(cacheState, scopeKey);
      const previousActiveKey = scopeState.activeKey;
      const entryKey = buildSnapshotEntryKey({ scopeKey, version });

      markPreviousActiveAsInactive(
        scopeState,
        previousActiveKey,
        nowEpochMs,
        cacheState.config.inactiveTtlMs,
      );

      const entry: CachedSnapshotEntry = {
        key: entryKey,
        scopeKey,
        version,
        snapshot,
        loadedAtEpochMs: nowEpochMs,
        lastAccessedAtEpochMs: nowEpochMs,
        expiresAtEpochMs: Number.MAX_SAFE_INTEGER,
        inFlightReaders: 0,
        isActive: true,
        estimatedBytes: estimateSnapshotBytes(snapshot),
      };

      scopeState.entriesByKey.set(entryKey, entry);
      scopeState.activeKey = entryKey;
      recordPublish();

      const evictedKeys = runScopeEviction(cacheState, scopeState, nowEpochMs);
      syncInventoryMetrics(cacheState);

      return {
        scopeKey,
        previousActiveKey,
        nextActiveKey: entryKey,
        evictedKeys,
      };
    },

    invalidateScope(
      scopeKey: SnapshotCacheScopeKey,
      nowEpochMs: number = Date.now(),
    ): string[] {
      const scopeState = cacheState.scopes.get(scopeKey);
      if (!scopeState) {
        return [];
      }

      recordInvalidation();

      if (scopeState.activeKey) {
        const activeEntry = scopeState.entriesByKey.get(scopeState.activeKey);
        if (activeEntry) {
          activeEntry.isActive = false;
          activeEntry.expiresAtEpochMs = nowEpochMs;
        }
        scopeState.activeKey = undefined;
      }

      const evictedKeys = runScopeEviction(cacheState, scopeState, nowEpochMs);
      syncInventoryMetrics(cacheState);
      return evictedKeys;
    },

    evictInactiveSnapshots(
      scopeKey: SnapshotCacheScopeKey,
      nowEpochMs: number = Date.now(),
    ): string[] {
      const scopeState = cacheState.scopes.get(scopeKey);
      if (!scopeState) {
        return [];
      }

      const evictedKeys: string[] = [];
      for (const key of retireExpiredSnapshots(scopeState, nowEpochMs)) {
        recordEviction("expired");
        evictedKeys.push(key);
      }

      evictedKeys.push(...runScopeEviction(cacheState, scopeState, nowEpochMs));
      syncInventoryMetrics(cacheState);
      return evictedKeys;
    },

    evictGlobally(nowEpochMs: number = Date.now()): string[] {
      const evictedKeys: string[] = [];

      for (const scopeState of cacheState.scopes.values()) {
        for (const key of retireExpiredSnapshots(scopeState, nowEpochMs)) {
          recordEviction("expired");
          evictedKeys.push(key);
        }
      }

      evictedKeys.push(...runGlobalEviction(cacheState, nowEpochMs));
      syncInventoryMetrics(cacheState);
      return evictedKeys;
    },

    getCacheStats(): CacheStatsSnapshot {
      const scopes: CacheStatsSnapshot["scopes"] = [];
      let totalCachedSnapshots = 0;
      let totalEstimatedBytes = 0;

      for (const scopeState of cacheState.scopes.values()) {
        let scopeBytes = 0;
        for (const entry of scopeState.entriesByKey.values()) {
          scopeBytes += entry.estimatedBytes ?? 0;
        }

        const activeEntry = scopeState.activeKey
          ? scopeState.entriesByKey.get(scopeState.activeKey)
          : undefined;

        scopes.push({
          scopeKey: scopeState.scopeKey,
          activeKey: scopeState.activeKey,
          activeVersion: activeEntry?.version,
          entryCount: scopeState.entriesByKey.size,
          estimatedBytes: scopeBytes,
        });

        totalCachedSnapshots += scopeState.entriesByKey.size;
        totalEstimatedBytes += scopeBytes;
      }

      syncCacheInventoryMetrics({
        activeScopes: cacheState.scopes.size,
        totalCachedSnapshots,
        totalEstimatedBytes,
      });

      return {
        activeScopes: cacheState.scopes.size,
        totalCachedSnapshots,
        totalEstimatedBytes,
        scopes,
      };
    },
  };

  return api;
}

let defaultRuntimeSnapshotCache: RuntimeSnapshotCache | undefined;

export function getDefaultRuntimeSnapshotCache(
  config?: Partial<SnapshotCacheConfig>,
): RuntimeSnapshotCache {
  if (!defaultRuntimeSnapshotCache) {
    defaultRuntimeSnapshotCache = createRuntimeSnapshotCache(config);
  }
  return defaultRuntimeSnapshotCache;
}

export function resetDefaultRuntimeSnapshotCache(
  config?: Partial<SnapshotCacheConfig>,
): RuntimeSnapshotCache {
  defaultRuntimeSnapshotCache = createRuntimeSnapshotCache(config);
  return defaultRuntimeSnapshotCache;
}

/** @deprecated Use buildSnapshotScopeKey */
export function buildSnapshotCacheKey(
  params: SnapshotCacheKeyParams,
): SnapshotCacheScopeKey {
  return buildSnapshotScopeKey(params);
}

export function getActiveSnapshot(
  scopeKey: SnapshotCacheScopeKey,
): CompiledRuleSnapshot | undefined {
  const handle = getDefaultRuntimeSnapshotCache().getActiveSnapshotHandle(scopeKey);
  if (!handle) {
    return undefined;
  }
  const snapshot = handle.entry.snapshot;
  handle.release();
  return snapshot;
}

export function setActiveSnapshot(
  scopeKey: SnapshotCacheScopeKey,
  snapshot: CompiledRuleSnapshot,
): SnapshotPublishResult {
  return getDefaultRuntimeSnapshotCache().publishSnapshot(
    scopeKey,
    snapshot,
    snapshot.version,
  );
}

export function swapActiveSnapshot(
  scopeKey: SnapshotCacheScopeKey,
  snapshot: CompiledRuleSnapshot,
): CompiledRuleSnapshot | undefined {
  const cache = getDefaultRuntimeSnapshotCache();
  const previousKey = cache.getScopeState(scopeKey)?.activeKey;
  const previous = previousKey
    ? cache.getScopeState(scopeKey)?.entriesByKey.get(previousKey)?.snapshot
    : undefined;
  cache.publishSnapshot(scopeKey, snapshot, snapshot.version);
  return previous;
}

export function invalidateSnapshot(scopeKey: SnapshotCacheScopeKey): boolean {
  const evicted = getDefaultRuntimeSnapshotCache().invalidateScope(scopeKey);
  return evicted.length > 0 || getDefaultRuntimeSnapshotCache().getScopeState(scopeKey) !== undefined;
}

export interface SnapshotCacheEntry {
  snapshot: CompiledRuleSnapshot;
  loadedAtEpochMs: number;
}

export function getActiveSnapshotMetadata(
  scopeKey: SnapshotCacheScopeKey,
): SnapshotCacheEntry | undefined {
  const scopeState = getDefaultRuntimeSnapshotCache().getScopeState(scopeKey);
  if (!scopeState?.activeKey) {
    return undefined;
  }
  const entry = scopeState.entriesByKey.get(scopeState.activeKey);
  if (!entry) {
    return undefined;
  }
  return {
    snapshot: entry.snapshot,
    loadedAtEpochMs: entry.loadedAtEpochMs,
  };
}

export function getActiveSnapshotHandle(
  scopeKey: SnapshotCacheScopeKey,
  nowEpochMs?: number,
): SnapshotAcquireHandle | undefined {
  return getDefaultRuntimeSnapshotCache().getActiveSnapshotHandle(scopeKey, nowEpochMs);
}

export function publishSnapshot(
  scopeKey: SnapshotCacheScopeKey,
  snapshot: CompiledRuleSnapshot,
  version: SnapshotVersion,
  nowEpochMs?: number,
): SnapshotPublishResult {
  return getDefaultRuntimeSnapshotCache().publishSnapshot(
    scopeKey,
    snapshot,
    version,
    nowEpochMs,
  );
}

export function invalidateScope(
  scopeKey: SnapshotCacheScopeKey,
  nowEpochMs?: number,
): string[] {
  return getDefaultRuntimeSnapshotCache().invalidateScope(scopeKey, nowEpochMs);
}

export function getCacheStats(): CacheStatsSnapshot {
  return getDefaultRuntimeSnapshotCache().getCacheStats();
}

export function evictInactiveSnapshots(
  scopeKey: SnapshotCacheScopeKey,
  nowEpochMs?: number,
): string[] {
  return getDefaultRuntimeSnapshotCache().evictInactiveSnapshots(scopeKey, nowEpochMs);
}

export function evictGlobally(nowEpochMs?: number): string[] {
  return getDefaultRuntimeSnapshotCache().evictGlobally(nowEpochMs);
}
