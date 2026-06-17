import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import type { ParseProgress } from "@/types/log";
import { formatNumber } from "@/utils/format";

interface ParseProgressBarProps {
  progress: ParseProgress;
}

export function ParseProgressBar({ progress }: ParseProgressBarProps) {
  if (!progress.isParsing) return null;

  if (progress.phase === "scanning") {
    const pct =
      progress.totalLines > 0
        ? Math.round((progress.parsedLines / progress.totalLines) * 100)
        : 0;

    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Scanning for ERROR / WARN / FATAL… {formatNumber(progress.matchCount ?? 0)}{" "}
          found ({pct}% of file)
        </Typography>
        <LinearProgress
          variant={progress.totalLines > 0 ? "determinate" : "indeterminate"}
          value={pct}
          sx={{ height: 8, borderRadius: 1 }}
        />
      </Box>
    );
  }

  const pct =
    progress.totalLines > 0
      ? Math.round((progress.parsedLines / progress.totalLines) * 100)
      : 0;

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Loading context regions… {formatNumber(progress.entryCount)} entries (
        {progress.parsedLines} of {progress.windowCount ?? progress.totalLines} regions,{" "}
        {pct}%)
      </Typography>
      <LinearProgress
        variant={progress.totalLines > 0 ? "determinate" : "indeterminate"}
        value={pct}
        sx={{ height: 8, borderRadius: 1 }}
      />
    </Box>
  );
}
