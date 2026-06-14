"use client";

import { useCallback, useEffect, useState } from "react";
import type { PluginDescriptorDto } from "@retailer-search/shared-types";
import { getAuthHeaders } from "./lib/auth-headers";
import { getSearchApiUrl } from "./lib/search-api-url";

const panelStyle = {
  padding: "1rem",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#fff",
} as const;

const buttonStyle = {
  padding: "0.45rem 0.75rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
} as const;

export function PluginsPanel() {
  const [plugins, setPlugins] = useState<PluginDescriptorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/plugins`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: getAuthHeaders("none"),
      });
      if (!response.ok) {
        throw new Error(`Failed to load plugins (${response.status})`);
      }
      const body = (await response.json()) as { plugins: PluginDescriptorDto[] };
      setPlugins(body.plugins ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load plugins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins]);

  const togglePlugin = async (plugin: PluginDescriptorDto) => {
    setTogglingId(plugin.id);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/plugins/${plugin.id}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: getAuthHeaders(),
          body: JSON.stringify({ enabled: !plugin.enabled }),
        },
      );
      if (!response.ok) {
        throw new Error(`Toggle plugin failed (${response.status})`);
      }
      await loadPlugins();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Toggle failed");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>Search plugins</h2>
      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Enable or disable registered search pipeline plugins for this instance.
      </p>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>{error}</p>
      ) : null}

      {loading ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading plugins...</p>
      ) : plugins.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>No plugins registered.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.5rem" }}>Plugin</th>
                <th style={{ padding: "0.5rem" }}>Version</th>
                <th style={{ padding: "0.5rem" }}>Hooks</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {plugins.map((plugin) => (
                <tr key={plugin.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <div>{plugin.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      <code>{plugin.id}</code>
                    </div>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{plugin.version}</td>
                  <td style={{ padding: "0.5rem", fontSize: 12 }}>
                    {plugin.hooks.join(", ")}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {plugin.enabled ? "Enabled" : "Disabled"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <button
                      type="button"
                      style={buttonStyle}
                      disabled={togglingId === plugin.id}
                      onClick={() => void togglePlugin(plugin)}
                    >
                      {togglingId === plugin.id
                        ? "Saving..."
                        : plugin.enabled
                          ? "Disable"
                          : "Enable"}
                    </button>
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
