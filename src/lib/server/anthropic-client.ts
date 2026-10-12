// Builds the Claude client (server only: reads API keys; never import from client components).
// MIT's Parley gateway speaks the Anthropic Messages API, so the same SDK works with its base URL.
import Anthropic from "@anthropic-ai/sdk";

export const PARLEY_BASE_URL = "https://parley.api.mit.edu";

/** True when requests go through Parley (PARLEY_API_KEY set) rather than Anthropic directly. */
export const USING_PARLEY = Boolean(process.env.PARLEY_API_KEY);

/** Parley serves a fixed set of models; PARLEY_MODEL names one, used for every request. */
export const PARLEY_MODEL = process.env.PARLEY_MODEL || "claude-sonnet-4-6";

export function createClient(options: { timeout: number; maxRetries: number }): Anthropic {
  if (USING_PARLEY) {
    return new Anthropic({ ...options, apiKey: process.env.PARLEY_API_KEY, baseURL: PARLEY_BASE_URL });
  }
  return new Anthropic(options);
}
