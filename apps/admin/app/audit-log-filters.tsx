"use client";

import type { AuditLogFilterDto } from "@retailer-search/shared-types";

interface AuditLogFiltersProps {
  filters: AuditLogFilterDto;
  onChange: (filters: AuditLogFilterDto) => void;
}

const inputStyle = {
  padding: "0.45rem 0.6rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  minWidth: 140,
} as const;

export function AuditLogFilters({ filters, onChange }: AuditLogFiltersProps) {
  const update = (key: keyof AuditLogFilterDto, value: string) => {
    onChange({
      ...filters,
      [key]: value.trim() ? value.trim() : undefined,
    });
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1rem",
      }}
    >
      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
        Action type
        <select
          value={filters.actionType ?? ""}
          onChange={(event) => update("actionType", event.target.value)}
          style={inputStyle}
        >
          <option value="">All</option>
          <option value="create_rule">create_rule</option>
          <option value="update_rule">update_rule</option>
          <option value="create_synonym">create_synonym</option>
          <option value="update_synonym">update_synonym</option>
          <option value="delete_synonym">delete_synonym</option>
          <option value="apply_suggestion">apply_suggestion</option>
          <option value="preview_suggestion_action">
            preview_suggestion_action
          </option>
          <option value="query_preview">query_preview</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
        Entity type
        <select
          value={filters.entityType ?? ""}
          onChange={(event) => update("entityType", event.target.value)}
          style={inputStyle}
        >
          <option value="">All</option>
          <option value="merchandising_rule">merchandising_rule</option>
          <option value="synonym">synonym</option>
          <option value="suggestion">suggestion</option>
          <option value="search_query">search_query</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
        Outcome
        <select
          value={filters.outcome ?? ""}
          onChange={(event) => update("outcome", event.target.value)}
          style={inputStyle}
        >
          <option value="">All</option>
          <option value="success">success</option>
          <option value="failure">failure</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
        Keyword
        <input
          value={filters.keyword ?? ""}
          onChange={(event) => update("keyword", event.target.value)}
          placeholder="Search summary, labels..."
          style={inputStyle}
        />
      </label>

      <div style={{ display: "flex", alignItems: "end" }}>
        <button
          type="button"
          onClick={() => onChange({})}
          style={{
            padding: "0.45rem 0.75rem",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            background: "#fff",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
