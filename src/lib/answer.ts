/** Removes punctuation and whitespace and folds full-width ASCII so answers compare fairly. */
function normalizeChinese(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\s\p{P}\p{S}]/gu, "")
    .toLowerCase();
}

/** Pinyin without tone marks, spaces or apostrophes; ü/v both become "v". */
export function plainPinyin(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, (mark) => (mark === "̈" ? "̈" : ""))
    .replace(/ü/gi, "v")
    .replace(/[\s'’\p{P}]/gu, "")
    .toLowerCase();
}

export interface AnswerCheck {
  correct: boolean;
  /** Character-level diff of the typed answer against the expected Chinese. */
  diff: { text: string; status: "same" | "missing" | "extra" }[];
}

/** Longest-common-subsequence diff between two character arrays. */
function diffChars(
  typed: string[],
  expected: string[],
  equal: (a: string, b: string) => boolean = (a, b) => a === b,
): AnswerCheck["diff"] {
  const n = typed.length;
  const m = expected.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = equal(typed[i], expected[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: AnswerCheck["diff"] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && equal(typed[i], expected[j])) {
      out.push({ text: typed[i], status: "same" });
      i++;
      j++;
    } else if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      out.push({ text: expected[j], status: "missing" });
      j++;
    } else {
      out.push({ text: typed[i], status: "extra" });
      i++;
    }
  }
  return out;
}

/**
 * Checks a typed answer against the expected Chinese. Punctuation and spacing
 * are ignored. When `pinyin` is given (single-word cards), a toneless pinyin
 * answer is also accepted.
 */
export function checkAnswer(typed: string, expectedZh: string, pinyin?: string): AnswerCheck {
  const t = normalizeChinese(typed);
  const e = normalizeChinese(expectedZh);
  const pinyinOk = pinyin !== undefined && t.length > 0 && plainPinyin(typed) === plainPinyin(pinyin);
  return { correct: t === e || pinyinOk, diff: diffChars([...t], [...e]) };
}

/**
 * Character diff from a wrong sentence to its correction, for display: punctuation is
 * kept (shown as in the correction), full-width and ASCII forms count as the same
 * character, and spaces are dropped.
 */
export function diffSentences(wrong: string, right: string): AnswerCheck["diff"] {
  const chars = (s: string) => [...s.replace(/\s+/g, "")];
  // NFKC folds full-width ，！？ etc. to ASCII; the ideographic full stop needs mapping by hand.
  const fold = (c: string) => (c === "。" ? "." : c.normalize("NFKC"));
  const diff = diffChars(chars(wrong), chars(right), (a, b) => fold(a) === fold(b));
  // Equal-but-differently-written punctuation shows the corrected form.
  const corrected = chars(right);
  let j = 0;
  return diff.map((d) => {
    if (d.status === "extra") return d;
    const text = corrected[j++];
    return { ...d, text };
  });
}
