import rawGrammar from "../../data/grammar.json";
import type { Level } from "./words";

export interface GrammarExample {
  zh: string;
  pinyin: string;
  en: string;
  /** Substrings of `zh` that carry the pattern, highlighted on the card. */
  highlight: string[];
}

export interface GrammarPoint {
  id: string;
  level: Level;
  title: string;
  pattern: string;
  explanation: string;
  examples: GrammarExample[];
  /** A typical error, its correction (with pinyin and English) and why. */
  mistake: { wrong: string; right: string; pinyin: string; en: string; reason: string };
  /** HSK words used by the examples; drives the unlock rule. */
  wordIds: number[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isGrammarPoint(value: unknown): value is GrammarPoint {
  if (typeof value !== "object" || value === null) return false;
  const g = value as Record<string, unknown>;
  const mistake = g.mistake as Record<string, unknown> | undefined;
  return (
    typeof g.id === "string" &&
    (g.level === 1 || g.level === 2 || g.level === 3) &&
    typeof g.title === "string" &&
    typeof g.pattern === "string" &&
    typeof g.explanation === "string" &&
    Array.isArray(g.examples) &&
    g.examples.length >= 2 &&
    g.examples.every((e: Record<string, unknown>) =>
      typeof e.zh === "string" && typeof e.pinyin === "string" && typeof e.en === "string" && isStringArray(e.highlight),
    ) &&
    typeof mistake === "object" &&
    typeof mistake.wrong === "string" &&
    typeof mistake.right === "string" &&
    typeof mistake.pinyin === "string" &&
    typeof mistake.en === "string" &&
    typeof mistake.reason === "string" &&
    Array.isArray(g.wordIds) &&
    g.wordIds.every((id) => typeof id === "number")
  );
}

/** Validates grammar content at the boundary; throws naming the first bad entry. */
export function parseGrammar(raw: unknown): GrammarPoint[] {
  if (!Array.isArray(raw)) throw new Error(`grammar list must be an array, got ${typeof raw}`);
  raw.forEach((entry, i) => {
    if (!isGrammarPoint(entry)) throw new Error(`malformed grammar point at index ${i}: ${JSON.stringify(entry).slice(0, 200)}`);
  });
  return raw as GrammarPoint[];
}

export const GRAMMAR: GrammarPoint[] = parseGrammar(rawGrammar);

export const GRAMMAR_BY_ID: ReadonlyMap<string, GrammarPoint> = new Map(GRAMMAR.map((g) => [g.id, g]));
