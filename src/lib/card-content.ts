import { parseKey, type Deck, type Mistake } from "./deck";
import type { GrammarExample, GrammarPoint } from "./grammar";
import type { Level, Word } from "./words";

interface Base {
  key: string;
  label: string;
  level?: Level;
  /** Expected Chinese for production cards (typed-answer checking); pinyin accepted for single words. */
  answer?: { zh: string; pinyin?: string };
  /** Chinese read aloud by the speaker button, front and back. */
  audio: { front?: string; back: string };
}

export type CardContent =
  | (Base & { kind: "word"; face: "r" | "p"; word: Word })
  | (Base & { kind: "sentence"; face: "r" | "p"; word: Word })
  | (Base & { kind: "grammar"; face: "u" | "f"; grammar: GrammarPoint; example: GrammarExample })
  | (Base & { kind: "mistake"; face: "f"; mistake: Mistake });

const LABELS: Partial<Record<string, string>> = {
  "word:r": "Word",
  "word:p": "Word · English → 中文",
  "sentence:r": "Sentence",
  "sentence:p": "Sentence · English → 中文",
  "grammar:u": "Grammar",
  "grammar:f": "Grammar · fix the mistake",
  "mistake:f": "From your chat",
};

/**
 * Resolves a card key to what the card shows. `reps` (reviews so far) rotates
 * grammar examples so each review uses a different sentence. Returns null when
 * the key refers to content that no longer exists.
 */
export function cardContent(key: string, deck: Deck, reps = 0): CardContent | null {
  const { kind, ref, face } = parseKey(key);
  const label = LABELS[`${kind}:${face}`] ?? "";

  if (kind === "word" || kind === "sentence") {
    if (face !== "r" && face !== "p") return null;
    const word = deck.words.find((w) => w.id === Number(ref));
    if (!word) return null;
    if (kind === "word") {
      return {
        key, label, kind, face, word, level: word.level,
        answer: face === "p" ? { zh: word.hanzi, pinyin: word.pinyin } : undefined,
        audio: { front: face === "r" ? word.hanzi : undefined, back: word.hanzi },
      };
    }
    return {
      key, label, kind, face, word, level: word.level,
      answer: face === "p" ? { zh: word.example.zh } : undefined,
      audio: { front: face === "r" ? word.example.zh : undefined, back: word.example.zh },
    };
  }

  if (kind === "grammar") {
    if (face !== "u" && face !== "f") return null;
    const grammar = deck.grammar.find((g) => g.id === ref);
    if (!grammar || grammar.examples.length === 0) return null;
    const example = grammar.examples[reps % grammar.examples.length];
    const answer = face === "u" ? example.zh : grammar.mistake.right;
    return { key, label, kind, face, grammar, example, level: grammar.level, answer: { zh: answer }, audio: { back: answer } };
  }

  const mistake = deck.mistakes.find((m) => m.id === ref);
  if (!mistake || face !== "f") return null;
  return { key, label, kind: "mistake", face, mistake, answer: { zh: mistake.right }, audio: { back: mistake.right } };
}
