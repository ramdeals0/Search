import {
  estimateSnapshotBytes,
  freezeCompiledRuleSnapshot,
  validateCompiledRuleSnapshot,
} from "./compiled-rule-snapshot.js";
import {
  recordAcquire,
  recordEviction,
  recordInvalidate,
  recordPublish,
  recordRelease,
  recordRetire,
  syncSnapshotInventoryMetrics,
} from "./snapshot-metrics.js";
import {
  collectExpiredInactiveEntryKeys,
  markEntryInactive,
  pruneGlobalEntries,
  pruneScopeEntries,
} from "./snapshot-retirement.js";
import type {
  CompiledRuleSnapshot,
  SnapshotEntry,
  SnapshotManagerAcquireHandle,
  SnapshotManagerConfig,
  SnapshotManagerPublishResult,
  SnapshotScopeKey,
  SnapshotScopeParams,
  SnapshotStats,
  SnapshotVersion,
} from "./types.js";

export const DEFAULT_SNAPSHOT_MANAGER_CONFIG: SnapshotManagerConfig = {
  inactiveTtlMs: 300_000,
  maxSnapshotsPerScope: 3,
  maxTotalSnapshots: 200,
  maxEstimatedBytes: undefined,
  deepFreezeSnapshots: false,
};

interface ScopeState {
  scopeKey: SnapshotScopeKey;
  activeEntryKey?: string;
  entriesByKey: Map<string, SnapshotEntry>;
}

export interface SnapshotManager {
  readonly config: SnapshotManagerConfig;
  acquire(scopeKey: SnapshotScopeKey, nowEpochMs?: number): SnapshotManagerAcquireHandle | null;
  /** Returns the active snapshot without incrementing readers (peek / non-request usage). */
  getActiveSnapshot(scopeKey: SnapshotScopeKey): CompiledRuleSnapshot | null;
  getActiveEntry(scopeKey: SnapshotScopeKey): SnapshotEntry | null;
  publish(
    scopeKey: SnapshotScopeKey,
    nextSnapshot: CompiledRuleSnapshot,
    nowEpochMs?: number,
  ): SnapshotManagerPublishResult;
  retire(scopeKey: SnapshotScopeKey, nowEpochMs?: number): string[];
  invalidateScope(scopeKey: SnapshotScopeKey, nowEpochMs?: number): string[];
  getStats(): SnapshotStats;
  getScopeEntries(scopeKey: SnapshotScopeKey): SnapshotEntry[];
}

export function buildSnapshotScopeKey(params: SnapshotScopeParams): SnapshotScopeKey {
  const locale = params.locale?.trim().toLowerCase() || "_";
  const channel = params.channel?.trim().toLowerCase() || "_";
  return `${params.tenantId}|${params.environment}|${locale}|${channel}`;
}

export function buildSnapshotEntryKey(
  scopeKey: SnapshotScopeKey,
  version: SnapshotVersion,
): string {
  return `${scopeKey}@v=${version}`;
}

function getOrCreateScope(scopes: Map<SnapshotScopeKey, ScopeState>, scopeKey: SnapshotScopeKey): ScopeState {
  let scope = scopes.get(scopeKey);
  if (!scope) {
    scope = {
      scopeKey,
      entriesByKey: new Map(),
    };
    scopes.set(scopeKey, scope);
  }
  return scope;
}

function listAllEntries(scopes: Map<SnapshotScopeKey, ScopeState>): SnapshotEntry[] {
  const entries: SnapshotEntry[] = [];
  for (const scope of scopes.values()) {
    entries.push(...scope.entriesByKey.values());
  }
  return entries;
}

function removeEntryFromScope(scope: ScopeState, entryKey: string): void {
  scope.entriesByKey.delete(entryKey);
  if (scope.activeEntryKey === entryKey) {
    scope.activeEntryKey = undefined;
  }
}

function createAcquireHandle(entry: SnapshotEntry): SnapshotManagerAcquireHandle {
  let released = false;
  entry.inFlightReaders += 1;
  recordAcquire();

  return {
    entry,
    snapshot: entry.snapshot,
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

function computeStats(scopes: Map<SnapshotScopeKey, ScopeState>): SnapshotStats {
  let totalSnapshots = 0;
  let activeSnapshots = 0;
  let inactiveSnapshots = 0;
  let inFlightReaders = 0;
  let estimatedBytes = 0;

  for (const scope of scopes.values()) {
    for (const entry of scope.entriesByKey.values()) {
      totalSnapshots += 1;
      inFlightReaders += entry.inFlightReaders;
      estimatedBytes += entry.estimatedBytes ?? 0;
      if (entry.isActive) {
        activeSnapshots += 1;
      } else {
        inactiveSnapshots += 1;
      }
    }
  }

  return {
    activeScopes: scopes.size,
    totalSnapshots,
    activeSnapshots,
    inactiveSnapshots,
    inFlightReaders,
    estimatedBytes: estimatedBytes > 0 ? estimatedBytes : undefined,
  };
}

function runRetirementForScope(
  scope: ScopeState,
  scopes: Map<SnapshotScopeKey, ScopeState>,
  config: SnapshotManagerConfig,
  nowEpochMs: number,
): string[] {
  const scopeEntries = [...scope.entriesByKey.values()];
  const evictedEntryKeys: string[] = [];

  for (const entryKey of collectExpiredInactiveEntryKeys(
    scopeEntries,
    scope.activeEntryKey,
    nowEpochMs,
  )) {
    removeEntryFromScope(scope, entryKey);
    evictedEntryKeys.push(entryKey);
    recordEviction();
  }

  for (const entryKey of pruneScopeEntries(
    [...scope.entriesByKey.values()],
    scope.activeEntryKey,
    config,
  )) {
    if (!scope.entriesByKey.has(entryKey)) {
      continue;
    }
    removeEntryFromScope(scope, entryKey);
    evictedEntryKeys.push(entryKey);
    recordEviction();
  }

  const remainingEntries = listAllEntries(scopes);
  for (const entryKey of pruneGlobalEntries(remainingEntries, config)) {
    for (const candidateScope of scopes.values()) {
      if (!candidateScope.entriesByKey.has(entryKey)) {
        continue;
      }
      removeEntryFromScope(candidateScope, entryKey);
      evictedEntryKeys.push(entryKey);
      recordEviction();
    }
  }

  if (scope.entriesByKey.size === 0 && !scope.activeEntryKey) {
    scopes.delete(scope.scopeKey);
  }

  if (evictedEntryKeys.length > 0) {
    recordRetire(evictedEntryKeys.length);
  }

  return evictedEntryKeys;
}

export function createSnapshotManager(
  config: Partial<SnapshotManagerConfig> = {},
): SnapshotManager {
  const managerConfig: SnapshotManagerConfig = {
    ...DEFAULT_SNAPSHOT_MANAGER_CONFIG,
    ...config,
  };
  const scopes = new Map<SnapshotScopeKey, ScopeState>();

  const syncMetrics = (): void => {
    const stats = computeStats(scopes);
    syncSnapshotInventoryMetrics({
      activeScopes: stats.activeScopes,
      totalSnapshots: stats.totalSnapshots,
      totalInFlightReaders: stats.inFlightReaders,
      estimatedBytesTotal: stats.estimatedBytes,
    });
  };

  const manager: SnapshotManager = {
    config: managerConfig,

    acquire(scopeKey: SnapshotScopeKey, nowEpochMs: number = Date.now()) {
      const scope = scopes.get(scopeKey);
      if (!scope?.activeEntryKey) {
        return null;
      }

      const entry = scope.entriesByKey.get(scope.activeEntryKey);
      if (!entry || !entry.isActive) {
        return null;
      }

      entry.lastAccessedAtEpochMs = nowEpochMs;
      return createAcquireHandle(entry);
    },

    getActiveSnapshot(scopeKey: SnapshotScopeKey): CompiledRuleSnapshot | null {
      return manager.getActiveEntry(scopeKey)?.snapshot ?? null;
    },

    getActiveEntry(scopeKey: SnapshotScopeKey): SnapshotEntry | null {
      const scope = scopes.get(scopeKey);
      if (!scope?.activeEntryKey) {
        return null;
      }
      return scope.entriesByKey.get(scope.activeEntryKey) ?? null;
    },

    publish(
      scopeKey: SnapshotScopeKey,
      nextSnapshot: CompiledRuleSnapshot,
      nowEpochMs: number = Date.now(),
    ): SnapshotManagerPublishResult {
      validateCompiledRuleSnapshot(nextSnapshot);
      const frozenSnapshot = freezeCompiledRuleSnapshot(nextSnapshot, {
        deep: managerConfig.deepFreezeSnapshots,
      });

      const scope = getOrCreateScope(scopes, scopeKey);
      const previousActiveEntryKey = scope.activeEntryKey;
      const entryKey = buildSnapshotEntryKey(scopeKey, frozenSnapshot.version);

      const entry: SnapshotEntry = {
        entryKey,
        scopeKey,
        version: frozenSnapshot.version,
        snapshot: frozenSnapshot,
        loadedAtEpochMs: nowEpochMs,
        lastAccessedAtEpochMs: nowEpochMs,
        inFlightReaders: 0,
        isActive: true,
        estimatedBytes: estimateSnapshotBytes(frozenSnapshot),
      };

      scope.entriesByKey.set(entryKey, entry);
      scope.activeEntryKey = entryKey;

      if (previousActiveEntryKey) {
        const previous = scope.entriesByKey.get(previousActiveEntryKey);
        if (previous) {
          markEntryInactive(previous, nowEpochMs, managerConfig.inactiveTtlMs);
        }
      }

      recordPublish();
      const evictedEntryKeys = runRetirementForScope(
        scope,
        scopes,
        managerConfig,
        nowEpochMs,
      );
      syncMetrics();

      return {
        scopeKey,
        previousActiveEntryKey,
        nextActiveEntryKey: entryKey,
        nextVersion: frozenSnapshot.version,
        evictedEntryKeys,
      };
    },

    retire(scopeKey: SnapshotScopeKey, nowEpochMs: number = Date.now()): string[] {
      const scope = scopes.get(scopeKey);
      if (!scope) {
        return [];
      }
      const evictedEntryKeys = runRetirementForScope(
        scope,
        scopes,
        managerConfig,
        nowEpochMs,
      );
      syncMetrics();
      return evictedEntryKeys;
    },

    invalidateScope(scopeKey: SnapshotScopeKey, nowEpochMs: number = Date.now()): string[] {
      const scope = scopes.get(scopeKey);
      if (!scope) {
        return [];
      }

      recordInvalidate();

      if (scope.activeEntryKey) {
        const active = scope.entriesByKey.get(scope.activeEntryKey);
        if (active) {
          markEntryInactive(active, nowEpochMs, 0);
          active.expiresAtEpochMs = nowEpochMs;
        }
        scope.activeEntryKey = undefined;
      }

      const evictedEntryKeys = runRetirementForScope(
        scope,
        scopes,
        managerConfig,
        nowEpochMs,
      );
      syncMetrics();
      return evictedEntryKeys;
    },

    getStats(): SnapshotStats {
      const stats = computeStats(scopes);
      syncMetrics();
      return stats;
    },

    getScopeEntries(scopeKey: SnapshotScopeKey): SnapshotEntry[] {
      const scope = scopes.get(scopeKey);
      if (!scope) {
        return [];
      }
      return [...scope.entriesByKey.values()].sort(
        (a, b) => b.loadedAtEpochMs - a.loadedAtEpochMs,
      );
    },
  };

  return manager;
}

let defaultSnapshotManager: SnapshotManager | undefined;

export function getDefaultSnapshotManager(
  config?: Partial<SnapshotManagerConfig>,
): SnapshotManager {
  if (!defaultSnapshotManager) {
    defaultSnapshotManager = createSnapshotManager(config);
  }
  return defaultSnapshotManager;
}

export function resetDefaultSnapshotManager(
  config?: Partial<SnapshotManagerConfig>,
): SnapshotManager {
  defaultSnapshotManager = createSnapshotManager(config);
  return defaultSnapshotManager;
}

/** @deprecated Use buildSnapshotScopeKey */
export const buildSnapshotCacheKey = buildSnapshotScopeKey;
