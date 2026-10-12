"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { activeLevels, type Level } from "@/lib/levels";
import { loadSettings, saveSettings, SETTINGS_EVENT, type Settings } from "@/lib/progress-store";

const SETTINGS_KEY = "pt.settings.v1";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(SETTINGS_EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(SETTINGS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The learner's settings, kept in step across every screen: a change saved anywhere
 * (such as the level switch in the tab bar) re-renders every component using this.
 * Client-only (reads browser storage).
 */
export function useSettings(): [Settings, (next: Settings) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(SETTINGS_KEY),
    () => null,
  );
  const settings = useMemo(() => loadSettings({ getItem: () => raw, setItem: () => {} }), [raw]);
  const update = useCallback((next: Settings) => saveSettings(window.localStorage, next), []);
  return [settings, update];
}

/** The levels switched on: A1–A2, or A1–B2 when B1–B2 is included. */
export function useActiveLevels(): Level[] {
  const [settings] = useSettings();
  return useMemo(() => activeLevels(settings.includeB1B2), [settings.includeB1B2]);
}
