import { describe, expect, it } from "vitest";
import { buildLexicon } from "./segment";
import {
  applyFixes,
  buildStory,
  draftProblems,
  draftWordCount,
  glossTargets,
  missingWords,
  parseStories,
  vocabOffenders,
  type StoryDraft,
} from "./story";

const lexicon = buildLexicon([
  { id: 1, pt: "eu", forms: [] },
  { id: 2, pt: "gostar", forms: ["gosto", "gosta"] },
  { id: 3, pt: "beber", forms: ["bebo", "bebe"] },
  { id: 4, pt: "café", forms: ["cafés"] },
  { id: 5, pt: "chá", forms: [] },
  { id: 6, pt: "de", forms: ["do", "da"] },
  { id: 7, pt: "você", forms: [] },
  { id: 8, pt: "em", forms: ["no", "na"] },
]);
const ctx = { level: 1 as const, lexicon, extras: new Set(["Nova York"]) };

function draft(sentences: string[], questions = 3): StoryDraft {
  return {
    title: "Café",
    titleEn: "Coffee",
    sentences: sentences.map((pt) => ({ pt, en: "…" })),
    questions: Array.from({ length: questions }, () => ({ q: "Você bebe chá?", qEn: "", options: ["eu", "você", "chá", "café"], answer: 2 })),
  };
}

/** A draft long enough for A1 (≥ 72 words). */
const longEnough = (s: string) => Array.from({ length: 25 }, () => s);

describe("draftProblems", () => {
  it("accepts a valid draft", () => {
    expect(draftProblems(draft(longEnough("Eu gosto de café.")), ctx)).toEqual([]);
  });

  it("flags words outside the vocabulary, allowing extras", () => {
    const issues = draftProblems(draft([...longEnough("Eu gosto de café."), "Eu bebo suco em Nova York."]), ctx);
    // The message quotes the sentence, then lists only the unknown words (not Nova York).
    expect(issues.join()).toMatch(/outside the list: suco$/);
  });

  it("flags stories that are far too short", () => {
    expect(draftProblems(draft(["Eu gosto de chá."]), ctx).join()).toMatch(/words; aim for/);
  });

  it("requires three questions with four options and a valid answer", () => {
    const d = draft(longEnough("Eu gosto de café."), 2);
    d.questions[0].answer = 9;
    const issues = draftProblems(d, ctx).join(" | ");
    expect(issues).toMatch(/exactly 3 questions/);
    expect(issues).toMatch(/invalid answer index 9/);
  });
});

describe("draftWordCount", () => {
  it("counts words, not numbers or punctuation", () => {
    expect(draftWordCount(draft(["Eu gosto de café.", "29 cafés!"]))).toBe(5);
  });
});

describe("missingWords", () => {
  it("lists topic words no draft uses, in any form", () => {
    const topic = [{ id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
    expect(missingWords([draft(["Eu gosto de cafés."]), draft(["Você bebe chá?"])], lexicon, topic)).toEqual([]);
    expect(missingWords([draft(["Eu gosto de café."])], lexicon, topic)).toEqual([3, 5]);
  });
});

describe("buildStory", () => {
  const dictionary = new Map([
    [1, { en: "I" }],
    [3, { en: "to drink" }],
    [5, { en: "tea" }],
  ]);

  it("attaches contextual glosses to words, keeping spaces and punctuation", () => {
    const d = draft(["Eu bebo chá."]);
    expect(glossTargets(d, lexicon)).toEqual([["Eu", "bebo", "chá"]]);
    const story = buildStory("s1", 1, "Food & drink", d, [[{ en: "I" }, { en: "drink" }, { en: "tea" }]], lexicon, dictionary);
    expect(story.sentences[0].tokens).toEqual([
      { text: "Eu", en: "I", wordId: 1 },
      { text: " " },
      { text: "bebo", en: "drink", wordId: 3 },
      { text: " " },
      { text: "chá", en: "tea", wordId: 5 },
      { text: "." },
    ]);
    expect(story.wordIds.sort()).toEqual([1, 3, 5]);
  });

  it("falls back to extra glosses for names when the gloss count is off", () => {
    const withNames = buildLexicon([{ id: 1, pt: "eu", forms: [] }], ["Nova York"]);
    const story = buildStory("s1", 1, "Time", draft(["Nova York"]), [[]], withNames, new Map(), new Map([["Nova York", { en: "New York" }]]));
    expect(story.sentences[0].tokens[0]).toEqual({ text: "Nova York", en: "New York", wordId: undefined });
  });

  it("falls back to dictionary glosses when the gloss count is off", () => {
    const story = buildStory("s1", 1, "Food & drink", draft(["Eu bebo chá."]), [[{ en: "y" }]], lexicon, dictionary);
    expect(story.sentences[0].tokens[2]).toEqual({ text: "bebo", en: "to drink", wordId: 3 });
  });
});

describe("parseStories", () => {
  it("names the malformed entry", () => {
    expect(() => parseStories([{ id: "x" }])).toThrow(/malformed story at index 0/);
  });
});

describe("vocabOffenders", () => {
  it("locates out-of-vocabulary text by path", () => {
    const d = draft(["Eu gosto de café.", "Eu bebo suco."]);
    d.questions[1].options[3] = "suco";
    expect(vocabOffenders(d, 0, ctx)).toEqual([
      { path: "0.s1", text: "Eu bebo suco.", bad: ["suco"] },
      { path: "0.q1.o3", text: "suco", bad: ["suco"] },
    ]);
  });
});

describe("applyFixes", () => {
  it("replaces sentences, titles, questions and options, and appends sentences", () => {
    const [fixed] = applyFixes(
      [draft(["Eu bebo suco."])],
      [
        { path: "0.s0", pt: "Eu bebo chá.", en: "I drink tea." },
        { path: "0.title", pt: "Chá", en: "Tea" },
        { path: "0.q0", pt: "Você bebe chá?", en: "Do you drink tea?" },
        { path: "0.q0.o1", pt: "chá" },
        { path: "0.add", pt: "Você bebe café.", en: "You drink coffee." },
      ],
    );
    expect(fixed.sentences.map((s) => s.pt)).toEqual(["Eu bebo chá.", "Você bebe café."]);
    expect(fixed.title).toBe("Chá");
    expect(fixed.questions[0].q).toBe("Você bebe chá?");
    expect(fixed.questions[0].options[1]).toBe("chá");
  });

  it("inserts sentences after the given sentence, keeping original indices valid", () => {
    const [fixed] = applyFixes(
      [draft(["Um.", "Dois.", "Três."])],
      [
        { path: "0.s0+", pt: "Um e meio.", en: "" },
        { path: "0.s1+", pt: "Dois e meio.", en: "" },
        { path: "0.s1+", pt: "Dois e três quartos.", en: "" },
        { path: "0.add", pt: "Quatro.", en: "" },
      ],
    );
    expect(fixed.sentences.map((s) => s.pt)).toEqual(["Um.", "Um e meio.", "Dois.", "Dois e meio.", "Dois e três quartos.", "Três.", "Quatro."]);
  });

  it("replaces a whole question when options and answer are given", () => {
    const [fixed] = applyFixes(
      [draft(["Eu bebo chá."])],
      [{ path: "0.q2", pt: "Quem bebe chá?", en: "Who drinks tea?", options: ["eu", "você", "ele", "ela"], answer: 0 }],
    );
    expect(fixed.questions[2]).toEqual({ q: "Quem bebe chá?", qEn: "Who drinks tea?", options: ["eu", "você", "ele", "ela"], answer: 0 });
  });

  it("does not mutate the input and ignores unknown paths", () => {
    const original = draft(["Eu bebo chá."]);
    applyFixes([original], [{ path: "0.s0", pt: "Mudou." }, { path: "5.s0", pt: "x" }, { path: "nonsense", pt: "x" }]);
    expect(original.sentences[0].pt).toBe("Eu bebo chá.");
  });
});
