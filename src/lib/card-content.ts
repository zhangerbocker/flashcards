import { parseKey, type Deck, type Mistake } from "./deck";
import type { GrammarExample, GrammarPoint } from "./grammar";
import { isTense, PERSONS, TENSE_CUE, TENSE_LEVEL, type Tense, type Verb } from "./verbs";
import { withArticle, type Level, type Word } from "./words";

interface Base {
  key: string;
  label: string;
  level?: Level;
  /** Expected Portuguese for production cards (typed-answer checking), plus other accepted answers. */
  answer?: { pt: string; alternatives?: string[] };
  /** Portuguese read aloud by the speaker button, front and back. */
  audio: { front?: string; back: string };
}

export type CardContent =
  | (Base & { kind: "word"; face: "r" | "p"; word: Word; /** Its conjugation table, for verbs. */ verb?: Verb })
  | (Base & { kind: "sentence"; face: "r" | "p"; word: Word })
  | (Base & { kind: "grammar"; face: "u" | "f"; grammar: GrammarPoint; example: GrammarExample })
  | (Base & { kind: "conjugation"; face: "p"; verb: Verb; word: Word; tense: Tense; person: number; form: string })
  | (Base & { kind: "mistake"; face: "f"; mistake: Mistake });

const LABELS: Partial<Record<string, string>> = {
  "word:r": "Word",
  "word:p": "Word · English → Português",
  "sentence:r": "Sentence",
  "sentence:p": "Sentence · English → Português",
  "grammar:u": "Grammar",
  "grammar:f": "Grammar · fix the mistake",
  "conjugation:p": "Conjugation",
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
      const full = withArticle(word);
      const verb = deck.verbs.find((v) => v.wordId === word.id);
      return {
        key, label, kind, face, word, level: word.level, ...(verb ? { verb } : {}),
        answer: face === "p" ? { pt: full, alternatives: full === word.pt ? [] : [word.pt] } : undefined,
        audio: { front: face === "r" ? full : undefined, back: full },
      };
    }
    return {
      key, label, kind, face, word, level: word.level,
      answer: face === "p" ? { pt: word.example.pt } : undefined,
      audio: { front: face === "r" ? word.example.pt : undefined, back: word.example.pt },
    };
  }

  if (kind === "grammar") {
    if (face !== "u" && face !== "f") return null;
    const grammar = deck.grammar.find((g) => g.id === ref);
    if (!grammar || grammar.examples.length === 0) return null;
    const example = grammar.examples[reps % grammar.examples.length];
    const answer = face === "u" ? example.pt : grammar.mistake.right;
    return { key, label, kind, face, grammar, example, level: grammar.level, answer: { pt: answer }, audio: { back: answer } };
  }

  if (kind === "conjugation") {
    const m = /^(\d+)-(\w+)-([0-3])$/.exec(ref);
    if (!m || face !== "p" || !isTense(m[2])) return null;
    const wordId = Number(m[1]);
    const verb = deck.verbs.find((v) => v.wordId === wordId);
    const word = deck.words.find((w) => w.id === wordId);
    if (!verb || !word) return null;
    const tense = m[2];
    const person = Number(m[3]);
    const form = verb.tenses[tense][person];
    // "eu falo", "ela fala" or "que eu fale" is as good as the bare form.
    const pronouns = PERSONS[person].split(" / ");
    const cue = TENSE_CUE[tense];
    const withPronoun = pronouns.map((p) => `${p} ${form}`);
    return {
      key, label, kind, face, verb, word, tense, person, form,
      // A verb drill is as hard as the harder of the verb and the tense.
      level: Math.max(word.level, TENSE_LEVEL[tense]) as Level,
      answer: { pt: form, alternatives: cue ? [...withPronoun, ...withPronoun.map((w) => `${cue} ${w}`)] : withPronoun },
      audio: { back: `${cue ? `${cue} ` : ""}${pronouns[0]} ${form}` },
    };
  }

  const mistake = deck.mistakes.find((m) => m.id === ref);
  if (!mistake || face !== "f") return null;
  return { key, label, kind: "mistake", face, mistake, answer: { pt: mistake.right }, audio: { back: mistake.right } };
}
