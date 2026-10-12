import { describe, expect, it } from "vitest";
import { parseWords, WORDS } from "./words";
import { TOPICS } from "./topics";

describe("HSK word list", () => {
  it("has 300 HSK 1, 200 HSK 2 and 500 HSK 3 words (1000 in all)", () => {
    expect(WORDS.filter((w) => w.level === 1)).toHaveLength(300);
    expect(WORDS.filter((w) => w.level === 2)).toHaveLength(200);
    expect(WORDS.filter((w) => w.level === 3)).toHaveLength(500);
  });

  it("keeps no reading markers (才1) in the hanzi", () => {
    expect(WORDS.filter((w) => /\d/.test(w.hanzi)).map((w) => w.hanzi)).toEqual([]);
  });

  it("uses each word in its own example sentence", () => {
    expect(WORDS.filter((w) => !w.example.zh.includes(w.hanzi)).map((w) => `${w.id} ${w.hanzi}`)).toEqual([]);
  });

  it("has unique ids", () => {
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length);
  });

  it("gives every topic at least 10 words", () => {
    for (const topic of TOPICS) expect(WORDS.filter((w) => w.topic === topic).length).toBeGreaterThanOrEqual(10);
  });

  it("has no truncated glosses", () => {
    expect(WORDS.filter((w) => w.english.includes("…"))).toEqual([]);
  });
});

describe("parseWords", () => {
  it("rejects a non-array", () => {
    expect(() => parseWords({})).toThrow(/must be an array/);
  });

  it("names the malformed entry", () => {
    expect(() => parseWords([{ id: 1, hanzi: "爱" }])).toThrow(/malformed word at index 0/);
  });
});
