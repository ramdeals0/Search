import type { EnvironmentKey } from "@retailer-search/shared-types";
import {
  getMutableSynonymsForEnvironment,
  getSynonymsForEnvironment,
  replaceSynonymsForEnvironment,
  touchEnvironment,
} from "./environment-config-store.js";

const PHRASE_SYNONYMS: Array<[string, string]> = [
  ["paneer cheese", "paneer"],
  ["basmati rice", "rice"],
  ["detergent soap", "detergent"],
  ["soft drink", "beverages"],
];

const DEFAULT_ADMIN_ENVIRONMENT: EnvironmentKey = "staging";
const DEFAULT_LIVE_ENVIRONMENT: EnvironmentKey = "live";

export function getSynonymMap(
  environment: EnvironmentKey = DEFAULT_LIVE_ENVIRONMENT,
): Record<string, string> {
  return getSynonymsForEnvironment(environment);
}

export function getAllSynonyms(
  environment: EnvironmentKey = DEFAULT_ADMIN_ENVIRONMENT,
): Record<string, string> {
  return getSynonymMap(environment);
}

export function hasSynonym(
  key: string,
  environment: EnvironmentKey = DEFAULT_ADMIN_ENVIRONMENT,
): boolean {
  const normalizedKey = key.trim().toLowerCase();
  const synonyms = getSynonymsForEnvironment(environment);
  return normalizedKey.length > 0 && normalizedKey in synonyms;
}

export function addSynonym(
  key: string,
  value: string,
  environment: EnvironmentKey = DEFAULT_ADMIN_ENVIRONMENT,
): { key: string; value: string } | null {
  const normalizedKey = key.trim().toLowerCase();
  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedKey || !normalizedValue) {
    return null;
  }

  if (hasSynonym(normalizedKey, environment)) {
    return null;
  }

  const synonyms = getMutableSynonymsForEnvironment(environment);
  synonyms[normalizedKey] = normalizedValue;
  touchEnvironment(environment);
  return { key: normalizedKey, value: normalizedValue };
}

export function getSynonymAuditContext(
  key: string,
  value: string,
): { key: string; value: string } {
  return {
    key: key.trim().toLowerCase(),
    value: value.trim().toLowerCase(),
  };
}

export function replaceAllSynonyms(
  nextSynonyms: Record<string, string>,
  environment: EnvironmentKey = DEFAULT_ADMIN_ENVIRONMENT,
): void {
  replaceSynonymsForEnvironment(environment, nextSynonyms);
}

export function normalizeSynonyms(
  query: string,
  environment: EnvironmentKey = DEFAULT_LIVE_ENVIRONMENT,
): string {
  let result = query.trim().toLowerCase();
  const tokenSynonyms = getSynonymsForEnvironment(environment);

  for (const [phrase, replacement] of PHRASE_SYNONYMS) {
    if (result.includes(phrase)) {
      result = result.replaceAll(phrase, replacement);
    }
  }

  return result
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => tokenSynonyms[token] ?? token)
    .join(" ");
}
