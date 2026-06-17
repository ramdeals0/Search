import type {
  LogFilterState,
  LogLevel,
  LogSummaryStats,
  LogEntryIndex,
  SortDirection,
  SortField,
} from "@/types/log";
import { SEVERITY_ORDER } from "@/types/log";

const ERROR_LEVELS: LogLevel[] = ["ERROR", "WARN", "FATAL"];

export function filterLogs(
  entries: LogEntryIndex[],
  filters: LogFilterState,
  ignoredIds: Set<string>,
): LogEntryIndex[] {
  const query = filters.searchQuery.trim().toLowerCase();

  let result = entries.filter((entry) => {
    const isIgnored = ignoredIds.has(entry.id);

    if (isIgnored && !filters.showIgnored) return false;
    if (filters.severityMode === "errors-only" && !ERROR_LEVELS.includes(entry.level))
      return false;
    if (
      filters.levelFilters.size > 0 &&
      !filters.levelFilters.has(entry.level)
    ) {
      return false;
    }
    if (query) {
      const haystack = `${entry.message} ${entry.fileName} ${entry.level}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  result = sortLogs(result, filters.sortField, filters.sortDirection);
  return result;
}

export function sortLogs(
  entries: LogEntryIndex[],
  field: SortField,
  direction: SortDirection,
): LogEntryIndex[] {
  const sorted = [...entries].sort((a, b) => {
    if (field === "timestamp") {
      const ta = a.timestamp?.getTime() ?? 0;
      const tb = b.timestamp?.getTime() ?? 0;
      return ta - tb;
    }
    return SEVERITY_ORDER[a.level] - SEVERITY_ORDER[b.level];
  });

  return direction === "desc" ? sorted.reverse() : sorted;
}

export function computeSummaryStats(
  entries: LogEntryIndex[],
  ignoredIds: Set<string>,
): LogSummaryStats {
  let error = 0;
  let warn = 0;
  let fatal = 0;
  let ignored = 0;

  for (const entry of entries) {
    if (ignoredIds.has(entry.id)) ignored++;
    if (entry.level === "ERROR") error++;
    if (entry.level === "WARN") warn++;
    if (entry.level === "FATAL") fatal++;
  }

  return {
    total: entries.length,
    error,
    warn,
    fatal,
    ignored,
  };
}

export function toggleLevelFilter(
  current: Set<LogLevel>,
  level: LogLevel,
): Set<LogLevel> {
  const next = new Set(current);
  if (next.has(level)) next.delete(level);
  else next.add(level);
  return next;
}
