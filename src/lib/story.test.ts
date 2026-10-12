import { describe, expect, it } from "vitest";
import { buildLexicon } from "./segment";
import {
  applyFixes,
  buildStory,
  draftProblems,
  glossTargets,
  hanCount,
  missingWords,
  parseStories,
  vocabOffenders,
  type StoryDraft,
} from "./story";

const lexicon = buildLexicon([
  { id: 1, hanzi: "我" },
  { id: 2, hanzi: "喜欢" },
  { id: 3, hanzi: "喝" },
  { id: 4, hanzi: "咖啡" },
  { id: 5, hanzi: "茶" },
  { id: 6, hanzi: "吗" },
  { id: 7, hanzi: "你" },
]);
const ctx = { level: 1 as const, lexicon, extras: new Set(["纽约"]) };

function draft(sentences: string[], questions = 3): StoryDraft {
  return {
    title: "咖啡",
    titleEn: "Coffee",
    sentences: sentences.map((zh) => ({ zh, en: "…" })),
    questions: Array.from({ length: questions }, () => ({ q: "你喜欢茶吗？", qEn: "", options: ["我", "你", "茶", "咖啡"], answer: 2 })),
  };
}

/** A draft long enough for HSK 1 (≥ 96 characters). */
const longEnough = (s: string) => Array.from({ length: 20 }, () => s);

describe("draftProblems", () => {
  it("accepts a valid draft", () => {
    expect(draftProblems(draft(longEnough("我喜欢咖啡。")), ctx)).toEqual([]);
  });

  it("flags words outside the vocabulary, allowing extras", () => {
    const issues = draftProblems(draft([...longEnough("我喜欢咖啡。"), "我在纽约喝可乐。"]), ctx);
    // The message quotes the sentence, then lists only the unknown words (not 纽约).
    expect(issues.join()).toMatch(/outside the list: 在 可 乐$/);
  });

  it("flags stories that are far too short", () => {
    expect(draftProblems(draft(["我喜欢茶。"]), ctx).join()).toMatch(/characters/);
  });

  it("requires three questions with four options and a valid answer", () => {
    const d = draft(longEnough("我喜欢咖啡。"), 2);
    d.questions[0].answer = 9;
    const issues = draftProblems(d, ctx).join(" | ");
    expect(issues).toMatch(/exactly 3 questions/);
    expect(issues).toMatch(/invalid answer index 9/);
  });
});

describe("hanCount", () => {
  it("counts only Chinese characters", () => {
    expect(hanCount(draft(["我喜欢咖啡。", "29块"]))).toBe(6);
  });
});

describe("missingWords", () => {
  it("lists topic words no draft uses", () => {
    const topic = [
      { id: 2, hanzi: "喜欢" },
      { id: 3, hanzi: "喝" },
      { id: 4, hanzi: "咖啡" },
      { id: 5, hanzi: "茶" },
    ];
    expect(missingWords([draft(["我喜欢咖啡。"]), draft(["你喝茶吗？"])], lexicon, topic)).toEqual([]);
    expect(missingWords([draft(["我喜欢咖啡。"])], lexicon, topic)).toEqual([3, 5]);
  });

  it("counts homographs listed as separate entries as used together", () => {
    // The lexicon links 茶 to id 5; a second entry with the same characters (id 50) is covered too.
    expect(missingWords([draft(["我喝茶。"])], lexicon, [{ id: 50, hanzi: "茶" }])).toEqual([]);
  });
});

describe("buildStory", () => {
  const dictionary = new Map([
    [1, { pinyin: "wǒ", en: "I" }],
    [3, { pinyin: "hē", en: "to drink" }],
    [5, { pinyin: "chá", en: "tea" }],
  ]);

  it("attaches contextual glosses to non-punctuation tokens", () => {
    const d = draft(["我喝茶。"]);
    expect(glossTargets(d, lexicon)).toEqual([["我", "喝", "茶"]]);
    const story = buildStory("s1", 1, "Food & drink", d, [[{ pinyin: "wǒ", en: "I" }, { pinyin: "hē", en: "drink" }, { pinyin: "chá", en: "tea" }]], lexicon, dictionary);
    expect(story.sentences[0].tokens).toEqual([
      { text: "我", pinyin: "wǒ", en: "I", wordId: 1 },
      { text: "喝", pinyin: "hē", en: "drink", wordId: 3 },
      { text: "茶", pinyin: "chá", en: "tea", wordId: 5 },
      { text: "。" },
    ]);
    expect(story.wordIds.sort()).toEqual([1, 3, 5]);
  });

  it("falls back to extra glosses for names when the gloss count is off", () => {
    const withNames = buildLexicon([{ id: 1, hanzi: "我" }], ["大卫"]);
    const story = buildStory("s1", 1, "Time", draft(["大卫"]), [[]], withNames, new Map(), new Map([["大卫", { pinyin: "Dàwèi", en: "David" }]]));
    expect(story.sentences[0].tokens[0]).toEqual({ text: "大卫", pinyin: "Dàwèi", en: "David", wordId: undefined });
  });

  it("falls back to dictionary glosses when the gloss count is off", () => {
    const story = buildStory("s1", 1, "Food & drink", draft(["我喝茶。"]), [[{ pinyin: "x", en: "y" }]], lexicon, dictionary);
    expect(story.sentences[0].tokens[1]).toEqual({ text: "喝", pinyin: "hē", en: "to drink", wordId: 3 });
  });
});

describe("parseStories", () => {
  it("names the malformed entry", () => {
    expect(() => parseStories([{ id: "x" }])).toThrow(/malformed story at index 0/);
  });
});

describe("vocabOffenders", () => {
  it("locates out-of-vocabulary text by path", () => {
    const d = draft(["我喜欢咖啡。", "我喝可乐。"]);
    d.questions[1].options[3] = "可乐";
    expect(vocabOffenders(d, 0, ctx)).toEqual([
      { path: "0.s1", text: "我喝可乐。", bad: ["可", "乐"] },
      { path: "0.q1.o3", text: "可乐", bad: ["可", "乐"] },
    ]);
  });
});

describe("applyFixes", () => {
  it("replaces sentences, titles, questions and options, and appends sentences", () => {
    const [fixed] = applyFixes(
      [draft(["我喝可乐。"])],
      [
        { path: "0.s0", zh: "我喝茶。", en: "I drink tea." },
        { path: "0.title", zh: "茶", en: "Tea" },
        { path: "0.q0", zh: "你喝茶吗？", en: "Do you drink tea?" },
        { path: "0.q0.o1", zh: "茶" },
        { path: "0.add", zh: "你喝咖啡。", en: "You drink coffee." },
      ],
    );
    expect(fixed.sentences.map((s) => s.zh)).toEqual(["我喝茶。", "你喝咖啡。"]);
    expect(fixed.title).toBe("茶");
    expect(fixed.questions[0].q).toBe("你喝茶吗？");
    expect(fixed.questions[0].options[1]).toBe("茶");
  });

  it("inserts sentences after the given sentence, keeping original indices valid", () => {
    const [fixed] = applyFixes(
      [draft(["一。", "二。", "三。"])],
      [
        { path: "0.s0+", zh: "一点五。", en: "" },
        { path: "0.s1+", zh: "二点五。", en: "" },
        { path: "0.s1+", zh: "二点七。", en: "" },
        { path: "0.add", zh: "四。", en: "" },
      ],
    );
    expect(fixed.sentences.map((s) => s.zh)).toEqual(["一。", "一点五。", "二。", "二点五。", "二点七。", "三。", "四。"]);
  });

  it("replaces a whole question when options and answer are given", () => {
    const [fixed] = applyFixes([draft(["我喝茶。"])], [{ path: "0.q2", zh: "谁喝茶？", en: "Who drinks tea?", options: ["我", "你", "他", "她"], answer: 0 }]);
    expect(fixed.questions[2]).toEqual({ q: "谁喝茶？", qEn: "Who drinks tea?", options: ["我", "你", "他", "她"], answer: 0 });
  });

  it("does not mutate the input and ignores unknown paths", () => {
    const original = draft(["我喝茶。"]);
    applyFixes([original], [{ path: "0.s0", zh: "改了" }, { path: "5.s0", zh: "x" }, { path: "nonsense", zh: "x" }]);
    expect(original.sentences[0].zh).toBe("我喝茶。");
  });
});
