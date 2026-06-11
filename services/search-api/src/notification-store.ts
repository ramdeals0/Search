import type {
  NotificationDto,
  NotificationListResponseDto,
  NotificationType,
} from "@retailer-search/shared-types";

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

  return updated;
}

export function countUnreadNotifications(recipientActorId?: string): number {
  return listNotifications({ recipientActorId, unreadOnly: true }).total;
}
