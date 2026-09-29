// USD per 1M tokens. Cached as of the Claude API skill's pricing table
// (2026-06-24) — Anthropic first-party rates. Cache read/write multipliers
// (0.1x / 1.25x of input) are the general Anthropic convention for 5-minute
// ephemeral cache blocks, applied here as an estimate, not billed fact.
//
// Rates can be extended or overridden with an optional pricing.json (see
// pricing.example.json). Models without a known rate are priced with the
// default rate, reported as `estimated: true`, and logged once per model.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUILTIN_RATES = {
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
export const BUILTIN_DEFAULT_RATE = BUILTIN_RATES['claude-sonnet-5'];

const DEFAULT_PRICING_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'pricing.json');

const isRate = (r) =>
  r && typeof r === 'object' && Number.isFinite(r.input) && Number.isFinite(r.output) && r.input >= 0 && r.output >= 0;

// Reads an override file of the form
//   { "default": { "input": 3, "output": 15 }, "<model-id>": { "input": .., "output": .. } }
// A missing file is normal (returns no overrides). An unreadable, malformed or
// partly invalid file is reported through `warn` and the valid parts are kept.
export function loadPricingOverrides(filePath, warn = console.warn) {
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') warn(`[pricing] cannot read ${filePath}: ${err.message}`);
    return { rates: {}, defaultRate: null };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    warn(`[pricing] ${filePath} is not valid JSON, ignoring it: ${err.message}`);
    return { rates: {}, defaultRate: null };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    warn(`[pricing] ${filePath} must be a JSON object, ignoring it`);
    return { rates: {}, defaultRate: null };
  }
  const rates = {};
  let defaultRate = null;
  for (const [key, value] of Object.entries(data)) {
    if (!isRate(value)) {
      warn(`[pricing] ignoring "${key}" in ${filePath}: expected {"input": <number>, "output": <number>}`);
    } else if (key === 'default') {
      defaultRate = { input: value.input, output: value.output };
    } else {
      rates[key] = { input: value.input, output: value.output };
    }
  }
  return { rates, defaultRate };
}

export function createPricing({ overrides = {}, defaultRate, warn = console.warn } = {}) {
  const rates = { ...BUILTIN_RATES, ...overrides };
  const fallback = defaultRate ?? BUILTIN_DEFAULT_RATE;
  const warned = new Set();

  // Returns { rate, estimated }; estimated is true when the default rate was used.
  function lookupRate(model) {
    if (Object.hasOwn(rates, model)) return { rate: rates[model], estimated: false };
    if (model && !warned.has(model)) {
      warned.add(model);
      warn(
        `[pricing] no rate for model "${model}", using the default rate ` +
          `($${fallback.input}/$${fallback.output} per 1M tokens); add it to pricing.json for an accurate cost`,
      );
    }
    return { rate: fallback, estimated: true };
  }

  // Returns { usd, estimated }.
  function estimateCost(model, usage) {
    const { rate, estimated } = lookupRate(model);
    const usd =
      (usage.inputTokens / 1e6) * rate.input +
      (usage.outputTokens / 1e6) * rate.output +
      (usage.cacheReadTokens / 1e6) * (rate.input * 0.1) +
      (usage.cacheCreationTokens / 1e6) * (rate.input * 1.25);
    return { usd, estimated };
  }

  return { lookupRate, estimateCost };
}

const overrides = loadPricingOverrides(resolve(process.env.WORKING_AGENTS_PRICING ?? DEFAULT_PRICING_FILE));
const shared = createPricing({ overrides: overrides.rates, defaultRate: overrides.defaultRate });

export const lookupRate = shared.lookupRate;
export const estimateCost = shared.estimateCost;
export const estimateCostUsd = (model, usage) => shared.estimateCost(model, usage).usd;
