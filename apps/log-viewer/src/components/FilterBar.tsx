import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import SortIcon from "@mui/icons-material/Sort";
import type { LogFilterState, LogLevel, SortField } from "@/types/log";
import { toggleLevelFilter } from "@/utils/logFilter";
import { LevelBadge } from "./LevelBadge";

const QUICK_LEVELS: LogLevel[] = ["ERROR", "WARN", "FATAL"];

interface FilterBarProps {
  filters: LogFilterState;
  resultCount: number;
  onChange: (patch: Partial<LogFilterState>) => void;
}

export function FilterBar({ filters, resultCount, onChange }: FilterBarProps) {
  const toggleLevel = (level: LogLevel) => {
    onChange({ levelFilters: toggleLevelFilter(filters.levelFilters, level) });
  };

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
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ md: "center" }}
        >
          <TextField
            size="small"
            placeholder="Search log text…"
            value={filters.searchQuery}
            onChange={(e) => onChange({ searchQuery: e.target.value })}
            sx={{ flex: 1, minWidth: 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />

          <ToggleButtonGroup
            exclusive
            size="small"
            value={filters.severityMode}
            onChange={(_, value) => {
              if (value) onChange({ severityMode: value });
            }}
          >
            <ToggleButton value="all">Show all</ToggleButton>
            <ToggleButton value="errors-only">ERROR / WARN / FATAL</ToggleButton>
          </ToggleButtonGroup>

          <FormControlLabel
            control={
              <Switch
                checked={filters.showIgnored}
                onChange={(e) => onChange({ showIgnored: e.target.checked })}
                size="small"
              />
            }
            label="Show ignored"
          />
        </Stack>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Box component="span" sx={{ typography: "body2", color: "text.secondary", mr: 0.5 }}>
              Level:
            </Box>
            {QUICK_LEVELS.map((level) => (
              <Box
                key={level}
                onClick={() => toggleLevel(level)}
                sx={{
                  cursor: "pointer",
                  opacity: filters.levelFilters.size === 0 || filters.levelFilters.has(level) ? 1 : 0.35,
                  transition: "opacity 0.15s",
                }}
              >
                <LevelBadge level={level} />
              </Box>
            ))}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <SortIcon fontSize="small" color="action" />
            <ToggleButtonGroup
              exclusive
              size="small"
              value={filters.sortField}
              onChange={(_, value: SortField | null) => {
                if (value) onChange({ sortField: value });
              }}
            >
              <ToggleButton value="timestamp">Timestamp</ToggleButton>
              <ToggleButton value="severity">Severity</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={filters.sortDirection}
              onChange={(_, value) => {
                if (value) onChange({ sortDirection: value });
              }}
            >
              <ToggleButton value="asc">Asc</ToggleButton>
              <ToggleButton value="desc">Desc</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>

        <Box sx={{ typography: "body2", color: "text.secondary" }}>
          Showing {resultCount.toLocaleString()} entries
        </Box>
      </Stack>
    </Box>
  );
}
