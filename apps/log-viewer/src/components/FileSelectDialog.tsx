import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Radio from "@mui/material/Radio";
import Typography from "@mui/material/Typography";
import type { ScannedFileMeta } from "@/hooks/useLogViewer";

interface FileSelectDialogProps {
  open: boolean;
  folderName: string;
  files: ScannedFileMeta[];
  onConfirm: (fileIndex: number) => void;
  onCancel: () => void;
}

export function FileSelectDialog({
  open,
  folderName,
  files,
  onConfirm,
  onCancel,
}: FileSelectDialogProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  useEffect(() => {
    if (open) setSelectedFileIndex(files[0]?.fileIndex ?? 0);
  }, [open, folderName, files]);

  const handleConfirm = () => {
    onConfirm(selectedFileIndex);
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Choose the first log file</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Found {files.length} file{files.length === 1 ? "" : "s"} in{" "}
          <strong>{folderName}</strong>. Pick which file to load in this tab.
          Remaining files can be opened one-by-one in new tabs when you are done.
        </Typography>
        <List dense disablePadding>
          {files.map((file) => (
            <ListItemButton
              key={file.fileIndex}
              selected={selectedFileIndex === file.fileIndex}
              onClick={() => setSelectedFileIndex(file.fileIndex)}
            >
              <Radio
                checked={selectedFileIndex === file.fileIndex}
                tabIndex={-1}
                disableRipple
              />
              <ListItemText
                primary={file.name}
                secondary={`${(file.size / 1024).toFixed(1)} KB`}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm}>
          Load selected file
        </Button>
      </DialogActions>
    </Dialog>
  );
}
