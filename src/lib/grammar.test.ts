import { describe, expect, it } from "vitest";
import { GRAMMAR, parseGrammar } from "./grammar";
import { WORDS_BY_ID } from "./words";

describe("grammar content", () => {
  it("has unique ids", () => {
    expect(new Set(GRAMMAR.map((g) => g.id)).size).toBe(GRAMMAR.length);
  });

  it("highlights only text that appears in each example", () => {
    const bad = GRAMMAR.flatMap((g) => g.examples.flatMap((e) => e.highlight.filter((h) => !e.pt.toLowerCase().includes(h.toLowerCase()))));
    expect(bad).toEqual([]);
  });

  it("gives every corrected sentence an English meaning", () => {
    expect(GRAMMAR.filter((g) => !g.mistake.en.trim()).map((g) => g.id)).toEqual([]);
  });

  it("has a mistake whose wrong and right forms differ", () => {
    expect(GRAMMAR.filter((g) => g.mistake.wrong === g.mistake.right)).toEqual([]);
  });

  it("refers only to words in the word list", () => {
    expect(GRAMMAR.flatMap((g) => g.wordIds.filter((id) => !WORDS_BY_ID.has(id)).map((id) => `${g.id}: ${id}`))).toEqual([]);
  });
});

describe("parseGrammar", () => {
  it("names the malformed entry", () => {
    expect(() => parseGrammar([{ id: "x" }])).toThrow(/malformed grammar point at index 0/);
  });
});
