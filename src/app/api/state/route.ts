import { connection } from "next/server";
import { getDb } from "@/lib/server/db";
import { ownerOnly, requestIdentity } from "@/lib/server/request-identity";
import { stateHandler } from "@/lib/server/sync-handlers";

const handler = stateHandler(getDb);

export async function GET(request: Request) {
  // Progress is per request: never prerender this at build time.
  await connection();
  // The synced progress is the owner's; guests keep theirs on their device.
  return ownerOnly(requestIdentity(request), "Syncing progress") ?? handler();
}
