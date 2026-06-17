import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

interface FileQueueBarProps {
  folderName: string;
  activeFileName: string;
  queueIndex: number;
  queueTotal: number;
  hasNext: boolean;
  nextFileName: string | null;
  onOpenNext: () => void;
}

export function FileQueueBar({
  folderName,
  activeFileName,
  queueIndex,
  queueTotal,
  hasNext,
  nextFileName,
  onOpenNext,
}: FileQueueBarProps) {
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
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle1">Current file</Typography>
            <Chip
              label={`${queueIndex + 1} of ${queueTotal}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.5, fontFamily: "monospace" }}>
            {activeFileName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            From folder: {folderName}
          </Typography>
        </Box>

        <Stack spacing={1} alignItems={{ xs: "stretch", md: "flex-end" }}>
          {hasNext ? (
            <>
              <Typography variant="caption" color="text.secondary">
                Next: {nextFileName}
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<OpenInNewIcon />}
                onClick={onOpenNext}
              >
                Done — open next file in new tab
              </Button>
            </>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center" color="success.main">
              <CheckCircleOutlineIcon fontSize="small" />
              <Typography variant="body2">All files in this folder have been opened.</Typography>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
