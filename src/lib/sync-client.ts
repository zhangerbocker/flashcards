import { hasSavedSettings, loadMistakes, loadProgress, loadReviews, loadSettings, replaceWithSynced, type KeyValueStorage } from "./progress-store";
import { loadCustomStories, loadReadIds, replaceReadingWithSynced } from "./reading";
import { dropOps, enqueue, MAX_OPS_PER_REQUEST, pendingOps, SyncState, type SyncOp } from "./sync-ops";

export interface SyncDeps {
  storage: KeyValueStorage;
  fetch: typeof fetch;
}

/** synced: up to date with the server; offline: kept local data; signed-out: the session expired. */
export type SyncResult = "synced" | "offline" | "signed-out";

/** Set once this device's local data has been uploaded, so it is only uploaded once. */
const UPLOADED_KEY = "hsk.uploaded.v1";
/** Requests that hang (bad mobile signal) give up so the app falls back to local data. */
const TIMEOUT_MS = 10_000;

/** All of this device's data as ops, for its first sync (merged on the server by review time). */
export function snapshotOps(storage: KeyValueStorage): SyncOp[] {
  return [
    ...Object.entries(loadProgress(storage).items).map(([key, schedule]): SyncOp => ({ type: "item", key, schedule })),
    ...loadReviews(storage).map((entry): SyncOp => ({ type: "review", entry })),
    ...loadMistakes(storage).map((mistake): SyncOp => ({ type: "mistake", mistake })),
    // Only settings the learner chose; a new device's defaults must not overwrite them.
    ...(hasSavedSettings(storage) ? [{ type: "settings", settings: loadSettings(storage) } as SyncOp] : []),
    ...loadCustomStories(storage).map((story): SyncOp => ({ type: "story", story })),
    ...[...loadReadIds(storage)].map((id): SyncOp => ({ type: "read", id })),
  ];
}

async function request(deps: SyncDeps, path: string, init?: RequestInit): Promise<Response | "offline"> {
  try {
    return await deps.fetch(path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    // Network down or timed out: the outbox keeps the changes for next time.
    if (err instanceof TypeError || (err instanceof DOMException && ["TimeoutError", "AbortError"].includes(err.name))) return "offline";
    throw err;
  }
}

/** Sends queued changes in batches; each batch is removed from the outbox once applied. */
export async function flush(deps: SyncDeps): Promise<SyncResult> {
  for (let ops = pendingOps(deps.storage); ops.length > 0; ops = pendingOps(deps.storage)) {
    const batch = ops.slice(0, MAX_OPS_PER_REQUEST);
    const res = await request(deps, "/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops: batch }),
    });
    if (res === "offline") return "offline";
    if (res.status === 401) return "signed-out";
    if (res.status === 400) {
      // The server can never accept this batch; keeping it would block every later change.
      console.error(`sync batch rejected: ${((await res.json().catch(() => ({}))) as { error?: string }).error ?? "no reason"}`);
      dropOps(deps.storage, batch.length);
      continue;
    }
    if (!res.ok) return "offline";
    dropOps(deps.storage, batch.length);
  }
  return "synced";
}

/**
 * Brings this device up to date: uploads its data on its first sync, sends queued
 * changes, then replaces local data with the server's merged copy. If anything is still
 * unsent (offline), local data is left as is so no change is lost.
 */
export async function syncNow(deps: SyncDeps): Promise<SyncResult> {
  const firstSync = deps.storage.getItem(UPLOADED_KEY) === null;
  if (firstSync) for (const op of snapshotOps(deps.storage)) enqueue(deps.storage, op);
  const sent = await flush(deps);
  if (sent !== "synced") return sent;
  if (firstSync) deps.storage.setItem(UPLOADED_KEY, new Date().toISOString());

  let state = await fetchState(deps);
  if (typeof state === "string") return state;
  // A server with no progress at all is a new (or wiped) database: fill it from this
  // device instead of wiping the device to match.
  if (Object.keys(state.items).length === 0 && Object.keys(loadProgress(deps.storage).items).length > 0) {
    for (const op of snapshotOps(deps.storage)) enqueue(deps.storage, op);
    const resent = await flush(deps);
    if (resent !== "synced") return resent;
    state = await fetchState(deps);
    if (typeof state === "string") return state;
  }
  if (pendingOps(deps.storage).length > 0) return "synced"; // changed meanwhile; the next sync picks it up
  replaceWithSynced(deps.storage, state);
  replaceReadingWithSynced(deps.storage, state);
  return "synced";
}

async function fetchState(deps: SyncDeps): Promise<SyncState | "offline" | "signed-out"> {
  const res = await request(deps, "/api/state", { cache: "no-store" });
  if (res === "offline") return "offline";
  if (res.status === 401) return "signed-out";
  if (!res.ok) return "offline";
  const state = SyncState.safeParse(await res.json());
  if (!state.success) throw new Error(`server state didn't match the expected shape: ${state.error.issues[0].message}`);
  return state.data;
}
