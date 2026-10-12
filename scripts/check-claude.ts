// Checks that the configured Claude key works, with one tiny structured request.
// Run in this folder: npx tsx --env-file=.env.local scripts/check-claude.ts
import { z } from "zod";
import { generateJson, CONTENT_MODEL } from "../src/lib/server/claude";
import { USING_PARLEY } from "../src/lib/server/anthropic-client";

const Word = z.object({ pt: z.string(), english: z.string() });

console.log(`Calling ${USING_PARLEY ? "Parley" : "Anthropic"} with ${CONTENT_MODEL}…`);
const word = await generateJson(Word, "You are a Brazilian Portuguese teacher.", "Give one common A1 noun.", 500, "low");
console.log("OK:", word);
