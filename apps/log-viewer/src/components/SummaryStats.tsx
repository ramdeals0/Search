import Grid from "@mui/material/Grid2";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import type { LogSummaryStats } from "@/types/log";
import { formatNumber } from "@/utils/format";

interface StatCardProps {
  label: string;
  value: number;
  accent: string;
}

function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        height: "100%",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          width: 4,
          height: "100%",
          bgcolor: accent,
        },
      }}
    >
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontVariantNumeric: "tabular-nums" }}>
        {formatNumber(value)}
      </Typography>
    </Paper>
  );
}

interface SummaryStatsProps {
  stats: LogSummaryStats;
}

export function SummaryStats({ stats }: SummaryStatsProps) {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Summary
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Total logs" value={stats.total} accent="#6366f1" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Errors" value={stats.error} accent="#dc2626" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Warnings" value={stats.warn} accent="#f59e0b" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Fatal" value={stats.fatal} accent="#7e22ce" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Ignored" value={stats.ignored} accent="#64748b" />
        </Grid>
      </Grid>
      {stats.partial && (
        <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: "block" }}>
          Still parsing — counts update as more of the file is loaded.
        </Typography>
      )}
    </Box>
  );
}
