/**
 * Turns measured token counts into a cost, using Google's published paid-tier
 * prices. Prices were read from https://ai.google.dev/gemini-api/docs/pricing
 * on 25 Nov 2026 (standard, text input). Thinking tokens are billed as output.
 * A model without a listed price returns null instead of a guess.
 */
import type { TokenUsage } from "./run.ts";

export const PRICES_CHECKED_ON = "2026-11-25";

/** USD per 1 million tokens. */
export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
};

export function costUsd(model: string, usage: TokenUsage): number | null {
  const price = MODEL_PRICES[model];
  if (!price) return null;
  const output = usage.outputTokens + usage.thinkingTokens;
  return (usage.inputTokens * price.input + output * price.output) / 1_000_000;
}
