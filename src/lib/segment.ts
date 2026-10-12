export interface Token {
  text: string;
  /** "extra": an allowed term outside the word list, such as a name; "punct" covers spaces too. */
  kind: "word" | "extra" | "unknown" | "punct" | "other";
  wordId?: number;
}

export interface Lexicon {
  /** Lowercased written form (dictionary form or inflection, possibly several words) → word id. */
  byText: ReadonlyMap<string, number>;
  /** Lowercased extra terms. */
  extras: ReadonlySet<string>;
  /** Longest entry, in words, for multi-word matching (por favor, fim de semana). */
  maxWords: number;
}

/** The lookup form of a word or phrase: lowercase, composed accents, hyphens as spaces, single spaces. */
export function lookupForm(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/-/g, " ").trim().replace(/\s+/g, " ");
}

const wordsIn = (entry: string) => entry.split(" ").length;

/** Words (matched by dictionary form and every inflected form) plus extra terms kept as single tokens. */
export function buildLexicon(
  words: readonly { id: number; pt: string; forms: readonly string[] }[],
  extras: Iterable<string> = [],
): Lexicon {
  const byText = new Map<string, number>();
  // Dictionary forms first so "casa" (house) beats a verb form "casa" (from casar).
  for (const w of words) if (!byText.has(lookupForm(w.pt))) byText.set(lookupForm(w.pt), w.id);
  for (const w of words) for (const f of w.forms) if (!byText.has(lookupForm(f))) byText.set(lookupForm(f), w.id);
  const extraSet = new Set([...extras].map(lookupForm).filter((e) => !byText.has(e)));
  const maxWords = Math.max(1, ...[...byText.keys(), ...extraSet].map(wordsIn));
  return { byText, extras: extraSet, maxWords };
}

/** Letter runs, numbers, whitespace runs, or any single other character (hyphens split clitics: chama-se). */
const PIECE = /[\p{L}\p{M}]+|\d+(?:[.,:]\d+)*|\s+|./gu;
const LETTERS = /^[\p{L}\p{M}]+$/u;
const NUMBER = /^\d/;

/**
 * Splits text into tokens, matching the longest run of words (joined by single
 * spaces) found in the lexicon. Unmatched words are "unknown"; numbers are
 * "other"; spaces and punctuation are "punct". Joining the tokens' text gives
 * back the input.
 */
export function segment(text: string, lexicon: Lexicon): Token[] {
  const pieces = text.normalize("NFC").match(PIECE) ?? [];
  const tokens: Token[] = [];
  let i = 0;
  while (i < pieces.length) {
    const piece = pieces[i];
    if (!LETTERS.test(piece)) {
      tokens.push({ text: piece, kind: NUMBER.test(piece) ? "other" : "punct" });
      i += 1;
      continue;
    }
    // Candidate phrases: piece, piece + " " or "-" + next word, ... up to maxWords words
    // (fim de semana, guarda-chuva); a hyphenated pair not in the lexicon splits (chama-se).
    const spans: number[] = [i];
    for (let j = i; spans.length < lexicon.maxWords; j += 2) {
      if ((pieces[j + 1] !== " " && pieces[j + 1] !== "-") || !LETTERS.test(pieces[j + 2] ?? "")) break;
      spans.push(j + 2);
    }
    let matched = false;
    for (let n = spans.length; n >= 1; n--) {
      const end = spans[n - 1] + 1;
      const phrase = pieces.slice(i, end).join("");
      const key = lookupForm(phrase);
      const id = lexicon.byText.get(key);
      if (id !== undefined) tokens.push({ text: phrase, kind: "word", wordId: id });
      else if (lexicon.extras.has(key)) tokens.push({ text: phrase, kind: "extra" });
      else continue;
      i = end;
      matched = true;
      break;
    }
    if (!matched) {
      tokens.push({ text: piece, kind: "unknown" });
      i += 1;
    }
  }
  return tokens;
}

/** Words in `text` that are neither in the lexicon nor among `extras` (names, allowed extra words). */
export function unknownTokens(text: string, lexicon: Lexicon, extras: ReadonlySet<string>): string[] {
  const merged = new Set([...lexicon.extras, ...[...extras].map(lookupForm)]);
  const maxWords = Math.max(lexicon.maxWords, ...[...merged].map(wordsIn));
  return segment(text, { byText: lexicon.byText, extras: merged, maxWords })
    .filter((t) => t.kind === "unknown")
    .map((t) => t.text);
}

/** Number of words (letter runs) in a text. */
export function wordCount(text: string): number {
  return (text.match(PIECE) ?? []).filter((p) => LETTERS.test(p)).length;
}
