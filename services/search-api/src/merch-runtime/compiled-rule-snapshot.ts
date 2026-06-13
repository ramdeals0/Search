import type {
  CompiledEffect,
  CompiledRuleSnapshot,
  RuleRef,
  RuntimeEnvironment,
} from "./types.js";

export interface CreateCompiledRuleSnapshotInput {
  snapshotId: string;
  tenantId: string;
  environment: RuntimeEnvironment;
  locale?: string;
  channel?: string;
  version: string;
  generatedAtEpochMs: number;
  queryExactMap?: Map<string, RuleRef[]> | Record<string, RuleRef[]>;
  categoryMap?: Map<string, RuleRef[]> | Record<string, RuleRef[]>;
  brandMap?: Map<string, RuleRef[]> | Record<string, RuleRef[]>;
  globalRules?: RuleRef[];
  ruleEffectsMap?: Map<string, CompiledEffect[]> | Record<string, CompiledEffect[]>;
}

class CompiledRuleSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompiledRuleSnapshotError";
  }
}

function toRuleRefMap(
  input: Map<string, RuleRef[]> | Record<string, RuleRef[]> | undefined,
): Map<string, RuleRef[]> {
  if (!input) {
    return new Map();
  }
  if (input instanceof Map) {
    return new Map(
      [...input.entries()].map(([key, refs]) => [key, sortRuleRefs(refs)]),
    );
  }
  return new Map(
    Object.entries(input).map(([key, refs]) => [key, sortRuleRefs(refs)]),
  );
}

function toEffectsMap(
  input:
    | Map<string, CompiledEffect[]>
    | Record<string, CompiledEffect[]>
    | undefined,
): Map<string, CompiledEffect[]> {
  if (!input) {
    return new Map();
  }
  if (input instanceof Map) {
    return new Map(input);
  }
  return new Map(Object.entries(input));
}

function sortRuleRefs(refs: RuleRef[]): RuleRef[] {
  return [...refs].sort((a, b) => b.priority - a.priority);
}

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new CompiledRuleSnapshotError(`${field} must be a non-empty string`);
  }
}

export function createCompiledRuleSnapshot(
  input: CreateCompiledRuleSnapshotInput,
): CompiledRuleSnapshot {
  assertNonEmpty(input.snapshotId, "snapshotId");
  assertNonEmpty(input.tenantId, "tenantId");
  assertNonEmpty(input.version, "version");

  if (input.environment !== "staging" && input.environment !== "live") {
    throw new CompiledRuleSnapshotError(
      `environment must be "staging" or "live", received "${input.environment}"`,
    );
  }

  if (!Number.isFinite(input.generatedAtEpochMs)) {
    throw new CompiledRuleSnapshotError("generatedAtEpochMs must be a finite number");
  }

  const snapshot: CompiledRuleSnapshot = {
    snapshotId: input.snapshotId.trim(),
    tenantId: input.tenantId.trim(),
    environment: input.environment,
    locale: input.locale?.trim() || undefined,
    channel: input.channel?.trim() || undefined,
    version: input.version.trim(),
    generatedAtEpochMs: input.generatedAtEpochMs,
    queryExactMap: toRuleRefMap(input.queryExactMap),
    categoryMap: toRuleRefMap(input.categoryMap),
    brandMap: toRuleRefMap(input.brandMap),
    globalRules: sortRuleRefs(input.globalRules ?? []),
    ruleEffectsMap: toEffectsMap(input.ruleEffectsMap),
  };

  validateCompiledRuleSnapshot(snapshot);
  return freezeCompiledRuleSnapshot(snapshot);
}

export function estimateSnapshotBytes(snapshot: CompiledRuleSnapshot): number | undefined {
  try {
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
  } catch {
    return undefined;
  }
}

export function freezeCompiledRuleSnapshot(
  snapshot: CompiledRuleSnapshot,
  options?: { deep?: boolean },
): CompiledRuleSnapshot {
  if (options?.deep) {
    Object.freeze(snapshot.globalRules);
    for (const refs of snapshot.queryExactMap.values()) {
      Object.freeze(refs);
    }
    for (const refs of snapshot.categoryMap.values()) {
      Object.freeze(refs);
    }
    for (const refs of snapshot.brandMap.values()) {
      Object.freeze(refs);
    }
    for (const effects of snapshot.ruleEffectsMap.values()) {
      Object.freeze(effects);
    }
  }

  return Object.freeze(snapshot);
}

export function validateCompiledRuleSnapshot(snapshot: CompiledRuleSnapshot): void {
  assertNonEmpty(snapshot.snapshotId, "snapshotId");
  assertNonEmpty(snapshot.tenantId, "tenantId");
  assertNonEmpty(snapshot.version, "version");

  if (snapshot.environment !== "staging" && snapshot.environment !== "live") {
    throw new CompiledRuleSnapshotError(
      `Invalid environment "${snapshot.environment}"`,
    );
  }

  if (!Number.isFinite(snapshot.generatedAtEpochMs)) {
    throw new CompiledRuleSnapshotError("generatedAtEpochMs must be finite");
  }

  validateRuleRefCollection(snapshot.globalRules, "globalRules");
  validateRuleRefMap(snapshot.queryExactMap, "queryExactMap");
  validateRuleRefMap(snapshot.categoryMap, "categoryMap");
  validateRuleRefMap(snapshot.brandMap, "brandMap");
  validateEffectsMap(snapshot.ruleEffectsMap);
}

function validateRuleRefMap(map: Map<string, RuleRef[]>, label: string): void {
  for (const [key, refs] of map.entries()) {
    if (!key.trim()) {
      throw new CompiledRuleSnapshotError(`${label} contains an empty lookup key`);
    }
    validateRuleRefCollection(refs, `${label}[${key}]`);
  }
}

function validateRuleRefCollection(refs: readonly RuleRef[], label: string): void {
  for (const ref of refs) {
    validateRuleRef(ref, label);
  }
}

function validateRuleRef(ref: RuleRef, label: string): void {
  if (!ref.ruleId.trim()) {
    throw new CompiledRuleSnapshotError(`${label} contains a rule with empty ruleId`);
  }
  if (!ref.ruleVersionId.trim()) {
    throw new CompiledRuleSnapshotError(
      `${label} rule "${ref.ruleId}" has empty ruleVersionId`,
    );
  }
  if (!Number.isFinite(ref.priority)) {
    throw new CompiledRuleSnapshotError(
      `${label} rule "${ref.ruleId}" has invalid priority`,
    );
  }
  if (
    ref.stackingMode !== "additive" &&
    ref.stackingMode !== "max" &&
    ref.stackingMode !== "override"
  ) {
    throw new CompiledRuleSnapshotError(
      `${label} rule "${ref.ruleId}" has invalid stackingMode`,
    );
  }
}

function validateEffectsMap(map: Map<string, CompiledEffect[]>): void {
  for (const [ruleId, effects] of map.entries()) {
    if (!ruleId.trim()) {
      throw new CompiledRuleSnapshotError("ruleEffectsMap contains an empty ruleId key");
    }
    for (const effect of effects) {
      if (!effect.productId.trim()) {
        throw new CompiledRuleSnapshotError(
          `rule "${ruleId}" contains an effect with empty productId`,
        );
      }
      if (
        effect.effectType !== "boost" &&
        effect.effectType !== "bury" &&
        effect.effectType !== "pin"
      ) {
        throw new CompiledRuleSnapshotError(
          `rule "${ruleId}" effect for "${effect.productId}" has invalid effectType`,
        );
      }
      if (!Number.isFinite(effect.effectValue)) {
        throw new CompiledRuleSnapshotError(
          `rule "${ruleId}" effect for "${effect.productId}" has invalid effectValue`,
        );
      }
      if (
        effect.effectType === "pin" &&
        effect.pinPosition !== undefined &&
        (!Number.isFinite(effect.pinPosition) || effect.pinPosition < 1)
      ) {
        throw new CompiledRuleSnapshotError(
          `rule "${ruleId}" pin for "${effect.productId}" has invalid pinPosition`,
        );
      }
    }
  }
}
