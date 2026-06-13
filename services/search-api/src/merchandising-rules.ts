import type {
  CreateMerchandisingRuleDto,
  EnvironmentKey,
  MerchandisingRule,
  MerchandisingRuleCondition,
  UpdateMerchandisingRuleDto,
} from "@retailer-search/shared-types";
import {
  getMutableRulesForEnvironment,
  getRulesForEnvironment,
  replaceRulesForEnvironment,
  touchEnvironment,
} from "./environment-config-store.js";

const DEFAULT_ADMIN_ENVIRONMENT: EnvironmentKey = "staging";
const DEFAULT_LIVE_ENVIRONMENT: EnvironmentKey = "live";

function sortRules(rules: MerchandisingRule[]): MerchandisingRule[] {
  return [...rules].sort((a, b) => b.priority - a.priority);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function createRuleId(
  name: string,
  environment: EnvironmentKey = DEFAULT_ADMIN_ENVIRONMENT,
): string {
  const rules = getRulesForEnvironment(environment);
  const base = `rule-${slugify(name) || "custom"}`;
  let candidate = base;
  let counter = 1;

  while (rules.some((rule) => rule.id === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function normalizeOptionalString(
  value: string | null | undefined,
): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeMerchandisingRuleCondition(
  condition: MerchandisingRuleCondition,
): MerchandisingRuleCondition {
  const normalized: MerchandisingRuleCondition = {};
  const query = normalizeOptionalString(condition.query);
  const brand = normalizeOptionalString(condition.brand);
  const category = normalizeOptionalString(condition.category);

  if (query) {
    normalized.query = query;
  }
  if (brand) {
    normalized.brand = brand;
  }
  if (category) {
    normalized.category = category;
  }
  if (condition.inStock !== undefined) {
    normalized.inStock = condition.inStock;
  }

  return normalized;
}

export function getAllMerchandisingRules(
  environment: EnvironmentKey = DEFAULT_ADMIN_ENVIRONMENT,
): MerchandisingRule[] {
  return sortRules(getRulesForEnvironment(environment));
}

export function getActiveMerchandisingRules(
  environment: EnvironmentKey = DEFAULT_LIVE_ENVIRONMENT,
): MerchandisingRule[] {
  return sortRules(
    getRulesForEnvironment(environment).filter((rule) => rule.active),
  );
}

export function getMerchandisingRuleById(
  id: string,
  environment: EnvironmentKey = DEFAULT_ADMIN_ENVIRONMENT,
): MerchandisingRule | undefined {
  return getRulesForEnvironment(environment).find((rule) => rule.id === id);
}

export function summarizeRuleCondition(rule: MerchandisingRule): string {
  const parts: string[] = [];

  if (rule.condition.query) {
    parts.push(`query:${rule.condition.query}`);
  }
  if (rule.condition.brand) {
    parts.push(`brand:${rule.condition.brand}`);
  }
  if (rule.condition.category) {
    parts.push(`category:${rule.condition.category}`);
  }
  if (rule.condition.inStock !== undefined) {
    parts.push(`inStock:${rule.condition.inStock}`);
  }

  return parts.join(", ") || "default";
}

export function getRuleAuditContext(rule: MerchandisingRule): {
  id: string;
  name: string;
  action: MerchandisingRule["action"];
  conditionSummary: string;
} {
  return {
    id: rule.id,
    name: rule.name,
    action: rule.action,
    conditionSummary: summarizeRuleCondition(rule),
  };
}

export function createMerchandisingRule(
  input: CreateMerchandisingRuleDto,
  environment: EnvironmentKey = DEFAULT_ADMIN_ENVIRONMENT,
): MerchandisingRule {
  const rule: MerchandisingRule = {
    id: createRuleId(input.name, environment),
    ...input,
    condition: normalizeMerchandisingRuleCondition(input.condition ?? {}),
  };
  const brand = normalizeOptionalString(input.brand);
  if (brand) {
    rule.brand = brand;
  } else {
    delete rule.brand;
  }
  const rules = getMutableRulesForEnvironment(environment);
  rules.push(rule);
  touchEnvironment(environment);
  return structuredClone(rule);
}

export function updateMerchandisingRule(
  id: string,
  input: UpdateMerchandisingRuleDto,
  environment: EnvironmentKey = DEFAULT_ADMIN_ENVIRONMENT,
): MerchandisingRule | undefined {
  const rules = getMutableRulesForEnvironment(environment);
  const index = rules.findIndex((rule) => rule.id === id);
  if (index === -1) {
    return undefined;
  }

  const updated: MerchandisingRule = {
    ...rules[index],
    ...input,
    id,
  };

  if (input.condition !== undefined) {
    updated.condition = normalizeMerchandisingRuleCondition(input.condition);
  }

  if ("brand" in input) {
    const brand = normalizeOptionalString(input.brand);
    if (brand) {
      updated.brand = brand;
    } else {
      delete updated.brand;
    }
  }

  rules[index] = updated;
  touchEnvironment(environment);
  return structuredClone(updated);
}

export function replaceAllMerchandisingRules(
  nextRules: MerchandisingRule[],
  environment: EnvironmentKey = DEFAULT_ADMIN_ENVIRONMENT,
): void {
  replaceRulesForEnvironment(environment, nextRules);
}

export function deleteMerchandisingRule(
  id: string,
  environment: EnvironmentKey = DEFAULT_ADMIN_ENVIRONMENT,
): boolean {
  const rules = getMutableRulesForEnvironment(environment);
  const index = rules.findIndex((rule) => rule.id === id);
  if (index === -1) {
    return false;
  }
  rules.splice(index, 1);
  touchEnvironment(environment);
  return true;
}
