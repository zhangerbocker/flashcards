import { z } from "zod";

/** A guest's chat budget as the server reports it (null for the owner, who has no limit). */
export const GuestBudget = z.object({
  limitUsd: z.number(),
  spentUsd: z.number(),
  remainingUsd: z.number(),
  poolRemainingUsd: z.number(),
  allowed: z.boolean(),
  reason: z.enum(["guest-limit", "pool-limit"]).optional(),
});
export type GuestBudget = z.infer<typeof GuestBudget>;

/** Who is signed in: the owner (unlimited chat, new stories, synced progress) or a guest. */
export const Me = z.object({ role: z.enum(["owner", "guest"]), budget: GuestBudget.nullable() });
export type Me = z.infer<typeof Me>;

/** "$0.18" for a dollar amount. */
export function dollars(usd: number): string {
  return `$${(Math.floor(usd * 100) / 100).toFixed(2)}`;
}
