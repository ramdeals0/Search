import type { StoredBatchMeta } from "@/utils/logFileStorage";
import {
  getBatchMeta,
  getQueuedFileMeta,
  saveBatchMeta,
  saveFilesToBatch,
  setBatchQueueStart,
} from "@/utils/logFileStorage";

export type LogBatchSession = StoredBatchMeta;

export function parseBatchUrlParams(): { batchId: string; queueIndex: number } | null {
  const params = new URLSearchParams(window.location.search);
  const batchId = params.get("batch");
  const queueRaw = params.get("queue");
  if (!batchId || queueRaw === null) return null;

  const queueIndex = Number.parseInt(queueRaw, 10);
  if (Number.isNaN(queueIndex) || queueIndex < 0) return null;

  return { batchId, queueIndex };
}

export function getTabUrl(batchId: string, queueIndex: number): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("batch", batchId);
  url.searchParams.set("queue", String(queueIndex));
  return url.toString();
}

export function openFileInNewTab(batchId: string, queueIndex: number): void {
  window.open(getTabUrl(batchId, queueIndex), "_blank", "noopener,noreferrer");
}

export async function createLogBatchFromFiles(
  folderName: string,
  files: Array<{ name: string; content: string }>,
): Promise<StoredBatchMeta> {
  return saveFilesToBatch(folderName, files);
}

export { getBatchMeta, getQueuedFileMeta, setBatchQueueStart, saveBatchMeta };
