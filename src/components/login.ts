"use client";

/** The result of trying a passcode: the role it logged in as, or a message to show. */
export type LoginResult = { ok: true; role: "owner" | "guest" } | { ok: false; error: string };

/** Logs in with a passcode; the server sets the session cookie (replacing any earlier one). */
export async function logIn(passcode: string): Promise<LoginResult> {
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    const body = (await res.json().catch(() => ({}))) as { role?: "owner" | "guest"; error?: string };
    if (res.ok) return { ok: true, role: body.role ?? "guest" };
    return { ok: false, error: body.error ?? `Login failed (HTTP ${res.status})` };
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
    return { ok: false, error: "Couldn't reach the server. Check your connection." };
  }
}

/**
 * Forgets this device's study data (progress, mistakes, chat, sessions, sync state) but not the
 * theme, so after switching between owner and guest the device starts from the new login's data:
 * the owner's synced progress, or a guest's fresh start. The owner's progress is safe on the server.
 */
export function forgetLocalStudyData(storage: Storage): void {
  for (const key of Object.keys(storage)) if (key.startsWith("pt.") && key !== "pt.theme.v1") storage.removeItem(key);
}
