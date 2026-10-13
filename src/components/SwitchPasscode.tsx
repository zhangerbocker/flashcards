"use client";

import { useState } from "react";
import { forgetLocalStudyData, logIn } from "./login";
import { useMe } from "./useMe";

/**
 * Shows who is signed in and lets the learner enter a different passcode (e.g. the owner's after
 * trying the app as a guest) without going back to the login screen.
 */
export function SwitchPasscode() {
  const me = useMe();
  const [passcode, setPasscode] = useState("");
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await logIn(passcode);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    // A different role means different data: start this device from the new login's progress.
    if (result.role !== me?.role) forgetLocalStudyData(window.localStorage);
    window.location.reload();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-2 border-b border-stone-200 pb-3 dark:border-stone-800"
    >
      <span className="block text-sm">
        Signed in as{" "}
        <b>{me ? (me.role === "owner" ? "owner (unlimited chat)" : "guest (limited chat)") : "…"}</b>
      </span>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={shown ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder={me?.role === "owner" ? "Another passcode" : "Owner passcode"}
            aria-label="Passcode to switch to"
            className="w-full rounded-full border border-stone-300 bg-white py-1.5 pl-3 pr-9 text-sm dark:border-stone-700 dark:bg-stone-950"
          />
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide passcode" : "Show passcode"}
            aria-pressed={shown}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
              {shown && <path d="M4 4l16 16" />}
            </svg>
          </button>
        </div>
        <button
          type="submit"
          disabled={busy || !passcode}
          className="shrink-0 rounded-full bg-red-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-40 dark:bg-red-500 dark:hover:bg-red-400"
        >
          {busy ? "Checking…" : "Switch"}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{error}</p>}
      <span className="text-xs text-stone-500">
        Switching between guest and owner reloads the app with that login&apos;s progress (the owner&apos;s is synced, so nothing is lost).
      </span>
    </form>
  );
}
