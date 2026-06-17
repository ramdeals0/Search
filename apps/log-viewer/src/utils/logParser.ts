import type { LogLevel, ParsedLogEntry } from "@/types/log";

const LOG_LEVEL_PATTERN =
  /\b(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|ERR|FATAL|CRITICAL)\b/i;

const TIMESTAMP_PATTERNS = [
  /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)/,
  /^(\[\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?\])/,
  /^(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)/,
];

const STACK_TRACE_LINE =
  /^(?:\s+at\s+|Caused by:|\.{3}\s+\d+\s+more|\tat\s|\s*\.\.\.\s+\d+\s+common frames omitted)/i;

function normalizeLevel(raw: string): LogLevel {
  const upper = raw.toUpperCase();
  if (upper === "WARNING") return "WARN";
  if (upper === "ERR") return "ERROR";
  if (upper === "CRITICAL") return "FATAL";
  if (
    upper === "TRACE" ||
    upper === "DEBUG" ||
    upper === "INFO" ||
    upper === "WARN" ||
    upper === "ERROR" ||
    upper === "FATAL"
  ) {
    return upper;
  }
  return "UNKNOWN";
}

function parseTimestamp(text: string): Date | null {
  for (const pattern of TIMESTAMP_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const cleaned = match[1].replace(/^\[|\]$/g, "");
      const date = new Date(cleaned);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
}

function tryParseJsonLine(line: string): {
  level: LogLevel;
  message: string;
  timestamp: Date | null;
} | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    const levelRaw =
      obj.level ?? obj.severity ?? obj.loglevel ?? obj.logLevel ?? "";
    const messageRaw =
      obj.message ?? obj.msg ?? obj.error ?? obj.text ?? "";
    const tsRaw =
      obj.timestamp ?? obj.time ?? obj["@timestamp"] ?? obj.date ?? null;

    if (!messageRaw && !levelRaw) return null;

    const timestamp =
      typeof tsRaw === "string" || typeof tsRaw === "number"
        ? new Date(tsRaw)
        : null;

    return {
      level: normalizeLevel(String(levelRaw || "UNKNOWN")),
      message: String(messageRaw),
      timestamp:
        timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null,
    };
  } catch {
    return null;
  }
}

function extractLevelAndMessage(line: string): {
  level: LogLevel;
  message: string;
  timestamp: Date | null;
} {
  const jsonEntry = tryParseJsonLine(line);
  if (jsonEntry) {
    return {
      level: jsonEntry.level,
      message: jsonEntry.message,
      timestamp: jsonEntry.timestamp,
    };
  }

  const timestamp = parseTimestamp(line);
  let remainder = line;

  for (const pattern of TIMESTAMP_PATTERNS) {
    remainder = remainder.replace(pattern, "").trim();
  }

  const levelMatch = remainder.match(LOG_LEVEL_PATTERN);
  const level = levelMatch ? normalizeLevel(levelMatch[1]) : "UNKNOWN";

  if (levelMatch) {
    const idx = remainder.indexOf(levelMatch[0]);
    remainder = remainder.slice(idx + levelMatch[0].length).trim();
    remainder = remainder.replace(/^[[\]():\-\s]+/, "").trim();
  }

  return { level, message: remainder || line.trim(), timestamp };
}

function isContinuationLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (STACK_TRACE_LINE.test(trimmed)) return true;
  if (trimmed.startsWith("Exception") || trimmed.startsWith("Error:"))
    return true;
  if (/^\s/.test(line)) return true;
  if (parseTimestamp(trimmed)) return false;
  if (LOG_LEVEL_PATTERN.test(trimmed) && extractLevelAndMessage(trimmed).level !== "UNKNOWN")
    return false;
  if (tryParseJsonLine(trimmed)) return false;
  return true;
}

function looksLikeNewEntry(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (tryParseJsonLine(trimmed)) return true;
  if (parseTimestamp(trimmed)) return true;
  if (LOG_LEVEL_PATTERN.test(trimmed)) return true;
  return false;
}

export function createLogId(
  fileName: string,
  lineNumber: number,
  timestamp: Date | null,
  message: string,
): string {
  const ts = timestamp?.toISOString() ?? "no-ts";
  const snippet = message.slice(0, 80);
  return `${fileName}:${lineNumber}:${ts}:${snippet}`;
}

function finalizeEntry(
  entry: {
    timestamp: Date | null;
    level: LogLevel;
    message: string;
    lines: string[];
  },
  fileName: string,
  startLine: number,
): ParsedLogEntry {
  const id = createLogId(
    fileName,
    startLine,
    entry.timestamp,
    entry.message,
  );
  const endLine = startLine + entry.lines.length - 1;
  return {
    ...entry,
    id,
    fileName,
    lineNumber: startLine,
    endLineNumber: endLine,
    lineCount: entry.lines.length,
    groupId: id,
    rawText: entry.lines.join("\n"),
    isPrimary: true,
  };
}

export function parseLogFile(fileName: string, content: string): ParsedLogEntry[] {
  const entries: ParsedLogEntry[] = [];
  let current: {
    timestamp: Date | null;
    level: LogLevel;
    message: string;
    lines: string[];
  } | null = null;
  let currentStartLine = 0;
  let lineNumber = 0;

  const flush = () => {
    if (!current) return;
    entries.push(finalizeEntry(current, fileName, currentStartLine));
    current = null;
  };

  for (const { line, lineNumber: ln } of (function* () {
    let start = 0;
    let num = 1;
    for (let i = 0; i <= content.length; i++) {
      if (i === content.length || content[i] === "\n") {
        let end = i;
        if (end > start && content[end - 1] === "\r") end--;
        yield { line: content.slice(start, end), lineNumber: num };
        start = i + 1;
        num++;
      }
    }
  })()) {
    lineNumber = ln;

    if (!line.trim()) {
      if (current) current.lines.push(line);
      continue;
    }

    if (current && isContinuationLine(line)) {
      current.lines.push(line);
      if (line.trim()) {
        current.message = current.lines[0] ?? current.message;
      }
      continue;
    }

    if (looksLikeNewEntry(line)) {
      flush();
      const { level, message, timestamp } = extractLevelAndMessage(line);
      current = {
        timestamp,
        level,
        message,
        lines: [line],
      };
      currentStartLine = lineNumber;
      continue;
    }

    if (current) {
      current.lines.push(line);
    } else {
      current = {
        timestamp: null,
        level: "UNKNOWN",
        message: line.trim(),
        lines: [line],
      };
      currentStartLine = lineNumber;
    }
  }

  flush();
  return entries;
}

export function parseLogFiles(
  files: Array<{ name: string; content: string }>,
): ParsedLogEntry[] {
  const allEntries = files.flatMap((file) =>
    parseLogFile(file.name, file.content),
  );

  return allEntries.sort((a, b) => {
    const ta = a.timestamp?.getTime() ?? 0;
    const tb = b.timestamp?.getTime() ?? 0;
    return ta - tb;
  });
}

export function groupEntriesByEvent(entries: ParsedLogEntry[]): ParsedLogEntry[] {
  return entries.map((entry) => ({
    ...entry,
    groupId: entry.id,
  }));
}
