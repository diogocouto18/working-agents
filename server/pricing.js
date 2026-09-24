// USD per 1M tokens. Cached as of the Claude API skill's pricing table
// (2026-06-24) — Anthropic first-party rates. Cache read/write multipliers
// (0.1x / 1.25x of input) are the general Anthropic convention for 5-minute
// ephemeral cache blocks, applied here as an estimate, not billed fact.
const RATES = {
  'claude-sonnet-5': { input: 2.0, output: 10.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-5': { input: 5.0, output: 25.0 },
  'claude-opus-4-8': { input: 5.0, output: 25.0 },
  'claude-opus-4-7': { input: 5.0, output: 25.0 },
  'claude-opus-4-6': { input: 5.0, output: 25.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-fable-5': { input: 10.0, output: 50.0 },
  'claude-fable-5-1': { input: 10.0, output: 50.0 },
};
const DEFAULT_RATE = RATES['claude-sonnet-5'];

export function estimateCostUsd(model, usage) {
  const rate = RATES[model] ?? DEFAULT_RATE;
  const inputCost = (usage.inputTokens / 1e6) * rate.input;
  const outputCost = (usage.outputTokens / 1e6) * rate.output;
  const cacheReadCost = (usage.cacheReadTokens / 1e6) * (rate.input * 0.1);
  const cacheWriteCost = (usage.cacheCreationTokens / 1e6) * (rate.input * 1.25);
  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}
