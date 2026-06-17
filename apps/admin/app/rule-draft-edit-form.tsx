"use client";

import { useMemo, useState } from "react";
import type {
  RuleDraftDto,
  SuggestedMerchandisingRuleDraft,
  UpdateRuleDraftRequestDto,
} from "@retailer-search/shared-types";

interface RuleDraftEditFormProps {
  draft: RuleDraftDto;
  busy: boolean;
  onSave: (payload: UpdateRuleDraftRequestDto) => Promise<void>;
  onCancel: () => void;
}

function readSuggestedRule(draft: RuleDraftDto): SuggestedMerchandisingRuleDraft {
  const rule = draft.suggestedRule as Partial<SuggestedMerchandisingRuleDraft>;
  return {
    name: typeof rule.name === "string" ? rule.name : `Recover zero results for '${draft.query}'`,
    action:
      rule.action === "pin" ||
      rule.action === "boost" ||
      rule.action === "bury" ||
      rule.action === "hide"
        ? rule.action
        : "boost",
    condition: {
      query:
        typeof rule.condition?.query === "string"
          ? rule.condition.query
          : draft.query.toLowerCase(),
      brand: typeof rule.condition?.brand === "string" ? rule.condition.brand : undefined,
      category:
        typeof rule.condition?.category === "string" ? rule.condition.category : undefined,
      inStock:
        typeof rule.condition?.inStock === "boolean" ? rule.condition.inStock : undefined,
    },
    productIds: Array.isArray(rule.productIds)
      ? rule.productIds.filter((id): id is string => typeof id === "string")
      : [],
    boostAmount: typeof rule.boostAmount === "number" ? rule.boostAmount : 15,
    buryAmount: typeof rule.buryAmount === "number" ? rule.buryAmount : 15,
    rationale: typeof rule.rationale === "string" ? rule.rationale : draft.rationale,
  };
}

const fieldStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
} as const;

const labelStyle = {
  display: "grid",
  gap: "0.35rem",
  fontSize: 13,
  color: "#334155",
} as const;

export function RuleDraftEditForm({ draft, busy, onSave, onCancel }: RuleDraftEditFormProps) {
  const initial = useMemo(() => readSuggestedRule(draft), [draft]);
  const [query, setQuery] = useState(draft.query);
  const [matchQuery, setMatchQuery] = useState(initial.condition?.query ?? draft.query.toLowerCase());
  const [name, setName] = useState(initial.name);
  const [action, setAction] = useState<SuggestedMerchandisingRuleDraft["action"]>(initial.action);
  const [productIds, setProductIds] = useState(initial.productIds?.join(", ") ?? "");
  const [boostAmount, setBoostAmount] = useState(String(initial.boostAmount ?? 15));
  const [buryAmount, setBuryAmount] = useState(String(initial.buryAmount ?? 15));
  const [rationale, setRationale] = useState(initial.rationale ?? draft.rationale ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedQuery = query.trim();
    const trimmedMatchQuery = matchQuery.trim();
    const trimmedName = name.trim();

    if (!trimmedQuery) {
      setError("Query is required.");
      return;
    }
    if (!trimmedMatchQuery) {
      setError("Match query is required.");
      return;
    }
    if (!trimmedName) {
      setError("Rule name is required.");
      return;
    }

    const payload: UpdateRuleDraftRequestDto = {
      query: trimmedQuery,
      rationale: rationale.trim() || undefined,
      suggestedRule: {
        name: trimmedName,
        action,
        condition: {
          query: trimmedMatchQuery.toLowerCase(),
        },
        productIds: productIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
        boostAmount: action === "boost" ? Number(boostAmount) || 15 : undefined,
        buryAmount: action === "bury" ? Number(buryAmount) || 15 : undefined,
      },
    };

    try {
      await onSave(payload);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      style={{
        marginTop: "0.75rem",
        padding: "0.75rem",
        border: "1px solid #dbeafe",
        borderRadius: 8,
        background: "#fff",
        display: "grid",
        gap: "0.75rem",
      }}
    >
      <label style={labelStyle}>
        Zero-result query
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={fieldStyle}
          disabled={busy}
        />
      </label>

      <label style={labelStyle}>
        Rule match query
        <input
          value={matchQuery}
          onChange={(event) => setMatchQuery(event.target.value)}
          style={fieldStyle}
          disabled={busy}
        />
      </label>

      <label style={labelStyle}>
        Rule name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          style={fieldStyle}
          disabled={busy}
        />
      </label>

      <label style={labelStyle}>
        Action
        <select
          value={action}
          onChange={(event) =>
            setAction(event.target.value as SuggestedMerchandisingRuleDraft["action"])
          }
          style={fieldStyle}
          disabled={busy}
        >
          <option value="pin">Pin</option>
          <option value="boost">Boost</option>
          <option value="bury">Bury</option>
          <option value="hide">Hide</option>
        </select>
      </label>

      <label style={labelStyle}>
        Product IDs
        <input
          value={productIds}
          onChange={(event) => setProductIds(event.target.value)}
          placeholder="SKU-1, SKU-2"
          style={fieldStyle}
          disabled={busy}
        />
      </label>

      {action === "boost" ? (
        <label style={labelStyle}>
          Boost amount
          <input
            type="number"
            min={1}
            value={boostAmount}
            onChange={(event) => setBoostAmount(event.target.value)}
            style={fieldStyle}
            disabled={busy}
          />
        </label>
      ) : null}

      {action === "bury" ? (
        <label style={labelStyle}>
          Bury amount
          <input
            type="number"
            min={1}
            value={buryAmount}
            onChange={(event) => setBuryAmount(event.target.value)}
            style={fieldStyle}
            disabled={busy}
          />
        </label>
      ) : null}

      <label style={labelStyle}>
        Rationale
        <textarea
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          rows={3}
          style={{ ...fieldStyle, resize: "vertical" }}
          disabled={busy}
        />
      </label>

      {error ? <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{error}</p> : null}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "0.45rem 0.75rem",
            border: "none",
            borderRadius: 6,
            background: "#0f172a",
            color: "#fff",
            cursor: busy ? "wait" : "pointer",
            fontSize: 13,
          }}
        >
          {busy ? "Saving..." : "Save draft"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          style={{
            padding: "0.45rem 0.75rem",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            background: "#fff",
            cursor: busy ? "wait" : "pointer",
            fontSize: 13,
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
