// Generates data/grammar.json: explanation, examples and a common mistake for each
// grammar point, restricted to HSK vocabulary at or below the point's level.
// Usage: npx tsx scripts/gen-grammar.ts [--only id1,id2]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { generateJson } from "../src/lib/server/claude";
import { GRAMMAR_SPEC, type GrammarSpec } from "./grammar-spec";
import { buildLexicon, segment, unknownTokens } from "../src/lib/segment";

const OUT = "data/grammar.json";
const MAX_ATTEMPTS = 3;
const CONCURRENCY = 6;

interface Word {
  id: number;
  hanzi: string;
  level: number;
}

const words: Word[] = JSON.parse(readFileSync("data/words.json", "utf8"));
const extrasFile = JSON.parse(readFileSync("data/allowed-extras.json", "utf8")) as { grammar: string[]; properNouns: string[] };
const extras = new Set([...extrasFile.grammar, ...extrasFile.properNouns]);

const Point = z.object({
  pattern: z.string().describe("Compact pattern, e.g. 'A 比 B + adj'"),
  explanation: z.string().describe("1-2 plain English sentences for a beginner"),
  examples: z
    .array(
      z.object({
        zh: z.string(),
        pinyin: z.string().describe("Tone-marked pinyin, words separated by spaces"),
        en: z.string(),
        highlight: z.array(z.string()).describe("Exact substrings of zh that carry the pattern"),
      }),
    )
    .describe("3 short, natural everyday sentences"),
  mistake: z.object({
    wrong: z.string().describe("A typical learner error with this pattern"),
    right: z.string().describe("The corrected sentence"),
    pinyin: z.string().describe("Tone-marked pinyin of the corrected sentence, words separated by spaces"),
    en: z.string().describe("English meaning of the corrected sentence"),
    reason: z.string().describe("One short English sentence explaining the fix"),
  }),
});
type Point = z.infer<typeof Point>;

const SYSTEM = `You write grammar flashcards for an adult learner of Mandarin (English speaker, lives in New York, from Brazil).
Rules:
- Every Chinese sentence uses ONLY words from the allowed vocabulary list, plus punctuation, Arabic numerals and these extras: ${[...extras].join(" ")}.
- Sentences are short (4-14 characters), natural, everyday, and clearly show the pattern.
- highlight entries must be exact substrings of zh.
- The mistake must be a realistic learner error for this exact pattern; wrong must not also be correct Chinese.`;

function vocabFor(level: number): string {
  return words.filter((w) => w.level <= level).map((w) => w.hanzi).join(" ");
}

function problems(point: Point, lexicon: ReturnType<typeof buildLexicon>): string[] {
  const issues: string[] = [];
  const sentences = [...point.examples.map((e) => e.zh), point.mistake.right];
  for (const zh of sentences) {
    const bad = unknownTokens(zh, lexicon, extras);
    if (bad.length) issues.push(`"${zh}" uses words outside the list: ${bad.join(" ")}`);
  }
  for (const e of point.examples) {
    for (const h of e.highlight) if (!e.zh.includes(h)) issues.push(`highlight "${h}" is not in "${e.zh}"`);
  }
  if (point.examples.length < 3) issues.push("needs 3 examples");
  return issues;
}

async function generatePoint(spec: GrammarSpec) {
  const lexicon = buildLexicon(words.filter((w) => w.level <= spec.level));
  let feedback = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = `Grammar point (HSK ${spec.level}): ${spec.title}\nWhat to teach: ${spec.brief}\n\nAllowed vocabulary:\n${vocabFor(spec.level)}${feedback}`;
    const point = await generateJson(Point, SYSTEM, prompt);
    const issues = problems(point, lexicon);
    if (issues.length === 0) {
      const wordIds = [
        ...new Set(point.examples.flatMap((e) => segment(e.zh, lexicon).flatMap((t) => (t.wordId ? [t.wordId] : [])))),
      ];
      return { id: spec.id, level: spec.level, title: spec.title, ...point, wordIds };
    }
    console.warn(`  ${spec.id} attempt ${attempt}: ${issues.join("; ")}`);
    feedback = `\n\nYour previous answer had problems. Fix them:\n- ${issues.join("\n- ")}`;
  }
  throw new Error(`${spec.id}: still invalid after ${MAX_ATTEMPTS} attempts`);
}

async function main() {
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg > -1 ? new Set(process.argv[onlyArg + 1].split(",")) : null;
  const existing: { id: string }[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
  const byId = new Map(existing.map((p) => [p.id, p]));
  const failed: string[] = [];
  const todo = GRAMMAR_SPEC.filter((spec) => (only ? only.has(spec.id) : !byId.has(spec.id)));
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const chunk = todo.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(generatePoint));
    results.forEach((result, j) => {
      const id = chunk[j].id;
      if (result.status === "fulfilled") {
        byId.set(id, result.value);
        console.log(`ok ${id}`);
      } else {
        failed.push(id);
        console.error(result.reason instanceof Error ? result.reason.message : result.reason);
      }
    });
    // Save after each chunk so an interrupted run keeps its progress.
    const ordered = GRAMMAR_SPEC.flatMap((s) => (byId.has(s.id) ? [byId.get(s.id)] : []));
    writeFileSync(OUT, JSON.stringify(ordered, null, 1) + "\n");
  }
  console.log(`${byId.size}/${GRAMMAR_SPEC.length} grammar points in ${OUT}`);
  if (failed.length) {
    console.error(`failed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
