import type { ApiUsageMeterDto } from "@retailer-search/shared-types";
import { prisma } from "./db.js";

function getMinuteWindowStart(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      0,
      0,
    ),
  );
}

export async function recordApiUsage(input: {
  apiKeyId: string;
  tenantId: string;
  route: string;
}): Promise<void> {
  const windowStart = getMinuteWindowStart();
  await prisma.apiUsageMeter.upsert({
    where: {
      apiKeyId_route_windowStart: {
        apiKeyId: input.apiKeyId,
        route: input.route,
        windowStart,
      },
    },
    create: {
      apiKeyId: input.apiKeyId,
      tenantId: input.tenantId,
      route: input.route,
      windowStart,
      requestCount: 1,
    },
    update: {
      requestCount: { increment: 1 },
    },
  });
}

export async function listApiUsageMeters(
  since?: Date,
): Promise<ApiUsageMeterDto[]> {
  const rows = await prisma.apiUsageMeter.findMany({
    where: since ? { windowStart: { gte: since } } : undefined,
    orderBy: [{ windowStart: "desc" }, { requestCount: "desc" }],
    take: 500,
  });

  return rows.map((row: {
    apiKeyId: string;
    tenantId: string;
    route: string;
    windowStart: Date;
    requestCount: number;
  }) => ({
    apiKeyId: row.apiKeyId,
    tenantId: row.tenantId,
    route: row.route,
    windowStart: row.windowStart.toISOString(),
    requestCount: row.requestCount,
  }));
}

export async function getApiUsageSummary(since?: Date): Promise<{
  totalRequests: number;
  meters: ApiUsageMeterDto[];
}> {
  const meters = await listApiUsageMeters(since);
  const totalRequests = meters.reduce(
    (sum, meter) => sum + meter.requestCount,
    0,
  );
  return { totalRequests, meters };
}
