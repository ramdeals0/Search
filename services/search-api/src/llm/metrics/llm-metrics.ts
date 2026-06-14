export interface LlmMetricsSnapshot {
  calls: number;
  failures: number;
  cacheHits: number;
  totalLatencyMs: number;
  rewriteUsage: number;
  zeroResultRecoveryAttempts: number;
  zeroResultRecoverySuccesses: number;
  rerankUsage: number;
  lastError?: string;
}

const metrics: LlmMetricsSnapshot = {
  calls: 0,
  failures: 0,
  cacheHits: 0,
  totalLatencyMs: 0,
  rewriteUsage: 0,
  zeroResultRecoveryAttempts: 0,
  zeroResultRecoverySuccesses: 0,
  rerankUsage: 0,
};

export function recordLlmCall(latencyMs: number): void {
  metrics.calls += 1;
  metrics.totalLatencyMs += latencyMs;
}

export function recordLlmFailure(error: string): void {
  metrics.failures += 1;
  metrics.lastError = error;
}

export function recordLlmCacheHit(): void {
  metrics.cacheHits += 1;
}

export function recordRewriteUsage(): void {
  metrics.rewriteUsage += 1;
}

export function recordZeroResultRecoveryAttempt(): void {
  metrics.zeroResultRecoveryAttempts += 1;
}

export function recordZeroResultRecoverySuccess(): void {
  metrics.zeroResultRecoverySuccesses += 1;
}

export function recordRerankUsage(): void {
  metrics.rerankUsage += 1;
}

export function getLlmMetricsSnapshot(): LlmMetricsSnapshot {
  return { ...metrics };
}

export function resetLlmMetrics(): void {
  metrics.calls = 0;
  metrics.failures = 0;
  metrics.cacheHits = 0;
  metrics.totalLatencyMs = 0;
  metrics.rewriteUsage = 0;
  metrics.zeroResultRecoveryAttempts = 0;
  metrics.zeroResultRecoverySuccesses = 0;
  metrics.rerankUsage = 0;
  metrics.lastError = undefined;
}
