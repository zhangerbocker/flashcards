// Adds the 500 HSK 3 words (2025 syllabus) to data/words.json as ids 501-1000, from the
// Mandarin Zone list parsed to JSON ({n, hanzi, pinyin, pos, en}). Claude writes a concise
// learner gloss, a topic and an example sentence for each; examples are checked to contain
// the word and use only HSK 1-3 words, and failures are sent back with the reason.
// Finished batches are cached in <cache.json>, so a rerun only redoes what failed.
// Usage: npx tsx scripts/import-hsk3.ts <hsk3_raw.json> <cache.json>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { buildLexicon, unknownTokens } from "../src/lib/segment";
import { generateJson } from "../src/lib/server/claude";
import { TOPICS } from "../src/lib/topics";
import type { Word } from "../src/lib/words";

const WORDS_PATH = "data/words.json";
const ID_OFFSET = 500;
const BATCH = 25;
const MAX_ROUNDS = 4;
const CONCURRENCY = 4;

interface RawEntry {
  n: number;
  hanzi: string;
  pinyin: string;
  pos: string;
  en: string;
}

const Enriched = z.object({
  words: z.array(
    z.object({
      n: z.number().int(),
      english: z.string().describe("Concise learner gloss for this reading and part of speech, at most ~60 characters, ';' between senses"),
      topic: z.enum(TOPICS),
      exampleZh: z.string().describe("One short natural sentence (6-16 characters) using the word"),
      examplePinyin: z.string().describe("Tone-marked pinyin of exampleZh, words separated by spaces, sentence capitalized"),
      exampleEn: z.string().describe("Natural English translation of exampleZh"),
    }),
  ),
});
type Enriched = z.infer<typeof Enriched>["words"][number];

const SYSTEM = `You prepare HSK 3 (2025 syllabus) vocabulary cards for an adult learner (English speaker, Brazilian, lives in New York).
For each word:
- english: a concise gloss for THIS reading (pinyin) and part of speech, the senses a learner meets first; no dictionary noise, no truncation.
- topic, the single most useful of:
  Function words: particles, pronouns, conjunctions, prepositions, question words, adverbs, auxiliary/copular verbs.
  Numbers & measures: numbers, measure words, quantity words.
  People & family: family members, people, jobs as people, names, gender.
  Places & directions: places, buildings, locations, direction and position words.
  Time: dates, days, clock time, time periods, time adverbs about when.
  Food & drink: food, drinks, meals, eating and drinking verbs.
  Daily life & transport: greetings and set phrases, clothes, household objects, shopping, transport, travel, internet, hobbies, animals.
  School & work: school, study, reading/writing, language, jobs, office work.
  Body & health: body parts, illness, doctors and hospitals, sports and exercise.
  Weather & colors: weather, seasons, temperature, colors, nature.
  Actions: verbs that fit no more specific topic.
  Descriptions: adjectives that fit no more specific topic.
- an example sentence: short, natural, everyday, using the word in this reading, and using ONLY words from the allowed HSK 1-3 list (names and numbers are fine).
Return every n you are given exactly once.`;

function problems(entry: RawEntry, e: Enriched, lexicon: ReturnType<typeof buildLexicon>, extras: Set<string>): string[] {
  const issues: string[] = [];
  if (!e.exampleZh.includes(entry.hanzi)) issues.push(`the example must contain ${entry.hanzi}`);
  const unknown = unknownTokens(e.exampleZh, lexicon, extras);
  if (unknown.length) issues.push(`"${e.exampleZh}" uses ${unknown.join(" ")}, which isn't an HSK 1-3 word: write a different sentence`);
  if (!/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(e.examplePinyin)) issues.push("examplePinyin needs tone marks");
  if (!e.english.trim() || e.english.includes("…")) issues.push("english must be a complete gloss");
  return issues;
}

async function enrich(batch: RawEntry[], allowed: string, lexicon: ReturnType<typeof buildLexicon>, extras: Set<string>): Promise<Map<number, Enriched>> {
  const done = new Map<number, Enriched>();
  let pending = batch;
  let feedback = new Map<number, string[]>();
  for (let round = 1; round <= MAX_ROUNDS && pending.length > 0; round++) {
    const lines = pending
      .map((w) => `${w.n}\t${w.hanzi}\t${w.pinyin}\t${w.pos}\t${w.en}${feedback.has(w.n) ? `\t(fix: ${feedback.get(w.n)!.join("; ")})` : ""}`)
      .join("\n");
    const out = await generateJson(Enriched, SYSTEM, `Words (n, hanzi, pinyin, pos, dictionary meaning):\n${lines}\n\nAllowed HSK 1-3 words:\n${allowed}`, 16000, "low");
    const byN = new Map(out.words.map((e) => [e.n, e]));
    feedback = new Map();
    const retry: RawEntry[] = [];
    for (const w of pending) {
      const e = byN.get(w.n);
      const issues = e ? problems(w, e, lexicon, extras) : ["missing from the answer"];
      if (issues.length === 0) done.set(w.n, e!);
      else {
        feedback.set(w.n, issues);
        retry.push(w);
      }
    }
    if (retry.length) console.warn(`  batch ${batch[0].n}: round ${round}, ${retry.length} to fix (${[...feedback].slice(0, 2).map(([n, i]) => `${n}: ${i[0]}`).join(" | ")})`);
    pending = retry;
  }
  if (pending.length) throw new Error(`could not get valid entries for n=${pending.map((w) => w.n).join(", ")}: ${[...feedback.values()].flat().slice(0, 3).join("; ")}`);
  return done;
}

async function main() {
  const [src, cachePath] = process.argv.slice(2);
  if (!src || !cachePath) throw new Error("usage: npx tsx scripts/import-hsk3.ts <hsk3_raw.json> <cache.json>");
  const raw: RawEntry[] = JSON.parse(readFileSync(src, "utf8"));
  if (raw.length !== 500) throw new Error(`expected 500 HSK 3 entries, got ${raw.length}`);
  const words: Word[] = JSON.parse(readFileSync(WORDS_PATH, "utf8")).filter((w: Word) => w.level !== 3);
  if (words.length !== 500) throw new Error(`expected 500 HSK 1-2 words in ${WORDS_PATH}, got ${words.length}`);

  const extrasFile = JSON.parse(readFileSync("data/allowed-extras.json", "utf8")) as { grammar: string[]; properNouns: string[] };
  const extras = new Set([...extrasFile.grammar, ...extrasFile.properNouns]);
  const all = [...words.map((w) => ({ id: w.id, hanzi: w.hanzi })), ...raw.map((w) => ({ id: ID_OFFSET + w.n, hanzi: w.hanzi }))];
  const lexicon = buildLexicon(all, extras);
  const allowed = [...new Set(all.map((w) => w.hanzi))].join(" ");

  const results = new Map<number, Enriched>(existsSync(cachePath) ? Object.entries(JSON.parse(readFileSync(cachePath, "utf8"))).map(([n, e]) => [Number(n), e as Enriched]) : []);
  const todo = raw.filter((w) => !results.has(w.n));
  console.log(`${results.size} cached, ${todo.length} to enrich`);
  const batches: RawEntry[][] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  const failures: string[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < batches.length) {
        const batch = batches[next++];
        try {
          for (const [n, e] of await enrich(batch, allowed, lexicon, extras)) results.set(n, e);
          writeFileSync(cachePath, JSON.stringify(Object.fromEntries(results)));
          console.log(`enriched ${results.size}/500`);
        } catch (err) {
          failures.push(err instanceof Error ? err.message : String(err));
        }
      }
    }),
  );
  if (failures.length) throw new Error(`${failures.length} batch(es) failed; rerun to retry them:\n${failures.join("\n")}`);

  const level3: Word[] = raw.map((w) => {
    const e = results.get(w.n)!;
    return {
      id: ID_OFFSET + w.n,
      hanzi: w.hanzi,
      pinyin: w.pinyin,
      pos: w.pos,
      english: e.english.trim(),
      level: 3,
      topic: e.topic,
      example: { zh: e.exampleZh.trim(), pinyin: e.examplePinyin.trim(), en: e.exampleEn.trim() },
    };
  });
  writeFileSync(WORDS_PATH, JSON.stringify([...words, ...level3], null, 1) + "\n");
  const counts = new Map<string, number>();
  for (const w of level3) counts.set(w.topic, (counts.get(w.topic) ?? 0) + 1);
  console.log(`wrote ${level3.length} HSK 3 words`, Object.fromEntries([...counts].sort((a, b) => b[1] - a[1])));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
