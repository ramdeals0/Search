import type { SearchMetricsSnapshotDto } from "@retailer-search/shared-types";
import { getProductSearchIndex } from "../index/product-index-manager.js";

const metrics = {
  searchRequests: 0,
  autocompleteRequests: 0,
  browseRequests: 0,
  searchLatencyMsTotal: 0,
  autocompleteLatencyMsTotal: 0,
  browseLatencyMsTotal: 0,
  analyticsEventsPersisted: 0,
};

export function recordSearchRequest(latencyMs: number): void {
  metrics.searchRequests += 1;
  metrics.searchLatencyMsTotal += latencyMs;
}

export function recordAutocompleteRequest(latencyMs: number): void {
  metrics.autocompleteRequests += 1;
  metrics.autocompleteLatencyMsTotal += latencyMs;
}

export function recordBrowseRequest(latencyMs: number): void {
  metrics.browseRequests += 1;
  metrics.browseLatencyMsTotal += latencyMs;
}

export function recordAnalyticsPersisted(count = 1): void {
  metrics.analyticsEventsPersisted += count;
}

export function getSearchMetricsSnapshot(): SearchMetricsSnapshotDto {
  const indexStats = getProductSearchIndex().getStats();
  return {
    ...metrics,
    indexProductCount: indexStats.productCount,
    indexTokenCount: indexStats.tokenCount,
  };
}

export function renderPrometheusMetrics(): string {
  const snapshot = getSearchMetricsSnapshot();
  const lines = [
    "# HELP search_api_requests_total Total search API requests by route.",
    "# TYPE search_api_requests_total counter",
    `search_api_requests_total{route="search"} ${snapshot.searchRequests}`,
    `search_api_requests_total{route="autocomplete"} ${snapshot.autocompleteRequests}`,
    `search_api_requests_total{route="browse"} ${snapshot.browseRequests}`,
    "# HELP search_api_latency_ms_total Cumulative request latency in milliseconds.",
    "# TYPE search_api_latency_ms_total counter",
    `search_api_latency_ms_total{route="search"} ${snapshot.searchLatencyMsTotal}`,
    `search_api_latency_ms_total{route="autocomplete"} ${snapshot.autocompleteLatencyMsTotal}`,
    `search_api_latency_ms_total{route="browse"} ${snapshot.browseLatencyMsTotal}`,
    "# HELP search_index_products Product documents in the in-memory search index.",
    "# TYPE search_index_products gauge",
    `search_index_products ${snapshot.indexProductCount}`,
    "# HELP search_index_tokens Distinct tokens in the in-memory search index.",
    "# TYPE search_index_tokens gauge",
    `search_index_tokens ${snapshot.indexTokenCount}`,
    "# HELP search_analytics_events_persisted Total analytics events written to Postgres.",
    "# TYPE search_analytics_events_persisted counter",
    `search_analytics_events_persisted ${snapshot.analyticsEventsPersisted}`,
  ];
  return `${lines.join("\n")}\n`;
}
