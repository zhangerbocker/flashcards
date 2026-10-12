import { describe, expect, it } from "vitest";
import type { Deck } from "./deck";
import { loadSession, markKnown, markMissed, saveSession, sessionOf, startSession, type Session } from "./session";
import { gradeItem, newItem, Rating, type Progress } from "./srs";
import type { Word } from "./words";

const NOW = new Date("2026-10-08T12:00:00Z");
const TODAY = "2026-10-08";
const FILTER = { kind: "words", level: "all", topic: "all", face: "r" } as const;
/** A random source that keeps the order when shuffling (always picks the last index). */
const KEEP = () => 0.999;

const word = (id: number): Word => ({
  id,
  pt: `p${id}`,
  pos: "adv.",
  english: `w${id}`,
  level: 1,
  topic: "Time",
  forms: [],
  example: { pt: "", en: "" },
});
const DECK: Deck = { words: [1, 2, 3, 4, 5, 6].map(word), grammar: [], verbs: [], mistakes: [] };

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

describe("startSession", () => {
  it("puts missed, then added, then due, then new, then known-not-due cards first", () => {
    const known = (dueIso: string) => ({ ...gradeItem(undefined, Rating.Know, NOW, TODAY), due: dueIso });
    const progress: Progress = {
      items: {
        "w:1": known("2026-12-01T00:00:00Z"),
        "w:2": known("2026-10-01T00:00:00Z"),
        "w:3": newItem(NOW, TODAY),
        "w:4": gradeItem(undefined, Rating.DontKnow, NOW, TODAY),
        "w:6": known("2026-11-01T00:00:00Z"),
      },
    };
    const session = startSession(DECK, progress, FILTER, "all", NOW, KEEP);
    expect([...session.queue]).toEqual(["w:4:r", "w:3:r", "w:2:r", "w:5:r", "w:6:r", "w:1:r"]);
    expect(session.total).toBe(6);
  });

  it("takes only the requested number of cards", () => {
    const session = startSession(DECK, { items: {} }, FILTER, 10, NOW, KEEP);
    expect(session.queue).toHaveLength(6);
    const progress: Progress = { items: { "w:5": gradeItem(undefined, Rating.DontKnow, NOW, TODAY) } };
    expect(startSession({ ...DECK }, progress, FILTER, 10, NOW, KEEP).queue[0]).toBe("w:5:r");
  });

  it("shuffles the chosen cards", () => {
    const session = startSession(DECK, { items: {} }, FILTER, "all", NOW, () => 0);
    expect(session.queue).not.toEqual(["w:1:r", "w:2:r", "w:3:r", "w:4:r", "w:5:r", "w:6:r"]);
    expect([...session.queue].sort()).toEqual(["w:1:r", "w:2:r", "w:3:r", "w:4:r", "w:5:r", "w:6:r"]);
  });
});

describe("answering", () => {
  const base: Session = { filter: FILTER, size: 10, queue: ["a", "b", "c", "d"], total: 4, missed: [] };

  it("takes a known card out for the rest of the session", () => {
    expect(markKnown(base).queue).toEqual(["b", "c", "d"]);
  });

  it("shuffles a missed card back in, never straight back on top, and remembers it", () => {
    expect(markMissed(base, () => 0).queue).toEqual(["b", "a", "c", "d"]);
    expect(markMissed(base, () => 0.999).queue).toEqual(["b", "c", "d", "a"]);
    const twice = markMissed({ ...base, queue: ["a"] , missed: ["a"] }, () => 0);
    expect(twice).toMatchObject({ queue: ["a"], missed: ["a"] });
    expect(markMissed(base, () => 0).missed).toEqual(["a"]);
  });
});

describe("sessionOf", () => {
  it("starts a session over exactly the given cards", () => {
    expect(sessionOf(["x", "y"], FILTER, KEEP)).toMatchObject({ queue: ["x", "y"], total: 2, missed: [], size: "all" });
  });
});

describe("session storage", () => {
  it("round-trips a session and clears it", () => {
    const storage = new MemoryStorage();
    const session = startSession(DECK, { items: {} }, FILTER, 20, NOW, KEEP);
    saveSession(storage, session);
    expect(loadSession(storage)).toEqual(session);
    saveSession(storage, null);
    expect(loadSession(storage)).toBeNull();
  });

  it("ignores unreadable data", () => {
    const storage = new MemoryStorage();
    storage.setItem("pt.session.v1", "{oops");
    expect(loadSession(storage)).toBeNull();
    storage.setItem("pt.session.v1", JSON.stringify({ queue: [] }));
    expect(loadSession(storage)).toBeNull();
  });
});
