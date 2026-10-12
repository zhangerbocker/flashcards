import { z } from "zod";
import { PartnerLine, TutorTurn, type ChatRequest } from "@/lib/chat";
import { GuestBudget } from "@/lib/me";

/** Thinking plus a retry can take a while; past this the learner gets a retry button. */
const TIMEOUT_MS = 60_000;

const Budget = { budget: GuestBudget.nullable() };
const OpenResponse = z.object({ partner: PartnerLine, ...Budget });
const TurnResponse = TutorTurn.extend(Budget);
const ErrorResponse = z.object({ error: z.string(), budget: GuestBudget.nullable().optional() });

/** A guest is out of chat budget; carries the budget so the screen can explain. */
export class BudgetError extends Error {
  constructor(message: string, readonly budget: GuestBudget) {
    super(message);
  }
}

async function post<T extends z.ZodType>(body: ChatRequest, schema: T): Promise<z.infer<T>> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") throw new Error("The tutor took too long to answer.");
    if (err instanceof TypeError) throw new Error("Couldn't reach the tutor. Check your connection.");
    throw err;
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ErrorResponse.safeParse(json);
    if (res.status === 402 && parsed.success && parsed.data.budget) throw new BudgetError(parsed.data.error, parsed.data.budget);
    throw new Error(parsed.success ? parsed.data.error : `The tutor failed (HTTP ${res.status}).`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error("The tutor sent an answer the app couldn't read.");
  return parsed.data;
}

export const openChat = (body: ChatRequest) => post(body, OpenResponse);
export const sendMessage = (body: ChatRequest) => post(body, TurnResponse);
