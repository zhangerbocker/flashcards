// Shared Claude helper for content generation (offline scripts and server routes only:
// it reads the API key and must never be imported by client components).
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { createClient, PARLEY_MODEL, USING_PARLEY } from "./anthropic-client";

/** Content generation model (chosen in the design spec); Parley uses PARLEY_MODEL instead. */
export const CONTENT_MODEL = USING_PARLEY ? PARLEY_MODEL : "claude-sonnet-5-5";

const client = createClient({ timeout: 5 * 60_000, maxRetries: 2 });

/**
 * Asks Claude for JSON matching `schema` and returns the parsed value.
 * Uses the server-side fallback (not on Parley) so a policy decline is retried
 * on another model inside the same call. Throws naming the stop reason when the output
 * is refused, truncated, or fails schema validation.
 */
export async function generateJson<T extends z.ZodType>(
  schema: T,
  system: string,
  prompt: string,
  maxTokens = 16000,
  effort: "low" | "medium" | "high" = "medium",
): Promise<z.infer<T>> {
  const response = await client.beta.messages.parse({
    model: CONTENT_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
    output_config: { effort, format: betaZodOutputFormat(schema) },
    ...(USING_PARLEY ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
  });
  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined the request (${response.stop_details?.category ?? "no category"})`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(`output truncated at max_tokens=${maxTokens}; raise it or shrink the batch`);
  }
  if (response.parsed_output == null) {
    throw new Error(`response did not match the schema (stop_reason=${response.stop_reason})`);
  }
  return response.parsed_output;
}
