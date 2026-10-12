// Prints an APP_PASSCODE_HASH value for the passcode typed on stdin (not an argument, so
// it stays out of shell history). Usage: npx tsx scripts/hash-passcode.ts
import { createInterface } from "node:readline/promises";
import { hashPasscode } from "../src/lib/server/auth";

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const passcode = (await rl.question("Passcode: ")).trim();
  rl.close();
  if (passcode.length < 6) throw new Error(`passcode must be at least 6 characters, got ${passcode.length}`);
  console.log(hashPasscode(passcode));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
