// Who sent a request (server only): reads the session cookie with SESSION_SECRET.
import { identify, type Identity } from "./auth";

export function requestIdentity(request: Request): Identity | null {
  return identify(request, process.env.SESSION_SECRET, new Date());
}

/** A 403 for features only the owner has; null when the request may go ahead. */
export function ownerOnly(identity: Identity | null, what: string): Response | null {
  if (!identity) return Response.json({ error: "Not signed in" }, { status: 401 });
  return identity.role === "owner" ? null : Response.json({ error: `${what} is only available to the owner.` }, { status: 403 });
}
