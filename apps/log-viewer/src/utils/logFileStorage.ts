const DB_NAME = "log-viewer-db";
const DB_VERSION = 1;
const FILE_STORE = "files";
const BATCH_STORE = "batches";

export interface StoredLogFile {
  key: string;
  batchId: string;
  fileIndex: number;
  name: string;
  content: string;
  size: number;
}

export interface StoredBatchMeta {
  batchId: string;
  folderName: string;
  files: Array<{ name: string; fileIndex: number; size: number }>;
  queueOrder: number[];
}

function fileKey(batchId: string, fileIndex: number): string {
  return `${batchId}:${fileIndex}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(BATCH_STORE)) {
        db.createObjectStore(BATCH_STORE, { keyPath: "batchId" });
      }
    };
  });
}

function txStore(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function saveLogFile(
  batchId: string,
  fileIndex: number,
  name: string,
  content: string,
): Promise<void> {
  const db = await openDb();
  const record: StoredLogFile = {
    key: fileKey(batchId, fileIndex),
    batchId,
    fileIndex,
    name,
    content,
    size: content.length,
  };

  await new Promise<void>((resolve, reject) => {
    const request = txStore(db, FILE_STORE, "readwrite").put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Save file failed"));
  });
}

export async function getLogFile(
  batchId: string,
  fileIndex: number,
): Promise<StoredLogFile | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = txStore(db, FILE_STORE, "readonly").get(
      fileKey(batchId, fileIndex),
    );
    request.onsuccess = () => resolve((request.result as StoredLogFile) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Get file failed"));
  });
}

export async function saveBatchMeta(meta: StoredBatchMeta): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = txStore(db, BATCH_STORE, "readwrite").put(meta);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Save batch failed"));
  });

  sessionStorage.setItem(
    `log-viewer-batch-meta-${meta.batchId}`,
    JSON.stringify({
      batchId: meta.batchId,
      folderName: meta.folderName,
      fileCount: meta.files.length,
      queueOrder: meta.queueOrder,
    }),
  );
}

export async function getBatchMeta(batchId: string): Promise<StoredBatchMeta | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = txStore(db, BATCH_STORE, "readonly").get(batchId);
    request.onsuccess = () => resolve((request.result as StoredBatchMeta) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Get batch failed"));
  });
}

export async function saveFilesToBatch(
  folderName: string,
  files: Array<{ name: string; content: string }>,
): Promise<StoredBatchMeta> {
  const batchId = crypto.randomUUID();
  const meta: StoredBatchMeta = {
    batchId,
    folderName,
    files: files.map((file, fileIndex) => ({
      name: file.name,
      fileIndex,
      size: file.content.length,
    })),
    queueOrder: files.map((_, index) => index),
  };

  for (let i = 0; i < files.length; i++) {
    await saveLogFile(batchId, i, files[i].name, files[i].content);
  }

  await saveBatchMeta(meta);
  return meta;
}

export async function setBatchQueueStart(
  batchId: string,
  startIndex: number,
): Promise<StoredBatchMeta | null> {
  const meta = await getBatchMeta(batchId);
  if (!meta) return null;

  const rest = meta.files
    .map((file) => file.fileIndex)
    .filter((index) => index !== startIndex)
    .sort((a, b) => {
      const nameA = meta.files.find((file) => file.fileIndex === a)?.name ?? "";
      const nameB = meta.files.find((file) => file.fileIndex === b)?.name ?? "";
      return nameA.localeCompare(nameB);
    });

  meta.queueOrder = [startIndex, ...rest];
  await saveBatchMeta(meta);
  return meta;
}

export async function getQueuedFileMeta(
  meta: StoredBatchMeta,
  queueIndex: number,
): Promise<{ name: string; fileIndex: number; size: number } | null> {
  const fileIndex = meta.queueOrder[queueIndex];
  if (fileIndex === undefined) return null;
  return meta.files[fileIndex] ?? null;
}
