import { DEMO_TYPO_CORRECTIONS } from "./demo-search-config.js";
import { normalizeSynonyms } from "./synonyms.js";

const PHRASE_TYPO_CORRECTIONS: Record<string, string> = Object.fromEntries(
  Object.entries(DEMO_TYPO_CORRECTIONS).filter(([key]) => key.includes(" ")),
);

const TOKEN_TYPO_CORRECTIONS: Record<string, string> = Object.fromEntries(
  Object.entries(DEMO_TYPO_CORRECTIONS).filter(([key]) => !key.includes(" ")),
);

export function correctQueryTypos(query: string): {
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

export function processSearchQuery(rawQuery: string): {
  normalizedQuery: string;
  correctedQuery?: string;
  searchQuery: string;
} {
  const trimmed = rawQuery.trim();
  const normalizedInput = trimmed.toLowerCase();
  const typoResult = correctQueryTypos(normalizedInput);
  const afterTypo = typoResult.correctedQuery ?? typoResult.normalizedQuery;
  const afterSynonym = normalizeSynonyms(afterTypo);

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
