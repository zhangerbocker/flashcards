// Generates the reading library: 3 or more stories per topic per level (about one per
// 25 topic words), covering every topic word at that level. Saves after each topic so a rerun skips finished ones.
// Usage: npx tsx scripts/gen-stories.ts [--only "HSK1:Time,HSK2:Actions"]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateStories } from "../src/lib/server/story-gen";
import type { Story } from "../src/lib/story";
import { TOPICS, type Topic } from "../src/lib/topics";
import type { Level, Word } from "../src/lib/words";

const OUT = "data/stories.json";
const MIN_STORIES_PER_TOPIC = 3;
const WORDS_PER_STORY = 25;
const CONCURRENCY = 4;

const words: Word[] = JSON.parse(readFileSync("data/words.json", "utf8"));
const extrasFile = JSON.parse(readFileSync("data/allowed-extras.json", "utf8")) as {
  grammar: string[];
  properNouns: string[];
  glosses: Record<string, [string, string]>;
};
const extras = new Set([...extrasFile.grammar, ...extrasFile.properNouns]);
const extraGlosses = new Map(Object.entries(extrasFile.glosses).map(([text, [pinyin, en]]) => [text, { pinyin, en }]));

/** Bigger topics get more stories, so every topic word fits naturally. */
function storiesFor(level: Level, topic: Topic): number {
  const topicWords = words.filter((w) => w.level === level && w.topic === topic).length;
  return Math.max(MIN_STORIES_PER_TOPIC, Math.ceil(topicWords / WORDS_PER_STORY));
}

const slug = (topic: Topic) => topic.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg > -1 ? new Set(process.argv[onlyArg + 1].split(",")) : null;
  const existing: Story[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
  const done = new Set(existing.map((s) => `HSK${s.level}:${s.topic}`));
  const jobs = ([1, 2, 3] as Level[]).flatMap((level) =>
    TOPICS.map((topic) => ({ level, topic, key: `HSK${level}:${topic}` })),
  ).filter((j) => (only ? only.has(j.key) : !done.has(j.key)));

  let stories = only ? existing.filter((s) => !only.has(`HSK${s.level}:${s.topic}`)) : existing;
  const failed: string[] = [];
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const chunk = jobs.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((j) =>
        generateStories({
          level: j.level,
          topic: j.topic,
          count: storiesFor(j.level, j.topic),
          words,
          extras,
          requireCoverage: true,
          extraGlosses,
          idPrefix: `h${j.level}-${slug(j.topic)}`,
          onRetry: (attempt, issues) => console.warn(`  ${j.key} attempt ${attempt}:\n    ${issues.join("\n    ")}`),
        }),
      ),
    );
    results.forEach((r, k) => {
      const job = chunk[k];
      if (r.status === "fulfilled") {
        stories = [...stories.filter((s) => `HSK${s.level}:${s.topic}` !== job.key), ...r.value.stories];
        const note = r.value.missing.length ? ` (uncovered: ${r.value.missing.join(" ")})` : "";
        console.log(`ok ${job.key}${note}`);
      } else {
        failed.push(job.key);
        console.error(`FAILED ${job.key}: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
      }
    });
    const order = (s: Story) => s.level * 100 + TOPICS.indexOf(s.topic);
    stories.sort((a, b) => order(a) - order(b) || a.id.localeCompare(b.id));
    writeFileSync(OUT, JSON.stringify(stories, null, 1) + "\n");
  }
  console.log(`${stories.length} stories in ${OUT}`);
  if (failed.length) {
    console.error(`failed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
