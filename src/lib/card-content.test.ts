import { describe, expect, it } from "vitest";
import { cardContent } from "./card-content";
import type { Deck } from "./deck";

const DECK: Deck = {
  words: [
    {
      id: 1,
      hanzi: "爱",
      pinyin: "ài",
      pos: "v.",
      english: "to love",
      level: 1,
      topic: "Actions",
      example: { zh: "我爱我的家人。", pinyin: "Wǒ ài wǒ de jiārén.", en: "I love my family." },
    },
  ],
  grammar: [
    {
      id: "g1",
      level: 2,
      title: "比",
      pattern: "A 比 B + adj",
      explanation: "",
      examples: [
        { zh: "狗比猫大。", pinyin: "", en: "Dogs are bigger than cats.", highlight: ["比"] },
        { zh: "我比你高。", pinyin: "", en: "I'm taller than you.", highlight: ["比"] },
      ],
      mistake: { wrong: "狗比猫很大。", right: "狗比猫大。", pinyin: "Gǒu bǐ māo dà.", en: "Dogs are bigger than cats.", reason: "No 很." },
      wordIds: [],
    },
  ],
  mistakes: [{ id: "m1", wrong: "我是忙。", right: "我很忙。", reason: "No 是 before adjectives.", createdAt: "x" }],
};

describe("cardContent", () => {
  it("has no typed answer for recognition cards", () => {
    expect(cardContent("w:1:r", DECK)?.answer).toBeUndefined();
  });

  it("accepts hanzi or pinyin for word production", () => {
    expect(cardContent("w:1:p", DECK)?.answer).toEqual({ zh: "爱", pinyin: "ài" });
  });

  it("expects the example sentence for sentence production", () => {
    expect(cardContent("s:1:p", DECK)?.answer).toEqual({ zh: "我爱我的家人。" });
  });

  it("rotates grammar examples by review count", () => {
    const first = cardContent("g:g1:u", DECK, 0);
    const second = cardContent("g:g1:u", DECK, 1);
    expect(first?.kind === "grammar" && first.example.zh).toBe("狗比猫大。");
    expect(second?.kind === "grammar" && second.example.zh).toBe("我比你高。");
  });

  it("expects the corrected sentence on fix cards", () => {
    expect(cardContent("g:g1:f", DECK)?.answer).toEqual({ zh: "狗比猫大。" });
    expect(cardContent("m:m1:f", DECK)?.answer).toEqual({ zh: "我很忙。" });
  });

  it("returns null for content that no longer exists", () => {
    expect(cardContent("w:99:r", DECK)).toBeNull();
    expect(cardContent("g:gone:u", DECK)).toBeNull();
  });
});
