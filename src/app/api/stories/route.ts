import { readFileSync } from "node:fs";
import path from "node:path";
import { generateStories } from "@/lib/server/story-gen";
import { isTopic } from "@/lib/topics";
import { WORDS } from "@/lib/words";

function loadExtras() {
  const file = JSON.parse(readFileSync(path.join(process.cwd(), "data/allowed-extras.json"), "utf8")) as {
    grammar: string[];
    properNouns: string[];
    glosses: Record<string, [string, string]>;
  };
  return {
    extras: new Set([...file.grammar, ...file.properNouns]),
    extraGlosses: new Map(Object.entries(file.glosses).map(([text, [pinyin, en]]) => [text, { pinyin, en }])),
  };
}

/** Drafting, repairing and glossing a story takes a few minutes. */
export const maxDuration = 300;

/**
 * Generates one new validated story for a level and topic.
 * Body: { level: 1 | 2 | 3, topic: Topic }. Responds { story } or { error }.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "request body must be JSON" }, { status: 400 });
  }
  const { level, topic } = (body ?? {}) as { level?: unknown; topic?: unknown };
  if (level !== 1 && level !== 2 && level !== 3) return Response.json({ error: `level must be 1, 2 or 3, got ${JSON.stringify(level)}` }, { status: 400 });
  if (!isTopic(topic)) return Response.json({ error: `unknown topic ${JSON.stringify(topic)}` }, { status: 400 });

  try {
    const { stories } = await generateStories({
      level,
      topic,
      count: 1,
      words: WORDS,
      ...loadExtras(),
      requireCoverage: false,
      idPrefix: `c-${Date.now()}`,
    });
    return Response.json({ story: stories[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`story generation failed for HSK ${level} ${topic}: ${message}`);
    return Response.json({ error: `Couldn't generate a story: ${message}` }, { status: 502 });
  }
}
