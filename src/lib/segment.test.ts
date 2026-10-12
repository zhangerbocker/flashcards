import { describe, expect, it } from "vitest";
import { buildLexicon, segment, unknownTokens } from "./segment";

const lexicon = buildLexicon([
  { id: 1, hanzi: "我" },
  { id: 2, hanzi: "喜欢" },
  { id: 3, hanzi: "喜" },
  { id: 4, hanzi: "咖啡" },
  { id: 5, hanzi: "不客气" },
  { id: 6, hanzi: "不" },
]);

describe("segment", () => {
  it("prefers the longest dictionary match", () => {
    expect(segment("我喜欢咖啡。", lexicon).map((t) => t.text)).toEqual(["我", "喜欢", "咖啡", "。"]);
  });

  it("links known tokens to their word ids", () => {
    const tokens = segment("不客气", lexicon);
    expect(tokens).toEqual([{ text: "不客气", kind: "word", wordId: 5 }]);
  });

  it("keeps runs of digits and latin letters together", () => {
    expect(segment("我29岁GPU", lexicon).map((t) => [t.text, t.kind])).toEqual([
      ["我", "word"],
      ["29", "other"],
      ["岁", "unknown"],
      ["GPU", "other"],
    ]);
  });

  it("marks characters outside the lexicon as unknown, one per token", () => {
    expect(segment("猫狗", lexicon).map((t) => [t.text, t.kind])).toEqual([
      ["猫", "unknown"],
      ["狗", "unknown"],
    ]);
  });

  it("treats Chinese and ASCII punctuation and spaces as punctuation", () => {
    expect(segment("我，咖啡! ", lexicon).map((t) => t.kind)).toEqual(["word", "punct", "word", "punct", "punct"]);
  });
});

describe("unknownTokens", () => {
  it("lists unknown tokens not covered by the allowed extras", () => {
    expect(unknownTokens("我喜欢巴西咖啡", lexicon, new Set(["巴西"]))).toEqual([]);
    expect(unknownTokens("我喜欢猫", lexicon, new Set())).toEqual(["猫"]);
  });

  it("still recognizes HSK words that contain an extra character", () => {
    const lex = buildLexicon([{ id: 1, hanzi: "儿子" }, { id: 2, hanzi: "没关系" }]);
    expect(unknownTokens("儿子没关系", lex, new Set(["儿", "没"]))).toEqual([]);
  });
});

describe("extras", () => {
  it("keeps extra terms such as proper nouns as single tokens without a word id", () => {
    const withExtras = buildLexicon([{ id: 1, hanzi: "我" }, { id: 2, hanzi: "在" }], ["纽约"]);
    expect(segment("我在纽约", withExtras)).toEqual([
      { text: "我", kind: "word", wordId: 1 },
      { text: "在", kind: "word", wordId: 2 },
      { text: "纽约", kind: "extra" },
    ]);
  });
});
