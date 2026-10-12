import { describe, expect, it } from "vitest";
import { costUsd } from "./budget";

describe("costUsd", () => {
  it("prices input and output tokens at the model's list price", () => {
    // Sonnet 4.6: $3 / $15 per million.
    expect(costUsd("claude-sonnet-4-6", { input_tokens: 6000, output_tokens: 400 })).toBeCloseTo(0.018 + 0.006);
  });

  it("prices cache writes at 1.25x and cache reads at 0.1x the input price", () => {
    const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000 };
    expect(costUsd("claude-sonnet-4-6", usage)).toBeCloseTo(3 * 1.25 + 3 * 0.1);
  });

  it("assumes Opus-tier prices for an unknown model, so a budget is never undercounted", () => {
    expect(costUsd("some-new-model", { input_tokens: 1_000_000, output_tokens: 0 })).toBe(5);
  });
});
