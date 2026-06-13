export type CacheEvictionType = "expired" | "lru" | "scope_limit" | "global_limit" | "bytes_limit";

export interface CacheMetricsSnapshot {
  cacheHits: number;
  cacheMisses: number;
  publishes: number;
  invalidations: number;
  evictions: number;
  expiredEvictions: number;
  lruEvictions: number;
  acquisitionCount: number;
  releaseCount: number;
  activeScopes: number;
  totalCachedSnapshots: number;
  totalEstimatedBytes: number;
}

const metrics: CacheMetricsSnapshot = {
  cacheHits: 0,
  cacheMisses: 0,
  publishes: 0,
  invalidations: 0,
  evictions: 0,
  expiredEvictions: 0,
  lruEvictions: 0,
  acquisitionCount: 0,
  releaseCount: 0,
  activeScopes: 0,
  totalCachedSnapshots: 0,
  totalEstimatedBytes: 0,
};

export function recordCacheHit(): void {
  metrics.cacheHits += 1;
}

export function recordCacheMiss(): void {
  metrics.cacheMisses += 1;
}

export function recordPublish(): void {
  metrics.publishes += 1;
}

export function recordInvalidation(): void {
  metrics.invalidations += 1;
}

export function recordEviction(type: CacheEvictionType): void {
  metrics.evictions += 1;
  if (type === "expired") {
    metrics.expiredEvictions += 1;
  } else if (type === "lru" || type === "scope_limit" || type === "global_limit" || type === "bytes_limit") {
    metrics.lruEvictions += 1;
  }
}

export function recordAcquisition(): void {
  metrics.acquisitionCount += 1;
}

export function recordRelease(): void {
  metrics.releaseCount += 1;
}

export function syncCacheInventoryMetrics(input: {
  activeScopes: number;
  totalCachedSnapshots: number;
  totalEstimatedBytes: number;
}): void {
  metrics.activeScopes = input.activeScopes;
  metrics.totalCachedSnapshots = input.totalCachedSnapshots;
  metrics.totalEstimatedBytes = input.totalEstimatedBytes;
}

export function getCacheMetricsSnapshot(): CacheMetricsSnapshot {
  return { ...metrics };
}

export function resetCacheMetricsForTests(): void {
  metrics.cacheHits = 0;
  metrics.cacheMisses = 0;
  metrics.publishes = 0;
  metrics.invalidations = 0;
  metrics.evictions = 0;
  metrics.expiredEvictions = 0;
  metrics.lruEvictions = 0;
  metrics.acquisitionCount = 0;
  metrics.releaseCount = 0;
  metrics.activeScopes = 0;
  metrics.totalCachedSnapshots = 0;
  metrics.totalEstimatedBytes = 0;
}
