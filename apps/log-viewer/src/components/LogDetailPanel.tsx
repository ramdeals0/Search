import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import type { ParsedLogEntry } from "@/types/log";
import { formatTimestamp } from "@/utils/format";
import { monoFont } from "@/theme";
import { LevelBadge } from "./LevelBadge";

interface LogDetailPanelProps {
  entry: ParsedLogEntry | null;
  loading?: boolean;
  isIgnored: boolean;
  open: boolean;
  onClose: () => void;
  onIgnore: () => void;
  onUnignore: () => void;
}

export function LogDetailPanel({
  entry,
  loading = false,
  isIgnored,
  open,
  onClose,
  onIgnore,
  onUnignore,
}: LogDetailPanelProps) {
  return (
    <Drawer
      anchor="right"
      open={open && !!entry}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 480, md: 560 },
          bgcolor: "background.paper",
          borderLeft: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      {entry && (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Typography variant="h6">Log details</Typography>
            <IconButton onClick={onClose} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Stack>

          <Box sx={{ p: 2, flex: 1, overflow: "auto" }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <LevelBadge level={entry.level} size="medium" />
                {isIgnored && (
                  <Typography variant="caption" color="text.secondary">
                    (ignored)
                  </Typography>
                )}
              </Stack>

              <DetailRow label="Timestamp" value={formatTimestamp(entry.timestamp)} />
              <DetailRow label="File" value={entry.fileName} />
              <DetailRow label="Line" value={String(entry.lineNumber)} />
              <DetailRow label="Group ID" value={entry.groupId} mono />

              <Divider />

              <Typography variant="subtitle2" color="text.secondary">
                Full message
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 2,
                  borderRadius: 1.5,
                  bgcolor: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid",
                  borderColor: "divider",
                  fontFamily: monoFont,
                  fontSize: "0.78rem",
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflow: "auto",
                  maxHeight: "50vh",
                  minHeight: 80,
                }}
              >
                {loading ? "Loading full log text…" : entry.rawText}
              </Box>

              <Typography variant="caption" color="text.secondary">
                {entry.lines?.length ?? entry.lineCount} line
                {(entry.lines?.length ?? entry.lineCount) !== 1 ? "s" : ""} in this event
              </Typography>
            </Stack>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}
          >
            <Button
              variant="outlined"
              startIcon={isIgnored ? <VisibilityIcon /> : <VisibilityOffIcon />}
              onClick={isIgnored ? onUnignore : onIgnore}
              fullWidth
            >
              {isIgnored ? "Unignore log" : "Ignore log"}
            </Button>
          </Stack>
        </Box>
      )}
    </Drawer>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={mono ? { fontFamily: monoFont, fontSize: "0.78rem", wordBreak: "break-all" } : undefined}
      >
        {value}
      </Typography>
    </Box>
  );
}
