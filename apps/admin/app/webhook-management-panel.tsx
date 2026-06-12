"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CreateWebhookEndpointRequestDto,
  TestWebhookFireRequestDto,
  WebhookDeliveryLogDto,
  WebhookDeliveryLogListResponseDto,
  WebhookEndpointDto,
  WebhookEndpointListResponseDto,
  WebhookEventType,
} from "@retailer-search/shared-types";
import {
  AUTH_TOKEN_STORAGE_KEY,
  ACCESS_GOVERNANCE_CHANGED_EVENT,
} from "./access-request-panel";
import { INTEGRATIONS_CHANGED_EVENT } from "./export-center-panel";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

const EVENT_OPTIONS: WebhookEventType[] = [
  "auth.login.succeeded",
  "auth.login.failed",
  "rbac.access.denied",
  "approval.created",
  "approval.approved",
  "approval.rejected",
  "promotion.executed",
  "jit.request.approved",
  "jit.request.revoked",
  "audit.review.completed",
];

const panelStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "1rem",
  background: "#fff",
} as const;

const inputStyle = {
  padding: "0.45rem 0.6rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  width: "100%",
} as const;

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
      : null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function WebhookManagementPanel() {
  const [endpoints, setEndpoints] = useState<WebhookEndpointDto[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryLogDto[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [subscribedEvents, setSubscribedEvents] = useState<WebhookEventType[]>([
    "approval.approved",
  ]);
  const [testEventType, setTestEventType] =
    useState<WebhookEventType>("approval.approved");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadPanelData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [endpointsRes, deliveriesRes] = await Promise.all([
        fetch(`${SEARCH_API_URL}/api/v1/admin/webhooks`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
        fetch(`${SEARCH_API_URL}/api/v1/admin/webhook-deliveries`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
      ]);

      if (!endpointsRes.ok || !deliveriesRes.ok) {
        throw new Error("Failed to load webhook data");
      }

      const endpointsBody =
        (await endpointsRes.json()) as WebhookEndpointListResponseDto;
      const deliveriesBody =
        (await deliveriesRes.json()) as WebhookDeliveryLogListResponseDto;

      setEndpoints(endpointsBody.endpoints);
      setDeliveries(deliveriesBody.deliveries.slice(0, 20));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load webhooks",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPanelData();
  }, [loadPanelData]);

  useEffect(() => {
    const handler = () => {
      void loadPanelData();
    };
    window.addEventListener(INTEGRATIONS_CHANGED_EVENT, handler);
    window.addEventListener(ACCESS_GOVERNANCE_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(INTEGRATIONS_CHANGED_EVENT, handler);
      window.removeEventListener(ACCESS_GOVERNANCE_CHANGED_EVENT, handler);
    };
  }, [loadPanelData]);

  const toggleEvent = (eventType: WebhookEventType) => {
    setSubscribedEvents((current) =>
      current.includes(eventType)
        ? current.filter((entry) => entry !== eventType)
        : [...current, eventType],
    );
  };

  const createEndpoint = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setFeedback(null);

    const payload: CreateWebhookEndpointRequestDto = {
      name: name.trim(),
      url: url.trim(),
      subscribedEvents,
      secret: secret.trim() || undefined,
    };

    try {
      const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/webhooks`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Create webhook failed with HTTP ${response.status}`);
      }

      setName("");
      setUrl("");
      setSecret("");
      setFeedback("Webhook endpoint created.");
      window.dispatchEvent(new CustomEvent(INTEGRATIONS_CHANGED_EVENT));
      await loadPanelData();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Failed to create webhook",
      );
    } finally {
      setCreating(false);
    }
  };

  const toggleEndpoint = async (endpointId: string, active: boolean) => {
    setActingOnId(endpointId);
    setError(null);

    try {
      const response = await fetch(
        `${SEARCH_API_URL}/api/v1/admin/webhooks/${endpointId}/toggle`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ active }),
        },
      );

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Toggle failed with HTTP ${response.status}`);
      }

      window.dispatchEvent(new CustomEvent(INTEGRATIONS_CHANGED_EVENT));
      await loadPanelData();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : "Failed to toggle webhook",
      );
    } finally {
      setActingOnId(null);
    }
  };

  const testFire = async () => {
    setTesting(true);
    setError(null);
    setFeedback(null);

    const payload: TestWebhookFireRequestDto = {
      eventType: testEventType,
    };

    try {
      const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/webhooks/test-fire`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Test fire failed with HTTP ${response.status}`);
      }

      setFeedback(`Test event ${testEventType} dispatched.`);
      window.dispatchEvent(new CustomEvent(INTEGRATIONS_CHANGED_EVENT));
      await loadPanelData();
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Failed to test webhook");
    } finally {
      setTesting(false);
    }
  };

  return (
    <section id="webhook-management" style={panelStyle}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Webhook Integrations</h2>
      <p style={{ marginTop: 0, color: "#475569", fontSize: 13 }}>
        Subscribe outbound webhooks to important governance and release events. Admin
        only.
      </p>

      {loading ? <p style={{ fontSize: 13 }}>Loading webhooks…</p> : null}
      {error ? (
        <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</p>
      ) : null}
      {feedback ? (
        <p style={{ color: "#047857", fontSize: 13, marginBottom: 12 }}>{feedback}</p>
      ) : null}

      <form
        onSubmit={createEndpoint}
        style={{
          display: "grid",
          gap: 10,
          marginBottom: 16,
          paddingBottom: 16,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>Create webhook endpoint</div>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} style={inputStyle} required />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          URL
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/webhooks/platform"
            style={inputStyle}
            required
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Secret (optional, used for x-platform-signature)
          <input
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            style={inputStyle}
          />
        </label>
        <div style={{ fontSize: 13 }}>
          Subscribed events
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {EVENT_OPTIONS.map((eventType) => (
              <label
                key={eventType}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  border: "1px solid #cbd5e1",
                  borderRadius: 999,
                  padding: "0.25rem 0.6rem",
                  background: subscribedEvents.includes(eventType) ? "#eff6ff" : "#fff",
                }}
              >
                <input
                  type="checkbox"
                  checked={subscribedEvents.includes(eventType)}
                  onChange={() => toggleEvent(eventType)}
                />
                {eventType}
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={creating || subscribedEvents.length === 0}
          style={{
            width: "fit-content",
            padding: "0.45rem 0.85rem",
            borderRadius: 6,
            border: "1px solid #334155",
            background: "#0f172a",
            color: "#fff",
            cursor: creating ? "wait" : "pointer",
            fontSize: 13,
          }}
        >
          {creating ? "Creating…" : "Create webhook"}
        </button>
      </form>

      <div
        style={{
          display: "grid",
          gap: 10,
          marginBottom: 16,
          paddingBottom: 16,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>Test fire</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={testEventType}
            onChange={(event) => setTestEventType(event.target.value as WebhookEventType)}
            style={{ ...inputStyle, width: "auto", minWidth: 240 }}
          >
            {EVENT_OPTIONS.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={testing}
            onClick={() => void testFire()}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: 6,
              border: "1px solid #2563eb",
              background: "#eff6ff",
              cursor: testing ? "wait" : "pointer",
              fontSize: 12,
            }}
          >
            {testing ? "Sending…" : "Send test event"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Endpoints</div>
          {endpoints.length === 0 ? (
            <p style={{ fontSize: 12, color: "#64748b" }}>No webhook endpoints yet.</p>
          ) : null}
          {endpoints.map((endpoint) => (
            <article
              key={endpoint.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                padding: "0.75rem",
                background: "#f8fafc",
                marginBottom: 8,
              }}
            >
              <strong style={{ fontSize: 14 }}>{endpoint.name}</strong>
              <div style={{ fontSize: 12, color: "#64748b", wordBreak: "break-all" }}>
                {endpoint.url}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Status: {endpoint.active ? "active" : "inactive"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Events: {endpoint.subscribedEvents.join(", ")}
              </div>
              {endpoint.lastDeliveryAt ? (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Last delivery: {new Date(endpoint.lastDeliveryAt).toLocaleString()} (
                  {endpoint.lastDeliveryStatus})
                </div>
              ) : null}
              <button
                type="button"
                disabled={actingOnId === endpoint.id}
                onClick={() => void toggleEndpoint(endpoint.id, !endpoint.active)}
                style={{
                  marginTop: 8,
                  padding: "0.35rem 0.7rem",
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid #64748b",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                {endpoint.active ? "Deactivate" : "Activate"}
              </button>
            </article>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Recent delivery logs
          </div>
          {deliveries.length === 0 ? (
            <p style={{ fontSize: 12, color: "#64748b" }}>No deliveries yet.</p>
          ) : null}
          {deliveries.map((delivery) => (
            <article
              key={delivery.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                padding: "0.65rem",
                background: "#f8fafc",
                marginBottom: 8,
                fontSize: 12,
              }}
            >
              <div>
                <strong>{delivery.eventType}</strong> · {delivery.status}
              </div>
              <div style={{ color: "#64748b" }}>
                Endpoint {delivery.endpointId} ·{" "}
                {new Date(delivery.createdAt).toLocaleString()}
              </div>
              {delivery.responseStatusCode ? (
                <div>HTTP {delivery.responseStatusCode}</div>
              ) : null}
              {delivery.errorMessage ? (
                <div style={{ color: "#b91c1c" }}>{delivery.errorMessage}</div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
