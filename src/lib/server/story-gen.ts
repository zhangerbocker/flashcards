// Story generation shared by the library script and the on-demand API route.
// Server-only: calls Claude through ./claude.
import { z } from "zod";
import { generateJson } from "./claude";
import { buildLexicon } from "../segment";
import {
  applyFixes,
  buildStory,
  draftProblems,
  draftWordCount,
  glossTargets,
  LENGTH_RANGE,
  missingWords,
  vocabOffenders,
  type Gloss,
  type Story,
  type StoryDraft,
} from "../story";
import type { Topic } from "../topics";
import { withArticle, type Level, type Word } from "../words";

const Question = z.object({
  q: z.string().describe("Question in simple Portuguese"),
  qEn: z.string().describe("English translation of the question"),
  options: z.array(z.string()).describe("Exactly 4 short options in Portuguese"),
  answer: z.number().int().describe("Index (0-3) of the correct option"),
});

const Draft = z.object({
  title: z.string().describe("Short Portuguese title"),
  titleEn: z.string(),
  sentences: z
    .array(z.object({ pt: z.string().describe("One Portuguese sentence with its end punctuation"), en: z.string() }))
    .describe("The story, one sentence per entry, in order"),
  questions: z.array(Question).describe("Exactly 3 multiple-choice comprehension questions"),
});

const DraftBatch = z.object({ stories: z.array(Draft) });

const Glosses = z.object({
  sentences: z
    .array(z.object({ tokens: z.array(z.object({ en: z.string() })) }))
    .describe("One entry per sentence; one gloss per given token, same order and count"),
});

export interface StoryGenInput {
  level: Level;
  topic: Topic;
  count: number;
  words: readonly Word[];
  extras: ReadonlySet<string>;
  /** Whether every topic word at this level must appear across the stories. */
  requireCoverage: boolean;
  /** English for extras (names, places), used when glossing falls back. */
  extraGlosses: ReadonlyMap<string, Gloss>;
  /** Prefix for generated story ids. */
  idPrefix: string;
  /** Called with the problems found when an attempt is rejected (for logging). */
  onRetry?: (attempt: number, issues: string[]) => void;
}

export interface StoryGenResult {
  stories: Story[];
  /** Topic words still unused after the last attempt (only when coverage was required). */
  missing: string[];
}

/** Target sentence counts per story; models hit these more reliably than word counts. */
const SENTENCES: Record<Level, string> = { 1: "12-18", 2: "16-24" };

const TENSES: Record<Level, string> = {
  1: "the present tense, ir + infinitive for the future, and a little pretérito perfeito",
  2: "the present, ir + infinitive, the pretérito perfeito and the pretérito imperfeito",
};

function system(level: Level, extras: ReadonlySet<string>): string {
  const [min, max] = LENGTH_RANGE[level];
  const cefr = level === 1 ? "A1" : "A2";
  return `You write graded reading stories in Brazilian Portuguese for an adult English-speaking learner at CEFR ${cefr}.
Rules:
- Use ONLY words from the allowed vocabulary list, in any inflected form (conjugations, plurals, feminine forms, contractions like do/na/pelo), plus punctuation, numerals and these extras: ${[...extras].join(", ")}. Use only names from the extras.
- Brazilian usage: você, a gente where natural, Brazilian vocabulary and word order.
- Use only ${TENSES[level]}.
- Each story has ${SENTENCES[level]} short sentences (${min}-${max} words in total): a small everyday scene with a beginning and an end, natural and warm, not a word list.
- One sentence per entry, with its end punctuation.
- Comprehension questions test the story's content; options are short; exactly one is correct.
- Different stories use different scenes and characters. Vary the settings (work, home, shopping, friends, weekends, school, travel, sports, the beach).
- If a word you want is not in the list, rephrase with listed words instead.`;
}

const Fixes = z.object({
  fixes: z.array(
    z.object({
      path: z
        .string()
        .describe('A path from the problem list; "<story>.s<j>+" to insert a new sentence right after sentence j; or "<story>.add" to append at the end'),
      pt: z.string(),
      en: z.string().describe("English translation (may be empty for options)"),
      options: z.array(z.string()).optional().describe('For "<story>.q<j>" only: the full new set of 4 options'),
      answer: z.number().int().optional().describe('For "<story>.q<j>" only: index of the correct new option'),
    }),
  ),
});

const MAX_REPAIRS = 6;

async function writeDrafts(input: StoryGenInput, lexicon: ReturnType<typeof buildLexicon>) {
  const allowed = input.words.filter((w) => w.level <= input.level);
  const topicWords = input.words.filter((w) => w.level === input.level && w.topic === input.topic);
  const vocab = allowed.map(withArticle).join(", ");
  const ctx = { level: input.level, lexicon, extras: input.extras };
  const [min] = LENGTH_RANGE[input.level];
  const coverage = input.requireCoverage
    ? `Across the ${input.count} stories, use EVERY one of these topic words at least once: ${topicWords.map(withArticle).join(", ")}`
    : `Feature words from this topic where natural: ${topicWords.map(withArticle).join(", ")}`;

  const first = await generateJson(
    DraftBatch,
    system(input.level, input.extras),
    `Topic: ${input.topic}\nWrite ${input.count} stories.\n${coverage}\n\nAllowed vocabulary:\n${vocab}`,
    16000,
    // Three long stories plus reasoning can exceed the output limit at medium effort.
    "low",
  );
  let drafts = first.stories.slice(0, input.count);
  if (drafts.length < input.count) throw new Error(`asked for ${input.count} stories, got ${drafts.length}`);
  const structural = drafts.flatMap((d) => draftProblems(d, ctx)).filter((i) => /questions|options|answer index/.test(i));
  if (structural.length) throw new Error(`malformed questions: ${structural.join("; ")}`);

  let missing: number[] = [];
  for (let round = 1; ; round++) {
    const offenders = drafts.flatMap((d, i) => vocabOffenders(d, i, ctx));
    const short = drafts.flatMap((d, i) => (draftWordCount(d) < min ? [{ i, n: draftWordCount(d) }] : []));
    missing = input.requireCoverage ? missingWords(drafts, lexicon, topicWords) : [];
    if (offenders.length === 0 && short.length === 0 && missing.length === 0) return { drafts, missing };
    if (round > MAX_REPAIRS) {
      // Out-of-vocabulary text must be fixed; a few uncovered words or a slightly short story are tolerated.
      if (offenders.length === 0) return { drafts, missing };
      throw new Error(`still uses words outside the list after ${MAX_REPAIRS} repairs: ${offenders.map((o) => o.bad.join(", ")).join("; ")}`);
    }

    const tasks: string[] = [];
    const questionPaths = new Set<string>();
    for (const o of offenders) {
      const q = /^(\d+\.q\d+)/.exec(o.path);
      if (q) {
        questionPaths.add(q[1]);
        continue;
      }
      tasks.push(`${o.path}: "${o.text}" uses ${o.bad.join(", ")}, which are not allowed. Rewrite it with listed words so the story still reads naturally; you may also rewrite neighboring sentences.`);
    }
    for (const path of questionPaths) {
      const [story, qi] = path.split(".q").map(Number);
      const q = drafts[story].questions[qi];
      tasks.push(`${path}: the question "${q.q}" or its options (${q.options.join(" / ")}) use words outside the list. Write a new question for "${path}" with "options" (4) and "answer", answerable from the story, using only listed words.`);
    }
    for (const { i, n } of short) tasks.push(`Story ${i} has only ${n} words; add sentences so it reaches at least ${min}, inserted where they fit ("${i}.s<j>+") or at the end ("${i}.add") if they continue the story.`);
    if (missing.length) {
      const names = topicWords.filter((w) => missing.includes(w.id)).map(withArticle);
      tasks.push(`These topic words are not used yet: ${names.join(", ")}. Use them naturally: rewrite a fitting sentence, or insert a new sentence where it belongs in the plot ("<story>.s<j>+"). Never tack unrelated sentences onto the end.`);
    }
    input.onRetry?.(round, tasks);
    const listing = drafts
      .map((d, i) => `Story ${i}: ${d.title}\n${d.sentences.map((s, j) => `  ${i}.s${j} ${s.pt}`).join("\n")}`)
      .join("\n");
    const out = await generateJson(
      Fixes,
      system(input.level, input.extras),
      `Current stories:\n${listing}\n\nFix these problems. Return only the changed or added pieces:\n- ${tasks.join("\n- ")}\n\nAllowed vocabulary:\n${vocab}`,
    );
    drafts = applyFixes(drafts, out.fixes);
  }
}

async function glossDraft(draft: StoryDraft, lexicon: ReturnType<typeof buildLexicon>): Promise<Gloss[][]> {
  const targets = glossTargets(draft, lexicon);
  const listing = targets.map((tokens, i) => `${i + 1}. ${draft.sentences[i].pt}\n   tokens: ${tokens.join(" | ")}`).join("\n");
  const prompt = `For each sentence, give a short English gloss for each listed token, in order, with the meaning it has in this sentence. For verbs, include the person and tense (fui → "I went", estava → "was"); for contractions, both parts (no → "in the").\n\n${listing}`;
  const out = await generateJson(Glosses, "You annotate Brazilian Portuguese text for English-speaking learners. Return exactly one gloss per listed token.", prompt);
  return out.sentences.map((s) => s.tokens);
}

/**
 * Generates validated, segmented and glossed stories for one topic and level.
 * Throws if vocabulary/format problems remain after retries.
 */
export async function generateStories(input: StoryGenInput): Promise<StoryGenResult> {
  const lexicon = buildLexicon(
    input.words.filter((w) => w.level <= input.level),
    input.extras,
  );
  const dictionary = new Map(input.words.map((w) => [w.id, { en: w.english }]));
  const { drafts, missing } = await writeDrafts(input, lexicon);
  const glosses = await Promise.all(drafts.map((d) => glossDraft(d, lexicon)));
  const stories = drafts.map((d, i) =>
    buildStory(`${input.idPrefix}-${i + 1}`, input.level, input.topic, d, glosses[i], lexicon, dictionary, input.extraGlosses),
  );
  const missingNames = input.words.filter((w) => missing.includes(w.id)).map(withArticle);
  return { stories, missing: missingNames };
}
