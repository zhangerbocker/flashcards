import type { ReviewEntry } from "./progress-store";

/** Local calendar day as YYYY-MM-DD for an ISO timestamp. */
function dayOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function previousDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Consecutive days with at least one review, ending today, or yesterday if
 * nothing has been reviewed yet today (so the streak isn't shown as broken mid-day).
 */
export function streak(reviews: readonly ReviewEntry[], today: string): number {
  const days = new Set(reviews.map((r) => dayOf(r.at)));
  let day = days.has(today) ? today : previousDay(today);
  let count = 0;
  while (days.has(day)) {
    count++;
    day = previousDay(day);
  }
  return count;
}

export function reviewedOn(reviews: readonly ReviewEntry[], day: string): number {
  return reviews.filter((r) => dayOf(r.at) === day).length;
}
