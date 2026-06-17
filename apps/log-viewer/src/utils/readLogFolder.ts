import type { LogFileSource } from "@/types/log";

const LOG_EXTENSIONS = [
  ".log",
  ".txt",
  ".json",
  ".jsonl",
  ".out",
  ".err",
  ".trace",
];

const SKIP_EXTENSIONS = [
  ".exe",
  ".dll",
  ".bin",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".zip",
  ".gz",
  ".tar",
  ".pdf",
  ".woff",
  ".woff2",
  ".ico",
  ".mp4",
  ".mp3",
];

export function isLogFile(name: string): boolean {
  const baseName = name.split(/[/\\]/).pop() ?? name;
  const lower = baseName.toLowerCase();

  if (SKIP_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
  // Rotated / dated logs: app.log.1, server.log.2024-06-15
  if (/\.log\./i.test(lower)) return true;
  if (LOG_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  if (!lower.includes(".")) return true;
  if (/log|access|error|debug|trace|stdout|stderr|syslog/i.test(lower)) return true;

  return false;
}

export async function readDirectoryHandleRecursive(
  dirHandle: FileSystemDirectoryHandle,
  pathPrefix = "",
): Promise<{ sources: LogFileSource[]; scanned: number; skipped: number }> {
  const sources: LogFileSource[] = [];
  let scanned = 0;
  let skipped = 0;

  for await (const [name, entry] of dirHandle.entries()) {
    const relativePath = pathPrefix ? `${pathPrefix}/${name}` : name;

    if (entry.kind === "directory") {
      const nested = await readDirectoryHandleRecursive(
        entry as FileSystemDirectoryHandle,
        relativePath,
      );
      sources.push(...nested.sources);
      scanned += nested.scanned;
      skipped += nested.skipped;
      continue;
    }

    if (entry.kind !== "file") continue;

    scanned++;
    const fileHandle = entry as FileSystemFileHandle;
    const file = await fileHandle.getFile();

    if (!isLogFile(file.name)) {
      skipped++;
      continue;
    }

    sources.push({
      name: relativePath,
      content: await file.text(),
    });
  }

  return { sources, scanned, skipped };
}

export async function readFileListFromInput(
  files: FileList,
): Promise<{ sources: LogFileSource[]; scanned: number; skipped: number }> {
  const allFiles = Array.from(files);
  const sources: LogFileSource[] = [];
  let skipped = 0;

  for (const file of allFiles) {
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      skipped++;
      continue;
    }

    if (!isLogFile(file.webkitRelativePath || file.name)) {
      skipped++;
      continue;
    }

    sources.push({
      name: file.webkitRelativePath || file.name,
      content: await file.text(),
    });
  }

  return { sources, scanned: allFiles.length, skipped };
}

export function describeLoadResult(
  sources: LogFileSource[],
  scanned: number,
  skipped: number,
): { type: "success" | "error" | "info"; message: string } {
  if (sources.length > 0) {
    return {
      type: "success",
      message: `Loaded ${sources.length} log file${sources.length === 1 ? "" : "s"} (${scanned} scanned, ${skipped} skipped).`,
    };
  }

  if (scanned === 0) {
    return {
      type: "error",
      message:
        "No files found in the selected folder. Try a folder that contains .log, .log.*, .txt, or .json files.",
    };
  }

  return {
    type: "error",
    message: `Found ${scanned} file${scanned === 1 ? "" : "s"} but none matched log patterns (.log, .log.*, .txt, .json, or similar names). ${skipped} skipped.`,
  };
}
