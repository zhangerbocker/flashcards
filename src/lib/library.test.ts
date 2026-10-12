import { describe, expect, it } from "vitest";
import { LIBRARY } from "./reading";
import { lookupForm } from "./segment";
import { WORDS_BY_ID } from "./words";

describe("reading library", () => {
  it("uses only words at or below each story's level", () => {
    const tooHard = LIBRARY.flatMap((s) =>
      s.wordIds.filter((id) => (WORDS_BY_ID.get(id)?.level ?? 99) > s.level).map((id) => `${s.id}: ${WORDS_BY_ID.get(id)?.pt}`),
    );
    expect(tooHard).toEqual([]);
  });

  it("links every word token to a word whose forms include it", () => {
    const bad = LIBRARY.flatMap((s) =>
      s.sentences.flatMap((se) =>
        se.tokens.flatMap((t) => {
          if (t.wordId === undefined) return [];
          const w = WORDS_BY_ID.get(t.wordId);
          const ok = w && [w.pt, ...w.forms].map(lookupForm).includes(lookupForm(t.text));
          return ok ? [] : [`${s.id}: ${t.text}`];
        }),
      ),
    );
    expect(bad).toEqual([]);
  });

  it("gives every story 3 questions with 4 options and a valid answer", () => {
    const bad = LIBRARY.filter(
      (s) => s.questions.length !== 3 || s.questions.some((q) => q.options.length !== 4 || q.answer < 0 || q.answer > 3),
    ).map((s) => s.id);
    expect(bad).toEqual([]);
  });

  it("glosses every word", () => {
    const missing = LIBRARY.flatMap((s) =>
      s.sentences.flatMap((se) => se.tokens.filter((t) => /\p{L}/u.test(t.text) && !t.en).map((t) => `${s.id}: ${t.text}`)),
    );
    expect(missing).toEqual([]);
  });

  it("has unique ids", () => {
    expect(new Set(LIBRARY.map((s) => s.id)).size).toBe(LIBRARY.length);
  });
});
