import { useCallback, useEffect, useMemo, useState } from "react";
import type { LogFilterState, ParsedLogEntry } from "@/types/log";
import { DEFAULT_FILTER_STATE } from "@/types/log";
import { filterLogs, computeSummaryStats } from "@/utils/logFilter";
import {
  loadIgnoredIds,
  ignoreLog,
  unignoreLog,
  unignoreAll as clearAllIgnored,
} from "@/utils/ignoredStore";
import {
  createLogBatchFromFiles,
  getBatchMeta,
  getQueuedFileMeta,
  openFileInNewTab,
  parseBatchUrlParams,
  setBatchQueueStart,
  type LogBatchSession,
} from "@/utils/logBatchStore";
import { useChunkedLogLoader } from "@/hooks/useChunkedLogLoader";

export interface PendingFolderScan {
  folderName: string;
  batchId: string;
  files: Array<{ name: string; fileIndex: number; size: number }>;
}

export interface ScannedFileMeta {
  name: string;
  fileIndex: number;
  size: number;
}

export function useLogViewer() {
  const {
    entries,
    loading: fileLoading,
    parseProgress,
    loadFileContent,
    loadFileFromStorage,
    loadMoreChunks,
    resolveEntryDetail,
    loadNotice,
    reset: resetLoader,
  } = useChunkedLogLoader();

  const [filters, setFilters] = useState<LogFilterState>(DEFAULT_FILTER_STATE);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(() => loadIgnoredIds());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<ParsedLogEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pendingScan, setPendingScan] = useState<PendingFolderScan | null>(null);
  const [batch, setBatch] = useState<LogBatchSession | null>(null);
  const [queueIndex, setQueueIndex] = useState<number | null>(null);

  const loading = fileLoading || scanning;

  const openStoredFile = useCallback(
    async (
      batchSession: LogBatchSession,
      queueIdx: number,
      fileMeta: ScannedFileMeta,
    ) => {
      setFolderName(batchSession.folderName);
      setActiveFileName(fileMeta.name);
      setBatch(batchSession);
      setQueueIndex(queueIdx);
      setSelectedId(null);
      setSelectedEntry(null);
      setPendingScan(null);
      await loadFileFromStorage(batchSession.batchId, fileMeta.fileIndex);
    },
    [loadFileFromStorage],
  );

  const beginFolderScan = useCallback(
    async (files: Array<{ name: string; content: string }>, label: string) => {
      if (files.length === 0) return;

      setScanning(true);
      try {
        const batchSession = await createLogBatchFromFiles(label, files);
        files.length = 0;

        if (batchSession.files.length === 1) {
          const only = batchSession.files[0];
          await openStoredFile(batchSession, 0, only);
          const url = new URL(window.location.href);
          url.searchParams.set("batch", batchSession.batchId);
          url.searchParams.set("queue", "0");
          window.history.replaceState({}, "", url.toString());
          return;
        }

        setPendingScan({
          folderName: label,
          batchId: batchSession.batchId,
          files: batchSession.files,
        });
      } finally {
        setScanning(false);
      }
    },
    [openStoredFile],
  );

  const confirmFirstFile = useCallback(
    async (fileIndex: number) => {
      if (!pendingScan) return;

      const updated = await setBatchQueueStart(pendingScan.batchId, fileIndex);
      if (!updated) return;

      const fileMeta = await getQueuedFileMeta(updated, 0);
      if (!fileMeta) return;

      await openStoredFile(updated, 0, fileMeta);

      const url = new URL(window.location.href);
      url.searchParams.set("batch", updated.batchId);
      url.searchParams.set("queue", "0");
      window.history.replaceState({}, "", url.toString());
    },
    [pendingScan, openStoredFile],
  );

  const cancelFileSelection = useCallback(() => {
    setPendingScan(null);
  }, []);

  const openNextFileInNewTab = useCallback(() => {
    if (!batch || queueIndex === null) return;
    openFileInNewTab(batch.batchId, queueIndex + 1);
  }, [batch, queueIndex]);

  useEffect(() => {
    const params = parseBatchUrlParams();
    if (!params) return;

    void (async () => {
      const session = await getBatchMeta(params.batchId);
      if (!session) return;

      const fileMeta = await getQueuedFileMeta(session, params.queueIndex);
      if (!fileMeta) return;

      await openStoredFile(session, params.queueIndex, fileMeta);
    })();
  }, [openStoredFile]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedEntry(null);
      return;
    }

    const index = entries.find((entry) => entry.id === selectedId);
    if (!index) {
      setSelectedEntry(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    void resolveEntryDetail(index).then((detail) => {
      if (!cancelled) {
        setSelectedEntry(detail);
        setDetailLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedId, entries, resolveEntryDetail]);

  const filteredEntries = useMemo(
    () => filterLogs(entries, filters, ignoredIds),
    [entries, filters, ignoredIds],
  );

  const summary = useMemo(
    () => ({
      ...computeSummaryStats(entries, ignoredIds),
      partial: parseProgress.isParsing,
    }),
    [entries, ignoredIds, parseProgress.isParsing],
  );

  const queueInfo = useMemo(() => {
    if (!batch || queueIndex === null) {
      return { hasNext: false, nextFileName: null, queueTotal: 0 };
    }

    const nextIndex = queueIndex + 1;
    const nextFileIndex = batch.queueOrder[nextIndex];
    const nextMeta = batch.files.find((file) => file.fileIndex === nextFileIndex);

    return {
      hasNext: nextIndex < batch.queueOrder.length,
      nextFileName: nextMeta?.name ?? null,
      queueTotal: batch.queueOrder.length,
    };
  }, [batch, queueIndex]);

  const handleIgnore = useCallback((id: string) => {
    setIgnoredIds((prev) => ignoreLog(id, prev));
  }, []);

  const handleUnignore = useCallback((id: string) => {
    setIgnoredIds((prev) => unignoreLog(id, prev));
  }, []);

  const handleUnignoreAll = useCallback(() => {
    setIgnoredIds((prev) => clearAllIgnored(prev));
  }, []);

  const updateFilters = useCallback((patch: Partial<LogFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  return {
    entries,
    filteredEntries,
    filters,
    updateFilters,
    ignoredIds,
    handleIgnore,
    handleUnignore,
    handleUnignoreAll,
    selectedId,
    setSelectedId,
    selectedEntry,
    detailLoading,
    folderName,
    activeFileName,
    loading,
    beginFolderScan,
    confirmFirstFile,
    cancelFileSelection,
    pendingScan,
    batch,
    queueIndex,
    queueInfo,
    openNextFileInNewTab,
    parseProgress,
    loadMoreChunks,
    loadNotice,
    summary,
    resetLoader,
    loadFileContent,
  };
}
