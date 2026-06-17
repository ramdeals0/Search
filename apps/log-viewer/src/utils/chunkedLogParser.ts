import type { LogLevel, LogEntryIndex, ParsedLogEntry } from "@/types/log";
import { createLogId } from "@/utils/logParser";
import { iterateLines } from "@/utils/logLineIterator";

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
  if (jsonEntry) return jsonEntry;

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

export function detectAlertLevel(line: string): LogLevel | null {
  const { level } = extractLevelAndMessage(line);
  if (level === "ERROR" || level === "WARN" || level === "FATAL") return level;
  return null;
}

function isContinuationLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (STACK_TRACE_LINE.test(trimmed)) return true;
  if (trimmed.startsWith("Exception") || trimmed.startsWith("Error:"))
    return true;
  if (/^\s/.test(line)) return true;
  if (parseTimestamp(trimmed)) return false;
  if (
    LOG_LEVEL_PATTERN.test(trimmed) &&
    extractLevelAndMessage(trimmed).level !== "UNKNOWN"
  )
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

export interface ParserCarryState {
  startLine: number;
  endLine: number;
  level: LogLevel;
  message: string;
  timestamp: Date | null;
  lineCount: number;
}

function finalizeIndex(
  carry: ParserCarryState,
  fileName: string,
): LogEntryIndex {
  const id = createLogId(
    fileName,
    carry.startLine,
    carry.timestamp,
    carry.message,
  );
  return {
    id,
    timestamp: carry.timestamp,
    level: carry.level,
    message: carry.message,
    fileName,
    lineNumber: carry.startLine,
    endLineNumber: carry.endLine,
    lineCount: carry.lineCount,
    groupId: id,
  };
}

export interface ChunkParseResult {
  entries: LogEntryIndex[];
  nextLine: number;
  carryState: ParserCarryState | null;
  done: boolean;
}

export function parseLogChunk(
  content: string,
  fileName: string,
  fromLine: number,
  maxLines: number,
  carryState: ParserCarryState | null,
): ChunkParseResult {
  const entries: LogEntryIndex[] = [];
  let current = carryState;
  let lastConsumedLine = fromLine - 1;

  const flush = () => {
    if (!current) return;
    entries.push(finalizeIndex(current, fileName));
    current = null;
  };

  for (const { line, lineNumber } of iterateLines(content, fromLine, maxLines)) {
    lastConsumedLine = lineNumber;

    if (!line.trim()) {
      if (current) current.lineCount++;
      continue;
    }

    if (current && isContinuationLine(line)) {
      current.endLine = lineNumber;
      current.lineCount++;
      continue;
    }

    if (looksLikeNewEntry(line)) {
      flush();
      const { level, message, timestamp } = extractLevelAndMessage(line);
      current = {
        startLine: lineNumber,
        endLine: lineNumber,
        level,
        message,
        timestamp,
        lineCount: 1,
      };
      continue;
    }

    if (current) {
      current.endLine = lineNumber;
      current.lineCount++;
    } else {
      current = {
        startLine: lineNumber,
        endLine: lineNumber,
        level: "UNKNOWN",
        message: line.trim(),
        timestamp: null,
        lineCount: 1,
      };
    }
  }

  const nextLine = lastConsumedLine + 1;

  return {
    entries,
    nextLine: lastConsumedLine < fromLine ? fromLine : nextLine,
    carryState: current,
    done: false,
  };
}

export function parseLogChunkUntilLine(
  content: string,
  fileName: string,
  fromLine: number,
  maxLines: number,
  carryState: ParserCarryState | null,
  totalLines: number,
): ChunkParseResult {
  const result = parseLogChunk(content, fileName, fromLine, maxLines, carryState);
  const consumedThrough = Math.max(fromLine, result.nextLine - 1);
  const reachedEnd = consumedThrough >= totalLines;

  if (reachedEnd && result.carryState) {
    result.entries.push(finalizeIndex(result.carryState, fileName));
    result.carryState = null;
  }

  return {
    ...result,
    done: reachedEnd,
  };
}

export function parseLogWindows(
  content: string,
  fileName: string,
  windows: Array<{ startLine: number; endLine: number }>,
): LogEntryIndex[] {
  const entries: LogEntryIndex[] = [];

  for (const window of windows) {
    const lineCount = window.endLine - window.startLine + 1;
    const result = parseLogChunkUntilLine(
      content,
      fileName,
      window.startLine,
      lineCount,
      null,
      window.endLine,
    );
    entries.push(...result.entries);
  }

  return entries;
}

export function indexToParsedEntry(
  index: LogEntryIndex,
  rawText: string,
  lines: string[],
): ParsedLogEntry {
  return {
    ...index,
    rawText,
    lines,
    isPrimary: true,
  };
}
