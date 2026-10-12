import { connection } from "next/server";
import { getDb } from "@/lib/server/db";
import { stateHandler } from "@/lib/server/sync-handlers";

const handler = stateHandler(getDb);

export async function GET() {
  // Progress is per request: never prerender this at build time.
  await connection();
  return handler();
}
