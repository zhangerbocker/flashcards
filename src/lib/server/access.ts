import { isValidSession } from "./auth";

export type Access = "allow" | "login" | "unauthorized" | "misconfigured";

/** Paths anyone may load: the login screen and what the browser fetches to install the app. */
const PUBLIC = [/^\/login$/, /^\/api\/login$/, /^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/(icon|apple-icon)[\w.-]*$/, /^\/favicon\.ico$/];

/**
 * Who may see a path. Everything but PUBLIC needs a valid session. Without a session
 * secret, development runs open (convenient locally) but production refuses everything
 * rather than serving the app, and spending the API key, without a login.
 */
export function access(pathname: string, sessionToken: string | undefined, sessionSecret: string | undefined, production: boolean, now: Date): Access {
  if (PUBLIC.some((re) => re.test(pathname))) return "allow";
  if (!sessionSecret) return production ? "misconfigured" : "allow";
  if (isValidSession(sessionToken, sessionSecret, now)) return "allow";
  return pathname.startsWith("/api/") ? "unauthorized" : "login";
}
