import type { CompiledRuleSnapshot, RuntimeEnvironment } from "./types.js";
import { validateCompiledRuleSnapshot } from "./compiled-rule-snapshot.js";
import {
  buildSnapshotScopeKey,
  getDefaultRuntimeSnapshotCache,
  type RuntimeSnapshotCache,
} from "./runtime-cache.js";

export interface LoadCompiledSnapshotForScopeParams {
  tenantId: string;
  environment: RuntimeEnvironment;
  locale?: string;
  channel?: string;
  snapshotId?: string;
  source?: CompiledRuleSnapshot | (() => CompiledRuleSnapshot | undefined);
  cache?: RuntimeSnapshotCache;
}

export interface PreloadCompiledSnapshotForScopeParams
  extends LoadCompiledSnapshotForScopeParams {
  version?: string;
  force?: boolean;
}

export interface LoadCompiledRuleSnapshotParams extends LoadCompiledSnapshotForScopeParams {}

export interface MaybeReloadCompiledRuleSnapshotParams
  extends PreloadCompiledSnapshotForScopeParams {}

const loaderRegistry = new Map<string, () => CompiledRuleSnapshot | undefined>();

function adoptSnapshot(snapshot: CompiledRuleSnapshot): CompiledRuleSnapshot {
  validateCompiledRuleSnapshot(snapshot);
  return snapshot;
}

function resolveSnapshotFromSource(
  params: LoadCompiledSnapshotForScopeParams,
): CompiledRuleSnapshot | undefined {
  if (typeof params.source === "function") {
    return params.source();
  }
  if (params.source) {
    return params.source;
  }

  const scopeKey = buildSnapshotScopeKey(params);
  return loaderRegistry.get(scopeKey)?.();
}

export function registerSnapshotLoader(
  scopeKey: string,
  loader: () => CompiledRuleSnapshot | undefined,
): void {
  loaderRegistry.set(scopeKey, loader);
}

export function loadCompiledSnapshotForScope(
  params: LoadCompiledSnapshotForScopeParams,
): CompiledRuleSnapshot | undefined {
  const snapshot = resolveSnapshotFromSource(params);
  if (!snapshot) {
    return undefined;
  }
  return adoptSnapshot(snapshot);
}

export function preloadCompiledSnapshotForScope(
  params: PreloadCompiledSnapshotForScopeParams,
): CompiledRuleSnapshot | undefined {
  const cache = params.cache ?? getDefaultRuntimeSnapshotCache();
  const scopeKey = cache.buildSnapshotScopeKey(params);

  if (!params.force) {
    const active = cache.getActiveSnapshotHandle(scopeKey);
    if (active) {
      const snapshot = active.entry.snapshot;
      active.release();
      return snapshot;
    }
  }

  const snapshot = loadCompiledSnapshotForScope(params);
  if (!snapshot) {
    return cache.getActiveSnapshotHandle(scopeKey)?.entry.snapshot;
  }

  const version = params.version ?? snapshot.version;
  cache.publishSnapshot(scopeKey, snapshot, version);
  return snapshot;
}

/** Loads from persistence only; does not read or mutate the runtime cache. */
export function loadCompiledRuleSnapshot(
  params: LoadCompiledRuleSnapshotParams,
): CompiledRuleSnapshot | undefined {
  return preloadCompiledSnapshotForScope(params);
}

export function maybeReloadCompiledRuleSnapshot(
  params: MaybeReloadCompiledRuleSnapshotParams,
): CompiledRuleSnapshot | undefined {
  return preloadCompiledSnapshotForScope(params);
}
