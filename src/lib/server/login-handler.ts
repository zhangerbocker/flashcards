import { z } from "zod";
import { createSessionToken, newGuestId, SESSION_COOKIE, SESSION_TTL_MS, verifyPasscode, type Identity } from "./auth";
import type { Db } from "./db";
import { failedLoginsSince, recordFailedLogin } from "./store";

export interface LoginConfig {
  getDb: () => Promise<Db>;
  /** Guests' passcode. */
  passcodeHash: string | undefined;
  /** The owner's passcode: unlimited chat, new stories and sync. */
  ownerPasscodeHash?: string | undefined;
  sessionSecret: string | undefined;
  /** Mark the cookie Secure (HTTPS only); true in production. */
  secureCookie: boolean;
  now: () => Date;
}

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60_000;
const LoginBody = z.object({ passcode: z.string().min(1).max(200) });

/**
 * POST /api/login: checks the passcode (the owner's first, then the guests') and sets the session
 * cookie with the matching role. Rate-limited to 10 failures per 15 minutes.
 */
export function loginHandler(config: LoginConfig) {
  return async function POST(request: Request): Promise<Response> {
    if ((!config.passcodeHash && !config.ownerPasscodeHash) || !config.sessionSecret) {
      return Response.json(
        { error: "Login isn't set up: SESSION_SECRET and APP_PASSCODE_HASH (or OWNER_PASSCODE_HASH) must be set" },
        { status: 503 },
      );
    }
    const parsed = LoginBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Enter the passcode" }, { status: 400 });

    // A missing database or a malformed hash is a setup problem: say which, so it can be fixed in
    // the host's settings. The messages name the setting, never a secret.
    let db: Db;
    let identity: Identity | null;
    try {
      db = await config.getDb();
      const passcode = parsed.data.passcode;
      identity =
        config.ownerPasscodeHash && verifyPasscode(passcode, config.ownerPasscodeHash)
          ? { role: "owner", id: "owner" }
          : config.passcodeHash && verifyPasscode(passcode, config.passcodeHash)
            ? { role: "guest", id: newGuestId() }
            : null;
    } catch (err) {
      // Drop any URL, in case a database error quotes the connection string.
      const message = (err instanceof Error ? err.message : String(err)).replace(/\w+:\/\/\S+/g, "<url>");
      console.error(`login setup problem: ${message}`);
      return Response.json({ error: `Server setup problem: ${message}` }, { status: 503 });
    }
    const now = config.now();
    if ((await failedLoginsSince(db, new Date(now.getTime() - FAILURE_WINDOW_MS))) >= MAX_FAILURES) {
      return Response.json({ error: "Too many wrong attempts. Try again in 15 minutes." }, { status: 429 });
    }
    if (!identity) {
      await recordFailedLogin(db, now);
      return Response.json({ error: "Wrong passcode" }, { status: 401 });
    }
    const cookie = [
      `${SESSION_COOKIE}=${createSessionToken(config.sessionSecret, now, identity)}`,
      "Path=/",
      `Max-Age=${SESSION_TTL_MS / 1000}`,
      "HttpOnly",
      "SameSite=Lax",
      ...(config.secureCookie ? ["Secure"] : []),
    ].join("; ");
    return Response.json({ ok: true, role: identity.role }, { headers: { "Set-Cookie": cookie } });
  };
}
