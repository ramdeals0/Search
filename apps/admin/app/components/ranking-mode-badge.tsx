import { formatRankingMode, rankingModeDescription } from "../lib/ranking-mode";

interface RankingModeBadgeProps {
  mode: string | undefined;
  label?: string;
  compact?: boolean;
}

export function RankingModeBadge({
  mode,
  label = "Ranking mode",
  compact = false,
}: RankingModeBadgeProps) {
  if (!mode) {
    return null;
  }

  const title = rankingModeDescription(mode);

  return (
    <div
      className="forge-callout forge-callout--info"
      style={{
        margin: 0,
        padding: compact ? "0.45rem 0.65rem" : "0.65rem 0.75rem",
      }}
      title={title}
    >
      <div style={{ fontSize: compact ? 12 : 13 }}>
        <strong>{label}:</strong> {formatRankingMode(mode)}
      </div>
      {!compact ? (
        <p
          style={{
            margin: "0.35rem 0 0",
            fontSize: 12,
            color: "var(--forge-text-muted)",
          }}
        >
          {title}
        </p>
      ) : null}
    </div>
  );
}
