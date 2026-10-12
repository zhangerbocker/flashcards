import rawWords from "../../data/words.json";
import { isTopic, type Topic } from "./topics";

export type Level = 1 | 2 | 3;

export interface Example {
  zh: string;
  pinyin: string;
  en: string;
}

export interface Word {
  id: number;
  hanzi: string;
  pinyin: string;
  pos: string;
  english: string;
  level: Level;
  topic: Topic;
  example: Example;
}

function isExample(value: unknown): value is Example {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return typeof e.zh === "string" && typeof e.pinyin === "string" && typeof e.en === "string";
}

function isWord(value: unknown): value is Word {
  if (typeof value !== "object" || value === null) return false;
  const w = value as Record<string, unknown>;
  return (
    typeof w.id === "number" &&
    typeof w.hanzi === "string" &&
    typeof w.pinyin === "string" &&
    typeof w.pos === "string" &&
    typeof w.english === "string" &&
    (w.level === 1 || w.level === 2 || w.level === 3) &&
    isTopic(w.topic) &&
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
