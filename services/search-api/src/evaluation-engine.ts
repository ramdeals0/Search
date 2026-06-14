import { searchProducts } from "@retailer-search/search-core";
import type {
  EvaluationQueryDto,
  EvaluationQuerySetDto,
  ExperimentLlmOverridesDto,
  ExperimentRunSummaryDto,
  MerchandisingRule,
  ProductDocument,
  QueryEvaluationResultDto,
} from "@retailer-search/shared-types";
import { llmEnhancedSearch } from "./search/llm-enhanced-search.js";

const TOP_N = 10;
const SEARCH_PAGE_SIZE = 20;

export interface SnapshotSearchConfig {
  rules: MerchandisingRule[];
  synonyms: Record<string, string>;
}

export interface RunExperimentEvaluationParams {
  experimentId: string;
  baseline: SnapshotSearchConfig;
  candidate: SnapshotSearchConfig;
  querySet: EvaluationQuerySetDto;
  products: ProductDocument[];
  candidateLlmOverrides?: ExperimentLlmOverridesDto;
}

function applySynonymMap(query: string, synonyms: Record<string, string>): string {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => synonyms[token] ?? token)
    .join(" ");
}

function getActiveRules(rules: MerchandisingRule[]): MerchandisingRule[] {
  return rules.filter((rule) => rule.active);
}

function hasCandidateLlmOverrides(
  overrides?: ExperimentLlmOverridesDto,
): boolean {
  if (!overrides) {
    return false;
  }

  return Boolean(
    overrides.queryRewriteEnabled ||
      overrides.zeroResultsEnabled ||
      overrides.rerankEnabled,
  );
}

function runSearchForConfig(
  products: ProductDocument[],
  rawQuery: string,
  config: SnapshotSearchConfig,
) {
  const query = applySynonymMap(rawQuery, config.synonyms);
  return searchProducts(
    products,
    { query, page: 1, pageSize: SEARCH_PAGE_SIZE },
    { rules: getActiveRules(config.rules) },
  );
}

async function runCandidateSearchForConfig(
  products: ProductDocument[],
  rawQuery: string,
  config: SnapshotSearchConfig,
  candidateLlmOverrides?: ExperimentLlmOverridesDto,
) {
  const query = applySynonymMap(rawQuery, config.synonyms);

  if (hasCandidateLlmOverrides(candidateLlmOverrides)) {
    return llmEnhancedSearch(
      products,
      { query, page: 1, pageSize: SEARCH_PAGE_SIZE },
      {
        rules: getActiveRules(config.rules),
        featureFlagOverride: {
          queryRewriteEnabled: candidateLlmOverrides?.queryRewriteEnabled ?? false,
          zeroResultsEnabled: candidateLlmOverrides?.zeroResultsEnabled ?? false,
          rerankEnabled: candidateLlmOverrides?.rerankEnabled ?? false,
        },
      },
    );
  }

  return runSearchForConfig(products, rawQuery, config);
}

function countExpectedMatches(
  topIds: string[],
  expectedProductIds: string[] | undefined,
): number | undefined {
  if (!expectedProductIds || expectedProductIds.length === 0) {
    return undefined;
  }

  const topSet = new Set(topIds);
  return expectedProductIds.filter((id) => topSet.has(id)).length;
}

function countOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((id) => setB.has(id)).length;
}

async function evaluateQuery(
  evaluationQuery: EvaluationQueryDto,
  products: ProductDocument[],
  baseline: SnapshotSearchConfig,
  candidate: SnapshotSearchConfig,
  candidateLlmOverrides?: ExperimentLlmOverridesDto,
): Promise<QueryEvaluationResultDto> {
  const baselineResult = runSearchForConfig(
    products,
    evaluationQuery.query,
    baseline,
  );
  const candidateResult = await runCandidateSearchForConfig(
    products,
    evaluationQuery.query,
    candidate,
    candidateLlmOverrides,
  );

  const topBaselineIds = baselineResult.hits.slice(0, TOP_N).map((hit) => hit.id);
  const topCandidateIds = candidateResult.hits
    .slice(0, TOP_N)
    .map((hit) => hit.id);

  const expectedMatchesInTopBaseline = countExpectedMatches(
    topBaselineIds,
    evaluationQuery.expectedProductIds,
  );
  const expectedMatchesInTopCandidate = countExpectedMatches(
    topCandidateIds,
    evaluationQuery.expectedProductIds,
  );

  const changed =
    baselineResult.totalHits !== candidateResult.totalHits ||
    topBaselineIds.join("|") !== topCandidateIds.join("|");

  return {
    query: evaluationQuery.query,
    totalBaseline: baselineResult.totalHits,
    totalCandidate: candidateResult.totalHits,
    topBaselineIds,
    topCandidateIds,
    overlapCount: countOverlap(topBaselineIds, topCandidateIds),
    expectedMatchesInTopBaseline,
    expectedMatchesInTopCandidate,
    changed,
    notes: evaluationQuery.notes,
  };
}

function classifyQueryOutcome(result: QueryEvaluationResultDto): {
  improved: boolean;
  regressed: boolean;
  unchanged: boolean;
} {
  const baselineExpected = result.expectedMatchesInTopBaseline;
  const candidateExpected = result.expectedMatchesInTopCandidate;

  if (
    baselineExpected !== undefined &&
    candidateExpected !== undefined &&
    baselineExpected !== candidateExpected
  ) {
    return {
      improved: candidateExpected > baselineExpected,
      regressed: candidateExpected < baselineExpected,
      unchanged: false,
    };
  }

  if (!result.changed) {
    return { improved: false, regressed: false, unchanged: true };
  }

  return { improved: false, regressed: false, unchanged: false };
}

export async function runExperimentEvaluation(
  params: RunExperimentEvaluationParams,
): Promise<ExperimentRunSummaryDto> {
  const results: QueryEvaluationResultDto[] = [];

  for (const evaluationQuery of params.querySet.queries) {
    results.push(
      await evaluateQuery(
        evaluationQuery,
        params.products,
        params.baseline,
        params.candidate,
        params.candidateLlmOverrides,
      ),
    );
  }

  let changedQueries = 0;
  let improvedQueries = 0;
  let regressedQueries = 0;
  let unchangedQueries = 0;

  for (const result of results) {
    const outcome = classifyQueryOutcome(result);
    if (result.changed) {
      changedQueries += 1;
    }
    if (outcome.improved) {
      improvedQueries += 1;
    } else if (outcome.regressed) {
      regressedQueries += 1;
    } else if (outcome.unchanged) {
      unchangedQueries += 1;
    }
  }

  return {
    experimentId: params.experimentId,
    runAt: new Date().toISOString(),
    summary: {
      totalQueries: results.length,
      changedQueries,
      improvedQueries,
      regressedQueries,
      unchangedQueries,
    },
    results,
  };
}

export function getQueryOutcomeLabel(
  result: QueryEvaluationResultDto,
): "improved" | "regressed" | "unchanged" | "changed" {
  const baselineExpected = result.expectedMatchesInTopBaseline;
  const candidateExpected = result.expectedMatchesInTopCandidate;

  if (
    baselineExpected !== undefined &&
    candidateExpected !== undefined &&
    candidateExpected > baselineExpected
  ) {
    return "improved";
  }

  if (
    baselineExpected !== undefined &&
    candidateExpected !== undefined &&
    candidateExpected < baselineExpected
  ) {
    return "regressed";
  }

  if (!result.changed) {
    return "unchanged";
  }

  return "changed";
}
