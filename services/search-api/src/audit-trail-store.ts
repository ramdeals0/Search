import { createHash } from "node:crypto";
import type {
  AuditActionType,
  AuditEntityType,
  AuditLogEntryDto,
  AuditLogFilterDto,
  AuditLogResponseDto,
  AuditOutcome,
} from "@retailer-search/shared-types";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

export const DEFAULT_AUDIT_ACTOR = {
  actorId: "local-admin",
  actorLabel: "Local Admin",
} as const;

export type RecordAuditLogInput = {
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId?: string;
  entityLabel?: string;
  outcome: AuditOutcome;
  summary: string;
  metadata?: Record<string, unknown>;
  actorId?: string;
  actorLabel?: string;
};

const auditLogs: AuditLogEntryDto[] = [];
const MAX_LIST_ENTRIES = 100;
let idCounter = 1;
let lastHashChain: string | null = null;

function createAuditLogId(): string {
  const id = `audit-${Date.now()}-${idCounter}`;
  idCounter += 1;
  return id;
}

function computeHashChain(entry: AuditLogEntryDto, previousHash: string | null): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        previousHash,
        id: entry.id,
        timestamp: entry.timestamp,
        actorId: entry.actorId,
        actionType: entry.actionType,
        summary: entry.summary,
        outcome: entry.outcome,
      }),
    )
    .digest("hex");
}

function mapRowToDto(row: {
  id: string;
  timestamp: Date;
  actorId: string;
  actorLabel: string;
  actionType: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  outcome: string;
  summary: string;
  metadata: unknown;
}): AuditLogEntryDto {
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    actorId: row.actorId,
    actorLabel: row.actorLabel,
    actionType: row.actionType as AuditActionType,
    entityType: row.entityType as AuditEntityType,
    entityId: row.entityId ?? undefined,
    entityLabel: row.entityLabel ?? undefined,
    outcome: row.outcome as AuditOutcome,
    summary: row.summary,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
  };
}

function persistAuditEntry(entry: AuditLogEntryDto, hashChainPrev: string | null): void {
  void prisma.auditTrailEntry
    .create({
      data: {
        id: entry.id,
        timestamp: new Date(entry.timestamp),
        actorId: entry.actorId,
        actorLabel: entry.actorLabel,
        actionType: entry.actionType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityLabel: entry.entityLabel,
        outcome: entry.outcome,
        summary: entry.summary,
        metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        hashChainPrev,
      },
    })
    .catch((error: unknown) => {
      console.error("Failed to persist audit entry", entry.id, error);
    });
}

function matchesKeyword(entry: AuditLogEntryDto, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const haystack = [
    entry.summary,
    entry.entityLabel ?? "",
    entry.entityId ?? "",
    entry.metadata ? JSON.stringify(entry.metadata) : "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export async function hydrateAuditTrailStore(): Promise<void> {
  auditLogs.length = 0;
  const rows = await prisma.auditTrailEntry.findMany({
    orderBy: { timestamp: "asc" },
  });

  lastHashChain = null;
  for (const row of rows) {
    const entry = mapRowToDto(row);
    auditLogs.push(entry);
    lastHashChain = row.hashChainPrev
      ? computeHashChain(entry, row.hashChainPrev)
      : computeHashChain(entry, null);
  }
}

export function recordAuditLog(input: RecordAuditLogInput): AuditLogEntryDto {
  const entry: AuditLogEntryDto = {
    id: createAuditLogId(),
    timestamp: new Date().toISOString(),
    actorId: input.actorId ?? DEFAULT_AUDIT_ACTOR.actorId,
    actorLabel: input.actorLabel ?? DEFAULT_AUDIT_ACTOR.actorLabel,
    actionType: input.actionType,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    outcome: input.outcome,
    summary: input.summary,
    metadata: input.metadata,
  };

  const hashChainPrev = lastHashChain;
  lastHashChain = computeHashChain(entry, hashChainPrev);
  auditLogs.push(entry);
  persistAuditEntry(entry, hashChainPrev);
  return entry;
}

export function getAuditLogById(id: string): AuditLogEntryDto | undefined {
  return auditLogs.find((entry) => entry.id === id);
}

export function listAuditLogs(filters: AuditLogFilterDto = {}): AuditLogResponseDto {
  let entries = [...auditLogs];

  if (filters.actionType) {
    entries = entries.filter((entry) => entry.actionType === filters.actionType);
  }

  if (filters.entityType) {
    entries = entries.filter((entry) => entry.entityType === filters.entityType);
  }

  if (filters.outcome) {
    entries = entries.filter((entry) => entry.outcome === filters.outcome);
  }

  if (filters.actorId) {
    entries = entries.filter((entry) => entry.actorId === filters.actorId);
  }

  if (filters.keyword) {
    entries = entries.filter((entry) => matchesKeyword(entry, filters.keyword!));
  }

  entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return {
    total: entries.length,
    entries: entries.slice(0, MAX_LIST_ENTRIES),
  };
}

export async function exportAllAuditLogs(
  filters: AuditLogFilterDto = {},
  limit = 10_000,
): Promise<AuditLogEntryDto[]> {
  const rows = await prisma.auditTrailEntry.findMany({
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  let entries = rows.map(mapRowToDto);

  if (filters.actionType) {
    entries = entries.filter((entry) => entry.actionType === filters.actionType);
  }
  if (filters.entityType) {
    entries = entries.filter((entry) => entry.entityType === filters.entityType);
  }
  if (filters.outcome) {
    entries = entries.filter((entry) => entry.outcome === filters.outcome);
  }
  if (filters.actorId) {
    entries = entries.filter((entry) => entry.actorId === filters.actorId);
  }
  if (filters.keyword) {
    entries = entries.filter((entry) => matchesKeyword(entry, filters.keyword!));
  }

  return entries;
}

export async function verifyAuditHashChain(): Promise<{
  valid: boolean;
  entryCount: number;
  brokenAtEntryId?: string;
}> {
  const rows = await prisma.auditTrailEntry.findMany({
    orderBy: { timestamp: "asc" },
  });

  let previousHash: string | null = null;
  for (const row of rows) {
    const entry = mapRowToDto(row);
    const expectedPrev = row.hashChainPrev ?? null;
    if (expectedPrev !== previousHash) {
      return {
        valid: false,
        entryCount: rows.length,
        brokenAtEntryId: entry.id,
      };
    }

    previousHash = computeHashChain(entry, previousHash);
  }

  return {
    valid: true,
    entryCount: rows.length,
  };
}

export function registerSeededAuditEntry(entry: AuditLogEntryDto): void {
  auditLogs.unshift(entry);
}

export function auditEntryCount(): number {
  return auditLogs.length;
}

export function recordRateLimitExceeded(input: {
  summary: string;
  path: string;
  method: string;
  policyName: string;
  actorId?: string;
  actorLabel?: string;
  metadata?: Record<string, unknown>;
}): AuditLogEntryDto {
  return recordAuditLog({
    actionType: "authorization_denied",
    entityType: "user",
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    outcome: "failure",
    summary: input.summary,
    metadata: {
      reason: "rate_limited",
      policyName: input.policyName,
      path: input.path,
      method: input.method,
      ...input.metadata,
    },
  });
}

export function recordUnauthorizedAccess(input: {
  summary: string;
  path: string;
  method: string;
  metadata?: Record<string, unknown>;
}): AuditLogEntryDto {
  return recordAuditLog({
    actionType: "authorization_denied",
    entityType: "user",
    outcome: "failure",
    summary: input.summary,
    metadata: {
      reason: "unauthenticated",
      path: input.path,
      method: input.method,
      ...input.metadata,
    },
  });
}

export function recordForbiddenAccess(input: {
  summary: string;
  path: string;
  method: string;
  actorId?: string;
  actorLabel?: string;
  metadata?: Record<string, unknown>;
}): AuditLogEntryDto {
  return recordAuditLog({
    actionType: "authorization_denied",
    entityType: "user",
    entityId: input.actorId,
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    outcome: "failure",
    summary: input.summary,
    metadata: {
      reason: "forbidden",
      path: input.path,
      method: input.method,
      ...input.metadata,
    },
  });
}

export function recordValidationFailure(input: {
  summary: string;
  path: string;
  method: string;
  actorId?: string;
  actorLabel?: string;
  metadata?: Record<string, unknown>;
}): AuditLogEntryDto {
  return recordAuditLog({
    actionType: "authorization_denied",
    entityType: "user",
    entityId: input.actorId,
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    outcome: "failure",
    summary: input.summary,
    metadata: {
      reason: "validation_error",
      path: input.path,
      method: input.method,
      ...input.metadata,
    },
  });
}

export function recordBootstrapAudit(input: {
  actionType:
    | "bootstrap_admin_created"
    | "bootstrap_security_configured"
    | "bootstrap_platform_configured"
    | "bootstrap_completed";
  summary: string;
  actorId?: string;
  actorLabel?: string;
  metadata?: Record<string, unknown>;
}): AuditLogEntryDto {
  return recordAuditLog({
    actionType: input.actionType,
    entityType: "bootstrap",
    entityId: "default",
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    outcome: "success",
    summary: input.summary,
    metadata: input.metadata,
  });
}
