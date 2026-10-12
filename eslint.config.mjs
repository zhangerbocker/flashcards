import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Browser code must never reach server modules or the Anthropic SDK: they read the API key.
    files: ["src/components/**", "src/lib/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/server/*", "./server/*", "../server/*", "**/lib/server/*"], message: "Server-only module: it may read secrets." },
            { group: ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*"], message: "Call Claude from a server route, never from browser code." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
