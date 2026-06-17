import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { useState } from "react";
import type { LogEntryIndex } from "@/types/log";
import { getIgnoredEntries } from "@/utils/ignoredStore";
import { truncate, formatTimestamp } from "@/utils/format";
import { LevelBadge } from "./LevelBadge";

interface IgnoredLogManagerProps {
  entries: LogEntryIndex[];
  ignoredIds: Set<string>;
  onUnignore: (id: string) => void;
  onUnignoreAll: () => void;
}

export function IgnoredLogManager({
  entries,
  ignoredIds,
  onUnignore,
  onUnignoreAll,
}: IgnoredLogManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const ignoredEntries = getIgnoredEntries(entries, ignoredIds);

  if (!ignoredIds.size) return null;

  return (
    <Paper elevation={0} sx={{ borderRadius: 2, overflow: "hidden" }}>
      <Box
        sx={{
          px: 2,
          py: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "rgba(15, 23, 42, 0.5)",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Typography variant="subtitle2">
          Ignored logs ({ignoredIds.size})
        </Typography>
        <StackActions
          expanded={expanded}
          count={ignoredIds.size}
          onUnignoreAll={onUnignoreAll}
          onToggle={() => setExpanded((v) => !v)}
        />
      </Box>

      <Collapse in={expanded}>
        <List dense disablePadding sx={{ maxHeight: 240, overflow: "auto" }}>
          {ignoredEntries.map((entry) => (
            <ListItem
              key={entry.id}
              secondaryAction={
                <Button size="small" onClick={() => onUnignore(entry.id)}>
                  Unignore
                </Button>
              }
              sx={{ borderTop: "1px solid", borderColor: "divider" }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5 }}>
                    <LevelBadge level={entry.level} />
                    <Typography variant="caption" color="text.secondary">
                      {formatTimestamp(entry.timestamp)}
                    </Typography>
                  </Box>
                }
                secondary={truncate(entry.message, 80)}
              />
            </ListItem>
          ))}
        </List>
      </Collapse>
    </Paper>
  );
}

function StackActions({
  expanded,
  count,
  onUnignoreAll,
  onToggle,
}: {
  expanded: boolean;
  count: number;
  onUnignoreAll: () => void;
  onToggle: () => void;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Button
        size="small"
        startIcon={<DeleteSweepIcon />}
        onClick={(e) => {
          e.stopPropagation();
          onUnignoreAll();
        }}
        disabled={count === 0}
      >
        Clear all
      </Button>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        sx={{
          transform: expanded ? "rotate(180deg)" : "none",
          transition: "transform 0.2s",
        }}
      >
        <ExpandMoreIcon />
      </IconButton>
    </Box>
  );
}
