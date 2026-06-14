"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AdminBrandingDto,
  UpdateAdminBrandingRequestDto,
} from "@retailer-search/shared-types";
import { getAuthHeaders } from "./lib/auth-headers";
import { getSearchApiUrl } from "./lib/search-api-url";

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

export function BrandingPanel() {
  const [branding, setBranding] = useState<AdminBrandingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadBranding = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/branding`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: getAuthHeaders("none"),
      });
      if (!response.ok) {
        throw new Error(`Failed to load branding (${response.status})`);
      }
      setBranding((await response.json()) as AdminBrandingDto);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load branding");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  const updateField = <K extends keyof AdminBrandingDto>(
    field: K,
    value: AdminBrandingDto[K],
  ) => {
    setBranding((current) => (current ? { ...current, [field]: value } : current));
  };

  const saveBranding = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!branding) {
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    const payload: UpdateAdminBrandingRequestDto = {
      instanceName: branding.instanceName,
      logoUrl: branding.logoUrl ?? "",
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor,
      sidebarColor: branding.sidebarColor,
    };

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/branding`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Save branding failed (${response.status})`);
      }
      setBranding((await response.json()) as AdminBrandingDto);
      setFeedback("Branding saved. Refresh to apply theme across the console.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section style={panelStyle}>
        <p style={{ margin: 0, fontSize: 14, color: "var(--forge-text-muted)" }}>
          Loading branding...
        </p>
      </section>
    );
  }

  if (!branding) {
    return (
      <section style={panelStyle}>
        <p style={{ margin: 0, color: "var(--forge-error)", fontSize: 14 }}>{error}</p>
      </section>
    );
  }

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>Instance branding</h2>
      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Customize the console name, logo, and theme colors for this tenant instance.
      </p>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>{error}</p>
      ) : null}
      {feedback ? (
        <p style={{ margin: "0 0 0.75rem", color: "#15803d", fontSize: 14 }}>{feedback}</p>
      ) : null}

      <form
        onSubmit={(event) => void saveBranding(event)}
        style={{ display: "grid", gap: "0.75rem" }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Instance name
          <input
            required
            value={branding.instanceName}
            onChange={(event) => updateField("instanceName", event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Logo URL
          <input
            value={branding.logoUrl ?? ""}
            onChange={(event) => updateField("logoUrl", event.target.value || undefined)}
            placeholder="https://cdn.example.com/logo.svg"
            style={inputStyle}
          />
        </label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Primary color
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="color"
                value={branding.primaryColor}
                onChange={(event) => updateField("primaryColor", event.target.value)}
                style={{ width: 44, height: 36, padding: 0, border: "none", cursor: "pointer" }}
              />
              <input
                value={branding.primaryColor}
                onChange={(event) => updateField("primaryColor", event.target.value)}
                style={inputStyle}
              />
            </div>
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Accent color
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="color"
                value={branding.accentColor ?? branding.primaryColor}
                onChange={(event) => updateField("accentColor", event.target.value)}
                style={{ width: 44, height: 36, padding: 0, border: "none", cursor: "pointer" }}
              />
              <input
                value={branding.accentColor ?? ""}
                onChange={(event) => updateField("accentColor", event.target.value || undefined)}
                placeholder={branding.primaryColor}
                style={inputStyle}
              />
            </div>
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Sidebar color
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="color"
                value={branding.sidebarColor ?? "#f8fafc"}
                onChange={(event) => updateField("sidebarColor", event.target.value)}
                style={{ width: 44, height: 36, padding: 0, border: "none", cursor: "pointer" }}
              />
              <input
                value={branding.sidebarColor ?? ""}
                onChange={(event) => updateField("sidebarColor", event.target.value || undefined)}
                placeholder="#f8fafc"
                style={inputStyle}
              />
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{ ...buttonStyle, width: "fit-content", background: "var(--forge-primary)", color: "#fff" }}
        >
          {saving ? "Saving..." : "Save branding"}
        </button>
      </form>
    </section>
  );
}
