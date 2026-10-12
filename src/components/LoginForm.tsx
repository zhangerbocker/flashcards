"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        router.replace("/cards");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Login failed (HTTP ${res.status})`);
    } catch (err) {
      if (!(err instanceof TypeError)) throw err;
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <h1 className="font-han text-center text-4xl text-red-700 dark:text-red-400">学中文</h1>
      <input
        type="password"
        autoComplete="current-password"
        autoFocus
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="Passcode"
        aria-label="Passcode"
        className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-lg dark:border-stone-700 dark:bg-stone-900"
      />
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || !passcode}
        className="rounded-2xl bg-stone-900 py-3 font-medium text-white disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900"
      >
        {busy ? "Checking…" : "Open"}
      </button>
    </form>
  );
}
