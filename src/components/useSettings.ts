"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Mistake } from "@/lib/deck";
import { activeLevels, type Level } from "@/lib/levels";
import {
  loadMistakes,
  loadProgress,
  loadSettings,
  MISTAKES_KEY,
  PROGRESS_KEY,
  saveSettings,
  SETTINGS_KEY,
  STORAGE_EVENT,
  type KeyValueStorage,
  type Settings,
} from "@/lib/progress-store";
import { CUSTOM_KEY, loadCustomStories, loadReadIds, READ_KEY } from "@/lib/reading";
import type { Progress } from "@/lib/srs";
import type { Story } from "@/lib/story";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(STORAGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(STORAGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * A value read from browser storage that stays current: a save anywhere (another screen,
 * the tab bar, a sync) re-renders every component using it. Next.js keeps recently visited
 * routes mounted in the background, so screens must not keep their own copies. Client-only.
 */
function useStored<T>(key: string, load: (storage: KeyValueStorage) => T): T {
  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key),
    () => null,
  );
  // Read-only view of storage with this key pinned to the snapshot, so the value matches `raw`.
  return useMemo(
    () => load({ getItem: (k) => (k === key ? raw : window.localStorage.getItem(k)), setItem: () => {} }),
    [key, load, raw],
  );
}

/** The learner's settings, with a setter that saves them. */
export function useSettings(): [Settings, (next: Settings) => void] {
  const settings = useStored(SETTINGS_KEY, loadSettings);
  const update = useCallback((next: Settings) => saveSettings(window.localStorage, next), []);
  return [settings, update];
}

/** The levels switched on: A1–A2, or A1–B2 when B1–B2 is included. */
export function useActiveLevels(): Level[] {
  const [settings] = useSettings();
  return useMemo(() => activeLevels(settings.includeB1B2), [settings.includeB1B2]);
}

/** Study progress (save it with saveProgress). */
export function useProgress(): Progress {
  return useStored(PROGRESS_KEY, loadProgress);
}

/** Chat mistakes saved as flashcards. */
export function useMistakes(): Mistake[] {
  return useStored(MISTAKES_KEY, loadMistakes);
}

/** Ids of stories marked as read. */
export function useReadIds(): Set<string> {
  return useStored(READ_KEY, loadReadIds);
}

/** Stories generated in this browser. */
export function useCustomStories(): Story[] {
  return useStored(CUSTOM_KEY, loadCustomStories);
}
