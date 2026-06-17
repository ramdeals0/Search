import { detectAlertLevel } from "@/utils/chunkedLogParser";
import { iterateLines, yieldToMain } from "@/utils/logLineIterator";

export const ERROR_CONTEXT_BEFORE = 100;
export const ERROR_CONTEXT_AFTER = 50;

export interface LineWindow {
  startLine: number;
  endLine: number;
}

export function mergeLineWindows(windows: LineWindow[]): LineWindow[] {
  if (!windows.length) return [];

  const sorted = [...windows].sort((a, b) => a.startLine - b.startLine);
  const merged: LineWindow[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.startLine <= last.endLine + 1) {
      last.endLine = Math.max(last.endLine, current.endLine);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

export function buildWindowAroundLine(
  lineNumber: number,
  totalLines: number,
  before = ERROR_CONTEXT_BEFORE,
  after = ERROR_CONTEXT_AFTER,
): LineWindow {
  return {
    startLine: Math.max(1, lineNumber - before),
    endLine: Math.min(totalLines, lineNumber + after),
  };
}

export function scanErrorWindowsSync(
  content: string,
  totalLines: number,
): { windows: LineWindow[]; matchCount: number } {
  const rawWindows: LineWindow[] = [];
  let matchCount = 0;

  for (const { line, lineNumber } of iterateLines(content)) {
    const level = detectAlertLevel(line);
    if (level === "ERROR" || level === "WARN" || level === "FATAL") {
      matchCount++;
      rawWindows.push(buildWindowAroundLine(lineNumber, totalLines));
    }
  }

  return { windows: mergeLineWindows(rawWindows), matchCount };
}

export async function scanErrorWindowsChunked(
  content: string,
  totalLines: number,
  onProgress?: (scannedLine: number, matchCount: number) => void,
): Promise<{ windows: LineWindow[]; matchCount: number }> {
  const rawWindows: LineWindow[] = [];
  let matchCount = 0;

  for (const { line, lineNumber } of iterateLines(content)) {
    const level = detectAlertLevel(line);
    if (level === "ERROR" || level === "WARN" || level === "FATAL") {
      matchCount++;
      rawWindows.push(buildWindowAroundLine(lineNumber, totalLines));
    }

    if (lineNumber % 5_000 === 0) {
      onProgress?.(lineNumber, matchCount);
      await yieldToMain();
    }
  }

  onProgress?.(totalLines, matchCount);
  return { windows: mergeLineWindows(rawWindows), matchCount };
}

export function summarizeWindows(windows: LineWindow[]): number {
  return windows.reduce(
    (sum, window) => sum + (window.endLine - window.startLine + 1),
    0,
  );
}
