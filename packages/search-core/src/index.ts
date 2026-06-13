import type {
  AutocompleteResponseDto,
  AutocompleteSuggestionDto,
  AvailableFacetsDto,
  FacetOptionDto,
  MerchandisingRule,
  ProductDocument,
  SearchFiltersDto,
  SearchHitDto,
  SearchRequestDto,
  SearchResponseDto,
} from "@retailer-search/shared-types";

type FacetKey = keyof AvailableFacetsDto;

export interface SearchProductsOptions {
  rules?: MerchandisingRule[];
  debug?: boolean;
}

interface ScoredProduct {
  product: ProductDocument;
  baseScore: number;
  exactMatchScore: number;
  inventoryScore: number;
  popularityScore: number;
  merchandisingAdjustment: number;
  finalScore: number;
  appliedRuleNames: string[];
}

const FACET_KEYS: FacetKey[] = ["brand", "category", "inStock"];

const PHRASE_SYNONYMS: Array<[string, string]> = [
  ["shop vac", "wet dry vacuum"],
  ["weed eater", "string trimmer"],
  ["breaker box", "electrical panel"],
  ["sheetrock", "drywall"],
  ["gfci outlet", "ground fault outlet"],
  ["pressure washer", "power washer"],
  ["drill driver", "cordless drill"],
  ["impact driver", "impact drill"],
  ["smoke detector", "smoke alarm"],
  ["drywall screws", "sheetrock screws"],
];

const TOKEN_SYNONYMS: Record<string, string> = {
  receptacle: "outlet",
  tap: "faucet",
  mower: "lawn mower",
  chop: "miter saw",
};

const TYPO_MAP: Record<string, string> = {
  dril: "drill",
  hammr: "hammer",
  mulsh: "mulch",
  drywal: "drywall",
  shopvac: "shop vac",
  "cordles drill": "cordless drill",
  "presure washer": "pressure washer",
  "smoke detecter": "smoke detector",
  "impct driver": "impact driver",
  "gfic outlet": "gfci outlet",
  thermastat: "smart thermostat",
};

export function normalizeQuery(input: string): string {
  return input.trim().toLowerCase();
}

function normalizeSynonyms(query: string): string {
  let result = query.trim().toLowerCase();

  for (const [phrase, replacement] of PHRASE_SYNONYMS) {
    if (result.includes(phrase)) {
      result = result.replaceAll(phrase, replacement);
    }
  }

  return result
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => TOKEN_SYNONYMS[token] ?? token)
    .join(" ");
}

function correctQueryTypos(query: string): {
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
  const normalizedInput = normalizeQuery(rawQuery);
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

function collectSearchableText(product: ProductDocument): string[] {
  const attributeValues = Object.values(product.attributes).flatMap((value) =>
    Array.isArray(value) ? value.map(String) : [String(value)],
  );

  return [
    product.title,
    product.brand,
    product.category,
    product.subcategory,
    product.description,
    ...attributeValues,
  ];
}

function productMatchesQuery(product: ProductDocument, query: string): boolean {
  if (!query) {
    return true;
  }

  return collectSearchableText(product).some((text) =>
    text.toLowerCase().includes(query),
  );
}

function getFacetValue(product: ProductDocument, key: FacetKey): string {
  if (key === "inStock") {
    return product.inStock ? "true" : "false";
  }

  return product[key];
}

function getFilterValues(
  filters: SearchFiltersDto | undefined,
  key: FacetKey,
): string[] {
  if (!filters) {
    return [];
  }

  return filters[key] ?? [];
}

function matchesFilters(
  product: ProductDocument,
  filters: SearchFiltersDto | undefined,
  excludeKey?: FacetKey,
): boolean {
  if (!filters) {
    return true;
  }

  for (const key of FACET_KEYS) {
    const values = getFilterValues(filters, key);
    if (excludeKey === key || values.length === 0) {
      continue;
    }

    const productValue = getFacetValue(product, key);
    if (!values.includes(productValue)) {
      return false;
    }
  }

  return true;
}

function countFacetOptions(
  products: ProductDocument[],
  key: FacetKey,
): FacetOptionDto[] {
  const counts = new Map<string, number>();

  for (const product of products) {
    const value = getFacetValue(product, key);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
}

function computeAvailableFacets(
  textMatched: ProductDocument[],
  filters: SearchFiltersDto | undefined,
): AvailableFacetsDto {
  return {
    brand: countFacetOptions(
      textMatched.filter((product) => matchesFilters(product, filters, "brand")),
      "brand",
    ),
    category: countFacetOptions(
      textMatched.filter((product) =>
        matchesFilters(product, filters, "category"),
      ),
      "category",
    ),
    inStock: countFacetOptions(
      textMatched.filter((product) =>
        matchesFilters(product, filters, "inStock"),
      ),
      "inStock",
    ),
  };
}

function computeBaseScore(product: ProductDocument, query: string): number {
  if (!query) {
    return 1;
  }

  const haystack = collectSearchableText(product).map((text) =>
    text.toLowerCase(),
  );
  const title = product.title.toLowerCase();
  const brand = product.brand.toLowerCase();
  const category = product.category.toLowerCase();

  let score = 0;

  if (haystack.some((text) => text.includes(query))) {
    score += 10;
  }
  if (title.includes(query)) {
    score += 8;
  }
  if (brand.includes(query)) {
    score += 6;
  }
  if (category.includes(query)) {
    score += 6;
  }

  return score;
}

function computeExactMatchScore(product: ProductDocument, query: string): number {
  if (!query) {
    return 0;
  }

  const title = product.title.toLowerCase();
  const brand = product.brand.toLowerCase();
  const category = product.category.toLowerCase();

  if (title === query) {
    return 50;
  }
  if (title.startsWith(query)) {
    return 35;
  }
  if (title.includes(query)) {
    return 20;
  }
  if (brand === query) {
    return 18;
  }
  if (category === query) {
    return 15;
  }

  return 0;
}

function computeInventoryScore(product: ProductDocument): number {
  return product.inStock ? Math.min(product.inventory / 20, 8) : 0;
}

function computePopularityScore(product: ProductDocument): number {
  return Math.min(product.inventory / 15, 10);
}

function ruleMatchesProduct(
  rule: MerchandisingRule,
  query: string,
  product: ProductDocument,
): boolean {
  const condition = rule.condition;

  if (condition.query && !query.includes(normalizeQuery(condition.query))) {
    return false;
  }
  if (condition.brand && product.brand !== condition.brand) {
    return false;
  }
  if (condition.category && product.category !== condition.category) {
    return false;
  }
  if (
    condition.inStock !== undefined &&
    product.inStock !== condition.inStock
  ) {
    return false;
  }
  if (rule.brand && product.brand !== rule.brand) {
    return false;
  }
  if (
    rule.productIds &&
    rule.productIds.length > 0 &&
    !rule.productIds.includes(product.id)
  ) {
    return false;
  }

  return true;
}

function applyMerchandisingRules(
  scored: ScoredProduct,
  query: string,
  rules: MerchandisingRule[],
): boolean {
  let hidden = false;

  for (const rule of rules) {
    if (!ruleMatchesProduct(rule, query, scored.product)) {
      continue;
    }

    if (rule.action === "hide") {
      hidden = true;
      scored.appliedRuleNames.push(rule.name);
      continue;
    }

    if (rule.action === "boost") {
      scored.merchandisingAdjustment += rule.boostAmount ?? 10;
      scored.appliedRuleNames.push(rule.name);
    }

    if (rule.action === "bury") {
      const buryAmount = rule.buryAmount ?? 10;
      if (
        rule.condition.query === "clearance" &&
        scored.product.price > 25
      ) {
        scored.merchandisingAdjustment -= buryAmount;
        scored.appliedRuleNames.push(rule.name);
      } else if (rule.condition.query !== "clearance") {
        scored.merchandisingAdjustment -= buryAmount;
        scored.appliedRuleNames.push(rule.name);
      }
    }
  }

  scored.finalScore =
    scored.baseScore +
    scored.exactMatchScore +
    scored.inventoryScore +
    scored.popularityScore +
    scored.merchandisingAdjustment;

  return !hidden;
}

function applyPinRules(
  ranked: ScoredProduct[],
  query: string,
  rules: MerchandisingRule[],
): ScoredProduct[] {
  const pinRules = rules.filter((rule) => rule.action === "pin");

  if (pinRules.length === 0) {
    return ranked;
  }

  const pinnedIds: string[] = [];
  const pinnedRuleNames = new Map<string, string>();

  for (const rule of pinRules) {
    if (!rule.condition.query || !query.includes(normalizeQuery(rule.condition.query))) {
      continue;
    }

    for (const productId of rule.productIds ?? []) {
      if (!pinnedIds.includes(productId)) {
        pinnedIds.push(productId);
        pinnedRuleNames.set(productId, rule.name);
      }
    }
  }

  if (pinnedIds.length === 0) {
    return ranked;
  }

  const pinned: ScoredProduct[] = [];
  const remaining: ScoredProduct[] = [];

  for (const productId of pinnedIds) {
    const match = ranked.find((item) => item.product.id === productId);
    if (match) {
      if (!match.appliedRuleNames.includes(pinnedRuleNames.get(productId)!)) {
        match.appliedRuleNames.push(pinnedRuleNames.get(productId)!);
      }
      pinned.push(match);
    }
  }

  for (const item of ranked) {
    if (!pinnedIds.includes(item.product.id)) {
      remaining.push(item);
    }
  }

  return [...pinned, ...remaining];
}

function scoreProducts(
  products: ProductDocument[],
  query: string,
  rules: MerchandisingRule[],
): ScoredProduct[] {
  const scored: ScoredProduct[] = [];

  for (const product of products) {
    const item: ScoredProduct = {
      product,
      baseScore: computeBaseScore(product, query),
      exactMatchScore: computeExactMatchScore(product, query),
      inventoryScore: computeInventoryScore(product),
      popularityScore: computePopularityScore(product),
      merchandisingAdjustment: 0,
      finalScore: 0,
      appliedRuleNames: [],
    };

    const visible = applyMerchandisingRules(item, query, rules);
    if (!visible) {
      continue;
    }

    scored.push(item);
  }

  scored.sort((a, b) => {
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore;
    }
    return a.product.title.localeCompare(b.product.title);
  });

  return applyPinRules(scored, query, rules);
}

function toHit(
  scored: ScoredProduct,
  debug: boolean,
): SearchHitDto {
  const hit: SearchHitDto = {
    id: scored.product.id,
    sku: scored.product.sku,
    title: scored.product.title,
    brand: scored.product.brand,
    category: scored.product.category,
    subcategory: scored.product.subcategory,
    description: scored.product.description,
    price: scored.product.price,
    imageUrl: scored.product.imageUrl,
    inStock: scored.product.inStock,
    score: scored.finalScore,
  };

  if (debug) {
    hit.rankingDebug = {
      productId: scored.product.id,
      baseScore: scored.baseScore,
      exactMatchScore: scored.exactMatchScore,
      inventoryScore: scored.inventoryScore,
      popularityScore: scored.popularityScore,
      merchandisingAdjustment: scored.merchandisingAdjustment,
      finalScore: scored.finalScore,
      appliedRuleNames: scored.appliedRuleNames,
    };
  }

  return hit;
}

function suggestionKey(suggestion: AutocompleteSuggestionDto): string {
  return `${suggestion.type}:${suggestion.value.toLowerCase()}`;
}

function addSuggestion(
  suggestions: AutocompleteSuggestionDto[],
  seen: Set<string>,
  suggestion: AutocompleteSuggestionDto,
): void {
  const key = suggestionKey(suggestion);
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  suggestions.push(suggestion);
}

export function getAutocompleteSuggestions(
  products: ProductDocument[],
  rawQuery: string,
): AutocompleteResponseDto {
  const processed = processSearchQuery(rawQuery);
  const query = processed.searchQuery;
  const suggestions: AutocompleteSuggestionDto[] = [];
  const seen = new Set<string>();

  if (!query) {
    return {
      query: rawQuery,
      normalizedQuery: processed.normalizedQuery,
      correctedQuery: processed.correctedQuery,
      suggestions: [],
    };
  }

  const matched = products.filter((product) => productMatchesQuery(product, query));

  for (const product of matched) {
    if (product.title.toLowerCase().includes(query)) {
      addSuggestion(suggestions, seen, {
        value: product.title,
        type: "product",
      });
    }
    if (product.brand.toLowerCase().includes(query)) {
      addSuggestion(suggestions, seen, {
        value: product.brand,
        type: "brand",
      });
    }
    if (product.category.toLowerCase().includes(query)) {
      addSuggestion(suggestions, seen, {
        value: product.category,
        type: "category",
      });
    }
  }

  if (processed.correctedQuery) {
    addSuggestion(suggestions, seen, {
      value: processed.correctedQuery,
      type: "query",
    });
  }

  addSuggestion(suggestions, seen, {
    value: processed.normalizedQuery,
    type: "query",
  });

  for (const product of matched.slice(0, 3)) {
    addSuggestion(suggestions, seen, {
      value: `${product.brand} ${product.category}`.toLowerCase(),
      type: "query",
    });
  }

  return {
    query: rawQuery,
    normalizedQuery: processed.normalizedQuery,
    correctedQuery: processed.correctedQuery,
    suggestions: suggestions.slice(0, 8),
  };
}

export function searchProducts(
  products: ProductDocument[],
  request: SearchRequestDto,
  options: SearchProductsOptions = {},
): SearchResponseDto {
  const start = Date.now();
  const processed = processSearchQuery(request.query);
  const query = processed.searchQuery;
  const page = Math.max(1, request.page);
  const pageSize = Math.max(1, Math.min(100, request.pageSize));
  const rules = options.rules ?? [];
  const debug = options.debug ?? false;

  const textMatched = products.filter((product) =>
    productMatchesQuery(product, query),
  );
  const filtered = textMatched.filter((product) =>
    matchesFilters(product, request.filters),
  );

  const ranked = scoreProducts(filtered, query, rules);
  const hits = ranked.map((item) => toHit(item, debug));

  const responseAppliedRules = [
    ...new Set(ranked.flatMap((item) => item.appliedRuleNames)),
  ];

  const totalHits = hits.length;
  const totalPages = Math.max(1, Math.ceil(totalHits / pageSize));
  const offset = (page - 1) * pageSize;

  return {
    query: request.query,
    normalizedQuery: processed.normalizedQuery,
    correctedQuery: processed.correctedQuery,
    page,
    pageSize,
    totalHits,
    totalPages,
    processingTimeMs: Date.now() - start,
    hits: hits.slice(offset, offset + pageSize),
    availableFacets: computeAvailableFacets(textMatched, request.filters),
    appliedRuleNames:
      responseAppliedRules.length > 0 ? responseAppliedRules : undefined,
  };
}
