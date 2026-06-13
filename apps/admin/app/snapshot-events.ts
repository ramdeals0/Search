export const ADMIN_SNAPSHOTS_CHANGED_EVENT = "admin:snapshots-changed";

export function notifySnapshotsChanged(): void {
  window.dispatchEvent(new CustomEvent(ADMIN_SNAPSHOTS_CHANGED_EVENT));
}
