import type {
  CompiledEffect,
  RuleRef,
  SearchCandidate,
} from "./types.js";
import { createCompiledRuleSnapshot, estimateSnapshotBytes } from "./compiled-rule-snapshot.js";
import { getCacheMetricsSnapshot } from "./cache-metrics.js";
import { buildEvalContext } from "./normalization.js";
import { evaluateMerchandisingRules } from "./evaluate-rules.js";
import {
  createRuntimeSnapshotCache,
  getDefaultRuntimeSnapshotCache,
} from "./runtime-cache.js";
import {
  buildSnapshotScopeKey,
  createSnapshotManager,
} from "./snapshot-manager.js";
import { getSnapshotMetrics, resetSnapshotMetricsForTests } from "./snapshot-metrics.js";

const BENCHMARK_RULE_COUNT = 250;
const BENCHMARK_EFFECT_COUNT = 3000;
const BENCHMARK_ITERATIONS = 200;
const CANDIDATE_SIZES = [20, 50, 100, 250] as const;

function buildBenchmarkSnapshot(version = "bench-1"): ReturnType<typeof createCompiledRuleSnapshot> {
  const queryExactMap = new Map<string, RuleRef[]>();
  const categoryMap = new Map<string, RuleRef[]>();
  const brandMap = new Map<string, RuleRef[]>();
  const globalRules: RuleRef[] = [];
  const ruleEffectsMap = new Map<string, CompiledEffect[]>();

  for (let index = 0; index < BENCHMARK_RULE_COUNT; index += 1) {
    const ruleId = `bench-rule-${index}`;
    const scopeType =
      index % 4 === 0
        ? "query_exact"
        : index % 4 === 1
          ? "category"
          : index % 4 === 2
            ? "brand"
            : "global";

    const ruleRef: RuleRef = {
      ruleId,
      ruleVersionId: `${ruleId}-v1`,
      priority: 1000 - index,
      scopeType,
      stackingMode: index % 3 === 0 ? "additive" : index % 3 === 1 ? "max" : "override",
    };

    switch (scopeType) {
      case "query_exact": {
        const key = `query-${index % 25}`;
        const refs = queryExactMap.get(key) ?? [];
        refs.push(ruleRef);
        queryExactMap.set(key, refs);
        break;
      }
      case "category": {
        const key = `category-${index % 20}`;
        const refs = categoryMap.get(key) ?? [];
        refs.push(ruleRef);
        categoryMap.set(key, refs);
        break;
      }
      case "brand": {
        const key = `brand-${index % 15}`;
        const refs = brandMap.get(key) ?? [];
        refs.push(ruleRef);
        brandMap.set(key, refs);
        break;
      }
      default:
        globalRules.push(ruleRef);
        break;
    }

    const effects: CompiledEffect[] = [];
    const effectCount = Math.ceil(BENCHMARK_EFFECT_COUNT / BENCHMARK_RULE_COUNT);
    for (let effectIndex = 0; effectIndex < effectCount; effectIndex += 1) {
      const productNumber = (index * effectCount + effectIndex) % BENCHMARK_EFFECT_COUNT;
      const effectType =
        effectIndex % 11 === 0 ? "pin" : effectIndex % 5 === 0 ? "bury" : "boost";
      effects.push({
        productId: `prod-${String(productNumber).padStart(5, "0")}`,
        effectType,
        effectValue: effectType === "pin" ? 0 : 5 + (effectIndex % 20),
        pinPosition: effectType === "pin" ? (effectIndex % 5) + 1 : undefined,
        reasonCode: `${ruleId}:${effectType}`,
      });
    }
    ruleEffectsMap.set(ruleId, effects);
  }

  return createCompiledRuleSnapshot({
    snapshotId: "bench-snapshot",
    tenantId: "default",
    environment: "staging",
    version,
    generatedAtEpochMs: Date.now(),
    queryExactMap,
    categoryMap,
    brandMap,
    globalRules,
    ruleEffectsMap,
  });
}

function buildBenchmarkCandidates(size: number): SearchCandidate[] {
  const candidates: SearchCandidate[] = [];
  for (let index = 0; index < size; index += 1) {
    candidates.push({
      productId: `prod-${String(index % BENCHMARK_EFFECT_COUNT).padStart(5, "0")}`,
      baseScore: 100 - (index % 50),
      inStock: index % 3 !== 0,
      popularity: index % 100,
    });
  }
  return candidates;
}

function measureMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

export interface MerchRuntimeBenchmarkReport {
  snapshotLookupMs: number;
  evaluations: Array<{
    candidateCount: number;
    matchAndAggregateMs: number;
    totalEvaluationMs: number;
    averagePerIterationMs: number;
  }>;
}

export function runMerchRuntimeBenchmark(): MerchRuntimeBenchmarkReport {
  const cache = getDefaultRuntimeSnapshotCache();
  const snapshot = buildBenchmarkSnapshot();
  const scopeKey = cache.buildSnapshotScopeKey({
    tenantId: snapshot.tenantId,
    environment: snapshot.environment,
  });

  const snapshotLookupMs = measureMs(() => {
    cache.publishSnapshot(scopeKey, snapshot, snapshot.version);
    cache.getActiveSnapshotHandle(scopeKey)?.release();
  });

  const context = buildEvalContext({
    tenantId: "default",
    environment: "staging",
    query: "query-3",
    categoryKey: "category-2",
    brandKeys: ["brand-1", "brand-4"],
    nowEpochMs: Date.now(),
  });

  const evaluations = CANDIDATE_SIZES.map((candidateCount) => {
    const candidates = buildBenchmarkCandidates(candidateCount);
    let matchAndAggregateMs = 0;
    let totalEvaluationMs = 0;

    for (let iteration = 0; iteration < BENCHMARK_ITERATIONS; iteration += 1) {
      totalEvaluationMs += measureMs(() => {
        evaluateMerchandisingRules(context, candidates, snapshot);
      });

      matchAndAggregateMs += measureMs(() => {
        evaluateMerchandisingRules(context, candidates, snapshot);
      });
    }

    return {
      candidateCount,
      matchAndAggregateMs: matchAndAggregateMs / BENCHMARK_ITERATIONS,
      totalEvaluationMs: totalEvaluationMs / BENCHMARK_ITERATIONS,
      averagePerIterationMs: totalEvaluationMs / BENCHMARK_ITERATIONS,
    };
  });

  return {
    snapshotLookupMs,
    evaluations,
  };
}

export function formatMerchRuntimeBenchmarkReport(
  report: MerchRuntimeBenchmarkReport,
): string {
  const lines = [
    "Merchandising runtime benchmark",
    `Snapshot lookup: ${report.snapshotLookupMs.toFixed(3)} ms`,
    "",
  ];

  for (const row of report.evaluations) {
    lines.push(
      `Candidates=${row.candidateCount}: total=${row.totalEvaluationMs.toFixed(3)} ms, match+aggregate=${row.matchAndAggregateMs.toFixed(3)} ms`,
    );
  }

  return lines.join("\n");
}

export interface SnapshotCacheBenchmarkReport {
  scopeCount: number;
  publishCount: number;
  acquireCycles: number;
  averagePublishMs: number;
  averageAcquireMs: number;
  retainedSnapshots: number;
  totalEstimatedBytes: number;
  metrics: ReturnType<typeof getCacheMetricsSnapshot>;
}

export function runSnapshotCacheBenchmark(): SnapshotCacheBenchmarkReport {
  const cache = createRuntimeSnapshotCache({
    inactiveTtlMs: 1,
    maxSnapshotsPerScope: 3,
    maxTotalSnapshots: 12,
    maxEstimatedBytes: 5_000_000,
  });

  const scopeKeys = [
    cache.buildSnapshotScopeKey({ tenantId: "tenant-a", environment: "staging" }),
    cache.buildSnapshotScopeKey({ tenantId: "tenant-a", environment: "live" }),
    cache.buildSnapshotScopeKey({ tenantId: "tenant-b", environment: "staging", locale: "en-us" }),
    cache.buildSnapshotScopeKey({ tenantId: "tenant-b", environment: "staging", channel: "web" }),
  ];

  let publishMs = 0;
  let publishCount = 0;
  let acquireMs = 0;
  let acquireCycles = 0;

  for (const scopeKey of scopeKeys) {
    for (let versionIndex = 0; versionIndex < 8; versionIndex += 1) {
      const snapshot = buildBenchmarkSnapshot(`${scopeKey}-v${versionIndex}`);
      publishMs += measureMs(() => {
        cache.publishSnapshot(scopeKey, snapshot, snapshot.version);
      });
      publishCount += 1;

      if (versionIndex % 2 === 0) {
        cache.evictInactiveSnapshots(scopeKey, Date.now() + 5);
      }
    }
  }

  for (let cycle = 0; cycle < 5_000; cycle += 1) {
    const scopeKey = scopeKeys[cycle % scopeKeys.length]!;
    acquireMs += measureMs(() => {
      const handle = cache.getActiveSnapshotHandle(scopeKey);
      if (handle) {
        void handle.entry.snapshot.version;
        handle.release();
        handle.release();
      }
    });
    acquireCycles += 1;
  }

  cache.evictGlobally(Date.now() + 5);
  const stats = cache.getCacheStats();
  const metrics = getCacheMetricsSnapshot();

  return {
    scopeCount: scopeKeys.length,
    publishCount,
    acquireCycles,
    averagePublishMs: publishMs / publishCount,
    averageAcquireMs: acquireMs / acquireCycles,
    retainedSnapshots: stats.totalCachedSnapshots,
    totalEstimatedBytes: stats.totalEstimatedBytes,
    metrics,
  };
}

export function formatSnapshotCacheBenchmarkReport(
  report: SnapshotCacheBenchmarkReport,
): string {
  return [
    "Snapshot cache benchmark",
    `Scopes: ${report.scopeCount}`,
    `Publishes: ${report.publishCount} (avg ${report.averagePublishMs.toFixed(3)} ms)`,
    `Acquire cycles: ${report.acquireCycles} (avg ${report.averageAcquireMs.toFixed(4)} ms)`,
    `Retained snapshots: ${report.retainedSnapshots}`,
    `Estimated bytes: ${report.totalEstimatedBytes}`,
    `Evictions: ${report.metrics.evictions} (expired=${report.metrics.expiredEvictions}, lru=${report.metrics.lruEvictions})`,
    `Hits/Misses: ${report.metrics.cacheHits}/${report.metrics.cacheMisses}`,
  ].join("\n");
}

export interface SnapshotManagerBenchmarkReport {
  publishCount: number;
  acquireCount: number;
  overlappingReadsDuringPublish: number;
  averagePublishMs: number;
  averageAcquireMs: number;
  retirementCount: number;
  peakRetainedSnapshots: number;
  retainedSnapshotsPerScope: Record<string, number>;
  totalEstimatedBytes?: number;
  metrics: ReturnType<typeof getSnapshotMetrics>;
}

export function runSnapshotManagerBenchmark(): SnapshotManagerBenchmarkReport {
  resetSnapshotMetricsForTests();

  const manager = createSnapshotManager({
    inactiveTtlMs: 5,
    maxSnapshotsPerScope: 3,
    maxTotalSnapshots: 10,
    maxEstimatedBytes: 2_000_000,
  });

  const scopeKeys = [
    buildSnapshotScopeKey({ tenantId: "tenant-a", environment: "staging" }),
    buildSnapshotScopeKey({ tenantId: "tenant-b", environment: "live", locale: "en-us" }),
  ];

  let publishMs = 0;
  let publishCount = 0;
  let acquireMs = 0;
  let acquireCount = 0;
  let overlappingReadsDuringPublish = 0;
  let peakRetainedSnapshots = 0;
  let retirementCount = 0;
  const retainedSnapshotsPerScope: Record<string, number> = {};

  for (const scopeKey of scopeKeys) {
    for (let versionIndex = 0; versionIndex < 6; versionIndex += 1) {
      const version = `${scopeKey}-v${versionIndex}`;
      const snapshot = buildBenchmarkSnapshot(version);

      const inFlight = manager.acquire(scopeKey);
      if (inFlight) {
        overlappingReadsDuringPublish += 1;
      }

      publishMs += measureMs(() => {
        manager.publish(scopeKey, snapshot);
      });
      publishCount += 1;

      if (inFlight) {
        void inFlight.snapshot.version;
        inFlight.release();
      }

      const stats = manager.getStats();
      peakRetainedSnapshots = Math.max(peakRetainedSnapshots, stats.totalSnapshots);
      retainedSnapshotsPerScope[scopeKey] = manager.getScopeEntries(scopeKey).length;
    }
  }

  for (let cycle = 0; cycle < 4_000; cycle += 1) {
    const scopeKey = scopeKeys[cycle % scopeKeys.length]!;
    acquireMs += measureMs(() => {
      const handle = manager.acquire(scopeKey);
      if (handle) {
        void handle.snapshot.version;
        handle.release();
        handle.release();
        acquireCount += 1;
      }
    });
  }

  for (const scopeKey of scopeKeys) {
    retirementCount += manager.retire(scopeKey, Date.now() + 10).length;
  }

  const finalStats = manager.getStats();

  return {
    publishCount,
    acquireCount,
    overlappingReadsDuringPublish,
    averagePublishMs: publishMs / publishCount,
    averageAcquireMs: acquireCount > 0 ? acquireMs / acquireCount : 0,
    retirementCount,
    peakRetainedSnapshots,
    retainedSnapshotsPerScope,
    totalEstimatedBytes: finalStats.estimatedBytes,
    metrics: getSnapshotMetrics(),
  };
}

export function formatSnapshotManagerBenchmarkReport(
  report: SnapshotManagerBenchmarkReport,
): string {
  return [
    "Snapshot manager benchmark",
    `Publishes: ${report.publishCount} (avg ${report.averagePublishMs.toFixed(3)} ms)`,
    `Acquires: ${report.acquireCount} (avg ${report.averageAcquireMs.toFixed(4)} ms)`,
    `Overlapping reads during publish: ${report.overlappingReadsDuringPublish}`,
    `Retirements: ${report.retirementCount}`,
    `Peak retained snapshots: ${report.peakRetainedSnapshots}`,
    `Estimated bytes: ${report.totalEstimatedBytes ?? "n/a"}`,
    `Metrics publishes/acquires/evictions: ${report.metrics.publishCount}/${report.metrics.acquireCount}/${report.metrics.evictionCount}`,
  ].join("\n");
}

export { estimateSnapshotBytes };
