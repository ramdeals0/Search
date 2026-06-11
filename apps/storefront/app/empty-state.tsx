type EmptyStateMode = "first-use" | "no-results" | "error";

interface EmptyStateProps {
  mode: EmptyStateMode;
  query?: string;
  errorMessage?: string;
}

const content: Record<
  EmptyStateMode,
  { title: string; body: string; action: string }
> = {
  "first-use": {
    title: "Search our catalog",
    body: "Find products by name, brand, category, or description. Try tools, hardware, or home improvement items.",
    action: "Enter a search term above to get started.",
  },
  "no-results": {
    title: "No matching products",
    body: "We couldn't find products that match your search. Try a different keyword, brand name, or category.",
    action: "Broaden your search or check spelling, then try again.",
  },
  error: {
    title: "Search unavailable",
    body: "We couldn't reach the search service right now. Make sure the search API is running locally.",
    action: "Start search-api and refresh this page.",
  },
};

export function EmptyState({ mode, query, errorMessage }: EmptyStateProps) {
  const { title, body, action } = content[mode];

  return (
    <section
      style={{
        marginTop: "1.5rem",
        padding: "1.25rem",
        borderRadius: 8,
        background: mode === "error" ? "#fef2f2" : "#f8fafc",
        border: `1px solid ${mode === "error" ? "#fca5a5" : "#e2e8f0"}`,
      }}
    >
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>{title}</h2>
      <p style={{ margin: "0 0 0.75rem", color: "#475569", lineHeight: 1.5 }}>
        {body}
      </p>
      {mode === "no-results" && query && (
        <p style={{ margin: "0 0 0.75rem", color: "#64748b", fontSize: 14 }}>
          Query: <strong>{query}</strong>
        </p>
      )}
      {mode === "error" && errorMessage && (
        <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: 14 }}>
          {errorMessage}
        </p>
      )}
      <p style={{ margin: 0, color: "#334155", fontSize: 14 }}>{action}</p>
    </section>
  );
}
