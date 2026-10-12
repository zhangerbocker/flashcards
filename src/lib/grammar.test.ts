import { describe, expect, it } from "vitest";
import { GRAMMAR, parseGrammar } from "./grammar";

describe("grammar content", () => {
  it("covers all three levels", () => {
    expect(GRAMMAR.filter((g) => g.level === 1).length).toBeGreaterThanOrEqual(25);
    expect(GRAMMAR.filter((g) => g.level === 2).length).toBeGreaterThanOrEqual(25);
    expect(GRAMMAR.filter((g) => g.level === 3).length).toBeGreaterThanOrEqual(40);
  });

  it("has unique ids", () => {
    expect(new Set(GRAMMAR.map((g) => g.id)).size).toBe(GRAMMAR.length);
  });

  it("highlights only text that appears in each example", () => {
    const bad = GRAMMAR.flatMap((g) => g.examples.flatMap((e) => e.highlight.filter((h) => !e.zh.includes(h))));
    expect(bad).toEqual([]);
  });

  it("gives every corrected sentence an English meaning", () => {
    expect(GRAMMAR.filter((g) => !g.mistake.en.trim()).map((g) => g.id)).toEqual([]);
  });

  it("gives every corrected sentence tone-marked pinyin", () => {
    const bad = GRAMMAR.filter((g) => !/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(g.mistake.pinyin)).map((g) => g.id);
    expect(bad).toEqual([]);
  });

  it("has a mistake whose wrong and right forms differ", () => {
    expect(GRAMMAR.filter((g) => g.mistake.wrong === g.mistake.right)).toEqual([]);
  });
});

describe("parseGrammar", () => {
  it("names the malformed entry", () => {
    expect(() => parseGrammar([{ id: "x" }])).toThrow(/malformed grammar point at index 0/);
  });
});
