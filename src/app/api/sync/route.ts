import { getDb } from "@/lib/server/db";
import { ownerOnly, requestIdentity } from "@/lib/server/request-identity";
import { syncHandler } from "@/lib/server/sync-handlers";

const handler = syncHandler(getDb);

/** The synced progress is the owner's; guests keep theirs on their device. */
export async function POST(request: Request) {
  return ownerOnly(requestIdentity(request), "Syncing progress") ?? handler(request);
}
