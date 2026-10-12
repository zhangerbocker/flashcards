import rawWords from "../../data/words.json";
import { isTopic, type Topic } from "./topics";

/** CEFR level: 1 = A1, 2 = A2. */
export type Level = 1 | 2;

export const LEVELS: readonly Level[] = [1, 2];

export const LEVEL_NAMES: Record<Level, string> = { 1: "A1", 2: "A2" };

export function isLevel(value: unknown): value is Level {
  return value === 1 || value === 2;
}

/** Noun gender: "mf" for nouns that take either article (o/a estudante). */
export type Gender = "m" | "f" | "mf";

export interface Example {
  pt: string;
  en: string;
}

export interface Word {
  id: number;
  /** Dictionary form: singular noun without article, masculine singular adjective, infinitive. */
  pt: string;
  pos: string;
  english: string;
  level: Level;
  topic: Topic;
  /** Nouns only. */
  gender?: Gender;
  /** Inflected forms (plurals, feminines, conjugations), lowercase, so the reader can find them. */
  forms: string[];
  example: Example;
}

const ARTICLES: Record<Gender, string> = { m: "o", f: "a", mf: "o/a" };

/** The word as it is learned: nouns with their article ("a casa"), everything else as is. */
export function withArticle(word: Pick<Word, "pt" | "gender">): string {
  return word.gender ? `${ARTICLES[word.gender]} ${word.pt}` : word.pt;
}

function isExample(value: unknown): value is Example {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return typeof e.pt === "string" && typeof e.en === "string";
}

function isWord(value: unknown): value is Word {
  if (typeof value !== "object" || value === null) return false;
  const w = value as Record<string, unknown>;
  return (
    typeof w.id === "number" &&
    typeof w.pt === "string" &&
    typeof w.pos === "string" &&
    typeof w.english === "string" &&
    isLevel(w.level) &&
    isTopic(w.topic) &&
    (w.gender === undefined || w.gender === "m" || w.gender === "f" || w.gender === "mf") &&
    Array.isArray(w.forms) &&
    w.forms.every((f) => typeof f === "string") &&
    isExample(w.example)
  );
}

/**
 * Validates raw word-list JSON at the content boundary.
 * Throws naming the first malformed entry so a bad import fails loudly.
 */
export function parseWords(raw: unknown): Word[] {
  if (!Array.isArray(raw)) throw new Error(`word list must be an array, got ${typeof raw}`);
  raw.forEach((entry, i) => {
    if (!isWord(entry)) throw new Error(`malformed word at index ${i}: ${JSON.stringify(entry)}`);
  });
  return raw as Word[];
}

export const WORDS: Word[] = parseWords(rawWords);

export const WORDS_BY_ID: ReadonlyMap<number, Word> = new Map(WORDS.map((w) => [w.id, w]));

const BY_FORM: ReadonlyMap<string, Word> = (() => {
  const map = new Map<string, Word>();
  for (const w of WORDS) map.set(w.pt.toLowerCase(), w);
  for (const w of WORDS) for (const f of w.forms) if (!map.has(f.toLowerCase())) map.set(f.toLowerCase(), w);
  return map;
})();

/** The list word written as `text` ("a casa", "casas", "falei"), ignoring a leading article; undefined if none. */
export function findWord(text: string): Word | undefined {
  const key = text.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");
  return BY_FORM.get(key) ?? BY_FORM.get(key.replace(/^(o\/a|os|as|o|a|um|uma) /, ""));
}
