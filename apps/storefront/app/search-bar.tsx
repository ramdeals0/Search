"use client";

import type { SearchFiltersDto } from "@retailer-search/shared-types";
import { Autocomplete } from "./autocomplete";

interface SearchBarProps {
  query: string;
  pageSize: number;
  activeFilters: SearchFiltersDto;
  compact?: boolean;
}

export function SearchBar({
  query,
  pageSize,
  activeFilters,
  compact = false,
}: SearchBarProps) {
  return (
    <form
      action="/"
      method="get"
      className="store-search-form"
      role="search"
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
        className={`store-btn store-btn--primary${compact ? "" : ""}`}
      >
        Search
      </button>
    </form>
  );
}
