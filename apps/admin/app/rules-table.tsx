"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  CatalogVocabularyDto,
  CreateMerchandisingRuleDto,
  MerchandisingRule,
  UpdateMerchandisingRuleDto,
} from "@retailer-search/shared-types";
import { RuleForm } from "./rule-form";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

const EMPTY_VOCABULARY: CatalogVocabularyDto = {
  brands: [],
  categories: [],
};

interface RulesTableProps {
  initialRules: MerchandisingRule[];
}

export function RulesTable({ initialRules }: RulesTableProps) {
  const router = useRouter();
  const [editingRule, setEditingRule] = useState<MerchandisingRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogVocabulary, setCatalogVocabulary] =
    useState<CatalogVocabularyDto>(EMPTY_VOCABULARY);

  useEffect(() => {
    let cancelled = false;

    void fetch(`${SEARCH_API_URL}/api/v1/admin/catalog/vocabulary`)
      .then((response) => (response.ok ? response.json() : EMPTY_VOCABULARY))
      .then((payload: CatalogVocabularyDto) => {
        if (!cancelled) {
          setCatalogVocabulary(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogVocabulary(EMPTY_VOCABULARY);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = () => {
    router.refresh();
  };

  const createRule = async (payload: CreateMerchandisingRuleDto) => {
    const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Create failed with HTTP ${response.status}`);
    }

    setCreating(false);
    refresh();
  };

  const updateRule = async (
    id: string,
    payload: UpdateMerchandisingRuleDto,
  ) => {
    const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/rules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Update failed with HTTP ${response.status}`);
    }

    setEditingRule(null);
    refresh();
  };

  const deleteRule = async (id: string) => {
    if (!window.confirm("Delete this merchandising rule?")) {
      return;
    }

    setError(null);
    const response = await fetch(`${SEARCH_API_URL}/api/v1/admin/rules/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError(`Delete failed with HTTP ${response.status}`);
      return;
    }

    refresh();
  };

  const toggleActive = async (rule: MerchandisingRule) => {
    setError(null);
    const response = await fetch(
      `${SEARCH_API_URL}/api/v1/admin/rules/${rule.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !rule.active }),
      },
    );

    if (!response.ok) {
      setError(`Toggle failed with HTTP ${response.status}`);
      return;
    }

    refresh();
  };

  return (
    <section
      style={{
        padding: "1rem",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Merchandising rules</h2>
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditingRule(null);
          }}
          style={{
            padding: "0.5rem 0.85rem",
            border: "none",
            borderRadius: 6,
            background: "var(--forge-primary)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          New rule
        </button>
      </div>

      {error && (
        <p style={{ margin: "0 0 1rem", color: "#b91c1c", fontSize: 14 }}>
          {error}
        </p>
      )}

      {creating && (
        <div style={{ marginBottom: "1rem" }}>
          <RuleForm
            catalogVocabulary={catalogVocabulary}
            onSubmit={createRule}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {editingRule && (
        <div style={{ marginBottom: "1rem" }}>
          <RuleForm
            initialRule={editingRule}
            catalogVocabulary={catalogVocabulary}
            onSubmit={(payload) => updateRule(editingRule.id, payload)}
            onCancel={() => setEditingRule(null)}
          />
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
              <th style={cellStyle}>Name</th>
              <th style={cellStyle}>Action</th>
              <th style={cellStyle}>Priority</th>
              <th style={cellStyle}>Condition</th>
              <th style={cellStyle}>Active</th>
              <th style={cellStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialRules.map((rule) => (
              <tr key={rule.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={cellStyle}>
                  <strong>{rule.name}</strong>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>{rule.id}</div>
                </td>
                <td style={cellStyle}>{rule.action}</td>
                <td style={cellStyle}>{rule.priority}</td>
                <td style={cellStyle}>{formatCondition(rule)}</td>
                <td style={cellStyle}>{rule.active ? "Yes" : "No"}</td>
                <td style={cellStyle}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRule(rule);
                        setCreating(false);
                      }}
                      style={actionButtonStyle}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(rule)}
                      style={actionButtonStyle}
                    >
                      {rule.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRule(rule.id)}
                      style={actionButtonStyle}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatCondition(rule: MerchandisingRule): string {
  const parts: string[] = [];
  if (rule.condition.query) {
    parts.push(`query:${rule.condition.query}`);
  }
  if (rule.condition.brand) {
    parts.push(`brand:${rule.condition.brand}`);
  }
  if (rule.condition.category) {
    parts.push(`category:${rule.condition.category}`);
  }
  if (rule.condition.inStock !== undefined) {
    parts.push(`inStock:${rule.condition.inStock}`);
  }
  if (rule.brand) {
    parts.push(`targetBrand:${rule.brand}`);
  }
  if (rule.productIds?.length) {
    parts.push(`products:${rule.productIds.join("|")}`);
  }
  return parts.join(", ") || "default";
}

const cellStyle = {
  padding: "0.75rem 0.5rem",
  verticalAlign: "top",
} as const;

const actionButtonStyle = {
  padding: "0.35rem 0.55rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 12,
} as const;
