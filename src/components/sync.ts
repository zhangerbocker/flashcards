"use client";

import { flush, syncNow, type SyncDeps } from "@/lib/sync-client";
import { OUTBOX_EVENT } from "@/lib/sync-ops";

/** Wait after a change before sending, so a burst of grades goes in one request. */
const SEND_DELAY_MS = 1500;

let opening: Promise<void> | undefined;

function deps(): SyncDeps {
  return { storage: window.localStorage, fetch: window.fetch.bind(window) };
}

function signedOut() {
  // A full page load, so the proxy shows the login screen.
  window.location.replace(`${window.location.origin}/login`);
}

function startBackgroundSending() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const send = () => {
    clearTimeout(timer);
    void flush(deps()).then((result) => result === "signed-out" && signedOut());
  };
  window.addEventListener(OUTBOX_EVENT, () => {
    clearTimeout(timer);
    timer = setTimeout(send, SEND_DELAY_MS);
  });
  window.addEventListener("online", send);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && send());
}

/**
 * Resolves once this device has synced with the server (or found it unreachable), so pages
 * read fresh local data. The first call starts the sync and background sending of later
 * changes; it never rejects, since the app still works from local data.
 */
export function whenSynced(): Promise<void> {
  opening ??= (async () => {
    startBackgroundSending();
    try {
      const result = navigator.onLine ? await syncNow(deps()) : "offline";
      if (result === "signed-out") signedOut();
    } catch (err) {
      console.error("sync failed:", err instanceof Error ? err.message : err);
    }
  })();
  return opening;
}
