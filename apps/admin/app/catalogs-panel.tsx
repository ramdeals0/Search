"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatalogDto } from "@retailer-search/shared-types";
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

export function CatalogsPanel() {
  const [catalogs, setCatalogs] = useState<CatalogDto[]>([]);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCatalogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/catalogs`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: getAuthHeaders("none"),
      });
      if (!response.ok) {
        throw new Error(`Failed to load catalogs (${response.status})`);
      }
      const body = (await response.json()) as { catalogs: CatalogDto[] };
      setCatalogs(body.catalogs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load catalogs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  const createCatalog = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!slug.trim() || !name.trim()) {
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/catalogs`, {
        method: "POST",
        credentials: "same-origin",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          slug: slug.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          isDefault,
        }),
      });
      if (!response.ok) {
        throw new Error(`Create catalog failed (${response.status})`);
      }

      setSlug("");
      setName("");
      setDescription("");
      setIsDefault(false);
      await loadCatalogs();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const toggleDefault = async (catalog: CatalogDto) => {
    setError(null);
    try {
      const response = await fetch(
        `${getSearchApiUrl()}/api/v1/admin/catalogs/${catalog.id}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: getAuthHeaders(),
          body: JSON.stringify({ isDefault: !catalog.isDefault }),
        },
      );
      if (!response.ok) {
        throw new Error(`Update catalog failed (${response.status})`);
      }
      await loadCatalogs();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Update failed");
    }
  };

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>Catalog registry</h2>
      <p style={{ margin: "0 0 1rem", fontSize: 13, color: "#64748b" }}>
        Register multiple product catalogs for this tenant. Use the header switcher to pick the
        active catalog context.
      </p>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>{error}</p>
      ) : null}

      <form
        onSubmit={(event) => void createCatalog(event)}
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
        <strong style={{ fontSize: 14 }}>Create catalog</strong>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Slug
            <input
              required
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="us-retail"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="US Retail"
              style={inputStyle}
            />
          </label>
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Description
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional description"
            style={inputStyle}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(event) => setIsDefault(event.target.checked)}
          />
          Set as default catalog
        </label>
        <button
          type="submit"
          disabled={creating}
          style={{ ...buttonStyle, width: "fit-content", background: "var(--forge-primary)", color: "#fff" }}
        >
          {creating ? "Creating..." : "Create catalog"}
        </button>
      </form>

      {loading ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading catalogs...</p>
      ) : catalogs.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>No catalogs yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.5rem" }}>Name</th>
                <th style={{ padding: "0.5rem" }}>Slug</th>
                <th style={{ padding: "0.5rem" }}>Products</th>
                <th style={{ padding: "0.5rem" }}>Default</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {catalogs.map((catalog) => (
                <tr key={catalog.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <div>{catalog.name}</div>
                    {catalog.description ? (
                      <div style={{ fontSize: 12, color: "#64748b" }}>{catalog.description}</div>
                    ) : null}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <code>{catalog.slug}</code>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{catalog.productCount ?? "—"}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <button
                      type="button"
                      style={buttonStyle}
                      onClick={() => void toggleDefault(catalog)}
                    >
                      {catalog.isDefault ? "Default" : "Make default"}
                    </button>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {catalog.active ? "Active" : "Inactive"}
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
