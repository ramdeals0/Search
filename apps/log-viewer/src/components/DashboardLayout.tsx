import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import InsightsIcon from "@mui/icons-material/Insights";
import type { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Box
        component="header"
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(17, 24, 39, 0.85)",
          backdropFilter: "blur(8px)",
          position: "sticky",
          top: 0,
          zIndex: 1100,
        }}
      >
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <InsightsIcon color="primary" />
            <Box>
              <Typography variant="h5" component="h1">
                Log Viewer
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Search, filter, and triage logs from local folders
              </Typography>
            </Box>
          </Stack>
        </Container>
      </Box>

      <Container
        maxWidth="xl"
        sx={{
          flex: 1,
          py: 3,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <Stack spacing={2.5} sx={{ flex: 1, minHeight: 0 }}>
          {children}
        </Stack>
      </Container>
    </Box>
  );
}
