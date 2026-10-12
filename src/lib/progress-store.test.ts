import { describe, expect, it } from "vitest";
import {
  addMistake,
  appendReview,
  DEFAULT_SETTINGS,
  loadMistakes,
  loadProgress,
  loadReviews,
  loadSettings,
  localDay,
  saveProgress,
  saveSettings,
} from "./progress-store";
import type { ItemSchedule } from "./srs";

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  keys(): string[] {
    return [...this.items.keys()];
  }
}

const ITEM: ItemSchedule = {
  due: "2026-10-09T00:00:00.000Z",
  state: "review",
  reps: 1,
  streak: 1,
  introducedOn: "2026-10-08",
};

describe("progress", () => {
  it("starts empty when nothing is saved", () => {
    expect(loadProgress(new MemoryStorage())).toEqual({ items: {} });
  });

  it("round-trips saved progress", () => {
    const storage = new MemoryStorage();
    saveProgress(storage, { items: { "w:7": ITEM } });
    expect(loadProgress(storage)).toEqual({ items: { "w:7": ITEM } });
  });


  it("backs up corrupt data instead of silently discarding it", () => {
    const storage = new MemoryStorage();
    storage.setItem("pt.progress.v1", "{not json");
    expect(loadProgress(storage)).toEqual({ items: {} });
    expect(storage.keys().some((k) => k.startsWith("pt.progress.v1.corrupt-"))).toBe(true);
  });
});

describe("settings", () => {
  it("uses defaults when nothing is saved", () => {
    expect(loadSettings(new MemoryStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips saved settings", () => {
    const storage = new MemoryStorage();
    const settings = { autoplayAudio: true, typeAnswers: true, includeB1B2: true };
    saveSettings(storage, settings);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it("keeps valid fields from older saves and defaults the rest", () => {
    const storage = new MemoryStorage();
    storage.setItem("pt.settings.v1", JSON.stringify({ typeAnswers: true }));
    expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, typeAnswers: true });
  });

  it("ignores invalid values", () => {
    const storage = new MemoryStorage();
    storage.setItem("pt.settings.v1", JSON.stringify({ typeAnswers: 1, autoplayAudio: "yes" }));
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("mistakes", () => {
  const mistake = { id: "m1", wrong: "狗比猫很大。", right: "狗比猫大。", reason: "No 很 in 比 sentences.", createdAt: "x" };

  it("starts empty", () => {
    expect(loadMistakes(new MemoryStorage())).toEqual([]);
  });

  it("adds and replaces by id", () => {
    const storage = new MemoryStorage();
    addMistake(storage, mistake);
    addMistake(storage, { ...mistake, reason: "updated" });
    expect(loadMistakes(storage)).toEqual([{ ...mistake, reason: "updated" }]);
  });
});

describe("reviews", () => {
  it("appends entries", () => {
    const storage = new MemoryStorage();
    appendReview(storage, { key: "w:1:r", rating: 2, at: "2026-10-08T12:00:00.000Z" });
    expect(loadReviews(storage)).toHaveLength(1);
  });
});

describe("localDay", () => {
  it("formats the local calendar day", () => {
    expect(localDay(new Date(2026, 9, 8, 23, 30))).toBe("2026-10-08");
  });
});
