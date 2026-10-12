import { z } from "zod";
import { MAX_OPS_PER_REQUEST, SyncOp } from "../sync-ops";
import type { Db } from "./db";
import { applyOps, loadState } from "./store";

const SyncBody = z.object({ ops: z.array(SyncOp).max(MAX_OPS_PER_REQUEST) });

/** GET /api/state: the learner's progress for a device to load. */
export function stateHandler(getDb: () => Promise<Db>) {
  return async function GET(): Promise<Response> {
    return Response.json(await loadState(await getDb()), { headers: { "Cache-Control": "no-store" } });
  };
}

/** POST /api/sync: applies a batch of ops from a device. Invalid batches are rejected whole, naming the problem. */
export function syncHandler(getDb: () => Promise<Db>) {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "request body must be JSON" }, { status: 400 });
    }
    const parsed = SyncBody.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return Response.json({ error: `${issue.path.join(".") || "body"}: ${issue.message}` }, { status: 400 });
    }
    await applyOps(await getDb(), parsed.data.ops);
    return Response.json({ applied: parsed.data.ops.length });
  };
}
