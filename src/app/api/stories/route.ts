import { loadExtras } from "@/lib/server/extras";
import { ownerOnly, requestIdentity } from "@/lib/server/request-identity";
import { generateStories } from "@/lib/server/story-gen";
import { isTopic } from "@/lib/topics";
import { isLevel, LEVEL_NAMES, WORDS } from "@/lib/words";

/** Drafting, repairing and glossing a story takes a few minutes. */
export const maxDuration = 300;

/**
 * Generates one new validated story for a level and topic.
 * Body: { level: 1 | 2, topic: Topic }. Responds { story } or { error }.
 */
export async function POST(request: Request) {
  // Each story costs more than a guest's whole chat budget, so only the owner generates them.
  const refused = ownerOnly(requestIdentity(request), "Generating new stories");
  if (refused) return refused;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "request body must be JSON" }, { status: 400 });
  }
  const { level, topic } = (body ?? {}) as { level?: unknown; topic?: unknown };
  if (!isLevel(level)) return Response.json({ error: `level must be 1-4 (A1-B2), got ${JSON.stringify(level)}` }, { status: 400 });
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
    console.error(`story generation failed for ${LEVEL_NAMES[level]} ${topic}: ${message}`);
    return Response.json({ error: `Couldn't generate a story: ${message}` }, { status: 502 });
  }
}
