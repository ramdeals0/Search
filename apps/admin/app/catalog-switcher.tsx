"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatalogDto } from "@retailer-search/shared-types";
import { getAuthHeaders } from "./lib/auth-headers";
import { getSearchApiUrl } from "./lib/search-api-url";

export const ACTIVE_CATALOG_STORAGE_KEY = "active-catalog-id";
export const ACTIVE_CATALOG_CHANGED_EVENT = "admin:active-catalog-changed";

const selectStyle = {
  padding: "0.35rem 0.5rem",
  border: "1px solid var(--forge-border-strong)",
  borderRadius: "var(--forge-radius-sm)",
  fontSize: 13,
  background: "var(--forge-surface)",
  color: "var(--forge-text)",
  minWidth: 140,
} as const;

export function CatalogSwitcher() {
  const [catalogs, setCatalogs] = useState<CatalogDto[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [visible, setVisible] = useState(false);

  const persistActive = useCallback((catalogId: string) => {
    setActiveId(catalogId);
    window.localStorage.setItem(ACTIVE_CATALOG_STORAGE_KEY, catalogId);
    window.dispatchEvent(
      new CustomEvent(ACTIVE_CATALOG_CHANGED_EVENT, { detail: { catalogId } }),
    );
  }, []);

  const loadCatalogs = useCallback(async () => {
    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/catalogs`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: getAuthHeaders("none"),
      });
      if (!response.ok) {
        setVisible(false);
        return;
      }

      const body = (await response.json()) as { catalogs: CatalogDto[] };
      const items = body.catalogs ?? [];
      setCatalogs(items);
      setVisible(items.length > 0);

      const stored = window.localStorage.getItem(ACTIVE_CATALOG_STORAGE_KEY);
      const defaultCatalog =
        items.find((catalog) => catalog.id === stored) ??
        items.find((catalog) => catalog.isDefault) ??
        items[0];

      if (defaultCatalog) {
        persistActive(defaultCatalog.id);
      }
    } catch {
      setVisible(false);
    }
  }, [persistActive]);

  useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  if (!visible || catalogs.length === 0) {
    return null;
  }

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: 13,
        color: "var(--forge-text-muted)",
      }}
    >
      <span>Catalog</span>
      <select
        value={activeId}
        onChange={(event) => persistActive(event.target.value)}
        style={selectStyle}
        aria-label="Active catalog"
      >
        {catalogs.map((catalog) => (
          <option key={catalog.id} value={catalog.id}>
            {catalog.name}
            {catalog.isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
