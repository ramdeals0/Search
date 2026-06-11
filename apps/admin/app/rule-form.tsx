"use client";

import { useState } from "react";
import type {
  CreateMerchandisingRuleDto,
  MerchandisingRule,
  MerchandisingRuleAction,
} from "@retailer-search/shared-types";

interface RuleFormProps {
  initialRule?: MerchandisingRule;
  onSubmit: (payload: CreateMerchandisingRuleDto) => Promise<void>;
  onCancel: () => void;
}

const emptyForm: CreateMerchandisingRuleDto = {
  name: "",
  active: true,
  priority: 50,
  action: "boost",
  condition: {},
  boostAmount: 10,
};

export function RuleForm({ initialRule, onSubmit, onCancel }: RuleFormProps) {
  const [form, setForm] = useState<CreateMerchandisingRuleDto>(
    initialRule ?? emptyForm,
  );
  const [productIds, setProductIds] = useState(
    initialRule?.productIds?.join(", ") ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = <K extends keyof CreateMerchandisingRuleDto>(
    key: K,
    value: CreateMerchandisingRuleDto[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload: CreateMerchandisingRuleDto = {
      ...form,
      productIds: productIds
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      await onSubmit(payload);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Save failed",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      style={{
        padding: "1rem",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        background: "#f8fafc",
        display: "grid",
        gap: "0.75rem",
      }}
    >
      <h3 style={{ margin: 0, fontSize: "1rem" }}>
        {initialRule ? "Edit rule" : "Create rule"}
      </h3>

      <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
        Name
        <input
          required
          value={form.name}
          onChange={(event) => updateField("name", event.target.value)}
          style={inputStyle}
        />
      </label>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          Action
          <select
            value={form.action}
            onChange={(event) =>
              updateField("action", event.target.value as MerchandisingRuleAction)
            }
            style={inputStyle}
          >
            <option value="pin">Pin</option>
            <option value="boost">Boost</option>
            <option value="bury">Bury</option>
            <option value="hide">Hide</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          Priority
          <input
            type="number"
            value={form.priority}
            onChange={(event) =>
              updateField("priority", Number(event.target.value))
            }
            style={inputStyle}
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            marginTop: 22,
          }}
        >
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => updateField("active", event.target.checked)}
          />
          Active
        </label>
      </div>

      <fieldset
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          padding: "0.75rem",
        }}
      >
        <legend style={{ fontSize: 13, color: "#64748b" }}>Condition</legend>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
            Query contains
            <input
              value={form.condition.query ?? ""}
              onChange={(event) =>
                updateField("condition", {
                  ...form.condition,
                  query: event.target.value || undefined,
                })
              }
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
            Brand
            <input
              value={form.condition.brand ?? ""}
              onChange={(event) =>
                updateField("condition", {
                  ...form.condition,
                  brand: event.target.value || undefined,
                })
              }
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
            Category
            <input
              value={form.condition.category ?? ""}
              onChange={(event) =>
                updateField("condition", {
                  ...form.condition,
                  category: event.target.value || undefined,
                })
              }
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
            In stock
            <select
              value={
                form.condition.inStock === undefined
                  ? ""
                  : String(form.condition.inStock)
              }
              onChange={(event) =>
                updateField("condition", {
                  ...form.condition,
                  inStock:
                    event.target.value === ""
                      ? undefined
                      : event.target.value === "true",
                })
              }
              style={inputStyle}
            >
              <option value="">Any</option>
              <option value="true">In stock</option>
              <option value="false">Out of stock</option>
            </select>
          </label>
        </div>
      </fieldset>

      <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
        Target brand (optional)
        <input
          value={form.brand ?? ""}
          onChange={(event) => updateField("brand", event.target.value || undefined)}
          style={inputStyle}
        />
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
        Product IDs (comma-separated)
        <input
          value={productIds}
          onChange={(event) => setProductIds(event.target.value)}
          style={inputStyle}
        />
      </label>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          Boost amount
          <input
            type="number"
            value={form.boostAmount ?? ""}
            onChange={(event) =>
              updateField(
                "boostAmount",
                event.target.value ? Number(event.target.value) : undefined,
              )
            }
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          Bury amount
          <input
            type="number"
            value={form.buryAmount ?? ""}
            onChange={(event) =>
              updateField(
                "buryAmount",
                event.target.value ? Number(event.target.value) : undefined,
              )
            }
            style={inputStyle}
          />
        </label>
      </div>

      {error && <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "0.55rem 0.9rem",
            border: "none",
            borderRadius: 6,
            background: "#0f172a",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {saving ? "Saving..." : "Save rule"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "0.55rem 0.9rem",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
} as const;
