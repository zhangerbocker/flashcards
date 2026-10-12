// Assigns each HSK word exactly one study topic and writes it into data/words.json.
// Usage: npx tsx scripts/assign-topics.ts
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { generateJson } from "../src/lib/server/claude";
import { TOPICS } from "../src/lib/topics";

const WORDS_PATH = "data/words.json";
const BATCH = 100;

interface RawWord {
  id: number;
  hanzi: string;
  pinyin: string;
  pos: string;
  english: string;
  topic?: string;
}

const Assignment = z.object({
  assignments: z.array(z.object({ id: z.number().int(), topic: z.enum(TOPICS) })),
});

const SYSTEM = `You sort Chinese vocabulary into study topics for a learner app.
Topics and rules:
- Function words: particles, pronouns, conjunctions, prepositions, question words, adverbs, auxiliary/copular verbs (是, 能, 可以).
- Numbers & measures: numbers, measure words, quantity words.
- People & family: family members, people, names, gender.
- Places & directions: places, buildings, locations, direction and position words, here/there words.
- Time: dates, days, clock time, time periods, time adverbs about when.
- Food & drink: food, drinks, meals, eating and drinking verbs.
- Daily life & transport: greetings and set phrases, clothes, household objects, shopping, transport, travel, internet, hobbies, animals.
- School & work: school, study, reading/writing, language, jobs, office work.
- Body & health: body parts, illness, doctors and hospitals, sports and exercise.
- Weather & colors: weather, seasons, temperature, colors.
- Actions: verbs that fit no more specific topic.
- Descriptions: adjectives that fit no more specific topic.
Choose the single most useful topic for a learner. Return every id you are given exactly once.`;

async function assignBatch(batch: RawWord[]): Promise<Map<number, string>> {
  const lines = batch.map((w) => `${w.id}\t${w.hanzi}\t${w.pinyin}\t${w.pos}\t${w.english}`).join("\n");
  for (let attempt = 1; attempt <= 2; attempt++) {
    const out = await generateJson(Assignment, SYSTEM, `Assign a topic to each word (id, hanzi, pinyin, pos, english):\n${lines}`);
    const got = new Map(out.assignments.map((a) => [a.id, a.topic]));
    const missing = batch.filter((w) => !got.has(w.id)).map((w) => w.id);
    if (missing.length === 0) return got;
    console.warn(`attempt ${attempt}: missing ids ${missing.join(", ")}`);
  }
  throw new Error(`could not get topics for every word in batch starting at id ${batch[0].id}`);
}

async function main() {
  const words: RawWord[] = JSON.parse(readFileSync(WORDS_PATH, "utf8"));
  for (let i = 0; i < words.length; i += BATCH) {
    const batch = words.slice(i, i + BATCH);
    const topics = await assignBatch(batch);
    for (const w of batch) w.topic = topics.get(w.id);
    console.log(`topics assigned for ids ${batch[0].id}-${batch[batch.length - 1].id}`);
  }
  writeFileSync(WORDS_PATH, JSON.stringify(words, null, 1) + "\n");
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w.topic!, (counts.get(w.topic!) ?? 0) + 1);
  console.log(Object.fromEntries([...counts].sort((a, b) => b[1] - a[1])));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
