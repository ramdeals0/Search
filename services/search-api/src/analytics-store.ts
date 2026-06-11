import type {
  NoResultQueryDto,
  SearchAnalyticsSummaryDto,
  SearchClickEventDto,
  SearchEventDto,
  TopQueryDto,
} from "@retailer-search/shared-types";

const searchEvents: SearchEventDto[] = [];
const clickEvents: SearchClickEventDto[] = [];

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function countQueries(queries: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const query of queries) {
    const normalized = normalizeQuery(query);
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return counts;
}

function toTopList(counts: Map<string, number>, limit: number): TopQueryDto[] {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([query, count]) => ({ query, count }));
}

function toNoResultList(
  counts: Map<string, number>,
  limit: number,
): NoResultQueryDto[] {
  return toTopList(counts, limit);
}

export function recordSearchEvent(
  event: Omit<SearchEventDto, "timestamp">,
): SearchEventDto {
  const stored: SearchEventDto = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  searchEvents.push(stored);
  return stored;
}

export function recordSearchClick(
  event: Omit<SearchClickEventDto, "timestamp">,
): SearchClickEventDto {
  const stored: SearchClickEventDto = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  clickEvents.push(stored);
  return stored;
}

export interface QueryAnalyticsRow {
  query: string;
  displayQuery: string;
  searches: number;
  clicks: number;
  ctr: number;
  zeroResults: number;
}

export function getQueryAnalytics(): QueryAnalyticsRow[] {
  const byQuery = new Map<
    string,
    {
      displayQuery: string;
      searches: number;
      clicks: number;
      zeroResults: number;
    }
  >();

  for (const event of searchEvents) {
    const normalized = normalizeQuery(event.query);
    if (!normalized) {
      continue;
    }

    const row = byQuery.get(normalized) ?? {
      displayQuery: event.query.trim(),
      searches: 0,
      clicks: 0,
      zeroResults: 0,
    };

    row.searches += 1;
    if (event.resultCount === 0) {
      row.zeroResults += 1;
    }
    row.displayQuery = event.query.trim();
    byQuery.set(normalized, row);
  }

  for (const event of clickEvents) {
    const normalized = normalizeQuery(event.query);
    if (!normalized) {
      continue;
    }

    const row = byQuery.get(normalized) ?? {
      displayQuery: event.query.trim(),
      searches: 0,
      clicks: 0,
      zeroResults: 0,
    };

    row.clicks += 1;
    byQuery.set(normalized, row);
  }

  return Array.from(byQuery.entries())
    .map(([query, row]) => ({
      query,
      displayQuery: row.displayQuery,
      searches: row.searches,
      clicks: row.clicks,
      ctr: row.searches > 0 ? row.clicks / row.searches : 0,
      zeroResults: row.zeroResults,
    }))
    .sort((a, b) => b.searches - a.searches);
}

export function getAnalyticsSummary(): SearchAnalyticsSummaryDto {
  const allQueries = searchEvents.map((event) => event.query);
  const noResultQueries = searchEvents
    .filter((event) => event.resultCount === 0)
    .map((event) => event.query);

  return {
    totalSearches: searchEvents.length,
    totalClicks: clickEvents.length,
    topQueries: toTopList(countQueries(allQueries), 10),
    noResultQueries: toNoResultList(countQueries(noResultQueries), 10),
  };
}
