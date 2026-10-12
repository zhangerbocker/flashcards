import { getDb } from "@/lib/server/db";
import { syncHandler } from "@/lib/server/sync-handlers";

export const POST = syncHandler(getDb);
