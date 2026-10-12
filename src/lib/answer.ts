/** Lowercase, composed accents, no punctuation, single spaces: so answers compare fairly. */
function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Text without accents or cedillas (não → nao, você → voce). */
export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

/** "accent": the same word with different accents (cafe → café), shown in its corrected form. */
export type DiffPart = { text: string; status: "same" | "missing" | "extra" | "accent" };

export interface AnswerCheck {
  correct: boolean;
  /** Right apart from accents (nao for não): close, but worth pointing out. */
  accentsOnly: boolean;
  /** Character-level diff of the typed answer against the expected answer. */
  diff: DiffPart[];
}

/** Longest-common-subsequence diff between two token arrays. */
function diffTokens(
  typed: readonly string[],
  expected: readonly string[],
  equal: (a: string, b: string) => boolean = (a, b) => a === b,
): DiffPart[] {
  const n = typed.length;
  const m = expected.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = equal(typed[i], expected[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && equal(typed[i], expected[j])) {
      out.push({ text: typed[i], status: "same" });
      i++;
      j++;
    } else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) {
      // On a tie, show what to remove before what to add ("-estou +sou").
      out.push({ text: typed[i], status: "extra" });
      i++;
    } else {
      out.push({ text: expected[j], status: "missing" });
      j++;
    }
  }
  return out;
}

/**
 * Checks a typed answer against the expected Portuguese. Case, punctuation and
 * spacing are ignored. `alternatives` are also accepted (the noun without its
 * article). An answer that is right except for accents is not correct, but is
 * flagged as `accentsOnly`. The diff is against the expected answer.
 */
export function checkAnswer(typed: string, expected: string, alternatives: readonly string[] = []): AnswerCheck {
  const t = normalize(typed);
  const accepted = [expected, ...alternatives].map(normalize);
  const correct = t.length > 0 && accepted.includes(t);
  const accentsOnly = !correct && t.length > 0 && accepted.some((a) => stripAccents(a) === stripAccents(t));
  return { correct, accentsOnly, diff: diffTokens([...t], [...normalize(expected)]) };
}

/** A word without surrounding punctuation, lowercased, for comparing sentence words. */
const fold = (word: string) => word.normalize("NFC").toLowerCase().replace(/^[\p{P}]+|[\p{P}]+$/gu, "");

/** Whether two words or phrases differ only in accents, case or punctuation (cafe / café). */
export function sameButAccents(a: string, b: string): boolean {
  const loose = (s: string) => stripAccents(normalize(s));
  return loose(a) === loose(b);
}

/**
 * Word-level diff from a wrong sentence to its correction, for display. Words that differ
 * only in case or surrounding punctuation count as the same and show the corrected form;
 * words that differ only in accents are "accent" parts, also in the corrected form.
 * Each part's text carries the space that follows it, so the parts join into a sentence;
 * neighboring words with the same status are merged into one part ("suco de laranja").
 */
export function diffSentences(wrong: string, right: string): DiffPart[] {
  const words = (s: string) => s.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  const corrected = words(right);
  const diff = diffTokens(words(wrong), corrected, (a, b) => stripAccents(fold(a)) === stripAccents(fold(b)));
  let j = 0;
  const parts = diff.map((d): DiffPart => {
    if (d.status === "extra") return d;
    const right = corrected[j++];
    return { text: right, status: d.status === "same" && fold(d.text) !== fold(right) ? "accent" : d.status };
  });
  const spaced = parts.map((d, i) => (i < parts.length - 1 ? { ...d, text: `${d.text} ` } : d));
  return spaced.reduce<DiffPart[]>((merged, d) => {
    const last = merged[merged.length - 1];
    if (last?.status === d.status) last.text += d.text;
    else merged.push({ ...d });
    return merged;
  }, []);
}
