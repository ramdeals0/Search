import type {
  CreateScheduledReleaseRequestDto,
  ScheduledReleaseDto,
  ScheduledReleaseStatus,
} from "@retailer-search/shared-types";
import { prisma } from "./db.js";

function toDto(row: {
  id: string;
  type: string;
  status: string;
  snapshotId: string;
  reason: string;
  scheduledAt: Date;
  executedAt: Date | null;
  linkedExperimentId: string | null;
  approvalRequestId: string | null;
  errorMessage: string | null;
  createdByUserId: string | null;
  createdByEmail: string | null;
  createdAt: Date;
}): ScheduledReleaseDto {
  return {
    id: row.id,
    type: row.type as ScheduledReleaseDto["type"],
    status: row.status as ScheduledReleaseStatus,
    snapshotId: row.snapshotId,
    reason: row.reason,
    scheduledAt: row.scheduledAt.toISOString(),
    executedAt: row.executedAt?.toISOString(),
    linkedExperimentId: row.linkedExperimentId ?? undefined,
    approvalRequestId: row.approvalRequestId ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    createdByUserId: row.createdByUserId ?? undefined,
    createdByEmail: row.createdByEmail ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createScheduledRelease(
  input: CreateScheduledReleaseRequestDto,
  actor?: { userId: string; email: string },
): Promise<ScheduledReleaseDto> {
  const row = await prisma.scheduledRelease.create({
    data: {
      type: input.type,
      snapshotId: input.snapshotId.trim(),
      reason: input.reason.trim(),
      scheduledAt: new Date(input.scheduledAt),
      linkedExperimentId: input.linkedExperimentId,
      approvalRequestId: input.approvalRequestId,
      createdByUserId: actor?.userId,
      createdByEmail: actor?.email,
    },
  });
  return toDto(row);
}

export async function listScheduledReleases(): Promise<ScheduledReleaseDto[]> {
  const rows = await prisma.scheduledRelease.findMany({
    orderBy: { scheduledAt: "asc" },
  });
  return rows.map(toDto);
}

export async function listDueScheduledReleases(
  now: Date = new Date(),
): Promise<ScheduledReleaseDto[]> {
  const rows = await prisma.scheduledRelease.findMany({
    where: {
      status: "pending",
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
  });
  return rows.map(toDto);
}

export async function cancelScheduledRelease(
  id: string,
): Promise<ScheduledReleaseDto | null> {
  try {
    const row = await prisma.scheduledRelease.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return toDto(row);
  } catch {
    return null;
  }
}

export async function markScheduledReleaseExecuted(
  id: string,
): Promise<ScheduledReleaseDto | null> {
  try {
    const row = await prisma.scheduledRelease.update({
      where: { id },
      data: {
        status: "executed",
        executedAt: new Date(),
      },
    });
    return toDto(row);
  } catch {
    return null;
  }
}

export async function markScheduledReleaseFailed(
  id: string,
  errorMessage: string,
): Promise<ScheduledReleaseDto | null> {
  try {
    const row = await prisma.scheduledRelease.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage,
      },
    });
    return toDto(row);
  } catch {
    return null;
  }
}
