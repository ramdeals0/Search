"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ApiKeyDto,
  CreateApiKeyResponseDto,
} from "@retailer-search/shared-types";
import { getSearchApiUrl } from "./lib/search-api-url";
import { getAuthHeaders } from "./lib/auth-headers";

const panelStyle = {
  padding: "1rem",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#fff",
} as const;

const inputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
} as const;

const buttonStyle = {
  padding: "0.45rem 0.75rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
} as const;

export function ApiKeysPanel() {
  const [apiKeys, setApiKeys] = useState<ApiKeyDto[]>([]);
  const [name, setName] = useState("");
  const [tenantId, setTenantId] = useState("default");
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState("120");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/api-keys`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: getAuthHeaders("none"),
      });
      if (!response.ok) {
        throw new Error(`Failed to load API keys (${response.status})`);
      }
      const body = (await response.json()) as { apiKeys: ApiKeyDto[] };
      setApiKeys(body.apiKeys ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const createKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    setCreating(true);
    setError(null);
    setCreatedSecret(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/api-keys`, {
        method: "POST",
        credentials: "same-origin",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          tenantId: tenantId.trim() || "default",
          rateLimitPerMinute: Number.parseInt(rateLimitPerMinute, 10) || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Create API key failed (${response.status})`);
      }

      const body = (await response.json()) as CreateApiKeyResponseDto;
      setCreatedSecret(body.secret);
      setName("");
      await loadKeys();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/api-keys/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: getAuthHeaders("none"),
      });
      if (!response.ok) {
        throw new Error(`Revoke failed (${response.status})`);
      }
      await loadKeys();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Revoke failed");
    }
  };

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>API keys</h2>
      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Create scoped keys for storefront, partners, and automation. Set{" "}
        <code>SEARCH_API_KEY_REQUIRED=true</code> on search-api to enforce keys in production.
      </p>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>{error}</p>
      ) : null}

      {createdSecret ? (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            borderRadius: 8,
            background: "#ecfdf5",
            border: "1px solid #86efac",
            fontSize: 13,
          }}
        >
          <strong>Copy this secret now — it will not be shown again:</strong>
          <pre style={{ margin: "0.5rem 0 0", overflow: "auto" }}>{createdSecret}</pre>
        </div>
      ) : null}

      <form
        onSubmit={(event) => void createKey(event)}
        style={{
          display: "grid",
          gap: "0.75rem",
          marginBottom: "1rem",
          padding: "0.85rem",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
        }}
      >
        <strong style={{ fontSize: 14 }}>Create API key</strong>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="storefront-prod"
            style={inputStyle}
          />
        </label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Tenant ID
            <input
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Rate limit / minute
            <input
              value={rateLimitPerMinute}
              onChange={(event) => setRateLimitPerMinute(event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={creating}
          style={{ ...buttonStyle, width: "fit-content", background: "#0f172a", color: "#fff" }}
        >
          {creating ? "Creating..." : "Create key"}
        </button>
      </form>

      {loading ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading keys...</p>
      ) : apiKeys.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>No API keys yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.5rem" }}>Name</th>
                <th style={{ padding: "0.5rem" }}>Prefix</th>
                <th style={{ padding: "0.5rem" }}>Tenant</th>
                <th style={{ padding: "0.5rem" }}>Scopes</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.5rem" }}>{key.name}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <code>{key.keyPrefix}…</code>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{key.tenantId}</td>
                  <td style={{ padding: "0.5rem", fontSize: 12 }}>
                    {key.scopes.join(", ")}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {key.enabled ? "Active" : "Revoked"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {key.enabled ? (
                      <button type="button" style={buttonStyle} onClick={() => void revokeKey(key.id)}>
                        Revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
