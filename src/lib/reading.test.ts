import { describe, expect, it } from "vitest";
import {
  knownShare,
  loadCustomStories,
  loadReadIds,
  markRead,
  saveCustomStory,
  wordStatus,
} from "./reading";
import { gradeItem, Rating, type Progress } from "./srs";
import type { Story } from "./story";

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const NOW = new Date("2026-10-08T12:00:00Z");
const known = gradeItem(undefined, Rating.Know, NOW, "2026-10-08");
const learning = gradeItem(undefined, Rating.DontKnow, NOW, "2026-10-08");
const progress: Progress = { items: { "w:1": known, "w:2": learning } };

const story: Story = {
  id: "c-1",
  level: 1,
  topic: "Time",
  title: "Hoje",
  titleEn: "Today",
  sentences: [{ tokens: [{ text: "Hoje", en: "today", wordId: 1 }], en: "Today." }],
  questions: [],
  wordIds: [1, 2, 3, 4],
};

describe("wordStatus", () => {
  it("distinguishes known, learning and new words", () => {
    expect(wordStatus(progress, 1)).toBe("known");
    expect(wordStatus(progress, 2)).toBe("learning");
    expect(wordStatus(progress, 3)).toBe("new");
  });
});

describe("knownShare", () => {
  it("is the share of the story's words that are known", () => {
    expect(knownShare(story, progress)).toBe(0.25);
  });

  it("is zero for a story without list words", () => {
    expect(knownShare({ ...story, wordIds: [] }, progress)).toBe(0);
  });
});

describe("custom stories", () => {
  it("saves and loads, replacing by id", () => {
    const storage = new MemoryStorage();
    saveCustomStory(storage, story);
    saveCustomStory(storage, { ...story, title: "改" });
    expect(loadCustomStories(storage).map((s) => s.title)).toEqual(["改"]);
  });

  it("skips malformed entries", () => {
    const storage = new MemoryStorage();
    storage.setItem("pt.stories.v1", JSON.stringify([{ id: "bad" }, story]));
    expect(loadCustomStories(storage).map((s) => s.id)).toEqual(["c-1"]);
  });
});

describe("read status", () => {
  it("remembers read stories", () => {
    const storage = new MemoryStorage();
    markRead(storage, "a");
    markRead(storage, "a");
    expect([...loadReadIds(storage)]).toEqual(["a"]);
  });
});
