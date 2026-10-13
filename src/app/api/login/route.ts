import { getDb } from "@/lib/server/db";
import { loginHandler } from "@/lib/server/login-handler";

export const POST = loginHandler({
  getDb,
  passcodeHash: process.env.APP_PASSCODE_HASH,
  ownerPasscodeHash: process.env.OWNER_PASSCODE_HASH,
  sessionSecret: process.env.SESSION_SECRET,
  secureCookie: process.env.NODE_ENV === "production",
  now: () => new Date(),
});
