"use client";

import type { SearchFiltersDto } from "@retailer-search/shared-types";
import { Autocomplete } from "./autocomplete";

interface SearchBarProps {
  query: string;
  pageSize: number;
  activeFilters: SearchFiltersDto;
}

export function SearchBar({ query, pageSize, activeFilters }: SearchBarProps) {
  return (
    <form
      action="/"
      method="get"
      style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}
    >
      <Autocomplete
        initialQuery={query}
        pageSize={pageSize}
        activeFilters={activeFilters}
      />
      <input type="hidden" name="page" value="1" />
      <input type="hidden" name="pageSize" value={pageSize} />
      {activeFilters.brand?.map((value) => (
        <input key={`brand-${value}`} type="hidden" name="brand" value={value} />
      ))}
      {activeFilters.category?.map((value) => (
        <input
          key={`category-${value}`}
          type="hidden"
          name="category"
          value={value}
        />
      ))}
      {activeFilters.inStock?.map((value) => (
        <input
          key={`inStock-${value}`}
          type="hidden"
          name="inStock"
          value={value}
        />
      ))}
      <button
        type="submit"
        style={{
          padding: "0.65rem 1rem",
          fontSize: 16,
          border: "none",
          borderRadius: 6,
          background: "#0f172a",
          color: "#fff",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Search
      </button>
    </form>
  );
}
