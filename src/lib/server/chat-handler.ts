import { ChatRequest, findScenario, promptWords, recentHistory } from "../chat";
import { WORDS, WORDS_BY_ID } from "../words";
import { TutorError, type TutorClient } from "./tutor";

/**
 * Handles POST /api/chat. Body: ChatRequest. Without `message` it returns the
 * partner's opening line ({ partner }); with one, the check of the message and the
 * reply ({ check, partner }). Invalid bodies get 400 naming the field; tutor
 * failures get 502 with a message the learner can act on.
 */
export function chatHandler(tutor: TutorClient) {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "request body must be JSON" }, { status: 400 });
    }
    const parsed = ChatRequest.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return Response.json({ error: `${issue.path.join(".") || "body"}: ${issue.message}` }, { status: 400 });
    }
    const { level, scenario: scenarioId, targetWordIds, history, message } = parsed.data;
    const context = {
      level,
      scenario: findScenario(scenarioId)!,
      allowedWords: promptWords(WORDS.filter((w) => w.level <= level)),
      targetWords: promptWords(targetWordIds.flatMap((id) => WORDS_BY_ID.get(id) ?? [])),
      history: recentHistory(history),
    };
    try {
      if (message === undefined) return Response.json({ partner: await tutor.open(context) });
      return Response.json(await tutor.respond(context, message));
    } catch (err) {
      if (!(err instanceof TutorError)) throw err;
      // Log the cause only: never the learner's messages.
      console.error(`chat turn failed: ${err.message}`);
      return Response.json({ error: `Couldn't reach the tutor: ${err.message}` }, { status: 502 });
    }
  };
}
