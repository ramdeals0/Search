import { searchProducts } from "@retailer-search/search-core";
import type {
  ActionPreviewDto,
  ApplySuggestionResponseDto,
  CreateMerchandisingRuleDto,
  MerchandisingRule,
  ProductDocument,
  RuleSuggestionDto,
  SuggestionActionType,
  SuggestionPriority,
  SuggestionType,
} from "@retailer-search/shared-types";
import type { QueryAnalyticsRow } from "./analytics-store.js";
import { createMerchandisingRule } from "./merchandising-rules.js";
import { addSynonym, hasSynonym } from "./synonyms.js";
import { correctQueryTypos } from "./typos.js";

const MIN_SEARCHES = 3;
const MIN_ZERO_RESULTS = 2;
const LOW_CTR_THRESHOLD = 0.2;
const MAX_SUGGESTIONS = 10;

const PRIORITY_WEIGHT: Record<SuggestionPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const SUGGESTED_ACTION_TYPES: Record<SuggestionType, SuggestionActionType[]> = {
  add_synonym: ["create_synonym", "open_query_preview"],
  pin_product: ["create_rule", "open_query_preview"],
  boost_brand: ["create_rule", "open_query_preview"],
  review_low_ctr: ["open_query_preview"],
  // No create_synonym here: these queries have no close catalog match to map to.
  improve_zero_results: ["open_query_preview"],
  expand_catalog: ["open_query_preview"],
};

let cachedSuggestions: RuleSuggestionDto[] = [];

function buildSuggestionId(type: SuggestionType, query: string): string {
  const slug = query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `sug-${type}-${slug || "query"}`;
}

export interface GenerateRuleSuggestionsParams {
  queryAnalytics: QueryAnalyticsRow[];
  rules: MerchandisingRule[];
  products: ProductDocument[];
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function buildCatalogTerms(products: ProductDocument[]): string[] {
  const terms = new Set<string>();

  for (const product of products) {
    terms.add(product.brand.toLowerCase());
    terms.add(product.category.toLowerCase());
    terms.add(product.subcategory.toLowerCase());

    for (const token of product.title.toLowerCase().split(/\s+/)) {
      if (token.length >= 3) {
        terms.add(token);
      }
    }
  }

  return Array.from(terms);
}

function findClosestCatalogTerm(
  query: string,
  catalogTerms: string[],
): string | undefined {
  const normalized = query.trim().toLowerCase();
  let best: { term: string; distance: number } | undefined;

  for (const term of catalogTerms) {
    const distance = levenshtein(normalized, term);
    if (distance === 0 || distance > 2) {
      continue;
    }

    if (!best || distance < best.distance) {
      best = { term, distance };
    }
  }

  return best?.term;
}

function getTypoCorrection(query: string): string | undefined {
  const { correctedQuery } = correctQueryTypos(query.trim().toLowerCase());
  return correctedQuery &&
    correctedQuery !== query.trim().toLowerCase()
    ? correctedQuery
    : undefined;
}

function resolveSynonymTarget(
  query: string,
  products: ProductDocument[],
): string | undefined {
  const typoCorrection = getTypoCorrection(query);
  if (typoCorrection) {
    return typoCorrection;
  }

  return findClosestCatalogTerm(query, buildCatalogTerms(products));
}

function getTopSearchHit(
  query: string,
  products: ProductDocument[],
  rules: MerchandisingRule[],
) {
  const activeRules = rules.filter((rule) => rule.active);
  const result = searchProducts(
    products,
    { query, page: 1, pageSize: 1 },
    { rules: activeRules },
  );

  return result.hits[0];
}

function hasRuleCoveringQuery(rules: MerchandisingRule[], query: string): boolean {
  const normalized = query.trim().toLowerCase();
  return rules.some(
    (rule) =>
      rule.active &&
      rule.condition.query?.trim().toLowerCase() === normalized,
  );
}

function suggestionKey(type: SuggestionType, query: string): string {
  return `${type}:${query.trim().toLowerCase()}`;
}

function withActionTypes(
  suggestion: Omit<RuleSuggestionDto, "suggestedActionTypes">,
): RuleSuggestionDto {
  return {
    ...suggestion,
    suggestedActionTypes: SUGGESTED_ACTION_TYPES[suggestion.type],
  };
}

function addSuggestion(
  bucket: Map<string, RuleSuggestionDto>,
  suggestion: Omit<RuleSuggestionDto, "suggestedActionTypes">,
): void {
  const enriched = withActionTypes(suggestion);
  const key = suggestionKey(enriched.type, enriched.query);
  const existing = bucket.get(key);

  if (
    !existing ||
    PRIORITY_WEIGHT[enriched.priority] > PRIORITY_WEIGHT[existing.priority]
  ) {
    bucket.set(key, enriched);
  }
}

function formatCtr(ctr: number): string {
  return `${(ctr * 100).toFixed(0)}%`;
}

function ensureSuggestions(params: GenerateRuleSuggestionsParams): RuleSuggestionDto[] {
  return generateRuleSuggestions(params);
}

function isActionSupported(
  suggestion: RuleSuggestionDto,
  actionType: SuggestionActionType,
): boolean {
  return suggestion.suggestedActionTypes?.includes(actionType) ?? false;
}

function buildPinRuleDraft(
  suggestion: RuleSuggestionDto,
  params: GenerateRuleSuggestionsParams,
): CreateMerchandisingRuleDto | null {
  const topHit = getTopSearchHit(
    suggestion.query,
    params.products,
    params.rules,
  );

  if (!topHit) {
    return null;
  }

  return {
    name: `Suggested pin for "${suggestion.query}"`,
    active: true,
    priority: 55,
    action: "pin",
    condition: { query: suggestion.query.trim().toLowerCase() },
    productIds: [topHit.id],
  };
}

function buildBoostRuleDraft(
  suggestion: RuleSuggestionDto,
  params: GenerateRuleSuggestionsParams,
): CreateMerchandisingRuleDto | null {
  const topHit = getTopSearchHit(
    suggestion.query,
    params.products,
    params.rules,
  );

  if (!topHit) {
    return null;
  }

  return {
    name: `Suggested boost for "${suggestion.query}"`,
    active: true,
    priority: 50,
    action: "boost",
    condition: { query: suggestion.query.trim().toLowerCase() },
    brand: topHit.brand,
    boostAmount: 25,
  };
}

function buildRuleDraft(
  suggestion: RuleSuggestionDto,
  params: GenerateRuleSuggestionsParams,
): CreateMerchandisingRuleDto | null {
  if (suggestion.type === "pin_product") {
    return buildPinRuleDraft(suggestion, params);
  }

  if (suggestion.type === "boost_brand") {
    return buildBoostRuleDraft(suggestion, params);
  }

  return null;
}

export function generateRuleSuggestions(
  params: GenerateRuleSuggestionsParams,
): RuleSuggestionDto[] {
  const catalogTerms = buildCatalogTerms(params.products);
  const bucket = new Map<string, RuleSuggestionDto>();

  for (const row of params.queryAnalytics) {
    const query = row.displayQuery;
    const metrics = {
      searches: row.searches,
      clicks: row.clicks,
      ctr: row.ctr,
      zeroResults: row.zeroResults,
    };

    const typoCorrection = getTypoCorrection(query);
    const closestTerm = findClosestCatalogTerm(query, catalogTerms);
    const hasResults = row.zeroResults < row.searches;

    if (
      row.searches >= MIN_SEARCHES &&
      row.zeroResults >= MIN_ZERO_RESULTS
    ) {
      if (typoCorrection || closestTerm) {
        const target = typoCorrection ?? closestTerm!;
        addSuggestion(bucket, {
          id: buildSuggestionId("add_synonym", query),
          type: "add_synonym",
          priority: "high",
          query,
          reason: `Query '${query}' has ${row.searches} searches, ${row.zeroResults} zero-result events, and likely reflects a spelling or synonym gap.`,
          recommendedAction: `Add a synonym mapping '${query}' -> '${target}' or align query normalization with catalog vocabulary.`,
          metrics,
        });
      } else {
        addSuggestion(bucket, {
          id: buildSuggestionId("improve_zero_results", query),
          type: "improve_zero_results",
          priority: "high",
          query,
          reason: `Query '${query}' has ${row.searches} searches and ${row.zeroResults} zero-result events with no close catalog match.`,
          recommendedAction:
            "Review catalog coverage, filters, and hide rules that may be suppressing valid matches.",
          metrics,
        });

        addSuggestion(bucket, {
          id: buildSuggestionId("expand_catalog", query),
          type: "expand_catalog",
          priority: "medium",
          query,
          reason: `Query '${query}' repeatedly returns no products despite ${row.searches} searches.`,
          recommendedAction:
            "Consider adding products or categories that satisfy this shopper intent.",
          metrics,
        });
      }
    }

    if (
      row.zeroResults >= MIN_ZERO_RESULTS &&
      (typoCorrection || closestTerm) &&
      row.searches < MIN_SEARCHES
    ) {
      const target = typoCorrection ?? closestTerm!;
      addSuggestion(bucket, {
        id: buildSuggestionId("add_synonym", query),
        type: "add_synonym",
        priority: "medium",
        query,
        reason: `Query '${query}' produced ${row.zeroResults} zero-result searches and appears related to '${target}'.`,
        recommendedAction: `Add a synonym or typo correction from '${query}' to '${target}'.`,
        metrics,
      });
    }

    if (
      row.searches >= MIN_SEARCHES &&
      hasResults &&
      row.ctr < LOW_CTR_THRESHOLD
    ) {
      addSuggestion(bucket, {
          id: buildSuggestionId("review_low_ctr", query),
        type: "review_low_ctr",
        priority: row.searches >= 5 ? "high" : "medium",
        query,
        reason: `Query '${query}' has strong search volume (${row.searches} searches) but low CTR (${formatCtr(row.ctr)}), suggesting the top results may not match shopper intent.`,
        recommendedAction:
          "Review ranking, merchandising rules, and result relevance for this query.",
        metrics,
      });

      if (!hasRuleCoveringQuery(params.rules, query)) {
        const topHit = getTopSearchHit(
          query,
          params.products,
          params.rules,
        );

        if (topHit) {
          if (row.searches >= 5) {
            addSuggestion(bucket, {
              id: buildSuggestionId("pin_product", query),
              type: "pin_product",
              priority: "medium",
              query,
              reason: `Query '${query}' has ${row.searches} searches with only ${row.clicks} clicks (${formatCtr(row.ctr)} CTR).`,
              recommendedAction: `Pin '${topHit.title}' (${topHit.id}) for query '${query}' to surface a stronger default result.`,
              metrics,
            });
          } else {
            addSuggestion(bucket, {
              id: buildSuggestionId("boost_brand", query),
              type: "boost_brand",
              priority: "medium",
              query,
              reason: `Query '${query}' has measurable traffic (${row.searches} searches) but weak engagement (${formatCtr(row.ctr)} CTR).`,
              recommendedAction: `Boost brand '${topHit.brand}' for query '${query}' to promote a more relevant result set.`,
              metrics,
            });
          }
        }
      }
    }

    if (
      row.searches >= MIN_SEARCHES &&
      row.clicks > 0 &&
      row.ctr < LOW_CTR_THRESHOLD &&
      hasResults
    ) {
      const topHit = getTopSearchHit(query, params.products, params.rules);

      if (topHit && !hasRuleCoveringQuery(params.rules, query)) {
        addSuggestion(bucket, {
          id: buildSuggestionId("boost_brand", query),
          type: "boost_brand",
          priority: "low",
          query,
          reason: `Query '${query}' already drives clicks (${row.clicks}) but CTR remains low at ${formatCtr(row.ctr)}.`,
          recommendedAction: `Boost brand '${topHit.brand}' or pin '${topHit.title}' (${topHit.id}) to improve click-through.`,
          metrics,
        });
      }
    }
  }

  cachedSuggestions = Array.from(bucket.values())
    .sort((a, b) => {
      const priorityDiff =
        PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return (b.metrics?.searches ?? 0) - (a.metrics?.searches ?? 0);
    })
    .slice(0, MAX_SUGGESTIONS);

  return cachedSuggestions;
}

export function getSuggestionById(
  id: string,
  params: GenerateRuleSuggestionsParams,
): RuleSuggestionDto | undefined {
  return ensureSuggestions(params).find((suggestion) => suggestion.id === id);
}

export function buildActionPreview(
  suggestionId: string,
  actionType: SuggestionActionType,
  params: GenerateRuleSuggestionsParams,
): ActionPreviewDto | null {
  const suggestion = getSuggestionById(suggestionId, params);
  if (!suggestion || !isActionSupported(suggestion, actionType)) {
    return null;
  }

  if (actionType === "open_query_preview") {
    return {
      suggestionId,
      query: suggestion.query,
      actionType,
      summary: `Preview search results for "${suggestion.query}" without changing any rules or synonyms.`,
      payloadPreview: { query: suggestion.query },
    };
  }

  if (actionType === "create_synonym") {
    const target = resolveSynonymTarget(suggestion.query, params.products);
    if (!target) {
      return null;
    }

    const key = suggestion.query.trim().toLowerCase();
    return {
      suggestionId,
      query: suggestion.query,
      actionType,
      summary: `Add an in-memory synonym mapping "${key}" to "${target}" so future searches normalize this query.`,
      payloadPreview: { key, value: target },
    };
  }

  const ruleDraft = buildRuleDraft(suggestion, params);
  if (!ruleDraft) {
    return null;
  }

  return {
    suggestionId,
    query: suggestion.query,
    actionType,
    summary: `Create a draft merchandising rule for "${suggestion.query}". You can edit or disable it later in the rules table.`,
    payloadPreview: ruleDraft as unknown as Record<string, unknown>,
  };
}

export function applySuggestionAction(
  suggestionId: string,
  actionType: SuggestionActionType,
  params: GenerateRuleSuggestionsParams,
): ApplySuggestionResponseDto {
  const suggestion = getSuggestionById(suggestionId, params);
  if (!suggestion) {
    return { success: false, message: "Suggestion not found." };
  }

  if (!isActionSupported(suggestion, actionType)) {
    return {
      success: false,
      message: `Action "${actionType}" is not supported for this suggestion.`,
    };
  }

  if (actionType === "open_query_preview") {
    return {
      success: true,
      message: `Ready to preview results for "${suggestion.query}".`,
      previewQuery: suggestion.query,
    };
  }

  if (actionType === "create_synonym") {
    if (
      suggestion.type !== "add_synonym" &&
      suggestion.type !== "improve_zero_results"
    ) {
      return {
        success: false,
        message: "Synonym creation is only supported for synonym-related suggestions.",
      };
    }

    const target = resolveSynonymTarget(suggestion.query, params.products);
    if (!target) {
      return {
        success: false,
        message: "No plausible synonym target was found for this query.",
      };
    }

    const key = suggestion.query.trim().toLowerCase();
    if (hasSynonym(key)) {
      return {
        success: false,
        message: `Synonym "${key}" already exists.`,
      };
    }

    addSynonym(key, target);
    return {
      success: true,
      message: `Created synonym "${key}" -> "${target}".`,
      createdSynonymKey: key,
    };
  }

  if (actionType === "create_rule") {
    if (
      suggestion.type !== "pin_product" &&
      suggestion.type !== "boost_brand"
    ) {
      return {
        success: false,
        message: "Rule creation is only supported for pin or boost suggestions.",
      };
    }

    const ruleDraft = buildRuleDraft(suggestion, params);
    if (!ruleDraft) {
      return {
        success: false,
        message: "Could not build a merchandising rule draft for this suggestion.",
      };
    }

    const created = createMerchandisingRule(ruleDraft);
    return {
      success: true,
      message: `Created merchandising rule "${created.name}".`,
      createdRuleId: created.id,
    };
  }

  return { success: false, message: "Unsupported action." };
}
