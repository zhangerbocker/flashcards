import { describe, expect, it } from "vitest";
import { LIBRARY } from "./reading";
import { TOPICS } from "./topics";
import { WORDS, WORDS_BY_ID } from "./words";

describe("reading library", () => {
  it("has at least 3 stories for every topic at every level", () => {
    for (const level of [1, 2, 3] as const) {
      for (const topic of TOPICS) {
        expect(LIBRARY.filter((s) => s.level === level && s.topic === topic).length, `HSK ${level} ${topic}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("uses only words at or below each story's level", () => {
    const tooHard = LIBRARY.flatMap((s) =>
      s.wordIds.filter((id) => (WORDS_BY_ID.get(id)?.level ?? 99) > s.level).map((id) => `${s.id}: ${WORDS_BY_ID.get(id)?.hanzi}`),
    );
    expect(tooHard).toEqual([]);
  });

  it("covers every topic word in that topic's stories", () => {
    const uncovered: string[] = [];
    for (const level of [1, 2, 3] as const) {
      for (const topic of TOPICS) {
        // Matched by written form so homograph entries (点, 过, 花) share coverage.
        const used = new Set(
          LIBRARY.filter((s) => s.level === level && s.topic === topic).flatMap((s) =>
            s.sentences.flatMap((se) => se.tokens.filter((t) => t.wordId !== undefined).map((t) => t.text)),
          ),
        );
        for (const w of WORDS) if (w.level === level && w.topic === topic && !used.has(w.hanzi)) uncovered.push(`HSK${level} ${topic}: ${w.hanzi}`);
      }
    }
    expect(uncovered).toEqual([]);
  });

  it("gives every story 3 questions with 4 options and a valid answer", () => {
    const bad = LIBRARY.filter(
      (s) => s.questions.length !== 3 || s.questions.some((q) => q.options.length !== 4 || q.answer < 0 || q.answer > 3),
    ).map((s) => s.id);
    expect(bad).toEqual([]);
  });

  it("glosses every non-punctuation token", () => {
    const missing = LIBRARY.flatMap((s) =>
      s.sentences.flatMap((se) => se.tokens.filter((t) => /\p{Script=Han}/u.test(t.text) && !t.pinyin).map((t) => `${s.id}: ${t.text}`)),
    );
    expect(missing).toEqual([]);
  });
});
