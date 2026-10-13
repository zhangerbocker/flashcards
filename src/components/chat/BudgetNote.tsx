import { dollars, type Me } from "@/lib/me";

/**
 * For guests: how much chat budget is left and why there is one, so a refused message makes
 * sense. Nothing for the owner (no limit) or before it's known.
 */
export function BudgetNote({ me, compact = false }: { me: Me | null; compact?: boolean }) {
  const budget = me?.role === "guest" ? me.budget : null;
  if (!budget) return null;
  const left = Math.min(budget.remainingUsd, budget.poolRemainingUsd);
  const out = !budget.allowed;
  return (
    <div
      role={out ? "alert" : undefined}
      className={`rounded-2xl border px-4 py-3 text-sm ${
        out
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          : "border-stone-200 bg-white text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
      }`}
    >
      {out ? (
        <p>
          {budget.reason === "pool-limit"
            ? "Chat is paused for guests: the shared guest budget has been used up."
            : `You've used your ${dollars(budget.limitUsd)} guest chat budget, so chat is off for this login.`}{" "}
          Flashcards and reading still work. (The owner can switch passcodes in Cards → settings.)
        </p>
      ) : (
        <p>
          <b className="text-stone-900 dark:text-stone-100">{dollars(left)}</b> of {dollars(budget.limitUsd)} guest chat budget left.
          {!compact && " Chat uses a paid AI service, so each guest gets a small budget: about one short conversation."}
        </p>
      )}
    </div>
  );
}
