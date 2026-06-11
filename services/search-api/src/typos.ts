import { normalizeSynonyms } from "./synonyms.js";

const TYPO_MAP: Record<string, string> = {
  basmti: "basmati",
  rise: "rice",
  panner: "paneer",
  chilli: "chili",
  orgnic: "organic",
  turmric: "turmeric",
  milke: "milk",
  hammr: "hammer",
};

export function correctQueryTypos(query: string): {
  correctedQuery?: string;
  normalizedQuery: string;
} {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return { normalizedQuery: "" };
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  let changed = false;
  const correctedTokens = tokens.map((token) => {
    const replacement = TYPO_MAP[token];
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
