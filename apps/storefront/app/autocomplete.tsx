"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  AutocompleteResponseDto,
  AutocompleteSuggestionDto,
  SearchFiltersDto,
} from "@retailer-search/shared-types";

const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? "http://localhost:4001";

interface AutocompleteProps {
  initialQuery: string;
  pageSize: number;
  activeFilters: SearchFiltersDto;
  onQueryChange?: (query: string) => void;
}

function buildSearchUrl(
  query: string,
  pageSize: number,
  activeFilters: SearchFiltersDto,
): string {
  const params = new URLSearchParams();
  params.set("query", query);
  params.set("page", "1");
  params.set("pageSize", String(pageSize));

  for (const value of activeFilters.brand ?? []) {
    params.append("brand", value);
  }
  for (const value of activeFilters.category ?? []) {
    params.append("category", value);
  }
  for (const value of activeFilters.inStock ?? []) {
    params.append("inStock", value);
  }

  return `/?${params.toString()}`;
}

function formatTypeLabel(type: AutocompleteSuggestionDto["type"]): string {
  switch (type) {
    case "product":
      return "Product";
    case "brand":
      return "Brand";
    case "category":
      return "Category";
    default:
      return "Query";
  }
}

export function Autocomplete({
  initialQuery,
  pageSize,
  activeFilters,
  onQueryChange,
}: AutocompleteProps) {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestionDto[]>(
    [],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const navigateToSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }
      router.push(buildSearchUrl(trimmed, pageSize, activeFilters));
      setIsOpen(false);
    },
    [activeFilters, pageSize, router],
  );

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const url = new URL("/api/v1/autocomplete", SEARCH_API_URL);
        url.searchParams.set("query", query);
        const response = await fetch(url.toString(), {
          signal: controller.signal,
        });

        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const data = (await response.json()) as AutocompleteResponseDto;
        setSuggestions(data.suggestions);
        setIsOpen(data.suggestions.length > 0);
        setActiveIndex(-1);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (event.key === "Enter") {
        return;
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current >= suggestions.length - 1 ? 0 : current + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      navigateToSearch(suggestions[activeIndex]?.value ?? query);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="store-search-form__input-wrap">
      <input
        type="search"
        name="query"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          onQueryChange?.(event.target.value);
        }}
        onFocus={() => {
          if (suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search products, brands, categories..."
        aria-label="Search products"
        aria-autocomplete="list"
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        className="store-input"
      />

      {isOpen && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            margin: 0,
            padding: "0.25rem 0",
            listStyle: "none",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
            zIndex: 20,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {suggestions.map((suggestion, index) => {
            const isActive = index === activeIndex;

            return (
              <li key={`${suggestion.type}-${suggestion.value}-${index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => navigateToSearch(suggestion.value)}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    padding: "0.65rem 0.75rem",
                    border: "none",
                    background: isActive ? "#f1f5f9" : "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  <span>{suggestion.value}</span>
                  <span style={{ color: "#64748b", whiteSpace: "nowrap" }}>
                    {formatTypeLabel(suggestion.type)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {isLoading && query.trim() && (
        <span
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          ...
        </span>
      )}
    </div>
  );
}
