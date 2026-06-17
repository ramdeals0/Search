const STORAGE_KEY = "log-viewer-ignored-ids";

export function loadIgnoredIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

export function saveIgnoredIds(ids: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function ignoreLog(id: string, current: Set<string>): Set<string> {
  const next = new Set(current);
  next.add(id);
  saveIgnoredIds(next);
  return next;
}

export function unignoreLog(id: string, current: Set<string>): Set<string> {
  const next = new Set(current);
  next.delete(id);
  saveIgnoredIds(next);
  return next;
}

export function unignoreAll(_current: Set<string>): Set<string> {
  const next = new Set<string>();
  saveIgnoredIds(next);
  return next;
}

export function getIgnoredEntries<T extends { id: string }>(
  entries: T[],
  ignoredIds: Set<string>,
): T[] {
  return entries.filter((e) => ignoredIds.has(e.id));
}
