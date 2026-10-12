import type { Mistake } from "./deck";
import type { Progress } from "./srs";
import { enqueue } from "./sync-ops";

/** The subset of the Web Storage API this module needs (injectable for tests). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Settings {
  autoplayAudio: boolean;
  typeAnswers: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoplayAudio: false,
  typeAnswers: false,
};

export interface ReviewEntry {
  key: string;
  rating: number;
  at: string;
}

const PROGRESS_KEY = "pt.progress.v1";
const SETTINGS_KEY = "pt.settings.v1";
const MISTAKES_KEY = "pt.mistakes.v1";
const REVIEWS_KEY = "pt.reviews.v1";
/** Keep the review log bounded; it only feeds streaks and today's counts. */
const MAX_REVIEWS = 5000;

function readJson(storage: KeyValueStorage, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    storage.setItem(`${key}.corrupt-${Date.now()}`, raw);
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Loads study progress. Unreadable data is copied to a timestamped backup key so a
 * bad write never loses history.
 */
export function loadProgress(storage: KeyValueStorage): Progress {
  const value = readJson(storage, PROGRESS_KEY);
  if (value === undefined) return { items: {} };
  if (!isRecord(value) || !isRecord(value.items)) {
    storage.setItem(`${PROGRESS_KEY}.corrupt-${Date.now()}`, JSON.stringify(value));
    return { items: {} };
  }
  return { items: value.items as Progress["items"] };
}

/** Saves progress and queues the items that changed for syncing. */
export function saveProgress(storage: KeyValueStorage, progress: Progress): void {
  const previous = loadProgress(storage).items;
  storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  for (const [key, schedule] of Object.entries(progress.items)) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(schedule)) enqueue(storage, { type: "item", key, schedule });
  }
}

/** Loads settings, falling back to the default for any missing or invalid field. */
export function loadSettings(storage: KeyValueStorage): Settings {
  const value = readJson(storage, SETTINGS_KEY);
  if (typeof value !== "object" || value === null) return DEFAULT_SETTINGS;
  const s = value as Partial<Record<keyof Settings, unknown>>;
  return {
    autoplayAudio: typeof s.autoplayAudio === "boolean" ? s.autoplayAudio : DEFAULT_SETTINGS.autoplayAudio,
    typeAnswers: typeof s.typeAnswers === "boolean" ? s.typeAnswers : DEFAULT_SETTINGS.typeAnswers,
  };
}

export function saveSettings(storage: KeyValueStorage, settings: Settings): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  enqueue(storage, { type: "settings", settings });
}

/** Whether settings were ever saved on this device (rather than the defaults being in use). */
export function hasSavedSettings(storage: KeyValueStorage): boolean {
  return storage.getItem(SETTINGS_KEY) !== null;
}

function isMistake(value: unknown): value is Mistake {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    ["id", "wrong", "right", "reason", "createdAt"].every((k) => typeof m[k] === "string") &&
    (m.en === undefined || typeof m.en === "string")
  );
}

export function loadMistakes(storage: KeyValueStorage): Mistake[] {
  const value = readJson(storage, MISTAKES_KEY);
  return Array.isArray(value) ? value.filter(isMistake) : [];
}

/** Appends a mistake (from chat) so it becomes a flashcard; returns the updated list. */
export function addMistake(storage: KeyValueStorage, mistake: Mistake): Mistake[] {
  const mistakes = [...loadMistakes(storage).filter((m) => m.id !== mistake.id), mistake];
  storage.setItem(MISTAKES_KEY, JSON.stringify(mistakes));
  enqueue(storage, { type: "mistake", mistake });
  return mistakes;
}

export function loadReviews(storage: KeyValueStorage): ReviewEntry[] {
  const value = readJson(storage, REVIEWS_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is ReviewEntry =>
      typeof r === "object" && r !== null && typeof r.key === "string" && typeof r.rating === "number" && typeof r.at === "string",
  );
}

export function appendReview(storage: KeyValueStorage, entry: ReviewEntry): ReviewEntry[] {
  const reviews = [...loadReviews(storage), entry].slice(-MAX_REVIEWS);
  storage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
  enqueue(storage, { type: "review", entry });
  return reviews;
}

/**
 * Replaces this device's progress, reviews, mistakes and settings with the synced copy
 * from the server, without queuing anything (it is already on the server). Settings are
 * kept when the server has none yet.
 */
export function replaceWithSynced(
  storage: KeyValueStorage,
  synced: { items: Progress["items"]; reviews: ReviewEntry[]; mistakes: Mistake[]; settings: Settings | null },
): void {
  storage.setItem(PROGRESS_KEY, JSON.stringify({ items: synced.items }));
  storage.setItem(REVIEWS_KEY, JSON.stringify(synced.reviews.slice(-MAX_REVIEWS)));
  storage.setItem(MISTAKES_KEY, JSON.stringify(synced.mistakes));
  if (synced.settings) storage.setItem(SETTINGS_KEY, JSON.stringify(synced.settings));
}

/** Local calendar day as YYYY-MM-DD; quotas and streaks reset at local midnight. */
export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
