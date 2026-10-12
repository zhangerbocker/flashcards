import { segment, unknownTokens, wordCount, type Lexicon } from "./segment";
import type { Topic } from "./topics";
import { isLevel, type Level } from "./words";

export interface StoryToken {
  text: string;
  /** Contextual English gloss; absent for spaces and punctuation. */
  en?: string;
  /** Present when the token is a word from the word list. */
  wordId?: number;
}

export interface StorySentence {
  tokens: StoryToken[];
  en: string;
}

export interface StoryQuestion {
  q: string;
  qEn: string;
  options: string[];
  answer: number;
}

export interface Story {
  id: string;
  level: Level;
  topic: Topic;
  title: string;
  titleEn: string;
  sentences: StorySentence[];
  questions: StoryQuestion[];
  /** Distinct list words used, for the known-word percentage. */
  wordIds: number[];
}

/** What the model writes before segmentation and glossing. */
export interface StoryDraft {
  title: string;
  titleEn: string;
  sentences: { pt: string; en: string }[];
  questions: StoryQuestion[];
}

/** Words in a draft's sentences (punctuation and numbers excluded). */
export function draftWordCount(draft: StoryDraft): number {
  return draft.sentences.reduce((n, s) => n + wordCount(s.pt), 0);
}

/** Story length in words per level. */
export const LENGTH_RANGE: Record<Level, [number, number]> = { 1: [90, 160], 2: [160, 260], 3: [250, 400], 4: [350, 550] };

interface ValidationContext {
  level: Level;
  lexicon: Lexicon;
  extras: ReadonlySet<string>;
}

/**
 * Problems with one draft: words outside the allowed vocabulary (sentences,
 * title, questions and options), length well outside the level's range,
 * and malformed questions. Returns readable messages for retry feedback.
 */
export function draftProblems(draft: StoryDraft, ctx: ValidationContext): string[] {
  const issues: string[] = [];
  const texts = [
    draft.title,
    ...draft.sentences.map((s) => s.pt),
    ...draft.questions.flatMap((q) => [q.q, ...q.options]),
  ];
  for (const text of texts) {
    const bad = unknownTokens(text, ctx.lexicon, ctx.extras);
    if (bad.length) issues.push(`"${text}" uses words outside the list: ${[...new Set(bad)].join(" ")}`);
  }
  const [min, max] = LENGTH_RANGE[ctx.level];
  const length = draftWordCount(draft);
  if (length < min * 0.8 || length > max * 1.25) {
    issues.push(`"${draft.title}" has ${length} words; aim for ${min}-${max}`);
  }
  if (draft.questions.length !== 3) issues.push(`"${draft.title}" needs exactly 3 questions`);
  for (const q of draft.questions) {
    if (q.options.length !== 4) issues.push(`question "${q.q}" needs exactly 4 options`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
      issues.push(`question "${q.q}" has an invalid answer index ${q.answer}`);
    }
  }
  return issues;
}

/** A piece of a draft that uses words outside the vocabulary. */
export interface Offender {
  /** "<story>.title", "<story>.s<i>", "<story>.q<j>" or "<story>.q<j>.o<k>". */
  path: string;
  text: string;
  bad: string[];
}

/** Every title, sentence, question and option in `draft` that uses words outside the vocabulary. */
export function vocabOffenders(draft: StoryDraft, storyIndex: number, ctx: ValidationContext): Offender[] {
  const items: { path: string; text: string }[] = [
    { path: `${storyIndex}.title`, text: draft.title },
    ...draft.sentences.map((s, i) => ({ path: `${storyIndex}.s${i}`, text: s.pt })),
    ...draft.questions.flatMap((q, j) => [
      { path: `${storyIndex}.q${j}`, text: q.q },
      ...q.options.map((o, k) => ({ path: `${storyIndex}.q${j}.o${k}`, text: o })),
    ]),
  ];
  return items.flatMap(({ path, text }) => {
    const bad = [...new Set(unknownTokens(text, ctx.lexicon, ctx.extras))];
    return bad.length ? [{ path, text, bad }] : [];
  });
}

export interface DraftFix {
  /**
   * An Offender path to replace; "<story>.s<j>+" to insert a sentence right after
   * sentence j; or "<story>.add" to append a sentence at the end.
   */
  path: string;
  pt: string;
  /** English for sentences, titles and questions; ignored for options. */
  en?: string;
  /** For "<story>.q<j>": replacement options and answer, replacing the whole question. */
  options?: string[];
  answer?: number;
}

/**
 * Applies replacements, insertions and appended sentences to drafts, returning
 * new drafts. Paths refer to the drafts as given: replacements are applied first,
 * then insertions from the last position backwards so earlier indices stay valid.
 * Unknown paths are ignored.
 */
export function applyFixes(drafts: readonly StoryDraft[], fixes: readonly DraftFix[]): StoryDraft[] {
  const out: StoryDraft[] = drafts.map((d) => ({
    ...d,
    sentences: d.sentences.map((s) => ({ ...s })),
    questions: d.questions.map((q) => ({ ...q, options: [...q.options] })),
  }));
  const inserts: { story: StoryDraft; after: number; pt: string; en: string }[] = [];
  for (const fix of fixes) {
    const m = /^(\d+)\.(title|add|s(\d+)(\+)?|q(\d+)(?:\.o(\d+))?)$/.exec(fix.path);
    if (!m) continue;
    const story = out[Number(m[1])];
    if (!story) continue;
    if (m[2] === "title") {
      story.title = fix.pt;
      if (fix.en) story.titleEn = fix.en;
    } else if (m[2] === "add") {
      inserts.push({ story, after: Number.MAX_SAFE_INTEGER, pt: fix.pt, en: fix.en ?? "" });
    } else if (m[3] !== undefined && m[4]) {
      inserts.push({ story, after: Number(m[3]), pt: fix.pt, en: fix.en ?? "" });
    } else if (m[3] !== undefined) {
      const sentence = story.sentences[Number(m[3])];
      if (sentence) Object.assign(sentence, { pt: fix.pt, en: fix.en ?? sentence.en });
    } else {
      const q = story.questions[Number(m[5])];
      if (!q) continue;
      if (m[6] !== undefined) {
        if (Number(m[6]) < q.options.length) q.options[Number(m[6])] = fix.pt;
      } else {
        q.q = fix.pt;
        if (fix.en) q.qEn = fix.en;
        if (fix.options && fix.options.length === 4 && fix.answer !== undefined && fix.answer >= 0 && fix.answer < 4) {
          q.options = [...fix.options];
          q.answer = fix.answer;
        }
      }
    }
  }
  // Stable sort keeps several insertions after the same sentence in the order given.
  const ordered = inserts.map((ins, i) => ({ ins, i })).sort((a, b) => b.ins.after - a.ins.after || b.i - a.i);
  for (const { ins } of ordered) {
    const at = Math.min(ins.after + 1, ins.story.sentences.length);
    ins.story.sentences.splice(at, 0, { pt: ins.pt, en: ins.en });
  }
  return out;
}

/** Topic words (by id) that none of the drafts use, in any form. */
export function missingWords(
  drafts: readonly StoryDraft[],
  lexicon: Lexicon,
  topicWords: readonly { id: number }[],
): number[] {
  const used = new Set<number>();
  for (const d of drafts) {
    for (const s of d.sentences) for (const t of segment(s.pt, lexicon)) if (t.wordId !== undefined) used.add(t.wordId);
  }
  return topicWords.filter((w) => !used.has(w.id)).map((w) => w.id);
}

/** Tokens per sentence that need a gloss (everything but spaces and punctuation), as sent to the glosser. */
export function glossTargets(draft: StoryDraft, lexicon: Lexicon): string[][] {
  return draft.sentences.map((s) =>
    segment(s.pt, lexicon)
      .filter((t) => t.kind !== "punct")
      .map((t) => t.text),
  );
}

export interface Gloss {
  en: string;
}

/**
 * Builds the final story from a draft and contextual glosses (one per
 * non-punctuation token, in order). A sentence whose gloss count doesn't
 * match falls back to the dictionary English for list words and to
 * `extraGlosses` for allowed extras such as names.
 */
export function buildStory(
  id: string,
  level: Level,
  topic: Topic,
  draft: StoryDraft,
  glosses: readonly (readonly Gloss[])[],
  lexicon: Lexicon,
  dictionary: ReadonlyMap<number, Gloss>,
  extraGlosses: ReadonlyMap<string, Gloss> = new Map(),
): Story {
  const wordIds = new Set<number>();
  const sentences = draft.sentences.map((s, i) => {
    const tokens = segment(s.pt, lexicon);
    const glossable = tokens.filter((t) => t.kind !== "punct").length;
    const sentenceGlosses = glosses[i]?.length === glossable ? glosses[i] : undefined;
    let g = 0;
    const out: StoryToken[] = tokens.map((t) => {
      if (t.kind === "punct") return { text: t.text };
      const gloss =
        sentenceGlosses?.[g++] ?? (t.wordId !== undefined ? dictionary.get(t.wordId) : extraGlosses.get(t.text));
      if (t.wordId !== undefined) wordIds.add(t.wordId);
      return { text: t.text, en: gloss?.en, wordId: t.wordId };
    });
    return { tokens: out, en: s.en };
  });
  return {
    id,
    level,
    topic,
    title: draft.title,
    titleEn: draft.titleEn,
    sentences,
    questions: draft.questions,
    wordIds: [...wordIds],
  };
}

function isStory(value: unknown): value is Story {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    isLevel(s.level) &&
    typeof s.topic === "string" &&
    typeof s.title === "string" &&
    Array.isArray(s.sentences) &&
    s.sentences.every(
      (x: Record<string, unknown>) => Array.isArray(x.tokens) && typeof x.en === "string",
    ) &&
    Array.isArray(s.questions) &&
    Array.isArray(s.wordIds)
  );
}

/** Validates story content at the boundary (bundled JSON or browser storage). */
export function parseStories(raw: unknown): Story[] {
  if (!Array.isArray(raw)) throw new Error(`story list must be an array, got ${typeof raw}`);
  raw.forEach((entry, i) => {
    if (!isStory(entry)) throw new Error(`malformed story at index ${i}: ${JSON.stringify(entry).slice(0, 120)}`);
  });
  return raw as Story[];
}
