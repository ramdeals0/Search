import type { ProcessedQuery, QueryProcessorConfig } from "./types.js";

function normalizeInput(rawQuery: string): string {
  return rawQuery.trim().toLowerCase();
}

function applyPhraseMap(text: string, map: Record<string, string>): string {
  let result = text;
  for (const [phrase, replacement] of Object.entries(map)) {
    if (result.includes(phrase)) {
      result = result.replaceAll(phrase, replacement);
    }
  }
  return result;
}

function applyPhrasePairs(text: string, pairs: Array<[string, string]>): string {
  let result = text;
  for (const [phrase, replacement] of pairs) {
    if (result.includes(phrase)) {
      result = result.replaceAll(phrase, replacement);
    }
  }
  return result;
}

function correctTypos(
  normalizedQuery: string,
  config: QueryProcessorConfig,
): { correctedQuery?: string; working: string } {
  const phraseTypos = config.phraseTypos ?? {};
  const tokenTypos = config.tokenTypos ?? {};

  let working = normalizedQuery;
  let changed = false;

  const afterPhrases = applyPhraseMap(working, phraseTypos);
  if (afterPhrases !== working) {
    working = afterPhrases;
    changed = true;
  }

  const tokens = working.split(/\s+/).filter(Boolean);
  const correctedTokens = tokens.map((token) => {
    const replacement = tokenTypos[token];
    if (replacement) {
      changed = true;
      return replacement;
    }
    return token;
  });

  if (!changed) {
    return { working: normalizedQuery };
  }

  return {
    correctedQuery: correctedTokens.join(" "),
    working: correctedTokens.join(" "),
  };
}

function applySynonyms(text: string, config: QueryProcessorConfig): string {
  let result = text;
  result = applyPhrasePairs(result, config.phraseSynonyms ?? []);
  const tokenSynonyms = config.tokenSynonyms ?? {};
  return result
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => tokenSynonyms[token] ?? token)
    .join(" ");
}

export function processSearchQueryWithConfig(
  rawQuery: string,
  config: QueryProcessorConfig = {},
): ProcessedQuery {
  const normalizedInput = normalizeInput(rawQuery);
  const typoResult = correctTypos(normalizedInput, config);
  const afterTypo = typoResult.correctedQuery ?? typoResult.working;
  const afterSynonym = applySynonyms(afterTypo, config);

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
