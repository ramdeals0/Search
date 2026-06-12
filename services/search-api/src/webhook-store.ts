import { createHmac, randomBytes } from "node:crypto";
import type {
  CreateWebhookEndpointRequestDto,
  EmitWebhookEventDto,
  WebhookDeliveryLogDto,
  WebhookEndpointDto,
  WebhookEventType,
} from "@retailer-search/shared-types";

interface StoredWebhookEndpoint extends WebhookEndpointDto {}

const webhookEndpoints: StoredWebhookEndpoint[] = [];
const webhookDeliveryLogs: WebhookDeliveryLogDto[] = [];

let endpointCounter = 1;
let deliveryCounter = 1;

function createEndpointId(): string {
  const id = `wh_${Date.now()}_${endpointCounter}`;
  endpointCounter += 1;
  return id;
}

function createDeliveryId(): string {
  const id = `whd_${Date.now()}_${deliveryCounter}`;
  deliveryCounter += 1;
  return id;
}

function cloneEndpoint(endpoint: WebhookEndpointDto): WebhookEndpointDto {
  return structuredClone(endpoint);
}

function cloneDelivery(delivery: WebhookDeliveryLogDto): WebhookDeliveryLogDto {
  return structuredClone(delivery);
}

export function maybeSignWebhookPayload(
  payload: string,
  secret?: string,
): string | undefined {
  if (!secret) {
    return undefined;
  }

  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createWebhookEndpoint(
  input: CreateWebhookEndpointRequestDto,
): WebhookEndpointDto {
  const endpoint: StoredWebhookEndpoint = {
    id: createEndpointId(),
    createdAt: new Date().toISOString(),
    name: input.name.trim(),
    url: input.url.trim(),
    active: true,
    subscribedEvents: [...new Set(input.subscribedEvents)],
    secret: input.secret?.trim() || undefined,
  };

  webhookEndpoints.unshift(endpoint);
  return cloneEndpoint(endpoint);
}

export function listWebhookEndpoints(): {
  total: number;
  endpoints: WebhookEndpointDto[];
} {
  return {
    total: webhookEndpoints.length,
    endpoints: webhookEndpoints.map(cloneEndpoint),
  };
}

export function getWebhookEndpointById(id: string): WebhookEndpointDto | null {
  const endpoint = webhookEndpoints.find((entry) => entry.id === id);
  return endpoint ? cloneEndpoint(endpoint) : null;
}

export function setWebhookEndpointActive(
  id: string,
  active: boolean,
): WebhookEndpointDto | null {
  const endpoint = webhookEndpoints.find((entry) => entry.id === id);
  if (!endpoint) {
    return null;
  }

  endpoint.active = active;
  return cloneEndpoint(endpoint);
}

export function listWebhookDeliveryLogs(): {
  total: number;
  deliveries: WebhookDeliveryLogDto[];
} {
  return {
    total: webhookDeliveryLogs.length,
    deliveries: webhookDeliveryLogs.map(cloneDelivery),
  };
}

export async function deliverWebhook(
  endpoint: WebhookEndpointDto,
  event: EmitWebhookEventDto,
  attemptNumber = 1,
): Promise<WebhookDeliveryLogDto> {
  const eventId = `evt_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const body = {
    id: eventId,
    type: event.type,
    occurredAt: new Date().toISOString(),
    payload: event.payload,
  };
  const serializedBody = JSON.stringify(body);
  const signature = maybeSignWebhookPayload(serializedBody, endpoint.secret);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "retailer-search-platform-webhook/1.0",
  };

  if (signature) {
    headers["x-platform-signature"] = signature;
  }

  const delivery: WebhookDeliveryLogDto = {
    id: createDeliveryId(),
    createdAt: new Date().toISOString(),
    endpointId: endpoint.id,
    eventType: event.type,
    status: "failed",
    attemptNumber,
  };

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers,
      body: serializedBody,
    });

    delivery.responseStatusCode = response.status;

    if (!response.ok) {
      delivery.errorMessage = `HTTP ${response.status}`;
    } else {
      delivery.status = "succeeded";
    }
  } catch (error) {
    delivery.errorMessage =
      error instanceof Error ? error.message : "Webhook delivery failed";
  }

  const storedEndpoint = webhookEndpoints.find((entry) => entry.id === endpoint.id);
  if (storedEndpoint) {
    storedEndpoint.lastDeliveryAt = delivery.createdAt;
    storedEndpoint.lastDeliveryStatus = delivery.status;
  }

  webhookDeliveryLogs.unshift(delivery);
  return cloneDelivery(delivery);
}

export async function emitWebhookEvent(
  event: EmitWebhookEventDto,
): Promise<WebhookDeliveryLogDto[]> {
  const deliveries: WebhookDeliveryLogDto[] = [];

  for (const endpoint of webhookEndpoints) {
    if (!endpoint.active) {
      continue;
    }

    if (!endpoint.subscribedEvents.includes(event.type)) {
      continue;
    }

    const delivery = await deliverWebhook(endpoint, event);
    deliveries.push(delivery);
  }

  return deliveries;
}

export function getDefaultTestPayload(
  eventType: WebhookEventType,
): Record<string, unknown> {
  switch (eventType) {
    case "auth.login.succeeded":
      return { email: "admin@example.com", userId: "user-demo" };
    case "auth.login.failed":
      return { email: "unknown@example.com", reason: "invalid_credentials" };
    case "rbac.access.denied":
      return { email: "reviewer@example.com", path: "/api/v1/admin/jit-policy" };
    case "approval.created":
      return { approvalRequestId: "apr_demo", snapshotName: "staging-release" };
    case "approval.approved":
      return { approvalRequestId: "apr_demo", approverEmail: "approver@example.com" };
    case "approval.rejected":
      return { approvalRequestId: "apr_demo", reason: "insufficient evidence" };
    case "promotion.executed":
      return { snapshotId: "snap_demo", environment: "live" };
    case "jit.request.approved":
      return { requestId: "jit_demo", requestedRole: "release_manager" };
    case "jit.request.revoked":
      return { requestId: "jit_demo", requesterEmail: "merchandiser@example.com" };
    case "audit.review.completed":
      return { reviewRunId: "review_demo", totalUsers: 5 };
    default:
      return { message: "test event" };
  }
}
