import type {
  AuditActionType,
  AuditLogEntryDto,
  AuditLogFilterDto,
  CreateExportJobRequestDto,
  ExportFormat,
  ExportJobDto,
  ExportTargetType,
  SecurityTimelineEntryDto,
  UserDto,
} from "@retailer-search/shared-types";
import type { Prisma } from "@prisma/client";
import { listAccessReviewRuns } from "./access-governance/index.js";
import { listApprovalRequests } from "./approval-store.js";
import { listPromotionHistory } from "./active-config-store.js";
import { getApiUsageSummary } from "./usage-meter-store.js";
import { listAuditLogs, exportAllAuditLogs, verifyAuditHashChain } from "./audit-trail-store.js";
import { prisma } from "./db.js";

const SECURITY_AUDIT_ACTION_TYPES: AuditActionType[] = [
  "user_login",
  "user_logout",
  "authorization_denied",
  "create_access_request",
  "resolve_access_request",
  "create_access_review",
  "complete_access_review",
  "resolve_access_review_item",
  "update_user_role",
  "disable_user",
  "create_jit_elevation_request",
  "resolve_jit_elevation_request",
  "expire_jit_elevation",
  "revoke_jit_elevation",
  "create_approval_request",
  "resolve_approval_request",
  "execute_approval_request",
  "promote_snapshot",
  "promote_environment",
  "webhook_delivery",
  "create_export_job",
];

const exportJobs: ExportJobDto[] = [];
let exportJobCounter = 1;

function mapExportJobRowToDto(row: {
  id: string;
  createdAt: Date;
  createdByUserId: string;
  createdByName: string;
  targetType: ExportTargetType;
  format: ExportFormat;
  status: ExportJobDto["status"];
  filters: unknown;
  fileName: string | null;
  recordCount: number | null;
  errorMessage: string | null;
}): ExportJobDto {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    createdByUserId: row.createdByUserId,
    createdByName: row.createdByName,
    targetType: row.targetType,
    format: row.format,
    status: row.status,
    filters: (row.filters as Record<string, unknown> | null) ?? undefined,
    fileName: row.fileName ?? undefined,
    recordCount: row.recordCount ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
  };
}

function persistExportJob(job: ExportJobDto): void {
  void prisma.exportJob
    .upsert({
      where: { id: job.id },
      create: {
        id: job.id,
        createdAt: new Date(job.createdAt),
        createdByUserId: job.createdByUserId,
        createdByName: job.createdByName,
        targetType: job.targetType,
        format: job.format,
        status: job.status,
        filters: (job.filters ?? undefined) as Prisma.InputJsonValue | undefined,
        fileName: job.fileName,
        recordCount: job.recordCount,
        errorMessage: job.errorMessage,
      },
      update: {
        status: job.status,
        recordCount: job.recordCount,
        errorMessage: job.errorMessage,
        updatedAt: new Date(),
      },
    })
    .catch((error: unknown) => {
      console.error("Failed to persist export job", job.id, error);
    });
}

export async function hydrateExportStore(): Promise<void> {
  exportJobs.length = 0;
  const rows = await prisma.exportJob.findMany({
    orderBy: { createdAt: "desc" },
  });
  for (const row of rows) {
    exportJobs.push(mapExportJobRowToDto(row));
  }
}

function createExportJobId(): string {
  const id = `export_${Date.now()}_${exportJobCounter}`;
  exportJobCounter += 1;
  return id;
}

function cloneJob(job: ExportJobDto): ExportJobDto {
  return structuredClone(job);
}

function formatTimestampForFileName(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function buildFileName(targetType: ExportTargetType, format: ExportFormat): string {
  const stamp = formatTimestampForFileName();
  return `${targetType.replace(/_/g, "-")}-${stamp}.${format}`;
}

function escapeCsvValue(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function generateCsvFromRecords(
  records: Record<string, unknown>[],
): string {
  if (records.length === 0) {
    return "";
  }

  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))];
  const header = columns.map(escapeCsvValue).join(",");
  const rows = records.map((record) =>
    columns.map((column) => escapeCsvValue(record[column])).join(","),
  );

  return [header, ...rows].join("\n");
}

function flattenRecord(record: Record<string, unknown>): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) {
      flattened[key] = value;
    } else if (typeof value === "object" && !Array.isArray(value)) {
      flattened[key] = JSON.stringify(value);
    } else {
      flattened[key] = value;
    }
  }

  return flattened;
}

function mapAuditEntryToSecurityTimeline(
  entry: AuditLogEntryDto,
): SecurityTimelineEntryDto {
  const severity =
    entry.outcome === "failure" ||
    entry.actionType === "authorization_denied" ||
    entry.actionType === "disable_user"
      ? "critical"
      : entry.actionType.includes("review") ||
          entry.actionType.includes("jit") ||
          entry.actionType.includes("access")
        ? "warning"
        : "info";

  const category = entry.actionType.includes("approval")
    ? "approval"
    : entry.actionType.includes("jit")
      ? "jit_access"
      : entry.actionType.includes("access")
        ? "access_governance"
        : entry.actionType.includes("login") ||
            entry.actionType === "authorization_denied"
          ? "authentication"
          : entry.actionType.includes("promote") ||
              entry.actionType.includes("execute")
            ? "release"
            : "security";

  return {
    id: entry.id,
    occurredAt: entry.timestamp,
    category,
    severity,
    summary: entry.summary,
    actorLabel: entry.actorLabel,
    entityType: entry.entityType,
    entityId: entry.entityId,
    actionType: entry.actionType,
    outcome: entry.outcome,
  };
}

function buildAuditReviewFindingRecords(
  filters: Record<string, unknown> = {},
): Record<string, unknown>[] {
  const reviewStatus =
    typeof filters.reviewStatus === "string" ? filters.reviewStatus : undefined;

  return listAccessReviewRuns()
    .runs.flatMap((run) =>
      run.items
        .filter((item) => {
          if (reviewStatus && run.status !== reviewStatus) {
            return false;
          }

          return (
            item.recommendedAction !== "keep" ||
            Boolean(item.note?.trim()) ||
            !item.active
          );
        })
        .map((item) => ({
          reviewRunId: run.id,
          reviewRunStatus: run.status,
          reviewCreatedAt: run.createdAt,
          reviewCompletedAt: run.completedAt,
          userId: item.userId,
          userEmail: item.userEmail,
          userName: item.userName,
          currentRole: item.currentRole,
          active: item.active,
          lastLoginAt: item.lastLoginAt,
          recommendedAction: item.recommendedAction,
          note: item.note,
        })),
    );
}

export async function generateExportData(
  targetType: ExportTargetType,
  format: ExportFormat,
  filters: Record<string, unknown> = {},
): Promise<{
  content: string;
  recordCount: number;
  mimeType: string;
}> {
  let records: Record<string, unknown>[] = [];

  if (targetType === "audit_trail") {
    const auditFilters: AuditLogFilterDto = {};
    if (typeof filters.actionType === "string") {
      auditFilters.actionType = filters.actionType;
    }
    if (typeof filters.entityType === "string") {
      auditFilters.entityType = filters.entityType;
    }
    if (typeof filters.outcome === "string") {
      auditFilters.outcome = filters.outcome;
    }
    if (typeof filters.keyword === "string") {
      auditFilters.keyword = filters.keyword;
    }
    if (typeof filters.category === "string") {
      auditFilters.keyword = filters.category;
    }
    if (typeof filters.severity === "string") {
      auditFilters.outcome =
        filters.severity === "critical" ? "failure" : undefined;
    }

    records = listAuditLogs(auditFilters).entries.map((entry) =>
      flattenRecord({
        id: entry.id,
        timestamp: entry.timestamp,
        actorId: entry.actorId,
        actorLabel: entry.actorLabel,
        actionType: entry.actionType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityLabel: entry.entityLabel,
        outcome: entry.outcome,
        summary: entry.summary,
        metadata: entry.metadata,
      }),
    );
  } else if (targetType === "approvals") {
    records = listApprovalRequests()
      .requests.filter((request) => {
        if (typeof filters.status === "string" && request.status !== filters.status) {
          return false;
        }
        return true;
      })
      .map((request) =>
        flattenRecord({
          id: request.id,
          status: request.status,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
          snapshotId: request.snapshotId,
          snapshotName: request.snapshotName,
          requestedByActorId: request.requestedBy.actorId,
          requestedByActorLabel: request.requestedBy.actorLabel,
          approvedByActorLabel: request.approvedBy?.actorLabel,
          rejectedByActorLabel: request.rejectedBy?.actorLabel,
          assignedReviewerIds: request.assignedReviewerIds,
          reason: request.reason,
          decisionNote: request.decisionNote,
          executedByActorLabel: request.executedBy?.actorLabel,
        }),
      );
  } else if (targetType === "access_reviews") {
    records = listAccessReviewRuns().runs.map((run) =>
      flattenRecord({
        id: run.id,
        status: run.status,
        createdAt: run.createdAt,
        createdByName: run.createdByName,
        completedAt: run.completedAt,
        scopeRoles: run.scope.roles,
        totalUsers: run.items.length,
        summary: run.summary,
      }),
    );
  } else if (targetType === "security_timeline") {
    const auditEntries = listAuditLogs().entries.filter((entry) =>
      SECURITY_AUDIT_ACTION_TYPES.includes(entry.actionType),
    );

    records = auditEntries
      .map((entry) => mapAuditEntryToSecurityTimeline(entry))
      .filter((entry) => {
        if (
          typeof filters.category === "string" &&
          entry.category !== filters.category
        ) {
          return false;
        }
        if (
          typeof filters.severity === "string" &&
          entry.severity !== filters.severity
        ) {
          return false;
        }
        return true;
      })
      .map((entry) => flattenRecord({ ...entry }));
  } else if (targetType === "audit_review_findings") {
    records = buildAuditReviewFindingRecords(filters).map(flattenRecord);
  } else if (targetType === "audit_hash_chain_report") {
    const report = await verifyAuditHashChain();
    records = [
      flattenRecord({
        ...report,
        verifiedAt: new Date().toISOString(),
      }),
    ];
  } else if (targetType === "api_usage_meters") {
    const summary = await getApiUsageSummary();
    records = summary.meters.map((meter) => flattenRecord({ ...meter }));
  } else if (targetType === "soc2_audit_package") {
    const [auditEntries, chainReport, approvals, promotions, accessReviews] =
      await Promise.all([
        exportAllAuditLogs({}, 5000),
        verifyAuditHashChain(),
        Promise.resolve(listApprovalRequests().requests),
        Promise.resolve(listPromotionHistory().entries),
        Promise.resolve(listAccessReviewRuns().runs),
      ]);

    if (format === "json") {
      const packageBody = {
        exportedAt: new Date().toISOString(),
        targetType,
        hashChain: {
          ...chainReport,
          verifiedAt: new Date().toISOString(),
        },
        auditTrail: auditEntries,
        approvals,
        promotionHistory: promotions,
        accessReviews,
      };
      return {
        content: JSON.stringify(packageBody, null, 2),
        recordCount:
          auditEntries.length +
          approvals.length +
          promotions.length +
          accessReviews.length,
        mimeType: "application/json",
      };
    }

    records = auditEntries.map((entry) =>
      flattenRecord({
        section: "audit_trail",
        id: entry.id,
        timestamp: entry.timestamp,
        actionType: entry.actionType,
        summary: entry.summary,
        outcome: entry.outcome,
      }),
    );
  }

  if (format === "json") {
    return {
      content: JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          targetType,
          recordCount: records.length,
          records,
        },
        null,
        2,
      ),
      recordCount: records.length,
      mimeType: "application/json",
    };
  }

  return {
    content: generateCsvFromRecords(records),
    recordCount: records.length,
    mimeType: "text/csv",
  };
}

export async function createExportJob(
  input: CreateExportJobRequestDto,
  actor: UserDto,
): Promise<ExportJobDto> {
  const timestamp = new Date().toISOString();
  const job: ExportJobDto = {
    id: createExportJobId(),
    createdAt: timestamp,
    createdByUserId: actor.id,
    createdByName: actor.name,
    targetType: input.targetType,
    format: input.format,
    status: "failed",
    filters: input.filters,
    fileName: buildFileName(input.targetType, input.format),
  };

  try {
    const generated = await generateExportData(
      input.targetType,
      input.format,
      input.filters ?? {},
    );
    job.status = "generated";
    job.recordCount = generated.recordCount;
  } catch (error) {
    job.errorMessage =
      error instanceof Error ? error.message : "Failed to generate export";
  }

  exportJobs.unshift(job);
  persistExportJob(job);
  return cloneJob(job);
}

export function listExportJobs(): { total: number; jobs: ExportJobDto[] } {
  return {
    total: exportJobs.length,
    jobs: exportJobs.map(cloneJob),
  };
}

export function getExportJobById(id: string): ExportJobDto | null {
  const job = exportJobs.find((entry) => entry.id === id);
  return job ? cloneJob(job) : null;
}

export function buildSecurityTimelineEntries(
  filters: Record<string, unknown> = {},
): SecurityTimelineEntryDto[] {
  const auditEntries = listAuditLogs({
    keyword: typeof filters.category === "string" ? filters.category : undefined,
  }).entries;

  return auditEntries
    .map((entry) => mapAuditEntryToSecurityTimeline(entry))
    .filter((entry) => {
      if (
        typeof filters.category === "string" &&
        entry.category !== filters.category
      ) {
        return false;
      }
      if (
        typeof filters.severity === "string" &&
        entry.severity !== filters.severity
      ) {
        return false;
      }
      return true;
    });
}

export { SECURITY_AUDIT_ACTION_TYPES };
