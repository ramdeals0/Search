import type {
  DiscoveryRecentQueryDto,
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
const sessionSearchEvents = new Map<string, DiscoveryRecentQueryDto[]>();
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
    sessionSearchEvents.clear();

    for (const row of recentSearchEvents.reverse()) {
      const event = {
        query: row.query,
        resultCount: row.resultCount,
        timestamp: row.createdAt.toISOString(),
      };
      searchEvents.push(event);
      if (row.sessionId) {
        const existing = sessionSearchEvents.get(row.sessionId) ?? [];
        existing.push({
          query: event.query,
          searchedAt: event.timestamp,
        });
        sessionSearchEvents.set(row.sessionId, existing);
      }
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
  if (options.sessionId) {
    const existing = sessionSearchEvents.get(options.sessionId) ?? [];
    existing.push({
      query: stored.query,
      searchedAt: stored.timestamp,
    });
    if (existing.length > 100) {
      existing.splice(0, existing.length - 100);
    }
    sessionSearchEvents.set(options.sessionId, existing);
  }

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

export function recordSearchAnalytics(
  query: string,
  resultCount: number,
  options: RecordSearchEventOptions = {},
): SearchEventDto | null {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  return recordSearchEvent({ query: trimmed, resultCount }, options);
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

function getInMemoryAnalyticsSummary(): SearchAnalyticsSummaryDto {
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

function windowStartFromDays(windowDays: number): Date {
  const days = Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getTrendingQueries(
  limit = 10,
  windowDays = 7,
): Promise<TopQueryDto[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));

  if (persistenceEnabled) {
    try {
      const grouped = await prisma.searchEvent.groupBy({
        by: ["normalizedQuery"],
        where: {
          createdAt: { gte: windowStartFromDays(windowDays) },
        },
        _count: { _all: true },
        orderBy: { _count: { normalizedQuery: "desc" } },
        take: safeLimit,
      });

      return grouped.map((row: {
        normalizedQuery: string;
        _count: { _all: number };
      }) => ({
        query: row.normalizedQuery,
        count: row._count._all,
      }));
    } catch {
      // Fall back to in-memory aggregation.
    }
  }

  const inWindow = searchEvents
    .filter((event) => new Date(event.timestamp) >= windowStartFromDays(windowDays))
    .map((event) => event.query);

  return toTopList(countQueries(inWindow), safeLimit);
}

export async function getRecentQueriesForSession(
  sessionId: string,
  limit = 10,
): Promise<DiscoveryRecentQueryDto[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) {
    return [];
  }

  if (persistenceEnabled) {
    try {
      const rows = await prisma.searchEvent.findMany({
        where: { sessionId: normalizedSessionId },
        orderBy: { createdAt: "desc" },
        take: safeLimit,
        select: {
          query: true,
          createdAt: true,
        },
      });

      return rows.map((row) => ({
        query: row.query,
        searchedAt: row.createdAt.toISOString(),
      }));
    } catch {
      // Fall back to in-memory events.
    }
  }

  return [...(sessionSearchEvents.get(normalizedSessionId) ?? [])]
    .reverse()
    .slice(0, safeLimit);
}

export async function getAnalyticsSummary(): Promise<SearchAnalyticsSummaryDto> {
  if (!persistenceEnabled) {
    return getInMemoryAnalyticsSummary();
  }

  try {
    const [totalSearches, totalClicks, topGrouped, zeroResultGrouped] =
      await Promise.all([
        prisma.searchEvent.count(),
        prisma.searchClickEvent.count(),
        prisma.searchEvent.groupBy({
          by: ["normalizedQuery"],
          _count: { _all: true },
          orderBy: { _count: { normalizedQuery: "desc" } },
          take: 10,
        }),
        prisma.searchEvent.groupBy({
          by: ["normalizedQuery"],
          where: { resultCount: 0 },
          _count: { _all: true },
          orderBy: { _count: { normalizedQuery: "desc" } },
          take: 10,
        }),
      ]);

    return {
      totalSearches,
      totalClicks,
      topQueries: topGrouped.map((row) => ({
        query: row.normalizedQuery,
        count: row._count._all,
      })),
      noResultQueries: zeroResultGrouped.map((row) => ({
        query: row.normalizedQuery,
        count: row._count._all,
      })),
    };
  } catch {
    return getInMemoryAnalyticsSummary();
  }
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
