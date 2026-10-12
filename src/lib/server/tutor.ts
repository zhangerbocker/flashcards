// The chat partner (server only: reads the API key; never import from client components).
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { PartnerLine, systemPrompt, TutorTurn, type Scenario } from "../chat";
import type { Level } from "../words";
import { createClient, PARLEY_MODEL, USING_PARLEY } from "./anthropic-client";

/**
 * Chat model: Haiku 5.5 (chosen with the learner: fast and cheap enough for every message).
 * CHAT_MODEL overrides it; on Parley the default is PARLEY_MODEL, since Parley doesn't serve Haiku 5.5.
 */
export const CHAT_MODEL = process.env.CHAT_MODEL || (USING_PARLEY ? PARLEY_MODEL : "claude-haiku-5-5");

export interface TutorContext {
  level: Level;
  scenario: Scenario;
  /** Every word allowed at the level, in dictionary form (nouns with their article). */
  allowedWords: readonly string[];
  targetWords: readonly string[];
  /** Earlier messages, oldest first, already trimmed to the context window. */
  history: readonly { role: "user" | "partner"; text: string }[];
}

/** The app's interface to the chat model, so routes can be tested with a fake. */
export interface TutorClient {
  /** The partner's opening line for a new conversation. */
  open(context: TutorContext): Promise<PartnerLine>;
  /** Checks the learner's message and replies to it. */
  respond(context: TutorContext, message: string): Promise<TutorTurn>;
}

/** A failure the learner should see as "couldn't reach the tutor"; the message names the cause. */
export class TutorError extends Error {}

const START = "(Start the conversation with one short opening line.)";
/** Thinking counts toward max_tokens on Haiku 5.5, so leave room beyond the ~300-token answer. */
const MAX_TOKENS = 4000;

export function createClaudeTutor(client = createClient({ timeout: 30_000, maxRetries: 1 })): TutorClient {
  async function ask<T extends z.ZodType>(schema: T, context: TutorContext, message: string): Promise<z.infer<T>> {
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: START },
      ...context.history.map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.text })),
      ...(message === START ? [] : [{ role: "user" as const, content: message }]),
    ];
    // The model's answer is pure given its input, so one retry on a malformed answer is safe.
    for (let attempt = 1; ; attempt++) {
      let response;
      try {
        response = await client.beta.messages.parse({
          model: CHAT_MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt(context.level, context.scenario, context.allowedWords, context.targetWords),
          messages,
          output_config: { effort: "low", format: betaZodOutputFormat(schema) },
        });
      } catch (err) {
        // Timeouts, connection failures and API errors (the SDK already retried once).
        if (err instanceof Anthropic.APIError) throw new TutorError(err.message);
        throw err;
      }
      if (response.stop_reason === "refusal") throw new TutorError("the model declined to answer this message");
      if (response.parsed_output != null) return response.parsed_output;
      if (attempt === 2) throw new TutorError(`the model's answer was incomplete (stop_reason=${response.stop_reason})`);
    }
  }

  return {
    open: (context) => ask(PartnerLine, context, START),
    respond: (context, message) => ask(TutorTurn, context, message),
  };
}
