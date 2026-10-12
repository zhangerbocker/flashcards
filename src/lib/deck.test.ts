import { describe, expect, it } from "vitest";
import {
  buildCramKeys,
  cardKey,
  currentExercise,
  dailyCounts,
  exercisesOf,
  introducedOn,
  newWordItems,
  nextDailyCard,
  parseKey,
  unlockedGrammarItems,
  unlockedVerbItems,
  verbItemKey,
  type Deck,
} from "./deck";
import type { GrammarPoint } from "./grammar";
import { gradeItem, newItem, Rating, type Grade, type ItemSchedule, type Progress } from "./srs";
import type { Topic } from "./topics";
import type { Level, Word } from "./words";

const NOW = new Date("2026-10-08T12:00:00Z");
const TODAY = "2026-10-08";

function word(id: number, level: Level, topic: Topic = "Actions"): Word {
  return {
    id,
    pt: `palavra${id}`,
    pos: "n.",
    english: `word ${id}`,
    level,
    topic,
    gender: "f",
    forms: [],
    example: { pt: "Exemplo.", en: "Example." },
  };
}

function grammar(id: string, wordIds: number[]): GrammarPoint {
  return {
    id,
    level: 1,
    title: id,
    pattern: "A + B",
    explanation: "",
    examples: [{ pt: "Exemplo.", en: "", highlight: [] }],
    mistake: { wrong: "x", right: "y", en: "y", reason: "z" },
    wordIds,
  };
}

const DECK: Deck = {
  words: [word(3, 2), word(1, 1, "Time"), word(2, 1, "Function words"), word(4, 2)],
  grammar: [grammar("g1", [1, 2])],
  verbs: [],
  mistakes: [],
};

function graded(rating: Grade, day = TODAY): ItemSchedule {
  return gradeItem(undefined, rating, NOW, day);
}

/** An item that has been passed and is due far in the future. */
function learned(day = TODAY): ItemSchedule {
  return { ...graded(Rating.Easy, day), due: "2026-12-01T00:00:00.000Z" };
}

const progress = (items: Progress["items"]): Progress => ({ items });
const QUOTAS = { newPerDay: 30, newGrammarPerDay: 30 };
const NONE = { newPerDay: 0, newGrammarPerDay: 0 };

describe("card keys", () => {
  it("round-trips kind, ref and face", () => {
    expect(parseKey(cardKey("grammar", "h1-shi", "u"))).toEqual({ kind: "grammar", ref: "h1-shi", face: "u" });
  });

  it("rejects malformed keys", () => {
    expect(() => parseKey("x:1:r")).toThrow(/invalid card key/);
  });
});

describe("exercisesOf", () => {
  it("rotates a word through recognition, production and its sentence both ways", () => {
    expect(exercisesOf("w:7")).toEqual(["w:7:r", "w:7:p", "s:7:r", "s:7:p"]);
  });

  it("rotates a grammar point between using the pattern and fixing the mistake", () => {
    expect(exercisesOf("g:h1-shi")).toEqual(["g:h1-shi:u", "g:h1-shi:f"]);
  });

  it("rejects unknown item keys", () => {
    expect(() => exercisesOf("x:1")).toThrow(/invalid item key/);
  });
});

describe("currentExercise", () => {
  it("follows the item's turn, wrapping around", () => {
    const at = (turn: number) => currentExercise("w:7", progress({ "w:7": { ...learned(), turn } }));
    expect([0, 1, 2, 3, 4].map(at)).toEqual(["w:7:r", "w:7:p", "s:7:r", "s:7:p", "w:7:r"]);
  });

  it("starts a new word on recognition", () => {
    expect(currentExercise("w:7", progress({}))).toBe("w:7:r");
  });
});

describe("newWordItems", () => {
  it("orders HSK 1 before HSK 2, then by topic, then by id", () => {
    expect(newWordItems(DECK, progress({}))).toEqual(["w:2", "w:1", "w:3", "w:4"]);
  });
});

describe("unlockedGrammarItems", () => {
  it("unlocks a grammar point once 70% of its words are introduced", () => {
    expect(unlockedGrammarItems(DECK, progress({ "w:1": graded(Rating.Good) }))).toEqual([]);
    expect(unlockedGrammarItems(DECK, progress({ "w:1": graded(Rating.Hard), "w:2": graded(Rating.Hard) }))).toEqual(["g:g1"]);
  });

  it("leaves out grammar points already studied", () => {
    const p = progress({ "w:1": learned(), "w:2": learned(), "g:g1": learned() });
    expect(unlockedGrammarItems(DECK, p)).toEqual([]);
  });
});

describe("introducedOn", () => {
  it("counts new words and grammar points separately, ignoring mistakes", () => {
    const p = progress({ "w:1": graded(Rating.Good), "g:g1": graded(Rating.Good), "m:x": graded(Rating.Good) });
    expect(introducedOn(p, TODAY)).toEqual({ words: 1, grammar: 1 });
  });
});

describe("nextDailyCard", () => {
  it("starts with the first new word, on recognition", () => {
    expect(nextDailyCard(DECK, progress({}), NOW, TODAY, QUOTAS)).toEqual({ item: "w:2", key: "w:2:r", isNew: true });
  });

  it("returns null when quotas are zero and nothing is due", () => {
    expect(nextDailyCard(DECK, progress({}), NOW, TODAY, NONE)).toBeNull();
  });

  it("shows a due word with its next exercise in the rotation", () => {
    const due = { ...graded(Rating.Good, "2026-10-01"), turn: 2, due: "2026-10-08T11:00:00.000Z" };
    expect(nextDailyCard(DECK, progress({ "w:4": due }), NOW, TODAY, QUOTAS)).toEqual({ item: "w:4", key: "s:4:r", isNew: false });
  });

  it("shows nothing of a word that is scheduled days out", () => {
    const later = { ...graded(Rating.Easy), turn: 3, due: "2026-10-16T12:00:00.000Z" };
    expect(nextDailyCard(DECK, progress({ "w:2": later }), NOW, TODAY, NONE)).toBeNull();
  });

  it("alternates between new words and unlocked grammar points", () => {
    const p = progress({ "w:1": learned("2026-10-07") });
    expect(nextDailyCard(DECK, p, NOW, TODAY, QUOTAS)?.item).toBe("w:2");
    const afterWord = progress({ ...p.items, "w:2": { ...graded(Rating.Good), due: "2026-10-09T00:00:00.000Z" } });
    expect(nextDailyCard(DECK, afterWord, NOW, TODAY, QUOTAS)).toEqual({ item: "g:g1", key: "g:g1:u", isNew: true });
  });

  it("shows a new word before a missed one that is not yet due", () => {
    const p = progress({ "w:2": graded(Rating.Again) });
    expect(nextDailyCard(DECK, p, NOW, TODAY, QUOTAS)?.item).toBe("w:1");
  });

  it("repeats a missed exercise from the learn-ahead window when nothing else is left", () => {
    const p = progress({ "w:2": graded(Rating.Again) });
    expect(nextDailyCard(DECK, p, NOW, TODAY, { newPerDay: 1, newGrammarPerDay: 0 })).toEqual({
      item: "w:2",
      key: "w:2:r",
      isNew: false,
    });
  });

  it("serves chat mistakes without using the quota", () => {
    const deck = { ...DECK, mistakes: [{ id: "m1", wrong: "a", right: "b", reason: "c", createdAt: TODAY }] };
    expect(nextDailyCard(deck, progress({}), NOW, TODAY, NONE)?.key).toBe("m:m1:f");
  });

  it("marks a word added from a story as new when it comes up", () => {
    expect(nextDailyCard(DECK, progress({ "w:3": newItem(NOW, TODAY) }), NOW, TODAY, NONE)).toEqual({
      item: "w:3",
      key: "w:3:r",
      isNew: true,
    });
  });

  it("skips progress for content that no longer exists", () => {
    const stale = { ...graded(Rating.Good, "2026-10-01"), due: "2026-10-01T00:00:00.000Z" };
    expect(nextDailyCard(DECK, progress({ "g:gone": stale }), NOW, TODAY, QUOTAS)?.item).toBe("w:2");
  });
});

describe("dailyCounts", () => {
  it("reports due items and remaining quotas", () => {
    const p = progress({ "w:2": graded(Rating.Again), "w:1": learned("2026-10-07") });
    expect(dailyCounts(DECK, p, NOW, TODAY, { newPerDay: 2, newGrammarPerDay: 1 })).toEqual({
      due: 1,
      newWords: 1,
      newGrammar: 1,
    });
  });
});

describe("buildCramKeys", () => {
  const rand = () => 0.3;

  it("builds word cards for a level and face", () => {
    const keys = buildCramKeys(DECK, { kind: "words", level: 2, topic: "all", face: "p" }, rand);
    expect([...keys].sort()).toEqual(["w:3:p", "w:4:p"]);
  });

  it("filters by topic", () => {
    const keys = buildCramKeys(DECK, { kind: "sentences", level: "all", topic: "Time", face: "r" }, rand);
    expect(keys).toEqual(["s:1:r"]);
  });

  it("includes both grammar faces", () => {
    const keys = buildCramKeys(DECK, { kind: "grammar", level: 1, topic: "all", face: "r" }, rand);
    expect([...keys].sort()).toEqual(["g:g1:f", "g:g1:u"]);
  });

  it("is deterministic for a given random source", () => {
    const filter = { kind: "words", level: "all", topic: "all", face: "r" } as const;
    expect(buildCramKeys(DECK, filter, rand)).toEqual(buildCramKeys(DECK, filter, rand));
  });
});

describe("verb drills", () => {
  const verb = {
    wordId: 1,
    infinitive: "falar",
    irregular: false,
    tenses: {
      presente: ["falo", "fala", "falamos", "falam"],
      preterito: ["falei", "falou", "falamos", "falaram"],
      imperfeito: ["falava", "falava", "falávamos", "falavam"],
    },
  } satisfies Deck["verbs"][number];
  const deck: Deck = { ...DECK, verbs: [verb] };

  it("rotates through the persons of a tense", () => {
    expect(exercisesOf("v:1-presente")).toEqual(["v:1-presente-0:p", "v:1-presente-1:p", "v:1-presente-3:p", "v:1-presente-2:p"]);
    expect(parseKey("v:1-presente-0:p")).toEqual({ kind: "conjugation", ref: "1-presente-0", face: "p" });
  });

  it("unlocks the present once the verb's word has graduated, then each tense after the previous one", () => {
    expect(unlockedVerbItems(deck, progress({ "w:1": graded(Rating.Again) }))).toEqual([]);
    expect(unlockedVerbItems(deck, progress({ "w:1": learned() }))).toEqual(["v:1-presente"]);
    const presentStarted = progress({ "w:1": learned(), [verbItemKey(1, "presente")]: graded(Rating.Again) });
    expect(unlockedVerbItems(deck, presentStarted)).toEqual([]);
    const presentLearned = progress({ "w:1": learned(), [verbItemKey(1, "presente")]: learned() });
    expect(unlockedVerbItems(deck, presentLearned)).toEqual(["v:1-preterito"]);
  });

  it("serves verb drills from the practice quota, taking turns with grammar", () => {
    const p = progress({ "w:1": learned(), "w:2": learned(), "w:3": learned(), "w:4": learned() });
    const quotas = { newPerDay: 0, newGrammarPerDay: 2 };
    const first = nextDailyCard(deck, p, NOW, TODAY, quotas);
    expect(first?.item).toBe("g:g1");
    const afterGrammar = progress({ ...p.items, "g:g1": graded(Rating.Good) });
    expect(nextDailyCard(deck, afterGrammar, NOW, TODAY, quotas)?.key).toBe("v:1-presente-0:p");
    expect(introducedOn(progress({ ...afterGrammar.items, "v:1-presente": graded(Rating.Good) }), TODAY).grammar).toBe(2);
  });

  it("crams every person of the chosen tense", () => {
    const keys = buildCramKeys(deck, { kind: "verbs", level: "all", topic: "all", face: "p", tense: "preterito" }, () => 0.3);
    expect([...keys].sort()).toEqual(["v:1-preterito-0:p", "v:1-preterito-1:p", "v:1-preterito-2:p", "v:1-preterito-3:p"]);
  });
});
