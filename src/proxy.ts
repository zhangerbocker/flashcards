import { NextResponse, type NextRequest } from "next/server";
import { access } from "./lib/server/access";
import { SESSION_COOKIE } from "./lib/server/auth";

/** Requires the passcode session for every page and API route (see access.ts). */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const decision = access(
    pathname,
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET,
    process.env.NODE_ENV === "production",
    new Date(),
  );
  switch (decision) {
    case "allow":
      return NextResponse.next();
    case "login":
      return NextResponse.redirect(new URL("/login", request.url));
    case "unauthorized":
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    case "misconfigured":
      return new NextResponse("Server not configured: SESSION_SECRET is not set.", { status: 503 });
  }
}

export const config = {
  // Static build assets need no check; everything else goes through access().
  matcher: ["/((?!_next/static|_next/image).*)"],
};
