import type {
  CompiledRuleSnapshot,
  EvalContext,
  EvaluatedCandidate,
  RuleRef,
  SearchCandidate,
} from "./types.js";
import { aggregateMatchedRuleEffects } from "./merge-effects.js";
import { mergePinnedResults } from "./merge-pins.js";

function effectTargetKey(productId: string, variantId?: string): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

function collectMatchedRuleRefs(
  context: EvalContext,
  snapshot: CompiledRuleSnapshot,
): RuleRef[] {
  const byRuleId = new Map<string, RuleRef>();

  const addRefs = (refs: RuleRef[] | undefined): void => {
    if (!refs) {
      return;
    }
    for (const ref of refs) {
      const existing = byRuleId.get(ref.ruleId);
      if (!existing || ref.priority > existing.priority) {
        byRuleId.set(ref.ruleId, ref);
      }
    }
  };

  addRefs(snapshot.queryExactMap.get(context.queryCanonical));
  if (context.categoryKey) {
    addRefs(snapshot.categoryMap.get(context.categoryKey));
  }
  if (context.brandKeys) {
    for (const brandKey of context.brandKeys) {
      addRefs(snapshot.brandMap.get(brandKey));
    }
  }
  addRefs(snapshot.globalRules);

  return [...byRuleId.values()].sort((a, b) => a.priority - b.priority);
}

export function evaluateMerchandisingRules(
  context: EvalContext,
  candidates: readonly SearchCandidate[],
  snapshot: CompiledRuleSnapshot,
): EvaluatedCandidate[] {
  if (candidates.length === 0) {
    return [];
  }

  const matchedRuleRefs = collectMatchedRuleRefs(context, snapshot);
  const aggregatedEffects = aggregateMatchedRuleEffects(
    matchedRuleRefs,
    snapshot.ruleEffectsMap,
    context.nowEpochMs,
  );

  const pinned: EvaluatedCandidate[] = [];
  const normal: EvaluatedCandidate[] = [];

  for (const candidate of candidates) {
    const key = effectTargetKey(candidate.productId, candidate.variantId);
    const aggregate = aggregatedEffects.get(key);
    const scoreDelta = aggregate?.scoreDelta ?? 0;
    const evaluated: EvaluatedCandidate = {
      ...candidate,
      finalScore: candidate.baseScore + scoreDelta,
      appliedPinPosition: aggregate?.pinPosition,
      matchedRuleIds: aggregate?.matchedRuleIds ?? [],
      matchedReasonCodes: aggregate?.matchedReasonCodes ?? [],
    };

    if (evaluated.appliedPinPosition !== undefined) {
      pinned.push(evaluated);
    } else {
      normal.push(evaluated);
    }
  }

  normal.sort((a, b) => b.finalScore - a.finalScore);
  return mergePinnedResults(pinned, normal);
}
