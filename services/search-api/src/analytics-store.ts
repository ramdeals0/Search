import type {
  NoResultQueryDto,
  SearchAnalyticsSummaryDto,
  SearchClickEventDto,
  SearchEventDto,
  TopQueryDto,
  ZeroResultInsightsResponseDto,
} from "@retailer-search/shared-types";
import { prisma } from "./db.js";
import { recordAnalyticsPersisted } from "./observability/search-metrics.js";

const searchEvents: SearchEventDto[] = [];
const clickEvents: SearchClickEventDto[] = [];
let persistenceEnabled = false;

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

export async function hydrateAnalyticsStore(): Promise<void> {
  try {
    const [recentSearchEvents, recentClickEvents] = await Promise.all([
      prisma.searchEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.searchClickEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    searchEvents.length = 0;
    clickEvents.length = 0;

    for (const row of recentSearchEvents.reverse()) {
      searchEvents.push({
        query: row.query,
        resultCount: row.resultCount,
        timestamp: row.createdAt.toISOString(),
      });
    }

    for (const row of recentClickEvents.reverse()) {
      clickEvents.push({
        query: row.query,
        productId: row.productId,
        productTitle: row.productTitle,
        timestamp: row.createdAt.toISOString(),
      });
    }

    persistenceEnabled = true;
  } catch {
    persistenceEnabled = false;
  }
}

export interface RecordSearchEventOptions {
  tenantId?: string;
  apiKeyId?: string;
  sessionId?: string;
}

export function recordSearchEvent(
  event: Omit<SearchEventDto, "timestamp">,
  options: RecordSearchEventOptions = {},
): SearchEventDto {
  const stored: SearchEventDto = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  searchEvents.push(stored);

  if (persistenceEnabled) {
    void prisma.searchEvent
      .create({
        data: {
          query: event.query,
          normalizedQuery: normalizeQuery(event.query),
          resultCount: event.resultCount,
          tenantId: options.tenantId ?? "default",
          apiKeyId: options.apiKeyId,
          sessionId: options.sessionId,
        },
      })
      .then(() => recordAnalyticsPersisted())
      .catch(() => undefined);
  }

  return stored;
}

export interface RecordClickEventOptions {
  tenantId?: string;
  apiKeyId?: string;
  sessionId?: string;
  position?: number;
}

export function recordSearchClick(
  event: Omit<SearchClickEventDto, "timestamp">,
  options: RecordClickEventOptions = {},
): SearchClickEventDto {
  const stored: SearchClickEventDto = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  clickEvents.push(stored);

  if (persistenceEnabled) {
    void prisma.searchClickEvent
      .create({
        data: {
          query: event.query,
          normalizedQuery: normalizeQuery(event.query),
          productId: event.productId,
          productTitle: event.productTitle,
          position: options.position,
          tenantId: options.tenantId ?? "default",
          apiKeyId: options.apiKeyId,
          sessionId: options.sessionId,
        },
      })
      .then(() => recordAnalyticsPersisted())
      .catch(() => undefined);
  }

  return stored;
}

export function getClickEventsForInsights(): SearchClickEventDto[] {
  return [...clickEvents];
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

export async function getZeroResultInsights(
  limit = 25,
): Promise<ZeroResultInsightsResponseDto> {
  if (persistenceEnabled) {
    try {
      const grouped = await prisma.searchEvent.groupBy({
        by: ["normalizedQuery"],
        where: { resultCount: 0 },
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: { _count: { normalizedQuery: "desc" } },
        take: limit,
      });

      return {
        total: grouped.length,
        queries: grouped.map((row: {
          normalizedQuery: string;
          _count: { _all: number };
          _max: { createdAt: Date | null };
        }) => ({
          query: row.normalizedQuery,
          count: row._count._all,
          lastSeenAt: (row._max.createdAt ?? new Date()).toISOString(),
        })),
      };
    } catch {
      // Fall back to in-memory aggregation.
    }
  }

  const counts = countQueries(
    searchEvents
      .filter((event) => event.resultCount === 0)
      .map((event) => event.query),
  );

  const queries = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([query, count]) => ({
      query,
      count,
      lastSeenAt: new Date().toISOString(),
    }));

  return {
    total: queries.length,
    queries,
  };
}
