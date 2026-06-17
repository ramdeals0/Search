import { useCallback, useRef, useState } from "react";
import type { LogEntryIndex, ParseProgress, ParsedLogEntry } from "@/types/log";
import {
  indexToParsedEntry,
  parseLogWindows,
} from "@/utils/chunkedLogParser";
import {
  countLines,
  extractLineRange,
  LARGE_FILE_BYTES,
  yieldToMain,
} from "@/utils/logLineIterator";
import {
  scanErrorWindowsChunked,
  scanErrorWindowsSync,
  summarizeWindows,
  type LineWindow,
} from "@/utils/errorWindowScanner";
import { getLogFile } from "@/utils/logFileStorage";

interface ActiveFileContext {
  batchId: string | null;
  fileIndex: number | null;
  fileName: string;
}

const EMPTY_PROGRESS: ParseProgress = {
  parsedLines: 0,
  totalLines: 0,
  entryCount: 0,
  isParsing: false,
};

export function useChunkedLogLoader() {
  const [entries, setEntries] = useState<LogEntryIndex[]>([]);
  const [parseProgress, setParseProgress] = useState<ParseProgress>(EMPTY_PROGRESS);
  const [loading, setLoading] = useState(false);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);

  const contentRef = useRef<string | null>(null);
  const windowsRef = useRef<LineWindow[]>([]);
  const nextWindowRef = useRef(0);
  const fileContextRef = useRef<ActiveFileContext | null>(null);
  const abortRef = useRef(false);
  const parsingRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = true;
    contentRef.current = null;
    windowsRef.current = [];
    nextWindowRef.current = 0;
    fileContextRef.current = null;
    setEntries([]);
    setParseProgress(EMPTY_PROGRESS);
    setLoadNotice(null);
  }, []);

  const parseWindowsBatch = useCallback(async () => {
    const content = contentRef.current;
    const ctx = fileContextRef.current;
    const windows = windowsRef.current;
    if (!content || !ctx || parsingRef.current || !windows.length) return;

    parsingRef.current = true;
    abortRef.current = false;

    try {
      while (
        !abortRef.current &&
        nextWindowRef.current < windows.length
      ) {
        const window = windows[nextWindowRef.current];
        const parsed = parseLogWindows(content, ctx.fileName, [window]);
        nextWindowRef.current += 1;

        setEntries((prev) => {
          const merged = [...prev, ...parsed];
          setParseProgress((progress) => ({
            ...progress,
            phase: "parsing",
            entryCount: merged.length,
            parsedLines: nextWindowRef.current,
            isParsing: nextWindowRef.current < windows.length,
          }));
          return merged;
        });

        await yieldToMain();
      }
    } finally {
      parsingRef.current = false;
      setParseProgress((prev) => ({ ...prev, isParsing: false, phase: undefined }));

      if (
        content &&
        content.length >= LARGE_FILE_BYTES &&
        ctx?.batchId !== null &&
        ctx?.fileIndex !== null
      ) {
        contentRef.current = null;
      }
    }
  }, []);

  const loadFileContent = useCallback(
    async (
      fileName: string,
      content: string,
      batchId: string | null,
      fileIndex: number | null,
    ) => {
      abortRef.current = true;
      await yieldToMain();

      reset();
      abortRef.current = false;
      setLoading(true);

      try {
        const totalLines = countLines(content);
        fileContextRef.current = { batchId, fileIndex, fileName };
        contentRef.current = content;

        setParseProgress({
          parsedLines: 0,
          totalLines,
          entryCount: 0,
          isParsing: true,
          phase: "scanning",
          matchCount: 0,
          windowCount: 0,
          loadedLineCount: 0,
        });

        const { windows, matchCount } =
          content.length >= LARGE_FILE_BYTES
            ? await scanErrorWindowsChunked(content, totalLines, (scanned, matches) => {
                setParseProgress((prev) => ({
                  ...prev,
                  parsedLines: scanned,
                  matchCount: matches,
                  phase: "scanning",
                }));
              })
            : scanErrorWindowsSync(content, totalLines);

        if (abortRef.current) return;

        windowsRef.current = windows;
        nextWindowRef.current = 0;

        const loadedLineCount = summarizeWindows(windows);

        if (matchCount === 0) {
          setEntries([]);
          setLoadNotice(
            "No ERROR, WARN, or FATAL lines found in this file.",
          );
          setParseProgress({
            parsedLines: totalLines,
            totalLines,
            entryCount: 0,
            isParsing: false,
            matchCount: 0,
            windowCount: 0,
            loadedLineCount: 0,
          });
          return;
        }

        setLoadNotice(
          `Loaded ${matchCount} ERROR/WARN/FATAL line${matchCount === 1 ? "" : "s"} with 100 lines before and 50 after (${windows.length} region${windows.length === 1 ? "" : "s"}, ${loadedLineCount.toLocaleString()} lines total).`,
        );

        setParseProgress({
          parsedLines: 0,
          totalLines: windows.length,
          entryCount: 0,
          isParsing: true,
          phase: "parsing",
          matchCount,
          windowCount: windows.length,
          loadedLineCount,
        });

        await parseWindowsBatch();
      } finally {
        setLoading(false);
      }
    },
    [reset, parseWindowsBatch],
  );

  const loadFileFromStorage = useCallback(
    async (batchId: string, fileIndex: number) => {
      setLoading(true);
      try {
        const stored = await getLogFile(batchId, fileIndex);
        if (!stored) throw new Error("File not found in storage");
        await loadFileContent(stored.name, stored.content, batchId, fileIndex);
      } finally {
        setLoading(false);
      }
    },
    [loadFileContent],
  );

  const loadMoreChunks = useCallback(async () => {
    if (
      !parsingRef.current &&
      nextWindowRef.current < windowsRef.current.length &&
      contentRef.current
    ) {
      await parseWindowsBatch();
    }
  }, [parseWindowsBatch]);

  const resolveEntryDetail = useCallback(
    async (index: LogEntryIndex): Promise<ParsedLogEntry> => {
      let content = contentRef.current;
      const ctx = fileContextRef.current;

      if (!content && ctx && ctx.batchId !== null && ctx.fileIndex !== null) {
        const stored = await getLogFile(ctx.batchId, ctx.fileIndex);
        content = stored?.content ?? null;
      }

      if (!content) {
        return {
          ...index,
          rawText: index.message,
          lines: [index.message],
          isPrimary: true,
        };
      }

      const { rawText, lines } = extractLineRange(
        content,
        index.lineNumber,
        index.endLineNumber,
      );
      return indexToParsedEntry(index, rawText, lines);
    },
    [],
  );

  return {
    entries,
    loading,
    parseProgress,
    loadNotice,
    loadFileContent,
    loadFileFromStorage,
    loadMoreChunks,
    resolveEntryDetail,
    reset,
  };
}
