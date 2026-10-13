// Guest chat budgets (server only). Each guest login may spend GUEST_LIMIT_USD on chat, and all
// guests together GUEST_POOL_USD; the owner is unlimited. Spend is priced from each response's
// token usage at Anthropic's list prices (a proxy such as Parley may bill differently).
import type { Db } from "./db";
import type { Identity } from "./auth";

export const GUEST_LIMIT_USD = positive(process.env.GUEST_LIMIT_USD, 0.25);
export const GUEST_POOL_USD = positive(process.env.GUEST_POOL_USD, 5);

function positive(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** List price in USD per million input / output tokens. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-5-5": { input: 4, output: 20 },
};
/** For a model not listed, assume Opus-tier prices so a guest budget is never undercounted. */
const UNKNOWN_MODEL = { input: 5, output: 25 };

/** The token counts a response reports. */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** What a response cost: cache writes at 1.25× and cache reads at 0.1× the input price. */
export function costUsd(model: string, usage: Usage): number {
  const price = PRICES[model] ?? UNKNOWN_MODEL;
  const inputTokens =
    usage.input_tokens + 1.25 * (usage.cache_creation_input_tokens ?? 0) + 0.1 * (usage.cache_read_input_tokens ?? 0);
  return (inputTokens * price.input + usage.output_tokens * price.output) / 1_000_000;
}

/** Where a learner stands; the owner's budget is null (unlimited). */
export interface GuestBudget {
  limitUsd: number;
  spentUsd: number;
  remainingUsd: number;
  /** What all guests together may still spend. */
  poolRemainingUsd: number;
  /** Whether another chat message is allowed. */
  allowed: boolean;
  /** Why not, when not allowed. */
  reason?: "guest-limit" | "pool-limit";
}

export async function guestBudget(db: Db, guestId: string): Promise<GuestBudget> {
  const [mine] = await db.query<{ spent_usd: number }>(`SELECT spent_usd FROM guest_spend WHERE guest_id = $1`, [guestId]);
  const [all] = await db.query<{ total: number | null }>(`SELECT SUM(spent_usd) AS total FROM guest_spend`);
  const spentUsd = Number(mine?.spent_usd ?? 0);
  const poolSpent = Number(all?.total ?? 0);
  const remainingUsd = Math.max(0, GUEST_LIMIT_USD - spentUsd);
  const poolRemainingUsd = Math.max(0, GUEST_POOL_USD - poolSpent);
  const reason = remainingUsd <= 0 ? "guest-limit" : poolRemainingUsd <= 0 ? "pool-limit" : undefined;
  return { limitUsd: GUEST_LIMIT_USD, spentUsd, remainingUsd, poolRemainingUsd, allowed: reason === undefined, ...(reason ? { reason } : {}) };
}

/** Adds what a guest just spent. */
export async function recordGuestSpend(db: Db, guestId: string, usd: number, now: Date): Promise<void> {
  if (!(usd > 0)) return;
  await db.query(
    `INSERT INTO guest_spend (guest_id, spent_usd, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (guest_id) DO UPDATE SET spent_usd = guest_spend.spent_usd + EXCLUDED.spent_usd, updated_at = EXCLUDED.updated_at`,
    [guestId, usd, now.toISOString()],
  );
}

/** The budget to report to a learner: null for the owner. */
export async function budgetFor(db: Db, identity: Identity): Promise<GuestBudget | null> {
  return identity.role === "owner" ? null : guestBudget(db, identity.id);
}
