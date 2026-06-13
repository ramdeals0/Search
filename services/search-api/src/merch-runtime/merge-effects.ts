import type {
  AggregatedEffect,
  CompiledEffect,
  RuleRef,
} from "./types.js";

function effectTargetKey(productId: string, variantId?: string): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

interface MutableAggregate extends AggregatedEffect {
  pinRulePriority: number;
}

function isRuleActive(rule: RuleRef, nowEpochMs: number): boolean {
  if (
    rule.activeFromEpochMs !== undefined &&
    nowEpochMs < rule.activeFromEpochMs
  ) {
    return false;
  }
  if (rule.activeToEpochMs !== undefined && nowEpochMs > rule.activeToEpochMs) {
    return false;
  }
  return true;
}

function signedEffectValue(effect: CompiledEffect): number {
  if (effect.effectType === "bury") {
    return -Math.abs(effect.effectValue);
  }
  if (effect.effectType === "boost") {
    return Math.abs(effect.effectValue);
  }
  return 0;
}

function appendUnique(target: string[], value: string | undefined): void {
  if (!value) {
    return;
  }
  if (!target.includes(value)) {
    target.push(value);
  }
}

function getOrCreateAggregate(
  aggregates: Map<string, MutableAggregate>,
  key: string,
): MutableAggregate {
  let aggregate = aggregates.get(key);
  if (!aggregate) {
    aggregate = {
      scoreDelta: 0,
      matchedRuleIds: [],
      matchedReasonCodes: [],
      pinRulePriority: Number.NEGATIVE_INFINITY,
    };
    aggregates.set(key, aggregate);
  }
  return aggregate;
}

function applyScoreEffect(
  aggregate: MutableAggregate,
  rule: RuleRef,
  signedValue: number,
): void {
  if (rule.stackingMode === "override") {
    aggregate.scoreDelta = signedValue;
    return;
  }

  if (rule.stackingMode === "max") {
    if (Math.abs(signedValue) > Math.abs(aggregate.scoreDelta)) {
      aggregate.scoreDelta = signedValue;
    }
    return;
  }

  aggregate.scoreDelta += signedValue;
}

function applyPinEffect(
  aggregate: MutableAggregate,
  rule: RuleRef,
  effect: CompiledEffect,
): void {
  const pinPosition = effect.pinPosition;
  if (pinPosition === undefined || pinPosition < 1) {
    return;
  }

  if (rule.priority > aggregate.pinRulePriority) {
    aggregate.pinPosition = pinPosition;
    aggregate.pinRulePriority = rule.priority;
    return;
  }

  if (
    rule.priority === aggregate.pinRulePriority &&
    aggregate.pinPosition !== undefined &&
    pinPosition < aggregate.pinPosition
  ) {
    aggregate.pinPosition = pinPosition;
  }
}

export function aggregateMatchedRuleEffects(
  ruleRefs: readonly RuleRef[],
  ruleEffectsMap: ReadonlyMap<string, CompiledEffect[]>,
  nowEpochMs: number,
): Map<string, AggregatedEffect> {
  const aggregates = new Map<string, MutableAggregate>();

  for (const rule of ruleRefs) {
    if (!isRuleActive(rule, nowEpochMs)) {
      continue;
    }

    const effects = ruleEffectsMap.get(rule.ruleId);
    if (!effects || effects.length === 0) {
      continue;
    }

    for (const effect of effects) {
      const key = effectTargetKey(effect.productId, effect.variantId);
      const aggregate = getOrCreateAggregate(aggregates, key);

      appendUnique(aggregate.matchedRuleIds, rule.ruleId);
      appendUnique(aggregate.matchedReasonCodes, effect.reasonCode);

      if (effect.effectType === "pin") {
        applyPinEffect(aggregate, rule, effect);
        continue;
      }

      applyScoreEffect(aggregate, rule, signedEffectValue(effect));
    }
  }

  const result = new Map<string, AggregatedEffect>();
  for (const [key, aggregate] of aggregates.entries()) {
    result.set(key, {
      scoreDelta: aggregate.scoreDelta,
      pinPosition: aggregate.pinPosition,
      matchedRuleIds: aggregate.matchedRuleIds,
      matchedReasonCodes: aggregate.matchedReasonCodes,
    });
  }

  return result;
}
