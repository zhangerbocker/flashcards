import type { Mistake } from "../deck";
import type { ReviewEntry, Settings } from "../progress-store";
import type { ItemSchedule } from "../srs";
import type { Story } from "../story";
import type { SyncOp, SyncState } from "../sync-ops";
import type { Db } from "./db";

/** Reviews returned to a device; matches the cap on the browser's review log. */
const MAX_REVIEWS = 5000;

/** Everything a device needs to show the learner's progress. */
export async function loadState(db: Db): Promise<SyncState> {
  const [items, reviews, mistakes, settings, stories, read] = await Promise.all([
    db.query<{ key: string; schedule: ItemSchedule }>("SELECT key, schedule FROM items"),
    db.query<{ card_key: string; rating: number; at: Date | string }>(
      "SELECT card_key, rating, at FROM (SELECT * FROM reviews ORDER BY at DESC LIMIT $1) r ORDER BY at",
      [MAX_REVIEWS],
    ),
    db.query<{ data: Mistake }>("SELECT data FROM mistakes ORDER BY data->>'createdAt', id"),
    db.query<{ data: Settings }>("SELECT data FROM settings WHERE id = 1"),
    db.query<{ data: Story }>("SELECT data FROM stories ORDER BY id"),
    db.query<{ id: string }>("SELECT id FROM read_stories ORDER BY id"),
  ]);
  return {
    items: Object.fromEntries(items.map((r) => [r.key, r.schedule])),
    reviews: reviews.map((r): ReviewEntry => ({ key: r.card_key, rating: r.rating, at: new Date(r.at).toISOString() })),
    mistakes: mistakes.map((r) => r.data),
    settings: settings[0]?.data ?? null,
    stories: stories.map((r) => r.data),
    readIds: read.map((r) => r.id),
  };
}

/**
 * Applies ops from a device. Each is idempotent: item schedules keep whichever version was
 * reviewed last (so an old device can't undo newer progress), reviews and read marks are
 * inserted once, and mistakes, stories and settings are replaced by id.
 */
export async function applyOps(db: Db, ops: readonly SyncOp[]): Promise<void> {
  for (const op of ops) {
    switch (op.type) {
      case "item":
        await db.query(
          `INSERT INTO items (key, schedule, last_review) VALUES ($1, $2, $3)
           ON CONFLICT (key) DO UPDATE SET schedule = excluded.schedule, last_review = excluded.last_review
           WHERE items.last_review IS NULL OR excluded.last_review >= items.last_review`,
          [op.key, JSON.stringify(op.schedule), op.schedule.last_review ?? null],
        );
        break;
      case "review":
        await db.query(
          "INSERT INTO reviews (id, card_key, rating, at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
          [`${op.entry.key}@${op.entry.at}`, op.entry.key, op.entry.rating, op.entry.at],
        );
        break;
      case "mistake":
        await db.query(
          "INSERT INTO mistakes (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = excluded.data",
          [op.mistake.id, JSON.stringify(op.mistake)],
        );
        break;
      case "settings":
        await db.query(
          "INSERT INTO settings (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = excluded.data",
          [JSON.stringify(op.settings)],
        );
        break;
      case "story":
        await db.query(
          "INSERT INTO stories (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = excluded.data",
          [op.story.id, JSON.stringify(op.story)],
        );
        break;
      case "read":
        await db.query("INSERT INTO read_stories (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [op.id]);
        break;
    }
  }
}

export async function recordFailedLogin(db: Db, at: Date): Promise<void> {
  await db.query("INSERT INTO failed_logins (at) VALUES ($1)", [at.toISOString()]);
  // Keep the table small: only the recent window matters.
  await db.query("DELETE FROM failed_logins WHERE at < $1", [new Date(at.getTime() - 24 * 3_600_000).toISOString()]);
}

export async function failedLoginsSince(db: Db, since: Date): Promise<number> {
  const rows = await db.query<{ n: number | string }>("SELECT count(*) AS n FROM failed_logins WHERE at >= $1", [since.toISOString()]);
  return Number(rows[0]?.n ?? 0);
}
