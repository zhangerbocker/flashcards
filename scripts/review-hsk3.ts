// Second pass over the HSK 3 words in data/words.json: Claude checks that each gloss matches
// the listed reading and part of speech, and that the example uses the word in that reading
// and is natural Chinese, and returns fixes. Fixed examples must still contain the word and
// use only HSK 1-3 words; anything still failing is reported, not written.
// Usage: npx tsx scripts/review-hsk3.ts
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { buildLexicon, unknownTokens } from "../src/lib/segment";
import { generateJson } from "../src/lib/server/claude";
import type { Word } from "../src/lib/words";

const WORDS_PATH = "data/words.json";
const BATCH = 50;
const CONCURRENCY = 4;

const Review = z.object({
  fixes: z.array(
    z.object({
      id: z.number().int(),
      problem: z.string().describe("What was wrong, in a few words"),
      english: z.string().describe("Corrected gloss (or the original if it was fine)"),
      exampleZh: z.string(),
      examplePinyin: z.string().describe("Tone-marked pinyin, words separated by spaces, sentence capitalized"),
      exampleEn: z.string(),
    }),
  ).describe("Only entries that need a change; empty if all are fine"),
});

const SYSTEM = `You review HSK 3 vocabulary cards. Each card has a word with ONE specific reading (pinyin) and part of speech.
Flag and fix a card only when:
- the gloss describes a different reading or part of speech than the one listed (e.g. 得 dé "to obtain" vs 得 de the particle), or is wrong or misleading;
- the example doesn't use the word in the listed reading and part of speech, or is ungrammatical or unnatural Chinese, or its pinyin/English don't match.
Fixed examples: short (6-16 characters), natural, everyday, and using ONLY words from the allowed HSK 1-3 list.
Leave correct cards out of the answer.`;

async function main() {
  const words: Word[] = JSON.parse(readFileSync(WORDS_PATH, "utf8"));
  const extrasFile = JSON.parse(readFileSync("data/allowed-extras.json", "utf8")) as { grammar: string[]; properNouns: string[] };
  const extras = new Set([...extrasFile.grammar, ...extrasFile.properNouns]);
  const lexicon = buildLexicon(words, extras);
  const allowed = [...new Set(words.map((w) => w.hanzi))].join(" ");
  const level3 = words.filter((w) => w.level === 3);
  const byId = new Map(words.map((w) => [w.id, w]));

  const batches: Word[][] = [];
  for (let i = 0; i < level3.length; i += BATCH) batches.push(level3.slice(i, i + BATCH));
  const rejected: string[] = [];
  let applied = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < batches.length) {
        const batch = batches[next++];
        const lines = batch.map((w) => `${w.id}\t${w.hanzi}\t${w.pinyin}\t${w.pos}\t${w.english}\t${w.example.zh}\t${w.example.pinyin}\t${w.example.en}`).join("\n");
        const out = await generateJson(Review, SYSTEM, `Cards (id, hanzi, pinyin, pos, gloss, example, example pinyin, example English):\n${lines}\n\nAllowed HSK 1-3 words:\n${allowed}`, 16000, "medium");
        for (const fix of out.fixes) {
          const word = byId.get(fix.id);
          if (!word || word.level !== 3) continue;
          const unknown = unknownTokens(fix.exampleZh, lexicon, extras);
          if (!fix.exampleZh.includes(word.hanzi) || unknown.length) {
            rejected.push(`${fix.id} ${word.hanzi}: ${fix.problem} -> "${fix.exampleZh}" (${unknown.length ? `uses ${unknown.join(" ")}` : "missing the word"})`);
            continue;
          }
          console.log(`${fix.id} ${word.hanzi} ${word.pinyin}: ${fix.problem}\n    ${word.english} | ${word.example.zh}\n -> ${fix.english} | ${fix.exampleZh}`);
          word.english = fix.english.trim();
          word.example = { zh: fix.exampleZh.trim(), pinyin: fix.examplePinyin.trim(), en: fix.exampleEn.trim() };
          applied++;
        }
      }
    }),
  );
  writeFileSync(WORDS_PATH, JSON.stringify(words, null, 1) + "\n");
  console.log(`applied ${applied} fixes`);
  if (rejected.length) console.log(`not applied (fix it by hand):\n${rejected.join("\n")}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
