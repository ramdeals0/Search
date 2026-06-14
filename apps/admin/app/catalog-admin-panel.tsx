"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AdminProductListResponseDto,
  CatalogCsvImportResultDto,
  UpdateAdminProductRequestDto,
} from "@retailer-search/shared-types";
import { getSearchApiUrl } from "./lib/search-api-url";

interface EditableProduct {
  id: string;
  sku: string;
  title: string;
  brand: string;
  category: string;
  subcategory: string;
  price: number;
  inStock: boolean;
}

const panelStyle = {
  padding: "1rem",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#fff",
} as const;

const inputStyle = {
  padding: "0.45rem 0.6rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  width: "100%",
} as const;

const buttonStyle = {
  padding: "0.4rem 0.7rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
} as const;

const primaryButtonStyle = {
  ...buttonStyle,
  background: "#0f172a",
  color: "#fff",
  borderColor: "#0f172a",
} as const;

export function CatalogAdminPanel() {
  const [products, setProducts] = useState<EditableProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPrice, setDraftPrice] = useState("");
  const [draftInStock, setDraftInStock] = useState(true);
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<CatalogCsvImportResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/products?limit=100`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Failed to load products (${response.status})`);
      }
      const body = (await response.json()) as AdminProductListResponseDto;
      setProducts(body.products ?? []);
    } catch (loadError) {
      setProducts([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const startEdit = (product: EditableProduct) => {
    setEditingId(product.id);
    setDraftTitle(product.title);
    setDraftPrice(String(product.price));
    setDraftInStock(product.inStock);
  };

  const saveEdit = async (productId: string) => {
    const parsedPrice = Number(draftPrice);
    if (!draftTitle.trim() || Number.isNaN(parsedPrice)) {
      return;
    }

    setBusy(true);
    setError(null);
    setFeedback(null);

    const payload: UpdateAdminProductRequestDto = {
      title: draftTitle.trim(),
      price: parsedPrice,
      inStock: draftInStock,
    };

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Update failed (${response.status})`);
      }
      setFeedback("Product updated.");
      setEditingId(null);
      await loadProducts();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async () => {
    if (!csvText.trim()) {
      return;
    }

    setBusy(true);
    setError(null);
    setFeedback(null);
    setImportResult(null);

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/products/import-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      if (!response.ok) {
        throw new Error(`CSV import failed (${response.status})`);
      }
      const result = (await response.json()) as CatalogCsvImportResultDto;
      setImportResult(result);
      setFeedback("CSV import completed.");
      await loadProducts();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "CSV import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}>Catalog admin</h2>
      <p style={{ margin: "0 0 0.85rem", fontSize: 13, color: "#64748b" }}>
        Manage product metadata and import catalog updates from CSV.
      </p>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>{error}</p>
      ) : null}
      {feedback ? (
        <p style={{ margin: "0 0 0.75rem", color: "#15803d", fontSize: 14 }}>{feedback}</p>
      ) : null}

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "0.75rem",
          background: "#f8fafc",
          marginBottom: "1rem",
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          CSV import payload
          <textarea
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            placeholder="id,sku,title,brand,category,subcategory,description,price,inventory,inStock"
            rows={6}
            style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
            disabled={busy}
          />
        </label>
        <button
          type="button"
          style={{ ...primaryButtonStyle, marginTop: "0.65rem" }}
          disabled={busy || !csvText.trim()}
          onClick={() => void importCsv()}
        >
          {busy ? "Importing..." : "Import CSV"}
        </button>
        {importResult ? (
          <p style={{ margin: "0.65rem 0 0", fontSize: 13, color: "#334155" }}>
            Imported {importResult.imported}, updated {importResult.updated}, skipped{" "}
            {importResult.skipped}
            {importResult.errors.length > 0 ? `, errors: ${importResult.errors.length}` : ""}.
          </p>
        ) : null}
      </div>

      {loading ? (
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Loading products...</p>
      ) : products.length === 0 ? (
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>No products found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.5rem" }}>SKU</th>
                <th style={{ padding: "0.5rem" }}>Title</th>
                <th style={{ padding: "0.5rem" }}>Brand</th>
                <th style={{ padding: "0.5rem" }}>Category</th>
                <th style={{ padding: "0.5rem" }}>Price</th>
                <th style={{ padding: "0.5rem" }}>In stock</th>
                <th style={{ padding: "0.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const isEditing = editingId === product.id;

                return (
                  <tr key={product.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{product.sku}</td>
                    <td style={{ padding: "0.5rem", minWidth: 260 }}>
                      {isEditing ? (
                        <input
                          value={draftTitle}
                          onChange={(event) => setDraftTitle(event.target.value)}
                          style={inputStyle}
                          disabled={busy}
                        />
                      ) : (
                        product.title
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{product.brand}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {product.category} / {product.subcategory}
                    </td>
                    <td style={{ padding: "0.5rem", minWidth: 120 }}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={draftPrice}
                          onChange={(event) => setDraftPrice(event.target.value)}
                          style={inputStyle}
                          disabled={busy}
                        />
                      ) : (
                        product.price.toFixed(2)
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={draftInStock}
                          onChange={(event) => setDraftInStock(event.target.checked)}
                          disabled={busy}
                        />
                      ) : product.inStock ? (
                        "Yes"
                      ) : (
                        "No"
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              style={primaryButtonStyle}
                              onClick={() => void saveEdit(product.id)}
                              disabled={busy || !draftTitle.trim()}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              style={buttonStyle}
                              onClick={() => setEditingId(null)}
                              disabled={busy}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            style={buttonStyle}
                            onClick={() => startEdit(product)}
                            disabled={busy}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
