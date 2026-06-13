import type { SnapshotEntry, SnapshotManagerConfig } from "./types.js";

export function markEntryInactive(
  entry: SnapshotEntry,
  nowEpochMs: number,
  inactiveTtlMs: number,
): void {
  if (!entry.isActive) {
    return;
  }
  entry.isActive = false;
  entry.inactiveSinceEpochMs = nowEpochMs;
  entry.expiresAtEpochMs = nowEpochMs + inactiveTtlMs;
}

export function isEntryRetirable(
  entry: SnapshotEntry,
  activeEntryKey: string | undefined,
  nowEpochMs: number,
): boolean {
  if (entry.entryKey === activeEntryKey) {
    return false;
  }
  if (entry.isActive) {
    return false;
  }
  if (entry.inFlightReaders > 0) {
    return false;
  }
  if (entry.expiresAtEpochMs !== undefined && nowEpochMs < entry.expiresAtEpochMs) {
    return false;
  }
  return true;
}

export function collectRetirableEntriesForScope(
  scopeEntries: readonly SnapshotEntry[],
  activeEntryKey: string | undefined,
  nowEpochMs: number,
): SnapshotEntry[] {
  return scopeEntries.filter((entry) =>
    isEntryRetirable(entry, activeEntryKey, nowEpochMs),
  );
}

function sortInactiveLru(entries: readonly SnapshotEntry[]): SnapshotEntry[] {
  return [...entries]
    .filter((entry) => !entry.isActive)
    .sort((a, b) => a.lastAccessedAtEpochMs - b.lastAccessedAtEpochMs);
}

export function pruneScopeEntries(
  scopeEntries: SnapshotEntry[],
  activeEntryKey: string | undefined,
  config: Pick<SnapshotManagerConfig, "maxSnapshotsPerScope">,
): string[] {
  const evictedEntryKeys: string[] = [];
  const protectedKeys = new Set<string>();
  if (activeEntryKey) {
    protectedKeys.add(activeEntryKey);
  }

  const inactiveSortedByRecency = [...scopeEntries]
    .filter((entry) => !entry.isActive && entry.inFlightReaders === 0)
    .sort((a, b) => b.loadedAtEpochMs - a.loadedAtEpochMs);

  const allowedInactive = Math.max(0, config.maxSnapshotsPerScope - protectedKeys.size);
  const keepKeys = new Set(
    inactiveSortedByRecency.slice(0, allowedInactive).map((entry) => entry.entryKey),
  );

  for (const entry of scopeEntries) {
    if (protectedKeys.has(entry.entryKey) || keepKeys.has(entry.entryKey)) {
      continue;
    }
    if (entry.isActive || entry.inFlightReaders > 0) {
      continue;
    }
    evictedEntryKeys.push(entry.entryKey);
  }

  return evictedEntryKeys;
}

export function pruneGlobalEntries(
  allEntries: SnapshotEntry[],
  config: Pick<SnapshotManagerConfig, "maxTotalSnapshots" | "maxEstimatedBytes">,
): string[] {
  const evictedEntryKeys: string[] = [];
  const activeEntries = allEntries.filter((entry) => entry.isActive);
  const inactiveCandidates = sortInactiveLru(allEntries).filter(
    (entry) => entry.inFlightReaders === 0,
  );

  const removeEntry = (entryKey: string): void => {
    if (!evictedEntryKeys.includes(entryKey)) {
      evictedEntryKeys.push(entryKey);
    }
  };

  let retained = allEntries.filter((entry) => !evictedEntryKeys.includes(entry.entryKey));

  while (
    retained.length > config.maxTotalSnapshots &&
    inactiveCandidates.length > 0
  ) {
    const next = inactiveCandidates.shift();
    if (!next || next.isActive || next.inFlightReaders > 0) {
      continue;
    }
    removeEntry(next.entryKey);
    retained = allEntries.filter((entry) => !evictedEntryKeys.includes(entry.entryKey));
  }

  if (config.maxEstimatedBytes !== undefined && config.maxEstimatedBytes > 0) {
    let estimatedBytes = retained.reduce(
      (sum, entry) => sum + (entry.estimatedBytes ?? 0),
      0,
    );

    const byteCandidates = sortInactiveLru(retained).filter(
      (entry) => entry.inFlightReaders === 0 && !entry.isActive,
    );

    while (estimatedBytes > config.maxEstimatedBytes && byteCandidates.length > 0) {
      const next = byteCandidates.shift();
      if (!next) {
        break;
      }
      removeEntry(next.entryKey);
      retained = allEntries.filter((entry) => !evictedEntryKeys.includes(entry.entryKey));
      estimatedBytes = retained.reduce(
        (sum, entry) => sum + (entry.estimatedBytes ?? 0),
        0,
      );
    }
  }

  void activeEntries;
  return evictedEntryKeys;
}

export function collectExpiredInactiveEntryKeys(
  scopeEntries: readonly SnapshotEntry[],
  activeEntryKey: string | undefined,
  nowEpochMs: number,
): string[] {
  return collectRetirableEntriesForScope(scopeEntries, activeEntryKey, nowEpochMs).map(
    (entry) => entry.entryKey,
  );
}
