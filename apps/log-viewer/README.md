# Log Viewer

A modern React log viewer for browsing, searching, and triaging log files from a local folder.

## Features

- **Folder picker** — select a directory of `.log`, `.txt`, or `.json` files (File System Access API with fallback)
- **Unified log stream** — merges and sorts entries from all files by timestamp
- **Multiline parsing** — groups stack traces and continuation lines with their parent entry
- **Virtualized table** — efficient rendering for large log sets
- **Filters** — search text, ERROR/WARN/FATAL level pills, errors-only mode, show/hide ignored
- **Ignore management** — ignore/unignore logs with persistence in `localStorage`
- **Detail panel** — click a row to inspect full raw log text
- **Summary cards** — total, error, warn, fatal, and ignored counts

## Quick start

From the monorepo root:

```bash
pnpm install
pnpm --filter @retailer-search/log-viewer dev
```

Open http://localhost:5174 and click **Load sample data** to explore mock logs, or **Select folder** to pick a directory of log files.

## Project structure

```
apps/log-viewer/
├── src/
│   ├── components/
│   │   ├── DashboardLayout.tsx   # App shell & header
│   │   ├── FilePicker.tsx        # Folder selection & mock loader
│   │   ├── FilterBar.tsx         # Search, level, sort, toggles
│   │   ├── IgnoredLogManager.tsx # Collapsible ignored-log list
│   │   ├── LevelBadge.tsx        # Colored level pills
│   │   ├── LogDetailPanel.tsx    # Side drawer with full log text
│   │   ├── LogTable.tsx          # Virtualized log table
│   │   └── SummaryStats.tsx      # Dashboard stat cards
│   ├── data/
│   │   └── mockLogs.ts           # Sample log files for development
│   ├── hooks/
│   │   └── useLogViewer.ts       # Main state orchestration
│   ├── types/
│   │   └── log.ts                # Shared types & constants
│   ├── utils/
│   │   ├── format.ts             # Timestamp & text helpers
│   │   ├── ignoredStore.ts       # localStorage ignore persistence
│   │   ├── logFilter.ts          # Filter, sort, summary logic
│   │   └── logParser.ts          # Multiline log parsing
│   ├── App.tsx
│   ├── main.tsx
│   └── theme.ts
├── index.html
├── package.json
└── vite.config.ts
```

## Example usage

### Load sample data programmatically

```tsx
import { MOCK_LOG_FILES } from "@/data/mockLogs";
import { parseLogFiles } from "@/utils/logParser";

const entries = parseLogFiles(MOCK_LOG_FILES);
console.log(entries.length, "parsed entries");
```

### Parse a single file

```tsx
import { parseLogFile } from "@/utils/logParser";

const entries = parseLogFile("app.log", fileContent);
```

### Filter logs

```tsx
import { filterLogs } from "@/utils/logFilter";
import { DEFAULT_FILTER_STATE } from "@/types/log";

const visible = filterLogs(entries, {
  ...DEFAULT_FILTER_STATE,
  searchQuery: "checkout",
  severityMode: "errors-only",
}, ignoredIds);
```

### Ignore / persist

```tsx
import { loadIgnoredIds, ignoreLog } from "@/utils/ignoredStore";

const ignored = loadIgnoredIds();
const updated = ignoreLog(entryId, ignored);
```

## Supported log formats

- ISO timestamps with level prefix: `2024-06-15T08:00:01.123Z ERROR message`
- Bracketed timestamps: `[2024-06-15T08:00:01.123Z] WARN message`
- JSON lines: `{"timestamp":"...","level":"ERROR","message":"..."}`
- Stack traces appended to error lines (Java, Python, etc.)

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server on port 5174 |
| `pnpm build` | Typecheck and production build |
| `pnpm preview` | Preview production build |
