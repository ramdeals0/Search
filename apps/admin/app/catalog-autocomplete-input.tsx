"use client";

import { useMemo, useState } from "react";

interface CatalogAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export function CatalogAutocompleteInput({
  value,
  onChange,
  options,
  placeholder,
}: CatalogAutocompleteInputProps) {
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    const needle = value.trim().toLowerCase();
    const matches = needle
      ? options.filter((option) => option.toLowerCase().includes(needle))
      : options;

    return matches.slice(0, 10);
  }, [options, value]);

  return (
    <div style={{ position: "relative" }}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setFocused(false), 120);
        }}
        style={inputStyle}
        autoComplete="off"
      />

      {focused && suggestions.length > 0 ? (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            margin: 0,
            padding: "0.25rem 0",
            listStyle: "none",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
            maxHeight: "12rem",
            overflowY: "auto",
          }}
        >
          {suggestions.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option);
                  setFocused(false);
                }}
                style={{
                  width: "100%",
                  padding: "0.45rem 0.65rem",
                  border: "none",
                  background: option === value ? "#f1f5f9" : "transparent",
                  textAlign: "left",
                  font: "inherit",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const inputStyle = {
  padding: "0.5rem 0.65rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
} as const;
