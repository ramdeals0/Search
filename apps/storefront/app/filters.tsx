"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type {
  AvailableFacetsDto,
  SearchFiltersDto,
} from "@retailer-search/shared-types";

interface FiltersProps {
  facets: AvailableFacetsDto;
  activeFilters: SearchFiltersDto;
  query: string;
  pageSize: number;
}

const FILTER_GROUPS: Array<{
  key: keyof SearchFiltersDto;
  label: string;
  formatLabel?: (value: string) => string;
}> = [
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  {
    key: "inStock",
    label: "Availability",
    formatLabel: (value) => (value === "true" ? "In stock" : "Out of stock"),
  },
];

function getActiveValues(
  activeFilters: SearchFiltersDto,
  key: keyof SearchFiltersDto,
): string[] {
  return activeFilters[key] ?? [];
}

export function Filters({
  facets,
  activeFilters,
  query,
  pageSize,
}: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: keyof SearchFiltersDto, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const current = getActiveValues(activeFilters, key);
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    params.delete(key);
    for (const item of next) {
      params.append(key, item);
    }

    if (query) {
      params.set("query", query);
    } else {
      params.delete("query");
    }

    params.set("page", "1");
    params.set("pageSize", String(pageSize));

    router.push(`/?${params.toString()}`);
  };

  return (
    <aside className="store-filters">
      <h2 className="store-filters__title">Refine results</h2>

      {FILTER_GROUPS.map((group) => {
        const options = facets[group.key] ?? [];
        if (options.length === 0) {
          return null;
        }

        const activeValues = getActiveValues(activeFilters, group.key);

        return (
          <section key={group.key} style={{ marginBottom: "1.25rem" }}>
            <h3 className="store-filters__group-title">{group.label}</h3>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: "0.35rem",
              }}
            >
              {options.map((option) => {
                const label = group.formatLabel
                  ? group.formatLabel(option.value)
                  : option.value;
                const checked = activeValues.includes(option.value);

                return (
                  <li key={`${group.key}-${option.value}`}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => updateFilter(group.key, option.value)}
                      />
                      <span style={{ flex: 1 }}>{label}</span>
                      <span style={{ color: "var(--store-muted)" }}>
                        ({option.count})
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}
