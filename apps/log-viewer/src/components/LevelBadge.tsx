import Chip from "@mui/material/Chip";
import type { LogLevel } from "@/types/log";
import { LEVEL_COLORS } from "@/types/log";

interface LevelBadgeProps {
  level: LogLevel;
  size?: "small" | "medium";
}

export function LevelBadge({ level, size = "small" }: LevelBadgeProps) {
  const colors = LEVEL_COLORS[level];
  return (
    <Chip
      label={level}
      size={size}
      sx={{
        bgcolor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        fontWeight: 600,
        fontSize: size === "small" ? "0.7rem" : "0.75rem",
        letterSpacing: "0.04em",
        height: size === "small" ? 22 : 26,
      }}
    />
  );
}
