// Adds tone-marked pinyin for each grammar point's corrected sentence (mistake.right)
// in data/grammar.json. Usage: npx tsx scripts/add-mistake-pinyin.ts
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { generateJson } from "../src/lib/server/claude";

const PATH = "data/grammar.json";

interface Point {
  id: string;
  mistake: { wrong: string; right: string; reason: string; pinyin?: string };
}

const Result = z.object({ items: z.array(z.object({ id: z.string(), pinyin: z.string() })) });

async function main() {
  const grammar: Point[] = JSON.parse(readFileSync(PATH, "utf8"));
  const listing = grammar.map((g) => `${g.id}\t${g.mistake.right}`).join("\n");
  const out = await generateJson(
    Result,
    "You write standard Hanyu Pinyin for Chinese learners: tone marks (not numbers), words separated by spaces, sentence-initial capital, punctuation kept, tone sandhi for 一 and 不 applied.",
    `Give the pinyin for each sentence (id, sentence). Return every id exactly once.\n${listing}`,
  );
  const byId = new Map(out.items.map((i) => [i.id, i.pinyin.trim()]));
  const missing = grammar.filter((g) => !byId.get(g.id)).map((g) => g.id);
  if (missing.length) throw new Error(`no pinyin returned for: ${missing.join(", ")}`);
  const noTones = grammar.filter((g) => !/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(byId.get(g.id)!)).map((g) => g.id);
  if (noTones.length) throw new Error(`pinyin without tone marks for: ${noTones.join(", ")}`);
  for (const g of grammar) g.mistake.pinyin = byId.get(g.id);
  writeFileSync(PATH, JSON.stringify(grammar, null, 1) + "\n");
  console.log(`added pinyin to ${grammar.length} corrected sentences`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
