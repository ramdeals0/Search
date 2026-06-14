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
    title: "Start shopping",
    body: "Search for tools, hardware, outdoor gear, and more — or browse departments from the home page.",
    action: "Use the search bar above or explore Shop all.",
  },
  "no-results": {
    title: "No products found",
    body: "Try a different keyword, check spelling, or browse a category instead.",
    action: "Clear filters or search for a broader term.",
  },
  error: {
    title: "Store temporarily unavailable",
    body: "We couldn't reach the product catalog. Make sure the search API is running.",
    action: "Refresh the page or contact support if the issue persists.",
  },
};

export function EmptyState({ mode, query, errorMessage }: EmptyStateProps) {
  const { title, body, action } = content[mode];

  return (
    <section
      className={`store-empty${mode === "error" ? " store-empty--error" : ""}`}
    >
      <h2 className="store-empty__title">{title}</h2>
      <p className="store-empty__text">{body}</p>
      {mode === "no-results" && query ? (
        <p className="store-empty__text">
          Searched for: <strong>{query}</strong>
        </p>
      ) : null}
      {mode === "error" && errorMessage ? (
        <p className="store-empty__text" style={{ color: "var(--store-danger)" }}>
          {errorMessage}
        </p>
      ) : null}
      <p className="store-empty__text">{action}</p>
    </section>
  );
}
