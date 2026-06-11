import type {
  AuditLogEntryDto,
  AuditLogFilterDto,
  AuditLogResponseDto,
  AuditOutcome,
  AuditActionType,
  AuditEntityType,
} from "@retailer-search/shared-types";

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

function createAuditLogId(): string {
  const id = `audit-${Date.now()}-${idCounter}`;
  idCounter += 1;
  return id;
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

  auditLogs.push(entry);
  return entry;
}

export function getAuditLogById(id: string): AuditLogEntryDto | undefined {
  return auditLogs.find((entry) => entry.id === id);
}

export function listAuditLogs(
  filters: AuditLogFilterDto = {},
): AuditLogResponseDto {
  let entries = [...auditLogs];

  if (filters.actionType) {
    entries = entries.filter(
      (entry) => entry.actionType === filters.actionType,
    );
  }

  if (filters.entityType) {
    entries = entries.filter(
      (entry) => entry.entityType === filters.entityType,
    );
  }

  if (filters.outcome) {
    entries = entries.filter((entry) => entry.outcome === filters.outcome);
  }

  if (filters.actorId) {
    entries = entries.filter((entry) => entry.actorId === filters.actorId);
  }

  if (filters.keyword) {
    entries = entries.filter((entry) =>
      matchesKeyword(entry, filters.keyword!),
    );
  }

  entries.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const total = entries.length;
  const limited = entries.slice(0, MAX_LIST_ENTRIES);

  return { total, entries: limited };
}
