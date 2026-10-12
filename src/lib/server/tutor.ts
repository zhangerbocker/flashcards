// The chat partner (server only: reads the API key; never import from client components).
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { PartnerLine, systemPrompt, TutorTurn, type Scenario } from "../chat";
import type { Level } from "../words";
import { createClient, PARLEY_MODEL, USING_PARLEY } from "./anthropic-client";
import { costUsd } from "./budget";

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

/** A tutor result and what producing it cost (all attempts). */
export interface Priced<T> {
  value: T;
  costUsd: number;
}

/** The app's interface to the chat model, so routes can be tested with a fake. */
export interface TutorClient {
  /** The partner's opening line for a new conversation. */
  open(context: TutorContext): Promise<Priced<PartnerLine>>;
  /** Checks the learner's message and replies to it. */
  respond(context: TutorContext, message: string): Promise<Priced<TutorTurn>>;
}

/** A failure the learner should see as "couldn't reach the tutor"; the message names the cause. */
export class TutorError extends Error {
  /** What was spent before failing (an attempt that came back unusable still costs). */
  constructor(message: string, readonly costUsd = 0) {
    super(message);
  }
}

const START = "(Start the conversation with one short opening line.)";
/** Thinking counts toward max_tokens on Haiku 5.5, so leave room beyond the ~300-token answer. */
const MAX_TOKENS = 4000;

export function createClaudeTutor(client = createClient({ timeout: 30_000, maxRetries: 1 })): TutorClient {
  async function ask<T extends z.ZodType>(schema: T, context: TutorContext, message: string): Promise<Priced<z.infer<T>>> {
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: START },
      ...context.history.map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.text })),
      ...(message === START ? [] : [{ role: "user" as const, content: message }]),
    ];
    // The model's answer is pure given its input, so one retry on a malformed answer is safe.
    let spent = 0;
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
        if (err instanceof Anthropic.APIError) throw new TutorError(err.message, spent);
        throw err;
      }
      spent += costUsd(response.model || CHAT_MODEL, response.usage);
      if (response.stop_reason === "refusal") throw new TutorError("the model declined to answer this message", spent);
      if (response.parsed_output != null) return { value: response.parsed_output, costUsd: spent };
      if (attempt === 2) throw new TutorError(`the model's answer was incomplete (stop_reason=${response.stop_reason})`, spent);
    }
  }

  return {
    open: (context) => ask(PartnerLine, context, START),
    respond: (context, message) => ask(TutorTurn, context, message),
  };
}
