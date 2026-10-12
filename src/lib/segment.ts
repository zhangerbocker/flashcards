export interface Token {
  text: string;
  /** "extra": an allowed non-HSK term such as a proper noun, kept whole. */
  kind: "word" | "extra" | "unknown" | "punct" | "other";
  wordId?: number;
}

export interface Lexicon {
  byText: ReadonlyMap<string, number>;
  extras: ReadonlySet<string>;
  maxLength: number;
}

/** HSK words (matched with their ids) plus optional extra terms kept as single tokens. */
export function buildLexicon(words: readonly { id: number; hanzi: string }[], extras: Iterable<string> = []): Lexicon {
  const byText = new Map<string, number>();
  for (const w of words) if (!byText.has(w.hanzi)) byText.set(w.hanzi, w.id);
  const extraSet = new Set([...extras].filter((e) => !byText.has(e)));
  const lengths = [...words.map((w) => w.hanzi), ...extraSet].map((t) => [...t].length);
  return { byText, extras: extraSet, maxLength: Math.max(1, ...lengths) };
}

const HAN = /\p{Script=Han}/u;
const ALNUM = /[0-9A-Za-z０-９.]/;

/**
 * Splits text into tokens by forward maximum matching against the lexicon.
 * Han characters with no match become single-character "unknown" tokens;
 * digit/latin runs are "other"; everything else is punctuation.
 */
export function segment(text: string, lexicon: Lexicon): Token[] {
  const chars = [...text];
  const tokens: Token[] = [];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (HAN.test(ch)) {
      let matched = false;
      for (let len = Math.min(lexicon.maxLength, chars.length - i); len >= 1; len--) {
        const candidate = chars.slice(i, i + len).join("");
        const id = lexicon.byText.get(candidate);
        if (id !== undefined) {
          tokens.push({ text: candidate, kind: "word", wordId: id });
        } else if (lexicon.extras.has(candidate)) {
          tokens.push({ text: candidate, kind: "extra" });
        } else {
          continue;
        }
        i += len;
        matched = true;
        break;
      }
      if (!matched) {
        tokens.push({ text: ch, kind: "unknown" });
        i += 1;
      }
    } else if (ALNUM.test(ch)) {
      let j = i;
      while (j < chars.length && ALNUM.test(chars[j])) j++;
      tokens.push({ text: chars.slice(i, j).join(""), kind: "other" });
      i = j;
    } else {
      tokens.push({ text: ch, kind: "punct" });
      i += 1;
    }
  }
  return tokens;
}

/**
 * Unknown characters in `text`, treating `extras` (grammar items, proper nouns)
 * as allowed terms. Words are matched longest-first, so an HSK word that
 * contains an extra character (儿子 vs 儿) is still recognized as a word.
 */
export function unknownTokens(text: string, lexicon: Lexicon, extras: ReadonlySet<string>): string[] {
  const merged = new Set([...lexicon.extras, ...extras]);
  const maxLength = Math.max(lexicon.maxLength, ...[...extras].map((e) => [...e].length));
  return segment(text, { byText: lexicon.byText, extras: merged, maxLength })
    .filter((t) => t.kind === "unknown")
    .map((t) => t.text);
}
