import { describe, expect, it } from "vitest";
import { buildLexicon, segment, unknownTokens, wordCount } from "./segment";

const lexicon = buildLexicon([
  { id: 1, pt: "eu", forms: [] },
  { id: 2, pt: "gostar", forms: ["gosto", "gosta", "gostei"] },
  { id: 3, pt: "de", forms: ["do", "da"] },
  { id: 4, pt: "café", forms: ["cafés"] },
  { id: 5, pt: "fim de semana", forms: ["fins de semana"] },
  { id: 6, pt: "fim", forms: ["fins"] },
  { id: 7, pt: "o", forms: ["a", "os", "as"] },
  { id: 8, pt: "chamar", forms: ["chama"] },
  { id: 9, pt: "se", forms: [] },
]);

const texts = (text: string) => segment(text, lexicon).map((t) => t.text);

describe("segment", () => {
  it("splits on spaces and punctuation, keeping them as tokens so the text can be rebuilt", () => {
    const text = "Eu gosto de café.";
    expect(texts(text)).toEqual(["Eu", " ", "gosto", " ", "de", " ", "café", "."]);
    expect(texts(text).join("")).toBe(text);
  });

  it("links inflected forms and capitalized words to their dictionary entry", () => {
    expect(segment("Gostei", lexicon)).toEqual([{ text: "Gostei", kind: "word", wordId: 2 }]);
    expect(segment("cafés", lexicon)[0].wordId).toBe(4);
  });

  it("prefers the longest multi-word match", () => {
    const tokens = segment("o fim de semana", lexicon).filter((t) => t.kind !== "punct");
    expect(tokens.map((t) => [t.text, t.wordId])).toEqual([
      ["o", 7],
      ["fim de semana", 5],
    ]);
  });

  it("falls back to single words when a phrase isn't complete", () => {
    expect(segment("fim do café", lexicon).filter((t) => t.kind === "word").map((t) => t.wordId)).toEqual([6, 3, 4]);
  });

  it("splits hyphenated clitics into separate words", () => {
    expect(segment("chama-se", lexicon).map((t) => [t.text, t.kind])).toEqual([
      ["chama", "word"],
      ["-", "punct"],
      ["se", "word"],
    ]);
  });

  it("marks numbers as other and words outside the lexicon as unknown", () => {
    expect(segment("eu 29 gatos", lexicon).map((t) => [t.text, t.kind])).toEqual([
      ["eu", "word"],
      [" ", "punct"],
      ["29", "other"],
      [" ", "punct"],
      ["gatos", "unknown"],
    ]);
  });

  it("treats precomposed and decomposed accents the same", () => {
    expect(segment("café", lexicon)[0].wordId).toBe(4);
  });
});

describe("unknownTokens", () => {
  it("lists words not covered by the lexicon or the allowed extras", () => {
    expect(unknownTokens("Eu gosto do Rio de Janeiro", lexicon, new Set(["Rio de Janeiro"]))).toEqual([]);
    expect(unknownTokens("Eu gosto de gatos", lexicon, new Set())).toEqual(["gatos"]);
  });
});

describe("extras", () => {
  it("keeps extra terms such as place names as single tokens without a word id", () => {
    const withExtras = buildLexicon([{ id: 1, pt: "eu", forms: [] }], ["São Paulo"]);
    expect(segment("eu São Paulo", withExtras)).toEqual([
      { text: "eu", kind: "word", wordId: 1 },
      { text: " ", kind: "punct" },
      { text: "São Paulo", kind: "extra" },
    ]);
  });
});

describe("wordCount", () => {
  it("counts words, not numbers or punctuation", () => {
    expect(wordCount("Eu tenho 2 irmãos, e você?")).toBe(5);
  });
});
