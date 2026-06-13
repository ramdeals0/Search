"use client";
import { getSearchApiUrl } from "../../../../lib/search-api-url";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  CatalogVocabularyDto,
  CreateMerchandisingRuleDto,
  MerchandisingRuleAction,
  MerchandisingRuleCondition,
} from "@retailer-search/shared-types";
import { CatalogAutocompleteInput } from "../../../../catalog-autocomplete-input";
import {
  WorkflowShell,
  workflowButtonStyle,
  workflowInputStyle,
} from "../../../admin-page-header";

const STEPS = [
  "Scope",
  "Trigger",
  "Action",
  "Products",
  "Preview",
  "Save",
] as const;

const EMPTY_VOCABULARY: CatalogVocabularyDto = {
  brands: [],
  categories: [],
};

const emptyForm: CreateMerchandisingRuleDto = {
  name: "",
  active: true,
  priority: 50,
  action: "boost",
  condition: {},
  boostAmount: 10,
};

function buildConditionPayload(
  condition: MerchandisingRuleCondition,
): MerchandisingRuleCondition {
  const next: MerchandisingRuleCondition = {};
  const query = condition.query?.trim();
  const brand = condition.brand?.trim();
  const category = condition.category?.trim();

  if (query) {
    next.query = query;
  }
  if (brand) {
    next.brand = brand;
  }
  if (category) {
    next.category = category;
  }
  if (condition.inStock !== undefined) {
    next.inStock = condition.inStock;
  }

  return next;
}

function formatPreview(form: CreateMerchandisingRuleDto, productIds: string): string {
  const lines = [
    `Name: ${form.name || "—"}`,
    `Active: ${form.active ? "Yes" : "No"}`,
    `Priority: ${form.priority}`,
    `Action: ${form.action}`,
    `Condition: ${JSON.stringify(buildConditionPayload(form.condition))}`,
    `Target brand: ${form.brand?.trim() || "—"}`,
    `Product IDs: ${productIds.trim() || "—"}`,
  ];
  if (form.action === "boost" || form.action === "bury") {
    lines.push(`Boost amount: ${form.boostAmount ?? 10}`);
  }
  return lines.join("\n");
}

export default function NewRuleWorkflowPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CreateMerchandisingRuleDto>(emptyForm);
  const [productIds, setProductIds] = useState("");
  const [catalogVocabulary, setCatalogVocabulary] =
    useState<CatalogVocabularyDto>(EMPTY_VOCABULARY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${getSearchApiUrl()}/api/v1/admin/catalog/vocabulary`)
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

  const canAdvance = useMemo(() => {
    if (step === 1) {
      return form.name.trim().length > 0;
    }
    if (step === 2) {
      const condition = buildConditionPayload(form.condition);
      return Object.keys(condition).length > 0;
    }
    return true;
  }, [form, step]);

  const updateField = <K extends keyof CreateMerchandisingRuleDto>(
    key: K,
    value: CreateMerchandisingRuleDto[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveRule = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: CreateMerchandisingRuleDto = {
      ...form,
      condition: buildConditionPayload(form.condition),
      brand: form.brand?.trim() ? form.brand.trim() : "",
      productIds: productIds
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      const response = await fetch(`${getSearchApiUrl()}/api/v1/admin/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Create failed with HTTP ${response.status}`);
      }

      setSuccess("Rule saved to staging.");
      window.setTimeout(() => {
        router.push("/admin/merchandising/rules");
        router.refresh();
      }, 900);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const stepContent = (() => {
    switch (step) {
      case 1:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Name the rule and set baseline scope before defining triggers.
            </p>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Rule name
              <input
                required
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                style={workflowInputStyle}
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
                Priority
                <input
                  type="number"
                  value={form.priority}
                  onChange={(event) =>
                    updateField("priority", Number(event.target.value))
                  }
                  style={workflowInputStyle}
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
                Active in staging
              </label>
            </div>
          </div>
        );
      case 2:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Define when this rule should fire. At least one trigger is required.
            </p>
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
                  style={workflowInputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
                Brand
                <CatalogAutocompleteInput
                  value={form.condition.brand ?? ""}
                  options={catalogVocabulary.brands}
                  placeholder="Select or type a brand"
                  onChange={(brand) => {
                    const next = { ...form.condition };
                    const trimmed = brand.trim();
                    if (trimmed) {
                      next.brand = trimmed;
                    } else {
                      delete next.brand;
                    }
                    updateField("condition", next);
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
                Category
                <CatalogAutocompleteInput
                  value={form.condition.category ?? ""}
                  options={catalogVocabulary.categories}
                  placeholder="Select or type a category"
                  onChange={(category) => {
                    const next = { ...form.condition };
                    const trimmed = category.trim();
                    if (trimmed) {
                      next.category = trimmed;
                    } else {
                      delete next.category;
                    }
                    updateField("condition", next);
                  }}
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
                  style={workflowInputStyle}
                >
                  <option value="">Any</option>
                  <option value="true">In stock</option>
                  <option value="false">Out of stock</option>
                </select>
              </label>
            </div>
          </div>
        );
      case 3:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Choose how matching products should be ranked.
            </p>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Action
              <select
                value={form.action}
                onChange={(event) =>
                  updateField("action", event.target.value as MerchandisingRuleAction)
                }
                style={workflowInputStyle}
              >
                <option value="pin">Pin</option>
                <option value="boost">Boost</option>
                <option value="bury">Bury</option>
                <option value="hide">Hide</option>
              </select>
            </label>
            {(form.action === "boost" || form.action === "bury") && (
              <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
                Boost / bury amount
                <input
                  type="number"
                  value={form.boostAmount ?? 10}
                  onChange={(event) =>
                    updateField("boostAmount", Number(event.target.value))
                  }
                  style={workflowInputStyle}
                />
              </label>
            )}
          </div>
        );
      case 4:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Optionally narrow the rule to specific products or a target brand.
            </p>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Target brand (optional)
              <CatalogAutocompleteInput
                value={form.brand ?? ""}
                options={catalogVocabulary.brands}
                placeholder="Select or type a target brand"
                onChange={(brand) =>
                  updateField("brand", brand.trim() ? brand.trim() : undefined)
                }
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Product IDs (comma-separated)
              <input
                value={productIds}
                onChange={(event) => setProductIds(event.target.value)}
                style={workflowInputStyle}
              />
            </label>
          </div>
        );
      case 5:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Review the assembled rule before saving to staging.
            </p>
            <pre
              style={{
                margin: 0,
                padding: "0.75rem",
                borderRadius: 8,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              {formatPreview(form, productIds)}
            </pre>
          </div>
        );
      case 6:
        return (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
              Save creates the rule in staging. You can edit or disable it from the Rules
              workspace.
            </p>
            {error ? (
              <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>
            ) : null}
            {success ? (
              <p style={{ margin: 0, color: "#15803d", fontSize: 14 }}>{success}</p>
            ) : null}
            <button
              type="button"
              disabled={saving || Boolean(success)}
              onClick={() => void saveRule()}
              style={workflowButtonStyle("primary")}
            >
              {saving ? "Saving..." : success ? "Saved" : "Save rule to staging"}
            </button>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <WorkflowShell
      title="New merchandising rule"
      description="Six-step guided create with preview before the rule lands in staging."
      backHref="/admin/merchandising/rules"
      backLabel="← Rules workspace"
      steps={STEPS}
      currentStep={step}
      stepLayout="sidebar"
      footer={
        <>
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            style={workflowButtonStyle("secondary")}
          >
            Back
          </button>
          {step < STEPS.length ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => setStep((current) => Math.min(STEPS.length, current + 1))}
              style={workflowButtonStyle("primary")}
            >
              Continue
            </button>
          ) : null}
        </>
      }
    >
      {stepContent}
    </WorkflowShell>
  );
}
