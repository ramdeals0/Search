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
  DiscoveryRecentResponseDto,
  SearchFiltersDto,
} from "@retailer-search/shared-types";
import { fetchSearchApi } from "./lib/search-api-client";
import { getOrCreateSessionId } from "./lib/session-id";

interface AutocompleteProps {
  initialQuery: string;
  pageSize: number;
  activeFilters: SearchFiltersDto;
  onQueryChange?: (query: string) => void;
  showRecentSearches?: boolean;
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
  showRecentSearches = false,
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
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [hasLoadedRecent, setHasLoadedRecent] = useState(false);

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
        const sessionId = getOrCreateSessionId();
        const response = await fetchSearchApi(
          `/api/v1/autocomplete?query=${encodeURIComponent(query.trim())}`,
          {
            signal: controller.signal,
            sessionId,
          },
        );

        if (!response.ok) {
          setSuggestions([]);
          setIsOpen(false);
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

  const loadRecentQueries = useCallback(async () => {
    if (!showRecentSearches || hasLoadedRecent) {
      return;
    }

    setIsLoadingRecent(true);
    try {
      const sessionId = getOrCreateSessionId();
      const response = await fetchSearchApi("/api/v1/discovery/recent?limit=10", {
        sessionId,
      });
      if (!response.ok) {
        setRecentQueries([]);
        return;
      }
      const data = (await response.json()) as DiscoveryRecentResponseDto;
      const queries = data.queries.map((entry) => entry.query).filter(Boolean);
      setRecentQueries(queries);
      if (queries.length > 0) {
        setIsOpen(true);
      }
    } catch {
      setRecentQueries([]);
    } finally {
      setHasLoadedRecent(true);
      setIsLoadingRecent(false);
    }
  }, [hasLoadedRecent, showRecentSearches]);

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
    const hasInput = query.trim().length > 0;
    const options = hasInput ? suggestions : recentQueries.map((value) => ({ value }));

    if (!isOpen || options.length === 0) {
      if (event.key === "Enter") {
        return;
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current >= options.length - 1 ? 0 : current + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? options.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      navigateToSearch(options[activeIndex]?.value ?? query);
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
          if (query.trim().length === 0) {
            void loadRecentQueries();
          }
          if (suggestions.length > 0 || recentQueries.length > 0) {
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

      {isOpen && (query.trim().length > 0 ? suggestions.length > 0 : recentQueries.length > 0) && (
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
          {(query.trim().length > 0
            ? suggestions.map((suggestion) => ({
                value: suggestion.value,
                typeLabel: formatTypeLabel(suggestion.type),
              }))
            : recentQueries.map((value) => ({
                value,
                typeLabel: "Recent",
              }))).map((item, index) => {
            const isActive = index === activeIndex;

            return (
              <li key={`${item.value}-${index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => navigateToSearch(item.value)}
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
                  <span>{item.value}</span>
                  <span style={{ color: "#64748b", whiteSpace: "nowrap" }}>
                    {item.typeLabel}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {(isLoading && query.trim()) || (isLoadingRecent && !query.trim()) ? (
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
      ) : null}
    </div>
  );
}
