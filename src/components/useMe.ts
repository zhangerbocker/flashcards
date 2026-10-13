"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Me } from "@/lib/me";

// One copy for the whole app, so the chat's budget and the library's "New story" agree.
let current: Me | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Replaces who is signed in (e.g. with the budget a chat reply reports). */
export function setMe(next: Me): void {
  current = next;
  for (const listener of listeners) listener();
}

function load(): Promise<void> {
  loading ??= fetch("/api/me", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => {
      const parsed = Me.safeParse(json);
      if (parsed.success) setMe(parsed.data);
    })
    .catch(() => {})
    .finally(() => (loading = null));
  return loading;
}

/** Who is signed in and, for a guest, their chat budget; null until known. */
export function useMe(): Me | null {
  const me = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
  // Refresh on each mount so a budget spent on another device shows up.
  useEffect(() => void load(), []);
  return me;
}
