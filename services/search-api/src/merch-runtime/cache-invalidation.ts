import type {
  CachedSnapshotEntry,
  SnapshotCacheConfig,
  SnapshotCacheScopeKey,
  SnapshotCacheState,
  SnapshotScopeState,
} from "./types.js";
import type { CacheEvictionType } from "./cache-metrics.js";

export function isEvictableEntry(
  entry: CachedSnapshotEntry,
  nowEpochMs: number,
): boolean {
  if (entry.isActive) {
    return false;
  }
  if (entry.inFlightReaders > 0) {
    return false;
  }
  return nowEpochMs >= entry.expiresAtEpochMs;
}

export function canForceRetireInactiveEntry(entry: CachedSnapshotEntry): boolean {
  return !entry.isActive && entry.inFlightReaders === 0;
}

export function markPreviousActiveAsInactive(
  scopeState: SnapshotScopeState,
  previousKey: string | undefined,
  nowEpochMs: number,
  inactiveTtlMs: number,
): void {
  if (!previousKey) {
    return;
  }

  const previous = scopeState.entriesByKey.get(previousKey);
  if (!previous || !previous.isActive) {
    return;
  }

  previous.isActive = false;
  previous.expiresAtEpochMs = nowEpochMs + inactiveTtlMs;
}

export function retireExpiredSnapshots(
  scopeState: SnapshotScopeState,
  nowEpochMs: number,
): string[] {
  const evictedKeys: string[] = [];

  for (const [key, entry] of scopeState.entriesByKey.entries()) {
    if (!isEvictableEntry(entry, nowEpochMs)) {
      continue;
    }
    scopeState.entriesByKey.delete(key);
    if (scopeState.activeKey === key) {
      scopeState.activeKey = undefined;
    }
    evictedKeys.push(key);
  }

  return evictedKeys;
}

function collectInactiveEvictableEntries(
  scopeState: SnapshotScopeState,
): CachedSnapshotEntry[] {
  const entries: CachedSnapshotEntry[] = [];
  for (const entry of scopeState.entriesByKey.values()) {
    if (entry.isActive || entry.inFlightReaders > 0) {
      continue;
    }
    entries.push(entry);
  }
  entries.sort((a, b) => a.lastAccessedAtEpochMs - b.lastAccessedAtEpochMs);
  return entries;
}

export function pruneScopeToGenerationLimit(
  scopeState: SnapshotScopeState,
  maxSnapshotsPerScope: number,
  _nowEpochMs: number,
): string[] {
  if (maxSnapshotsPerScope <= 0) {
    return [];
  }

  const evictedKeys: string[] = [];
  const protectedKeys = new Set<string>();
  if (scopeState.activeKey) {
    protectedKeys.add(scopeState.activeKey);
  }

  const inactiveEntries = collectInactiveEvictableEntries(scopeState)
    .sort((a, b) => b.loadedAtEpochMs - a.loadedAtEpochMs);

  const allowedInactive = Math.max(0, maxSnapshotsPerScope - protectedKeys.size);
  const keepInactive = new Set(
    inactiveEntries.slice(0, allowedInactive).map((entry) => entry.key),
  );

  for (const entry of inactiveEntries) {
    if (keepInactive.has(entry.key)) {
      continue;
    }
    if (entry.inFlightReaders > 0 || entry.isActive) {
      continue;
    }
    scopeState.entriesByKey.delete(entry.key);
    evictedKeys.push(entry.key);
  }

  return evictedKeys;
}

function countCachedSnapshots(cacheState: SnapshotCacheState): number {
  let total = 0;
  for (const scope of cacheState.scopes.values()) {
    total += scope.entriesByKey.size;
  }
  return total;
}

function sumEstimatedBytes(cacheState: SnapshotCacheState): number {
  let total = 0;
  for (const scope of cacheState.scopes.values()) {
    for (const entry of scope.entriesByKey.values()) {
      total += entry.estimatedBytes ?? 0;
    }
  }
  return total;
}

function collectGlobalInactiveCandidates(
  cacheState: SnapshotCacheState,
): CachedSnapshotEntry[] {
  const entries: CachedSnapshotEntry[] = [];
  for (const scope of cacheState.scopes.values()) {
    for (const entry of scope.entriesByKey.values()) {
      if (entry.isActive || entry.inFlightReaders > 0) {
        continue;
      }
      entries.push(entry);
    }
  }
  entries.sort((a, b) => a.lastAccessedAtEpochMs - b.lastAccessedAtEpochMs);
  return entries;
}

function removeEntryFromScope(
  cacheState: SnapshotCacheState,
  entry: CachedSnapshotEntry,
): void {
  const scope = cacheState.scopes.get(entry.scopeKey);
  if (!scope) {
    return;
  }
  scope.entriesByKey.delete(entry.key);
  if (scope.activeKey === entry.key) {
    scope.activeKey = undefined;
  }
  if (scope.entriesByKey.size === 0 && !scope.activeKey) {
    cacheState.scopes.delete(entry.scopeKey);
  }
}

export function pruneGlobalToSnapshotLimit(
  cacheState: SnapshotCacheState,
  maxTotalSnapshots: number,
  _nowEpochMs: number,
): Array<{ key: string; type: CacheEvictionType }> {
  const evicted: Array<{ key: string; type: CacheEvictionType }> = [];
  if (maxTotalSnapshots <= 0) {
    return evicted;
  }

  let candidates = collectGlobalInactiveCandidates(cacheState);
  while (countCachedSnapshots(cacheState) > maxTotalSnapshots && candidates.length > 0) {
    const entry = candidates.shift();
    if (!entry) {
      break;
    }
    if (entry.isActive || entry.inFlightReaders > 0) {
      continue;
    }
    removeEntryFromScope(cacheState, entry);
    evicted.push({ key: entry.key, type: "global_limit" });
    candidates = collectGlobalInactiveCandidates(cacheState);
  }

  return evicted;
}

export function pruneGlobalToEstimatedBytes(
  cacheState: SnapshotCacheState,
  maxEstimatedBytes: number | undefined,
  _nowEpochMs: number,
): Array<{ key: string; type: CacheEvictionType }> {
  const evicted: Array<{ key: string; type: CacheEvictionType }> = [];
  if (maxEstimatedBytes === undefined || maxEstimatedBytes <= 0) {
    return evicted;
  }

  let candidates = collectGlobalInactiveCandidates(cacheState);
  while (sumEstimatedBytes(cacheState) > maxEstimatedBytes && candidates.length > 0) {
    const entry = candidates.shift();
    if (!entry) {
      break;
    }
    if (entry.isActive || entry.inFlightReaders > 0) {
      continue;
    }
    removeEntryFromScope(cacheState, entry);
    evicted.push({ key: entry.key, type: "bytes_limit" });
    candidates = collectGlobalInactiveCandidates(cacheState);
  }

  return evicted;
}

export function collectScopeEvictions(
  scopeState: SnapshotScopeState,
  nowEpochMs: number,
  config: SnapshotCacheConfig,
): Array<{ key: string; type: CacheEvictionType }> {
  const evicted: Array<{ key: string; type: CacheEvictionType }> = [];

  for (const key of retireExpiredSnapshots(scopeState, nowEpochMs)) {
    evicted.push({ key, type: "expired" });
  }

  for (const key of pruneScopeToGenerationLimit(
    scopeState,
    config.maxSnapshotsPerScope,
    nowEpochMs,
  )) {
    evicted.push({ key, type: "scope_limit" });
  }

  return evicted;
}

export function getOrCreateScopeState(
  cacheState: SnapshotCacheState,
  scopeKey: SnapshotCacheScopeKey,
): SnapshotScopeState {
  let scopeState = cacheState.scopes.get(scopeKey);
  if (!scopeState) {
    scopeState = {
      scopeKey,
      entriesByKey: new Map(),
    };
    cacheState.scopes.set(scopeKey, scopeState);
  }
  return scopeState;
}
