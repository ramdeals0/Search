import type {
  EnvironmentKey,
  MerchandisingRule,
  RuleConflictItemDto,
  RuleConflictReportDto,
} from "@retailer-search/shared-types";
import { getAllMerchandisingRules } from "./merchandising-rules.js";

function isRuleActiveNow(rule: MerchandisingRule, now = Date.now()): boolean {
  if (!rule.active) {
    return false;
  }
  const start = rule.activeFrom ? new Date(rule.activeFrom).getTime() : undefined;
  const end = rule.activeTo ? new Date(rule.activeTo).getTime() : undefined;
  if (start !== undefined && now < start) {
    return false;
  }
  if (end !== undefined && now > end) {
    return false;
  }
  return true;
}

function matchesQuery(rule: MerchandisingRule, query: string): boolean {
  const conditionQuery = rule.condition.query?.trim().toLowerCase();
  if (!conditionQuery) {
    return true;
  }
  return query.includes(conditionQuery);
}

function overlapReason(a: MerchandisingRule, b: MerchandisingRule): string | null {
  if (a.action === b.action && a.action !== "hide") {
    return null;
  }
  if (
    (a.action === "hide" && (b.action === "pin" || b.action === "boost")) ||
    (b.action === "hide" && (a.action === "pin" || a.action === "boost"))
  ) {
    return "Hide conflicts with visibility-promoting rule";
  }
  if (
    (a.action === "pin" && b.action === "bury") ||
    (a.action === "bury" && b.action === "pin")
  ) {
    return "Pin conflicts with bury for overlapping products";
  }
  if (
    (a.action === "boost" && b.action === "bury") ||
    (a.action === "bury" && b.action === "boost")
  ) {
    return "Boost conflicts with bury for ranking";
  }
  return null;
}

export function inspectRuleConflicts(
  query: string,
  environment: EnvironmentKey,
): RuleConflictReportDto {
  const normalizedQuery = query.trim().toLowerCase();
  const now = Date.now();
  const candidates = getAllMerchandisingRules(environment).filter((rule) =>
    isRuleActiveNow(rule, now),
  );
  const matching = candidates.filter((rule) => matchesQuery(rule, normalizedQuery));
  const conflicts: RuleConflictItemDto[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < matching.length; i += 1) {
    for (let j = i + 1; j < matching.length; j += 1) {
      const a = matching[i];
      const b = matching[j];
      const reason = overlapReason(a, b);
      if (!reason) {
        continue;
      }

      for (const rule of [a, b]) {
        const key = `${rule.id}:${reason}`;
        if (seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);
        conflicts.push({
          query: normalizedQuery,
          ruleId: rule.id,
          ruleName: rule.name,
          action: rule.action,
          priority: rule.priority,
          overlapReason: reason,
        });
      }
    }
  }

  conflicts.sort((a, b) => b.priority - a.priority);

  return {
    query: normalizedQuery,
    environment,
    conflicts,
  };
}
