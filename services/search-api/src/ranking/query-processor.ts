import type { QueryProcessorConfig } from "@retailer-search/search-core";
import { DEMO_TYPO_CORRECTIONS } from "../demo-search-config.js";
import { getSynonymMap, normalizeSynonyms } from "../synonyms.js";

const PHRASE_SYNONYMS: Array<[string, string]> = [
  ["shop vac", "wet dry vacuum"],
  ["weed eater", "string trimmer"],
  ["sheet rock", "drywall"],
  ["gfci outlet", "ground fault outlet"],
  ["pressure washer", "power washer"],
  ["drywall screws", "sheetrock screws"],
  ["pull down faucet", "pull-down faucet"],
  ["smart thermostat", "wifi thermostat"],
];

const PHRASE_TYPO_CORRECTIONS: Record<string, string> = Object.fromEntries(
  Object.entries(DEMO_TYPO_CORRECTIONS).filter(([key]) => key.includes(" ")),
);

const TOKEN_TYPO_CORRECTIONS: Record<string, string> = Object.fromEntries(
  Object.entries(DEMO_TYPO_CORRECTIONS).filter(([key]) => !key.includes(" ")),
);

let cachedConfigKey = "";
let cachedConfig: QueryProcessorConfig = {};

export function buildLiveQueryProcessorConfig(): QueryProcessorConfig {
  const tokenSynonyms = getSynonymMap("live");
  const cacheKey = [
    JSON.stringify(tokenSynonyms),
    JSON.stringify(PHRASE_SYNONYMS),
    JSON.stringify(PHRASE_TYPO_CORRECTIONS),
    JSON.stringify(TOKEN_TYPO_CORRECTIONS),
  ].join("|");

  if (cacheKey !== cachedConfigKey) {
    cachedConfigKey = cacheKey;
    cachedConfig = {
      phraseSynonyms: PHRASE_SYNONYMS,
      tokenSynonyms,
      phraseTypos: PHRASE_TYPO_CORRECTIONS,
      tokenTypos: TOKEN_TYPO_CORRECTIONS,
    };
  }

  return cachedConfig;
}

export function invalidateQueryProcessorCache(): void {
  cachedConfigKey = "";
  cachedConfig = {};
}

/** Process a query using live environment synonyms and demo typo maps. */
export function processLiveSearchQuery(rawQuery: string): {
  normalizedQuery: string;
  correctedQuery?: string;
  searchQuery: string;
} {
  const trimmed = rawQuery.trim();
  const normalizedInput = trimmed.toLowerCase();
  const typoResult = correctQueryTypos(normalizedInput);
  const afterTypo = typoResult.correctedQuery ?? typoResult.normalizedQuery;
  const afterSynonym = normalizeSynonyms(afterTypo, "live");

  const correctedQuery =
    typoResult.correctedQuery && typoResult.correctedQuery !== normalizedInput
      ? typoResult.correctedQuery
      : undefined;

  return {
    normalizedQuery: afterSynonym,
    correctedQuery,
    searchQuery: afterSynonym,
  };
}

function correctQueryTypos(query: string): {
  correctedQuery?: string;
  normalizedQuery: string;
} {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return { normalizedQuery: "" };
  }

  let working = normalizedQuery;
  let changed = false;

  for (const [misspelling, correction] of Object.entries(PHRASE_TYPO_CORRECTIONS)) {
    if (working.includes(misspelling)) {
      working = working.replaceAll(misspelling, correction);
      changed = true;
    }
  }

  const tokens = working.split(/\s+/).filter(Boolean);
  const correctedTokens = tokens.map((token) => {
    const replacement = TOKEN_TYPO_CORRECTIONS[token];
    if (replacement) {
      changed = true;
      return replacement;
    }
    return token;
  });

  if (!changed) {
    return { normalizedQuery };
  }

  return {
    correctedQuery: correctedTokens.join(" "),
    normalizedQuery,
  };
}
