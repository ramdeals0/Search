"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  LlmProviderName,
  LlmSettingsDto,
  UpdateLlmSettingsRequestDto,
} from "@retailer-search/shared-types";
import { getAuthHeaders } from "./lib/auth-headers";
import { getSearchApiUrl } from "./lib/search-api-url";

const PROVIDER_OPTIONS: LlmProviderName[] = ["none", "openrouter", "groq"];

const DEFAULT_MODELS: Record<LlmProviderName, string> = {
  none: "none",
  openrouter: "meta-llama/llama-3.1-8b-instruct:free",
  groq: "llama-3.1-8b-instant",
};

const inputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
} as const;

export function LlmSettingsPanel() {
  const [settings, setSettings] = useState<LlmSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/llm-settings`, {
        cache: "no-store",
        headers: getAuthHeaders("none"),
      });

      if (!response.ok) {
        throw new Error(`Failed to load LLM settings: HTTP ${response.status}`);
      }

      setSettings((await response.json()) as LlmSettingsDto);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load LLM settings",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateField = <K extends keyof LlmSettingsDto>(
    field: K,
    value: LlmSettingsDto[K],
  ) => {
    setSettings((current) => (current ? { ...current, [field]: value } : current));
  };

  const saveSettings = async () => {
    if (!settings) {
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    const payload: UpdateLlmSettingsRequestDto = {
      provider: settings.provider,
      model: settings.model,
      timeoutMs: settings.timeoutMs,
      cacheTtlMs: settings.cacheTtlMs,
      maxQueryChars: settings.maxQueryChars,
      rerankTopK: settings.rerankTopK,
      debugLogging: settings.debugLogging,
      queryRewriteEnabled: settings.queryRewriteEnabled,
      zeroResultsEnabled: settings.zeroResultsEnabled,
      rerankEnabled: settings.rerankEnabled,
    };

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/llm-settings`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Save LLM settings failed with HTTP ${response.status}`);
      }

      setSettings((await response.json()) as LlmSettingsDto);
      setFeedback("LLM settings saved. Changes apply immediately to search and rule drafts.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save LLM settings",
      );
    } finally {
      setSaving(false);
    }
  };

  const onProviderChange = (provider: LlmProviderName) => {
    if (!settings) {
      return;
    }

    setSettings({
      ...settings,
      provider,
      model: DEFAULT_MODELS[provider],
    });
  };

  if (loading) {
    return (
      <section className="forge-card forge-card--panel">
        <p style={{ margin: 0, color: "var(--forge-text-muted)", fontSize: 14 }}>
          Loading LLM settings...
        </p>
      </section>
    );
  }

  if (!settings) {
    return (
      <section className="forge-card forge-card--panel">
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
          {error ?? "Unable to load LLM settings."}
        </p>
      </section>
    );
  }

  return (
    <section className="forge-card forge-card--panel">
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <div>
          <strong style={{ fontSize: "0.875rem" }}>LLM search settings</strong>
          <p
            style={{
              margin: "0.35rem 0 0",
              fontSize: "0.8125rem",
              color: "var(--forge-text-muted)",
            }}
          >
            Configure provider, model, and feature flags without redeploying. API keys stay
            in server environment variables (
            <code>OPENROUTER_API_KEY</code>, <code>GROQ_API_KEY</code>).
          </p>
        </div>

        <div className="forge-grid-metrics" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="forge-callout forge-callout--info" style={{ margin: 0 }}>
            <strong>OpenRouter key</strong>
            <div style={{ marginTop: 4, fontSize: 13 }}>
              {settings.credentials.openrouterConfigured ? "Configured" : "Not set"}
            </div>
          </div>
          <div className="forge-callout forge-callout--info" style={{ margin: 0 }}>
            <strong>Groq key</strong>
            <div style={{ marginTop: 4, fontSize: 13 }}>
              {settings.credentials.groqConfigured ? "Configured" : "Not set"}
            </div>
          </div>
          <div
            className={`forge-callout ${settings.providerReady ? "forge-callout--info" : "forge-callout--dashed"}`}
            style={{ margin: 0 }}
          >
            <strong>Provider ready</strong>
            <div style={{ marginTop: 4, fontSize: 13 }}>
              {settings.providerReady ? "Live calls enabled" : "Provider disabled or missing key"}
            </div>
          </div>
        </div>

        {settings.configuredInAdmin && settings.updatedAt ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--forge-text-muted)" }}>
            Last saved from admin{" "}
            {new Date(settings.updatedAt).toLocaleString()}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: "var(--forge-text-muted)" }}>
            Using environment defaults until you save from this panel.
          </p>
        )}

        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Provider
            <select
              value={settings.provider}
              onChange={(event) => onProviderChange(event.target.value as LlmProviderName)}
              style={inputStyle}
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Model
            <input
              value={settings.model}
              onChange={(event) => updateField("model", event.target.value)}
              style={inputStyle}
              placeholder={DEFAULT_MODELS[settings.provider]}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Timeout (ms)
            <input
              type="number"
              min={500}
              max={60000}
              value={settings.timeoutMs}
              onChange={(event) => updateField("timeoutMs", Number(event.target.value))}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Cache TTL (ms)
            <input
              type="number"
              min={0}
              max={3600000}
              value={settings.cacheTtlMs}
              onChange={(event) => updateField("cacheTtlMs", Number(event.target.value))}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Max query chars
            <input
              type="number"
              min={32}
              max={500}
              value={settings.maxQueryChars}
              onChange={(event) => updateField("maxQueryChars", Number(event.target.value))}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Rerank top K
            <input
              type="number"
              min={1}
              max={50}
              value={settings.rerankTopK}
              onChange={(event) => updateField("rerankTopK", Number(event.target.value))}
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.queryRewriteEnabled}
              onChange={(event) => updateField("queryRewriteEnabled", event.target.checked)}
            />
            Query rewrite enabled
          </label>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.zeroResultsEnabled}
              onChange={(event) => updateField("zeroResultsEnabled", event.target.checked)}
            />
            Zero-results recovery enabled
          </label>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.rerankEnabled}
              onChange={(event) => updateField("rerankEnabled", event.target.checked)}
            />
            Rerank enabled
          </label>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.debugLogging}
              onChange={(event) => updateField("debugLogging", event.target.checked)}
            />
            Debug logging
          </label>
        </div>

        {feedback ? (
          <p style={{ margin: 0, color: "#15803d", fontSize: 13 }}>{feedback}</p>
        ) : null}
        {error ? (
          <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{error}</p>
        ) : null}

        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          style={{
            justifySelf: "start",
            padding: "0.55rem 0.9rem",
            border: "none",
            borderRadius: 6,
            background: "var(--forge-primary)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {saving ? "Saving..." : "Save LLM settings"}
        </button>
      </div>
    </section>
  );
}
