import { ChatRequest, findScenario, promptWords, recentHistory } from "../chat";
import { WORDS, WORDS_BY_ID } from "../words";
import type { Identity } from "./auth";
import { budgetFor, recordGuestSpend } from "./budget";
import type { Db } from "./db";
import { TutorError, type Priced, type TutorClient } from "./tutor";

export interface ChatDeps {
  getDb: () => Promise<Db>;
  /** Who is asking (from the session cookie); null when not signed in. */
  identify: (request: Request) => Identity | null;
  now?: () => Date;
}

/**
 * Handles POST /api/chat. Body: ChatRequest. Without `message` it returns the
 * partner's opening line ({ partner }); with one, the check of the message and the
 * reply ({ check, partner }). Both also carry `budget`: what a guest has left (null
 * for the owner). Invalid bodies get 400 naming the field; a guest out of budget gets
 * 402 with the budget; tutor failures get 502 with a message the learner can act on.
 */
export function chatHandler(tutor: TutorClient, deps: ChatDeps) {
  const now = deps.now ?? (() => new Date());
  return async function POST(request: Request): Promise<Response> {
    const identity = deps.identify(request);
    if (!identity) return Response.json({ error: "Not signed in" }, { status: 401 });
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

    const db = await deps.getDb();
    const before = await budgetFor(db, identity);
    if (before && !before.allowed) {
      const error =
        before.reason === "pool-limit"
          ? "The shared guest budget for chat is used up, so chat is paused for guests."
          : "You've used your guest chat budget.";
      return Response.json({ error, budget: before }, { status: 402 });
    }

    const { level, scenario: scenarioId, targetWordIds, history, message } = parsed.data;
    const context = {
      level,
      scenario: findScenario(scenarioId)!,
      allowedWords: promptWords(WORDS.filter((w) => w.level <= level)),
      targetWords: promptWords(targetWordIds.flatMap((id) => WORDS_BY_ID.get(id) ?? [])),
      history: recentHistory(history),
    };
    const charge = async (usd: number) => {
      if (identity.role === "guest") await recordGuestSpend(db, identity.id, usd, now());
    };
    try {
      let reply: Priced<object>;
      if (message === undefined) {
        const opening = await tutor.open(context);
        reply = { value: { partner: opening.value }, costUsd: opening.costUsd };
      } else {
        reply = await tutor.respond(context, message);
      }
      await charge(reply.costUsd);
      return Response.json({ ...reply.value, budget: await budgetFor(db, identity) });
    } catch (err) {
      if (!(err instanceof TutorError)) throw err;
      await charge(err.costUsd);
      // Log the cause only: never the learner's messages.
      console.error(`chat turn failed: ${err.message}`);
      return Response.json({ error: `Couldn't reach the tutor: ${err.message}` }, { status: 502 });
    }
  };
}
