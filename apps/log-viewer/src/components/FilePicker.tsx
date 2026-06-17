import { useRef, useState, type InputHTMLAttributes } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DataObjectIcon from "@mui/icons-material/DataObject";
import type { LogFileSource } from "@/types/log";
import {
  describeLoadResult,
  readDirectoryHandleRecursive,
  readFileListFromInput,
} from "@/utils/readLogFolder";

interface FilePickerProps {
  folderName: string | null;
  activeFileName: string | null;
  loading: boolean;
  onFolderScanned: (sources: LogFileSource[], label: string) => void;
  onLoadMock: () => void;
}

type StatusMessage = {
  type: "success" | "error" | "info";
  message: string;
};

export function FilePicker({
  folderName,
  activeFileName,
  loading,
  onFolderScanned,
  onLoadMock,
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const handleScannedFiles = (
    sources: LogFileSource[],
    scanned: number,
    skipped: number,
    label: string,
  ) => {
    const result = describeLoadResult(sources, scanned, skipped);
    setStatus(result.type === "success" ? null : result);

    if (sources.length > 0) {
      onFolderScanned(sources, label);
    }
  };

  const handleDirectoryInput = async (files: FileList | null) => {
    if (!files?.length) {
      setStatus({ type: "error", message: "No files were selected." });
      return;
    }

    try {
      const { sources, scanned, skipped } = await readFileListFromInput(files);
      const label =
        files[0]?.webkitRelativePath?.split(/[/\\]/)[0] ??
        `${sources.length || scanned} files`;
      handleScannedFiles(sources, scanned, skipped, label);
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to read selected files.",
      });
    }
  };

  const openFolderInput = () => {
    inputRef.current?.click();
  };

  const handleNativePicker = async () => {
    setStatus({ type: "info", message: "Reading folder…" });

    if ("showDirectoryPicker" in window) {
      try {
        const dirHandle = await window.showDirectoryPicker!();
        const { sources, scanned, skipped } =
          await readDirectoryHandleRecursive(dirHandle);
        handleScannedFiles(sources, scanned, skipped, dirHandle.name);
        return;
      } catch (err) {
        if ((err as DOMException).name === "AbortError") {
          setStatus(null);
          return;
        }
        console.warn("Directory picker failed, falling back to file input:", err);
      }
    }

    openFolderInput();
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
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h6" gutterBottom>
            Log source
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {activeFileName
              ? `Viewing: ${activeFileName}`
              : folderName
                ? `Folder: ${folderName}`
                : "Choose a folder — you'll pick the first file, then open others in new tabs"}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            startIcon={<FolderOpenIcon />}
            onClick={handleNativePicker}
            disabled={loading}
          >
            Select folder
          </Button>
          <Button
            variant="outlined"
            startIcon={<DataObjectIcon />}
            onClick={onLoadMock}
            disabled={loading}
          >
            Load sample data
          </Button>
        </Stack>
      </Stack>

      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        {...({ webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>)}
        onChange={(e) => {
          void handleDirectoryInput(e.target.files);
          e.target.value = "";
        }}
      />

      {status && (
        <Alert severity={status.type} sx={{ mt: 2 }} onClose={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}

      {folderName && activeFileName && !status && (
        <Chip
          label={`${activeFileName}`}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ mt: 2, maxWidth: "100%" }}
        />
      )}
    </Box>
  );
}

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}
