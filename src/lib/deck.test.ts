import { describe, expect, it } from "vitest";
import { cardKey, itemOfCard, matchingCards, orderedWords, parseKey, verbItemKey, type Deck } from "./deck";
import type { GrammarPoint } from "./grammar";
import type { Topic } from "./topics";
import type { Verb } from "./verbs";
import type { Level, Word } from "./words";

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

function grammar(id: string): GrammarPoint {
  return {
    id,
    level: 1,
    title: id,
    pattern: "A + B",
    explanation: "",
    examples: [{ pt: "Exemplo.", en: "", highlight: [] }],
    mistake: { wrong: "x", right: "y", en: "y", reason: "z" },
    wordIds: [],
  };
}

const verb: Verb = {
  wordId: 1,
  infinitive: "falar",
  irregular: false,
  tenses: {
    presente: ["falo", "fala", "falamos", "falam"],
    preterito: ["falei", "falou", "falamos", "falaram"],
    imperfeito: ["falava", "falava", "falávamos", "falavam"],
  },
};

const DECK: Deck = {
  words: [word(3, 2), word(1, 1, "Time"), word(2, 1, "Function words"), word(4, 2)],
  grammar: [grammar("g1")],
  verbs: [verb],
  mistakes: [{ id: "m1", wrong: "a", right: "b", reason: "c", createdAt: "x" }],
};

describe("card keys", () => {
  it("round-trips kind, ref and face", () => {
    expect(parseKey(cardKey("grammar", "ser-estar", "u"))).toEqual({ kind: "grammar", ref: "ser-estar", face: "u" });
    expect(parseKey("v:1-presente-0:p")).toEqual({ kind: "conjugation", ref: "1-presente-0", face: "p" });
  });

  it("rejects malformed keys", () => {
    expect(() => parseKey("x:1:r")).toThrow(/invalid card key/);
  });
});

describe("itemOfCard", () => {
  it("gives a word's word and sentence cards the word's item", () => {
    expect(["w:7:r", "w:7:p", "s:7:r", "s:7:p"].map(itemOfCard)).toEqual(["w:7", "w:7", "w:7", "w:7"]);
  });

  it("gives every person of a verb tense that tense's item", () => {
    expect(itemOfCard("v:1-preterito-3:p")).toBe(verbItemKey(1, "preterito"));
    expect(itemOfCard("g:g1:f")).toBe("g:g1");
    expect(itemOfCard("m:m1:f")).toBe("m:m1");
  });
});

describe("orderedWords", () => {
  it("orders A1 before A2, then by topic, then by id", () => {
    expect(orderedWords(DECK.words).map((w) => w.id)).toEqual([2, 1, 3, 4]);
  });
});

describe("matchingCards", () => {
  it("builds word cards for a level and face, in study order", () => {
    expect(matchingCards(DECK, { kind: "words", level: 2, topic: "all", face: "p" })).toEqual(["w:3:p", "w:4:p"]);
    expect(matchingCards(DECK, { kind: "words", level: "all", topic: "all", face: "r" })).toEqual(["w:2:r", "w:1:r", "w:3:r", "w:4:r"]);
  });

  it("filters by topic", () => {
    expect(matchingCards(DECK, { kind: "sentences", level: "all", topic: "Time", face: "r" })).toEqual(["s:1:r"]);
  });

  it("includes both grammar faces", () => {
    expect(matchingCards(DECK, { kind: "grammar", level: 1, topic: "all", face: "r" })).toEqual(["g:g1:u", "g:g1:f"]);
  });

  it("includes every person of the chosen verb tense", () => {
    const keys = matchingCards(DECK, { kind: "verbs", level: "all", topic: "all", face: "p", tense: "preterito" });
    expect(keys).toEqual(["v:1-preterito-0:p", "v:1-preterito-1:p", "v:1-preterito-2:p", "v:1-preterito-3:p"]);
    expect(matchingCards(DECK, { kind: "verbs", level: "all", topic: "all", face: "p" })).toHaveLength(12);
  });

  it("lists chat mistakes", () => {
    expect(matchingCards(DECK, { kind: "mistakes", level: "all", topic: "all", face: "r" })).toEqual(["m:m1:f"]);
  });
});
