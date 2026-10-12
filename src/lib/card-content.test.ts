import { describe, expect, it } from "vitest";
import { cardContent } from "./card-content";
import type { Deck } from "./deck";
import { regularForms } from "./verbs";

const DECK: Deck = {
  levels: [1, 2, 3, 4],
  words: [
    {
      id: 1,
      pt: "casa",
      pos: "n.",
      english: "house",
      level: 1,
      topic: "Places & directions",
      gender: "f",
      forms: ["casas"],
      example: { pt: "A casa é pequena.", en: "The house is small." },
    },
    {
      id: 2,
      pt: "falar",
      pos: "v.",
      english: "to speak",
      level: 1,
      topic: "Actions",
      forms: ["falo", "fala"],
      example: { pt: "Eu falo português.", en: "I speak Portuguese." },
    },
  ],
  grammar: [
    {
      id: "g1",
      level: 1,
      title: "Ser vs. estar",
      pattern: "ser / estar",
      explanation: "",
      examples: [
        { pt: "Eu sou de Boston.", en: "I am from Boston.", highlight: ["sou"] },
        { pt: "Eu estou cansado.", en: "I'm tired.", highlight: ["estou"] },
      ],
      mistake: { wrong: "Eu estou de Boston.", right: "Eu sou de Boston.", en: "I am from Boston.", reason: "Origin takes ser." },
      wordIds: [],
    },
  ],
  verbs: [
    { wordId: 2, infinitive: "falar", irregular: false, ...regularForms("falar")! },
  ],
  mistakes: [{ id: "m1", wrong: "Eu é cansada.", right: "Eu estou cansada.", reason: "Use estar for states.", createdAt: "x" }],
};

describe("cardContent", () => {
  it("has no typed answer for recognition cards", () => {
    expect(cardContent("w:1:r", DECK)?.answer).toBeUndefined();
  });

  it("expects a noun with its article, also accepting it without", () => {
    expect(cardContent("w:1:p", DECK)?.answer).toEqual({ pt: "a casa", alternatives: ["casa"] });
    expect(cardContent("w:2:p", DECK)?.answer).toEqual({ pt: "falar", alternatives: [] });
  });

  it("gives a verb's word card its conjugation table", () => {
    const card = cardContent("w:2:r", DECK);
    expect(card?.kind === "word" && card.verb?.tenses.preterito).toEqual(["falei", "falou", "falamos", "falaram"]);
    expect(cardContent("w:1:r", DECK)).not.toHaveProperty("verb");
  });

  it("reads nouns aloud with their article", () => {
    expect(cardContent("w:1:r", DECK)?.audio).toEqual({ front: "a casa", back: "a casa" });
  });

  it("expects the example sentence for sentence production", () => {
    expect(cardContent("s:1:p", DECK)?.answer).toEqual({ pt: "A casa é pequena." });
  });

  it("rotates grammar examples by review count", () => {
    const first = cardContent("g:g1:u", DECK, 0);
    const second = cardContent("g:g1:u", DECK, 1);
    expect(first?.kind === "grammar" && first.example.pt).toBe("Eu sou de Boston.");
    expect(second?.kind === "grammar" && second.example.pt).toBe("Eu estou cansado.");
  });

  it("expects the corrected sentence on fix cards", () => {
    expect(cardContent("g:g1:f", DECK)?.answer).toEqual({ pt: "Eu sou de Boston." });
    expect(cardContent("m:m1:f", DECK)?.answer).toEqual({ pt: "Eu estou cansada." });
  });

  it("asks for one person of a verb tense, accepting it with or without the pronoun", () => {
    const card = cardContent("v:2-preterito-1:p", DECK);
    expect(card).toMatchObject({ kind: "conjugation", tense: "preterito", person: 1, form: "falou", level: 1 });
    expect(card?.answer).toEqual({ pt: "falou", alternatives: ["você falou", "ele falou", "ela falou"] });
    expect(card?.audio).toEqual({ back: "você falou" });
  });

  it("cues subjunctive drills with que / se / quando and rates them at the tense's level", () => {
    const card = cardContent("v:2-subjimperfeito-0:p", DECK);
    expect(card).toMatchObject({ form: "falasse", level: 4 });
    expect(card?.answer?.alternatives).toContain("se eu falasse");
    expect(card?.audio).toEqual({ back: "se eu falasse" });
  });

  it("returns null for content that no longer exists", () => {
    expect(cardContent("w:99:r", DECK)).toBeNull();
    expect(cardContent("g:gone:u", DECK)).toBeNull();
    expect(cardContent("v:9-presente-0:p", DECK)).toBeNull();
    expect(cardContent("v:2-futurox-0:p", DECK)).toBeNull();
  });
});
