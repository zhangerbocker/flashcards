import { describe, expect, it } from "vitest";
import { findWord, LEVELS, parseWords, withArticle, WORDS } from "./words";
import { lookupForm } from "./segment";

describe("word list", () => {
  it("has a substantial list at every level", () => {
    const counts = LEVELS.map((l) => WORDS.filter((w) => w.level === l).length);
    expect(counts.every((n) => n >= 300), `counts by level: ${counts.join(", ")}`).toBe(true);
  });

  it("has unique ids", () => {
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length);
  });

  it("has no duplicate entries (same word and part of speech)", () => {
    const keys = WORDS.map((w) => `${lookupForm(w.pt)}|${w.pos}`);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it("gives every noun a gender", () => {
    expect(WORDS.filter((w) => w.pos === "n." && !w.gender).map((w) => w.pt)).toEqual([]);
  });

  it("keeps forms lowercase and different from the dictionary form", () => {
    const bad = WORDS.flatMap((w) => w.forms.filter((f) => f !== f.toLowerCase() || f === w.pt).map((f) => `${w.pt}: ${f}`));
    expect(bad).toEqual([]);
  });

  it("uses each word, in some form, in its own example sentence", () => {
    const missing = WORDS.filter((w) => {
      const sentence = ` ${lookupForm(w.example.pt).replace(/[^\p{L}\p{M} ]/gu, " ")} `;
      return ![w.pt, ...w.forms].some((f) => sentence.includes(` ${lookupForm(f)} `));
    });
    expect(missing.map((w) => `${w.id} ${w.pt}: ${w.example.pt}`)).toEqual([]);
  });

  it("gives every word an English meaning and an example translation", () => {
    expect(WORDS.filter((w) => !w.english.trim() || !w.example.en.trim()).map((w) => w.pt)).toEqual([]);
  });
});

describe("withArticle", () => {
  it("adds the article to nouns only", () => {
    expect(withArticle({ pt: "casa", gender: "f" })).toBe("a casa");
    expect(withArticle({ pt: "dia", gender: "m" })).toBe("o dia");
    expect(withArticle({ pt: "estudante", gender: "mf" })).toBe("o/a estudante");
    expect(withArticle({ pt: "bonito" })).toBe("bonito");
  });
});

describe("findWord", () => {
  it("finds a word by dictionary or inflected form, ignoring a leading article", () => {
    const casa = WORDS.find((w) => w.pt === "casa")!;
    expect(findWord("a casa")).toBe(casa);
    expect(findWord("Casas")).toBe(casa);
    expect(findWord("xyz")).toBeUndefined();
  });
});

describe("parseWords", () => {
  it("rejects a non-array", () => {
    expect(() => parseWords({})).toThrow(/must be an array/);
  });

  it("names the malformed entry", () => {
    expect(() => parseWords([{ id: 1, pt: "casa" }])).toThrow(/malformed word at index 0/);
  });
});
