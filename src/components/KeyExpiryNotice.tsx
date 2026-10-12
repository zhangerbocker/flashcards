"use client";

import { useState } from "react";
import { keyExpiryNotice } from "@/lib/key-expiry";
import { localDay } from "@/lib/progress-store";

/** The expiry date is public config (not a secret); the key itself never reaches the browser. */
const EXPIRES_ON = process.env.NEXT_PUBLIC_API_KEY_EXPIRES;

function formatDay(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** Shown each time the app opens from a week before the Anthropic API key expires. */
export function KeyExpiryNotice() {
  const [dismissed, setDismissed] = useState(false);
  const notice = keyExpiryNotice(EXPIRES_ON, localDay(new Date()));
  if (!notice || dismissed) return null;
  const expired = notice.kind === "expired";
  const when = expired
    ? `expired on ${formatDay(notice.expiresOn)}`
    : notice.daysLeft === 0
      ? "expires today"
      : `expires on ${formatDay(notice.expiresOn)} (in ${notice.daysLeft} day${notice.daysLeft === 1 ? "" : "s"})`;
  return (
    <div
      role="alert"
      className={`mb-3 flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${
        expired ? "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
      }`}
    >
      <p>
        <b>Your Anthropic API key {when}.</b> {expired ? "Chat and new stories won't work" : "After that, chat and new stories stop working"}{" "}
        until you create a new key and update PARLEY_API_KEY (and NEXT_PUBLIC_API_KEY_EXPIRES) in Vercel.
      </p>
      <button type="button" aria-label="Dismiss" onClick={() => setDismissed(true)} className="shrink-0 text-lg leading-none opacity-60">
        ×
      </button>
    </div>
  );
}
