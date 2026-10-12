import rawStories from "../../data/stories.json";
import { itemKey } from "./deck";
import type { KeyValueStorage } from "./progress-store";
import type { Progress } from "./srs";
import { parseStories, type Story } from "./story";
import { enqueue } from "./sync-ops";

export const LIBRARY: Story[] = parseStories(rawStories);

export type WordStatus = "known" | "learning" | "new";

const CUSTOM_KEY = "pt.stories.v1";
const READ_KEY = "pt.read.v1";

/** A word is known once it has been passed (in review), learning once it is being studied. */
export function wordStatus(progress: Progress, wordId: number): WordStatus {
  const item = progress.items[itemKey("word", wordId)];
  if (!item) return "new";
  return item.state === "review" ? "known" : "learning";
}

/** Share (0-1) of a story's distinct list words that are known. */
export function knownShare(story: Story, progress: Progress): number {
  if (story.wordIds.length === 0) return 0;
  return story.wordIds.filter((id) => wordStatus(progress, id) === "known").length / story.wordIds.length;
}

function readJsonArray(storage: KeyValueStorage, key: string): unknown[] {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    storage.setItem(`${key}.corrupt-${Date.now()}`, raw);
    return [];
  }
}

/** Stories generated on demand and saved in this browser; unreadable entries are skipped. */
export function loadCustomStories(storage: KeyValueStorage): Story[] {
  const entries = readJsonArray(storage, CUSTOM_KEY);
  return entries.flatMap((entry) => {
    try {
      return parseStories([entry]);
    } catch {
      return [];
    }
  });
}

export function saveCustomStory(storage: KeyValueStorage, story: Story): Story[] {
  const stories = [...loadCustomStories(storage).filter((s) => s.id !== story.id), story];
  storage.setItem(CUSTOM_KEY, JSON.stringify(stories));
  enqueue(storage, { type: "story", story });
  return stories;
}

export function loadReadIds(storage: KeyValueStorage): Set<string> {
  return new Set(readJsonArray(storage, READ_KEY).filter((x): x is string => typeof x === "string"));
}

export function markRead(storage: KeyValueStorage, id: string): Set<string> {
  const ids = loadReadIds(storage);
  if (ids.has(id)) return ids;
  ids.add(id);
  storage.setItem(READ_KEY, JSON.stringify([...ids]));
  enqueue(storage, { type: "read", id });
  return ids;
}

/** Replaces this device's generated stories and read marks with the synced copy, without queuing anything. */
export function replaceReadingWithSynced(storage: KeyValueStorage, synced: { stories: Story[]; readIds: string[] }): void {
  storage.setItem(CUSTOM_KEY, JSON.stringify(synced.stories));
  storage.setItem(READ_KEY, JSON.stringify(synced.readIds));
}

export function findStory(id: string, custom: readonly Story[]): Story | undefined {
  return LIBRARY.find((s) => s.id === id) ?? custom.find((s) => s.id === id);
}
