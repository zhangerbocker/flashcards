import { connection } from "next/server";
import { budgetFor } from "@/lib/server/budget";
import { getDb } from "@/lib/server/db";
import { requestIdentity } from "@/lib/server/request-identity";

/** Who is signed in: { role, budget } (budget is null for the owner, who has no limit). */
export async function GET(request: Request) {
  await connection();
  const identity = requestIdentity(request);
  if (!identity) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json({ role: identity.role, budget: await budgetFor(await getDb(), identity) });
}
