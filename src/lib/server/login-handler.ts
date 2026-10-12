import { z } from "zod";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS, verifyPasscode } from "./auth";
import type { Db } from "./db";
import { failedLoginsSince, recordFailedLogin } from "./store";

export interface LoginConfig {
  getDb: () => Promise<Db>;
  passcodeHash: string | undefined;
  sessionSecret: string | undefined;
  /** Mark the cookie Secure (HTTPS only); true in production. */
  secureCookie: boolean;
  now: () => Date;
}

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60_000;
const LoginBody = z.object({ passcode: z.string().min(1).max(200) });

/** POST /api/login: checks the passcode and sets the session cookie. Rate-limited to 10 failures per 15 minutes. */
export function loginHandler(config: LoginConfig) {
  return async function POST(request: Request): Promise<Response> {
    if (!config.passcodeHash || !config.sessionSecret) {
      return Response.json({ error: "Login isn't set up: APP_PASSCODE_HASH and SESSION_SECRET must be set" }, { status: 503 });
    }
    const parsed = LoginBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Enter the passcode" }, { status: 400 });

    const db = await config.getDb();
    const now = config.now();
    if ((await failedLoginsSince(db, new Date(now.getTime() - FAILURE_WINDOW_MS))) >= MAX_FAILURES) {
      return Response.json({ error: "Too many wrong attempts. Try again in 15 minutes." }, { status: 429 });
    }
    if (!verifyPasscode(parsed.data.passcode, config.passcodeHash)) {
      await recordFailedLogin(db, now);
      return Response.json({ error: "Wrong passcode" }, { status: 401 });
    }
    const cookie = [
      `${SESSION_COOKIE}=${createSessionToken(config.sessionSecret, now)}`,
      "Path=/",
      `Max-Age=${SESSION_TTL_MS / 1000}`,
      "HttpOnly",
      "SameSite=Lax",
      ...(config.secureCookie ? ["Secure"] : []),
    ].join("; ");
    return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
  };
}
