import type {
  RecordCommerceEventRequestDto,
  RevenueMetricsDto,
} from "@retailer-search/shared-types";
import { prisma } from "./db.js";
const prismaClient = prisma as any;

export interface RecordCommerceEventOptions {
  sessionId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

const inMemoryEvents: Array<{
  type: RecordCommerceEventRequestDto["type"];
  sessionId?: string;
  query?: string;
  amountCents?: number;
  createdAt: string;
}> = [];

let persistenceEnabled = false;

export async function hydrateCommerceEventStore(): Promise<void> {
  try {
    await prismaClient.commerceEvent.count();
    persistenceEnabled = true;
  } catch {
    persistenceEnabled = false;
  }
}

export async function recordCommerceEvent(
  event: RecordCommerceEventRequestDto,
  options: RecordCommerceEventOptions = {},
): Promise<void> {
  const storedAt = new Date().toISOString();
  inMemoryEvents.push({
    type: event.type,
    sessionId: options.sessionId,
    query: event.query,
    amountCents: event.amountCents,
    createdAt: storedAt,
  });

  if (persistenceEnabled) {
    try {
      await prismaClient.commerceEvent.create({
        data: {
          type: event.type,
          sessionId: options.sessionId,
          tenantId: options.tenantId ?? "default",
          query: event.query,
          productId: event.productId,
          amountCents: event.amountCents,
          metadata: options.metadata,
        },
      });
    } catch {
      // Keep in-memory fallback behavior.
    }
  }
}

function windowStart(windowDays: number): Date {
  const days = Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getRevenueMetrics(windowDays = 30): Promise<RevenueMetricsDto> {
  const start = windowStart(windowDays);

  if (persistenceEnabled) {
    try {
      const [purchases, addToCarts, searches] = await Promise.all([
        prismaClient.commerceEvent.aggregate({
          where: { type: "purchase", createdAt: { gte: start } },
          _count: { _all: true },
          _sum: { amountCents: true },
        }),
        prismaClient.commerceEvent.count({
          where: { type: "add_to_cart", createdAt: { gte: start } },
        }),
        prisma.searchEvent.count({
          where: { createdAt: { gte: start } },
        }),
      ]);

      const revenueCents = purchases._sum.amountCents ?? 0;
      const purchaseCount = purchases._count._all;
      const searchesInWindow = searches;

      return {
        windowDays,
        purchaseCount,
        addToCartCount: addToCarts,
        revenueCents,
        revenuePerSearch:
          searchesInWindow > 0 ? revenueCents / searchesInWindow : 0,
        searchesInWindow,
      };
    } catch {
      // Fall back to in-memory events.
    }
  }

  const inWindow = inMemoryEvents.filter(
    (event) => new Date(event.createdAt) >= start,
  );
  const purchaseCount = inWindow.filter((event) => event.type === "purchase").length;
  const addToCartCount = inWindow.filter(
    (event) => event.type === "add_to_cart",
  ).length;
  const revenueCents = inWindow
    .filter((event) => event.type === "purchase")
    .reduce((sum, event) => sum + (event.amountCents ?? 0), 0);

  return {
    windowDays,
    purchaseCount,
    addToCartCount,
    revenueCents,
    revenuePerSearch: 0,
    searchesInWindow: 0,
  };
}
