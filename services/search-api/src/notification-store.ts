import type {
  NotificationDto,
  NotificationListResponseDto,
  NotificationType,
} from "@retailer-search/shared-types";
import { prisma } from "./db.js";

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  relatedApprovalRequestId?: string;
  recipientActorId?: string;
}

const notifications: NotificationDto[] = [];
let notificationIdCounter = 1;

function createNotificationId(): string {
  const id = `notif-${Date.now()}-${notificationIdCounter}`;
  notificationIdCounter += 1;
  return id;
}

function cloneNotification(notification: NotificationDto): NotificationDto {
  return structuredClone(notification);
}

function mapNotificationRowToDto(row: {
  id: string;
  createdAt: Date;
  type: string;
  title: string;
  message: string;
  relatedApprovalRequestId: string | null;
  recipientActorId: string | null;
  read: boolean;
}): NotificationDto {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    type: row.type as NotificationType,
    title: row.title,
    message: row.message,
    relatedApprovalRequestId: row.relatedApprovalRequestId ?? undefined,
    recipientActorId: row.recipientActorId ?? undefined,
    read: row.read,
  };
}

function persistNotification(notification: NotificationDto): void {
  void prisma.notification
    .upsert({
      where: { id: notification.id },
      create: {
        id: notification.id,
        createdAt: new Date(notification.createdAt),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        relatedApprovalRequestId: notification.relatedApprovalRequestId,
        recipientActorId: notification.recipientActorId,
        read: notification.read,
      },
      update: {
        read: notification.read,
        updatedAt: new Date(),
      },
    })
    .catch((error: unknown) => {
      console.error("Failed to persist notification", notification.id, error);
    });
}

export async function hydrateNotificationStore(): Promise<void> {
  notifications.length = 0;
  const rows = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
  });
  for (const row of rows) {
    notifications.push(mapNotificationRowToDto(row));
  }
}

export function notificationExists(
  relatedApprovalRequestId: string,
  type: NotificationType,
  recipientActorId?: string,
): boolean {
  return notifications.some(
    (notification) =>
      notification.relatedApprovalRequestId === relatedApprovalRequestId &&
      notification.type === type &&
      (recipientActorId === undefined ||
        notification.recipientActorId === recipientActorId),
  );
}

export function createNotification(
  input: CreateNotificationInput,
): NotificationDto {
  const notification: NotificationDto = {
    id: createNotificationId(),
    createdAt: new Date().toISOString(),
    type: input.type,
    title: input.title,
    message: input.message,
    relatedApprovalRequestId: input.relatedApprovalRequestId,
    recipientActorId: input.recipientActorId,
    read: false,
  };

  notifications.unshift(notification);
  persistNotification(notification);
  return cloneNotification(notification);
}

export function listNotifications(filters?: {
  recipientActorId?: string;
  unreadOnly?: boolean;
}): NotificationListResponseDto {
  let filtered = [...notifications];

  if (filters?.recipientActorId) {
    filtered = filtered.filter(
      (notification) =>
        notification.recipientActorId === filters.recipientActorId ||
        notification.recipientActorId === undefined,
    );
  }

  if (filters?.unreadOnly) {
    filtered = filtered.filter((notification) => !notification.read);
  }

  return {
    total: filtered.length,
    notifications: filtered.map(cloneNotification),
  };
}

export function markNotificationRead(id: string): NotificationDto | null {
  const notification = notifications.find((entry) => entry.id === id);
  if (!notification) {
    return null;
  }

  notification.read = true;
  persistNotification(notification);
  return cloneNotification(notification);
}

export function markAllNotificationsRead(): number {
  let updated = 0;

  for (const notification of notifications) {
    if (!notification.read) {
      notification.read = true;
      updated += 1;
    }
  }

  if (updated > 0) {
    void prisma.notification
      .updateMany({
        where: { read: false },
        data: { read: true },
      })
      .catch((error: unknown) => {
        console.error("Failed to mark all notifications read", error);
      });
  }

  return updated;
}

export function countUnreadNotifications(recipientActorId?: string): number {
  return listNotifications({ recipientActorId, unreadOnly: true }).total;
}

export function notifyApprovalDelegated(input: {
  approvalRequestId: string;
  fromReviewerId: string;
  toReviewerId: string;
  mode: "delegate" | "reassign";
}): NotificationDto {
  const modeLabel = input.mode === "delegate" ? "delegated backup" : "reassigned owner";
  return createNotification({
    type: "approval_delegated",
    title: "Approval reviewer delegation",
    message: `Reviewer ${input.fromReviewerId} has an active ${modeLabel} to ${input.toReviewerId} for approval ${input.approvalRequestId}.`,
    relatedApprovalRequestId: input.approvalRequestId,
    recipientActorId: input.toReviewerId,
  });
}

export function notifyApprovalReassigned(input: {
  approvalRequestId: string;
  previousReviewerIds: string[];
  nextReviewerIds: string[];
  reason: string;
}): NotificationDto[] {
  const created: NotificationDto[] = [];

  for (const recipientActorId of input.nextReviewerIds) {
    created.push(
      createNotification({
        type: "approval_reassigned",
        title: "Approval reassigned",
        message: `Approval ${input.approvalRequestId} was reassigned to you. Reason: ${input.reason}`,
        relatedApprovalRequestId: input.approvalRequestId,
        recipientActorId,
      }),
    );
  }

  return created;
}

export function notifyApprovalExceptionOpened(input: {
  approvalRequestId: string;
  exceptionId: string;
  summary: string;
  recipientActorId?: string;
}): NotificationDto {
  return createNotification({
    type: "approval_exception_opened",
    title: "Approval exception opened",
    message: input.summary,
    relatedApprovalRequestId: input.approvalRequestId,
    recipientActorId: input.recipientActorId,
  });
}
