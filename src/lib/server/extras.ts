// Allowed extra terms for generated stories (server and scripts only: reads data/ from disk).
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Gloss } from "../story";

/** Names and other terms allowed in stories, with the English the reader shows for them. */
export function loadExtras(root = process.cwd()): { extras: Set<string>; extraGlosses: Map<string, Gloss> } {
  const file = JSON.parse(readFileSync(path.join(root, "data/allowed-extras.json"), "utf8")) as {
    grammar: string[];
    properNouns: string[];
    glosses: Record<string, string>;
  };
  const extras = new Set([...file.grammar, ...file.properNouns]);
  // A name glosses as itself unless the file says otherwise (Brasil → Brazil).
  const extraGlosses = new Map([...extras].map((text) => [text, { en: file.glosses[text] ?? text }]));
  return { extras, extraGlosses };
}
