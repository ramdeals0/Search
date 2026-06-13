export interface SnapshotMetricsSnapshot {
  acquireCount: number;
  releaseCount: number;
  publishCount: number;
  retireCount: number;
  invalidateCount: number;
  evictionCount: number;
  activeScopes: number;
  totalSnapshots: number;
  totalInFlightReaders: number;
  estimatedBytesTotal?: number;
}

const metrics: SnapshotMetricsSnapshot = {
  acquireCount: 0,
  releaseCount: 0,
  publishCount: 0,
  retireCount: 0,
  invalidateCount: 0,
  evictionCount: 0,
  activeScopes: 0,
  totalSnapshots: 0,
  totalInFlightReaders: 0,
  estimatedBytesTotal: undefined,
};

export function recordAcquire(): void {
  metrics.acquireCount += 1;
}

export function recordRelease(): void {
  metrics.releaseCount += 1;
}

export function recordPublish(): void {
  metrics.publishCount += 1;
}

export function recordRetire(count = 1): void {
  metrics.retireCount += count;
}

export function recordInvalidate(count = 1): void {
  metrics.invalidateCount += count;
}

export function recordEviction(count = 1): void {
  metrics.evictionCount += count;
}

export function syncSnapshotInventoryMetrics(input: {
  activeScopes: number;
  totalSnapshots: number;
  totalInFlightReaders: number;
  estimatedBytesTotal?: number;
}): void {
  metrics.activeScopes = input.activeScopes;
  metrics.totalSnapshots = input.totalSnapshots;
  metrics.totalInFlightReaders = input.totalInFlightReaders;
  metrics.estimatedBytesTotal = input.estimatedBytesTotal;
}

export function getSnapshotMetrics(): SnapshotMetricsSnapshot {
  return { ...metrics };
}

export function resetSnapshotMetricsForTests(): void {
  metrics.acquireCount = 0;
  metrics.releaseCount = 0;
  metrics.publishCount = 0;
  metrics.retireCount = 0;
  metrics.invalidateCount = 0;
  metrics.evictionCount = 0;
  metrics.activeScopes = 0;
  metrics.totalSnapshots = 0;
  metrics.totalInFlightReaders = 0;
  metrics.estimatedBytesTotal = undefined;
}
