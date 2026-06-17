import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { FilePicker } from "@/components/FilePicker";
import { FileSelectDialog } from "@/components/FileSelectDialog";
import { FileQueueBar } from "@/components/FileQueueBar";
import { ParseProgressBar } from "@/components/ParseProgressBar";
import { FilterBar } from "@/components/FilterBar";
import { LogTable } from "@/components/LogTable";
import { LogDetailPanel } from "@/components/LogDetailPanel";
import { SummaryStats } from "@/components/SummaryStats";
import { IgnoredLogManager } from "@/components/IgnoredLogManager";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MOCK_LOG_FILES } from "@/data/mockLogs";
import { useLogViewer } from "@/hooks/useLogViewer";

export default function App() {
  const {
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
  } = useLogViewer();

  return (
    <DashboardLayout>
      <FilePicker
        folderName={folderName}
        activeFileName={activeFileName}
        loading={loading}
        onFolderScanned={(sources, label) => {
          void beginFolderScan(sources, label);
        }}
        onLoadMock={() => {
          void beginFolderScan(MOCK_LOG_FILES, "sample-data");
        }}
      />

      <FileSelectDialog
        open={pendingScan !== null}
        folderName={pendingScan?.folderName ?? ""}
        files={pendingScan?.files ?? []}
        onConfirm={(fileIndex) => {
          void confirmFirstFile(fileIndex);
        }}
        onCancel={cancelFileSelection}
      />

      {loading && entries.length === 0 && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {parseProgress.isParsing && <ParseProgressBar progress={parseProgress} />}

      {loadNotice && (
        <Alert severity={entries.length > 0 ? "info" : "warning"} sx={{ borderRadius: 2 }}>
          {loadNotice}
        </Alert>
      )}

      {!loading && batch && queueIndex !== null && activeFileName && folderName && (
        <FileQueueBar
          folderName={folderName}
          activeFileName={activeFileName}
          queueIndex={queueIndex}
          queueTotal={queueInfo.queueTotal}
          hasNext={queueInfo.hasNext}
          nextFileName={queueInfo.nextFileName}
          onOpenNext={openNextFileInNewTab}
        />
      )}

      {entries.length === 0 && !loading && !parseProgress.isParsing && loadNotice && (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            No severity lines to display. Try another file or check log format.
          </Typography>
        </Box>
      )}

      {entries.length > 0 && (
        <>
          <SummaryStats stats={summary} />

          <FilterBar
            filters={filters}
            resultCount={filteredEntries.length}
            onChange={updateFilters}
          />

          <IgnoredLogManager
            entries={entries}
            ignoredIds={ignoredIds}
            onUnignore={handleUnignore}
            onUnignoreAll={handleUnignoreAll}
          />

          <Box sx={{ flex: 1, minHeight: 400, display: "flex", minWidth: 0 }}>
            <LogTable
              entries={filteredEntries}
              selectedId={selectedId}
              ignoredIds={ignoredIds}
              parsing={parseProgress.isParsing}
              onSelect={setSelectedId}
              onIgnore={handleIgnore}
              onUnignore={handleUnignore}
              onLoadMore={() => {
                void loadMoreChunks();
              }}
            />
          </Box>
        </>
      )}

      <LogDetailPanel
        entry={selectedEntry}
        loading={detailLoading}
        isIgnored={selectedEntry ? ignoredIds.has(selectedEntry.id) : false}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        onIgnore={() => selectedEntry && handleIgnore(selectedEntry.id)}
        onUnignore={() => selectedEntry && handleUnignore(selectedEntry.id)}
      />
    </DashboardLayout>
  );
}
