import { z } from "zod";
import type { KeyValueStorage } from "./progress-store";
import { parseStories, type Story } from "./story";

/**
 * Changes made in the browser, sent to the server to keep devices in sync. Every op is an
 * idempotent upsert keyed by id, so a batch can be resent after a failure without harm.
 */

const iso = z.string().datetime({ offset: true });

export const ItemScheduleSchema = z.object({
  due: iso,
  state: z.enum(["new", "learning", "review"]),
  reps: z.number().int().min(0),
  streak: z.number().int().min(0),
  last_review: iso.optional(),
  introducedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const ReviewEntrySchema = z.object({ key: z.string().max(100), rating: z.number().int().min(1).max(2), at: iso });

export const MistakeSchema = z.object({
  id: z.string().max(100),
  wrong: z.string().max(1000),
  right: z.string().max(1000),
  en: z.string().max(1000).optional(),
  reason: z.string().max(2000),
  createdAt: z.string().max(40),
});

export const SettingsSchema = z.object({
  autoplayAudio: z.boolean(),
  typeAnswers: z.boolean(),
});

const StorySchema = z.custom<Story>((value) => {
  try {
    parseStories([value]);
    return true;
  } catch {
    return false;
  }
}, "malformed story");

export const SyncOp = z.discriminatedUnion("type", [
  z.object({ type: z.literal("item"), key: z.string().regex(/^[wgvm]:[\w-]+$/), schedule: ItemScheduleSchema }),
  z.object({ type: z.literal("review"), entry: ReviewEntrySchema }),
  z.object({ type: z.literal("mistake"), mistake: MistakeSchema }),
  z.object({ type: z.literal("settings"), settings: SettingsSchema }),
  z.object({ type: z.literal("story"), story: StorySchema }),
  z.object({ type: z.literal("read"), id: z.string().max(200) }),
]);
export type SyncOp = z.infer<typeof SyncOp>;

/** Most ops one request may carry; the client sends larger outboxes in several batches. */
export const MAX_OPS_PER_REQUEST = 500;

export const SyncState = z.object({
  items: z.record(z.string(), ItemScheduleSchema),
  reviews: z.array(ReviewEntrySchema),
  mistakes: z.array(MistakeSchema),
  settings: SettingsSchema.nullable(),
  stories: z.array(StorySchema),
  readIds: z.array(z.string()),
});
export type SyncState = z.infer<typeof SyncState>;

const OUTBOX_KEY = "pt.outbox.v1";
/** Fired on window when an op is queued, so the sync client can send it promptly. */
export const OUTBOX_EVENT = "pt:outbox";

export function pendingOps(storage: KeyValueStorage): SyncOp[] {
  const raw = storage.getItem(OUTBOX_KEY);
  if (raw === null) return [];
  try {
    const parsed = z.array(SyncOp).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    return [];
  }
}

/** Queues an op; a newer write to the same item or to settings replaces the queued one. */
export function enqueue(storage: KeyValueStorage, op: SyncOp): void {
  const supersedes = (queued: SyncOp) =>
    (op.type === "item" && queued.type === "item" && queued.key === op.key) ||
    (op.type === "settings" && queued.type === "settings");
  storage.setItem(OUTBOX_KEY, JSON.stringify([...pendingOps(storage).filter((q) => !supersedes(q)), op]));
  if (typeof globalThis.dispatchEvent === "function") globalThis.dispatchEvent(new Event(OUTBOX_EVENT));
}

/** Removes the first `count` ops once the server has applied them (ops queued meanwhile stay). */
export function dropOps(storage: KeyValueStorage, count: number): void {
  storage.setItem(OUTBOX_KEY, JSON.stringify(pendingOps(storage).slice(count)));
}
