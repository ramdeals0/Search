export type LogLevel =
  | "TRACE"
  | "DEBUG"
  | "INFO"
  | "WARN"
  | "ERROR"
  | "FATAL"
  | "UNKNOWN";

export interface ParsedLogEntry {
  id: string;
  timestamp: Date | null;
  level: LogLevel;
  message: string;
  fileName: string;
  lineNumber: number;
  endLineNumber: number;
  lineCount: number;
  /** Loaded on demand for large files. */
  rawText?: string;
  lines?: string[];
  groupId: string;
  isPrimary: boolean;
}

/** Lightweight index entry — no raw text stored in memory. */
export type LogEntryIndex = Omit<
  ParsedLogEntry,
  "rawText" | "lines" | "isPrimary"
>;

export type SeverityFilterMode = "all" | "errors-only";

export type SortField = "timestamp" | "severity";
export type SortDirection = "asc" | "desc";

export interface LogFilterState {
  searchQuery: string;
  levelFilters: Set<LogLevel>;
  severityMode: SeverityFilterMode;
  showIgnored: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
}

export interface LogSummaryStats {
  total: number;
  error: number;
  warn: number;
  fatal: number;
  ignored: number;
  /** True when more log lines are still being parsed. */
  partial?: boolean;
}

export interface ParseProgress {
  parsedLines: number;
  totalLines: number;
  entryCount: number;
  isParsing: boolean;
  phase?: "scanning" | "parsing";
  matchCount?: number;
  windowCount?: number;
  loadedLineCount?: number;
}

export interface LogFileSource {
  name: string;
  content: string;
}

export const SEVERITY_ORDER: Record<LogLevel, number> = {
  FATAL: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
  TRACE: 5,
  UNKNOWN: 6,
};

export const LEVEL_COLORS: Record<
  LogLevel,
  { bg: string; text: string; border: string }
> = {
  FATAL: { bg: "#3b0764", text: "#f5d0fe", border: "#7e22ce" },
  ERROR: { bg: "#7f1d1d", text: "#fecaca", border: "#dc2626" },
  WARN: { bg: "#78350f", text: "#fde68a", border: "#f59e0b" },
  INFO: { bg: "#1e3a5f", text: "#bfdbfe", border: "#3b82f6" },
  DEBUG: { bg: "#1f2937", text: "#d1d5db", border: "#6b7280" },
  TRACE: { bg: "#111827", text: "#9ca3af", border: "#4b5563" },
  UNKNOWN: { bg: "#374151", text: "#e5e7eb", border: "#9ca3af" },
};

export const DEFAULT_FILTER_STATE: LogFilterState = {
  searchQuery: "",
  levelFilters: new Set<LogLevel>(),
  severityMode: "all",
  showIgnored: false,
  sortField: "timestamp",
  sortDirection: "desc",
};
