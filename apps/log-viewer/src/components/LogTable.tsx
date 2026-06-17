import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LogEntryIndex } from "@/types/log";
import { formatTimestamp, truncate } from "@/utils/format";
import { monoFont } from "@/theme";
import { LevelBadge } from "./LevelBadge";

const ROW_HEIGHT = 52;

interface LogTableProps {
  entries: LogEntryIndex[];
  selectedId: string | null;
  ignoredIds: Set<string>;
  parsing: boolean;
  onSelect: (id: string) => void;
  onIgnore: (id: string) => void;
  onUnignore: (id: string) => void;
  onLoadMore: () => void;
}

export function LogTable({
  entries,
  selectedId,
  ignoredIds,
  parsing,
  onSelect,
  onIgnore,
  onUnignore,
  onLoadMore,
}: LogTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const onScroll = () => {
      if (!parsing && el.scrollTop + el.clientHeight >= el.scrollHeight - ROW_HEIGHT * 4) {
        onLoadMore();
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [parsing, onLoadMore, entries.length]);

  if (!entries.length) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6,
          textAlign: "center",
          borderRadius: 2,
        }}
      >
        <Typography color="text.secondary">
          No log entries match the current filters. Load a folder or adjust filters.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "160px 90px 1fr 140px 60px 40px",
          gap: 1,
          px: 2,
          py: 1,
          bgcolor: "rgba(15, 23, 42, 0.6)",
          borderBottom: "1px solid",
          borderColor: "divider",
          typography: "caption",
          fontWeight: 600,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <span>Timestamp</span>
        <span>Level</span>
        <span>Message</span>
        <span>File</span>
        <span>Line</span>
        <span />
      </Box>

      <Box ref={parentRef} sx={{ flex: 1, overflow: "auto", minHeight: 320 }}>
        <Box
          sx={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const entry = entries[virtualRow.index];
            const isIgnored = ignoredIds.has(entry.id);
            const isSelected = selectedId === entry.id;
            const lineCount = entry.lineCount;

            return (
              <Box
                key={entry.id}
                onClick={() => onSelect(entry.id)}
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: "grid",
                  gridTemplateColumns: "160px 90px 1fr 140px 60px 40px",
                  gap: 1,
                  alignItems: "center",
                  px: 2,
                  cursor: "pointer",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  bgcolor: isSelected
                    ? "rgba(99, 102, 241, 0.18)"
                    : virtualRow.index % 2 === 0
                      ? "transparent"
                      : "rgba(15, 23, 42, 0.35)",
                  opacity: isIgnored ? 0.45 : 1,
                  "&:hover": {
                    bgcolor: isSelected
                      ? "rgba(99, 102, 241, 0.24)"
                      : "rgba(51, 65, 85, 0.4)",
                  },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ fontFamily: monoFont, fontSize: "0.75rem" }}
                  noWrap
                >
                  {formatTimestamp(entry.timestamp)}
                </Typography>
                <Box>
                  <LevelBadge level={entry.level} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap title={entry.message}>
                    {truncate(entry.message, 100)}
                  </Typography>
                  {lineCount > 1 && (
                    <Typography variant="caption" color="text.secondary">
                      +{lineCount - 1} continuation line{lineCount > 2 ? "s" : ""}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary" noWrap title={entry.fileName}>
                  {entry.fileName}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: monoFont, fontSize: "0.75rem" }}
                  color="text.secondary"
                >
                  {entry.lineNumber}
                </Typography>
                <Tooltip title={isIgnored ? "Unignore" : "Ignore"}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isIgnored) onUnignore(entry.id);
                      else onIgnore(entry.id);
                    }}
                  >
                    {isIgnored ? (
                      <VisibilityIcon fontSize="small" />
                    ) : (
                      <VisibilityOffIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Paper>
  );
}
