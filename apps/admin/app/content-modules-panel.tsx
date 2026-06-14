"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  EnvironmentKey,
  SearchContentModuleDto,
  SearchContentModuleListResponseDto,
  SearchContentModuleType,
} from "@retailer-search/shared-types";
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
  padding: "0.55rem 0.9rem",
  border: "none",
  borderRadius: 6,
  background: "var(--forge-primary)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 14,
} as const;

export function ContentModulesPanel() {
  const [environment, setEnvironment] = useState<EnvironmentKey>("staging");
  const [modules, setModules] = useState<SearchContentModuleDto[]>([]);
  const [name, setName] = useState("");
  const [moduleType, setModuleType] = useState<SearchContentModuleType>("banner");
  const [priority, setPriority] = useState(100);
  const [active, setActive] = useState(true);
  const [conditionQuery, setConditionQuery] = useState("");
  const [conditionBrand, setConditionBrand] = useState("");
  const [conditionCategory, setConditionCategory] = useState("");
  const [contentTitle, setContentTitle] = useState("");
  const [contentBody, setContentBody] = useState("");
  const [contentHref, setContentHref] = useState("");
  const [contentCategory, setContentCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadModules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/content-modules?environment=${environment}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(`Failed to load content modules (${response.status})`);
      }
      const body = (await response.json()) as SearchContentModuleListResponseDto;
      setModules(body.modules ?? []);
    } catch (loadError) {
      setModules([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load modules");
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    void loadModules();
  }, [loadModules]);

  const createModule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/content-modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          active,
          environment,
          moduleType,
          priority,
          condition: {
            query: conditionQuery.trim() || undefined,
            brand: conditionBrand.trim() || undefined,
            category: conditionCategory.trim() || undefined,
          },
          content: {
            title: contentTitle.trim() || undefined,
            body: contentBody.trim() || undefined,
            href: contentHref.trim() || undefined,
            category: contentCategory.trim() || undefined,
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`Create content module failed (${response.status})`);
      }

      setName("");
      setModuleType("banner");
      setPriority(100);
      setActive(true);
      setConditionQuery("");
      setConditionBrand("");
      setConditionCategory("");
      setContentTitle("");
      setContentBody("");
      setContentHref("");
      setContentCategory("");
      setFeedback("Content module created.");
      await loadModules();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "0.85rem",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}>Content modules</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Configure banner, message, and category rail modules by environment.
          </p>
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Environment
          <select
            value={environment}
            onChange={(event) => setEnvironment(event.target.value as EnvironmentKey)}
            style={{ ...inputStyle, width: 130 }}
            disabled={saving}
          >
            <option value="staging">Staging</option>
            <option value="live">Live</option>
          </select>
        </label>
      </div>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>{error}</p>
      ) : null}
      {feedback ? (
        <p style={{ margin: "0 0 0.75rem", color: "#15803d", fontSize: 14 }}>{feedback}</p>
      ) : null}

      <form
        onSubmit={(event) => void createModule(event)}
        style={{
          display: "grid",
          gap: "0.75rem",
          padding: "0.85rem",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
          marginBottom: "1rem",
        }}
      >
        <strong style={{ fontSize: 14 }}>Create module</strong>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              style={inputStyle}
              placeholder="Summer Sale Hero"
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Module type
            <select
              value={moduleType}
              onChange={(event) =>
                setModuleType(event.target.value as SearchContentModuleType)
              }
              style={inputStyle}
            >
              <option value="banner">Banner</option>
              <option value="message">Message</option>
              <option value="category_rail">Category rail</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Priority
            <input
              type="number"
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 24, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Active
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Condition query
            <input
              value={conditionQuery}
              onChange={(event) => setConditionQuery(event.target.value)}
              style={inputStyle}
              placeholder="wireless headphones"
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Condition brand
            <input
              value={conditionBrand}
              onChange={(event) => setConditionBrand(event.target.value)}
              style={inputStyle}
              placeholder="Acme"
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Condition category
            <input
              value={conditionCategory}
              onChange={(event) => setConditionCategory(event.target.value)}
              style={inputStyle}
              placeholder="Electronics"
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Content title
            <input
              value={contentTitle}
              onChange={(event) => setContentTitle(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Content body
            <input
              value={contentBody}
              onChange={(event) => setContentBody(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Content href
            <input
              value={contentHref}
              onChange={(event) => setContentHref(event.target.value)}
              style={inputStyle}
              placeholder="/sale/summer"
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Content category
            <input
              value={contentCategory}
              onChange={(event) => setContentCategory(event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <button type="submit" style={{ ...buttonStyle, justifySelf: "start" }} disabled={saving || !name.trim()}>
          {saving ? "Creating..." : "Create module"}
        </button>
      </form>

      {loading ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading modules...</p>
      ) : modules.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          No content modules in {environment} yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.5rem" }}>Name</th>
                <th style={{ padding: "0.5rem" }}>Type</th>
                <th style={{ padding: "0.5rem" }}>Priority</th>
                <th style={{ padding: "0.5rem" }}>Condition</th>
                <th style={{ padding: "0.5rem" }}>Content</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr key={module.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <div style={{ fontWeight: 600 }}>{module.name}</div>
                    <div style={{ fontFamily: "monospace", color: "#64748b", fontSize: 12 }}>
                      {module.id}
                    </div>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{module.moduleType}</td>
                  <td style={{ padding: "0.5rem" }}>{module.priority}</td>
                  <td style={{ padding: "0.5rem", color: "#475569" }}>
                    {[
                      module.condition.query ? `q:${module.condition.query}` : null,
                      module.condition.brand ? `brand:${module.condition.brand}` : null,
                      module.condition.category ? `cat:${module.condition.category}` : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Any query"}
                  </td>
                  <td style={{ padding: "0.5rem", color: "#475569" }}>
                    {module.content.title || module.content.body || module.content.href || "-"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {module.active ? (
                      <span style={{ color: "#15803d" }}>Active</span>
                    ) : (
                      <span style={{ color: "#64748b" }}>Inactive</span>
                    )}
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
