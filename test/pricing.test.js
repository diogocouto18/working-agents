import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BUILTIN_RATES, BUILTIN_DEFAULT_RATE, createPricing, loadPricingOverrides } from '../server/pricing.js';

const USAGE = { inputTokens: 1e6, outputTokens: 1e6, cacheReadTokens: 0, cacheCreationTokens: 0 };

function collector() {
  const messages = [];
  return { messages, warn: (m) => messages.push(m) };
}

test('known model uses its own rate and is not estimated', () => {
  const { warn, messages } = collector();
  const p = createPricing({ warn });
  const { rate, estimated } = p.lookupRate('claude-haiku-4-5');
  assert.deepEqual(rate, BUILTIN_RATES['claude-haiku-4-5']);
  assert.equal(estimated, false);
  assert.equal(messages.length, 0);
});

test('cost adds input, output and cache read/write (0.1x / 1.25x of input)', () => {
  const p = createPricing({ warn() {} });
  const usage = { inputTokens: 1e6, outputTokens: 1e6, cacheReadTokens: 1e6, cacheCreationTokens: 1e6 };
  // haiku: 1 + 5 + 0.1 + 1.25
  assert.ok(Math.abs(p.estimateCost('claude-haiku-4-5', usage).usd - 7.35) < 1e-9);
});

test('unknown model falls back to the default rate and is flagged estimated', () => {
  const p = createPricing({ warn() {} });
  const { usd, estimated } = p.estimateCost('claude-not-a-model', USAGE);
  assert.equal(estimated, true);
  assert.equal(usd, BUILTIN_DEFAULT_RATE.input + BUILTIN_DEFAULT_RATE.output);
});

test('warns exactly once per unknown model', () => {
  const { warn, messages } = collector();
  const p = createPricing({ warn });
  for (let i = 0; i < 3; i++) p.estimateCost('mystery-1', USAGE);
  p.estimateCost('mystery-2', USAGE);
  p.estimateCost('mystery-2', USAGE);
  assert.equal(messages.length, 2);
  assert.match(messages[0], /mystery-1/);
  assert.match(messages[1], /mystery-2/);
});

test('inherited Object properties are not treated as models', () => {
  const p = createPricing({ warn() {} });
  assert.equal(p.lookupRate('constructor').estimated, true);
  assert.equal(p.lookupRate('__proto__').estimated, true);
});

test('overrides add new models and replace built-in rates', () => {
  const p = createPricing({
    overrides: { 'new-model': { input: 4, output: 20 }, 'claude-haiku-4-5': { input: 2, output: 8 } },
    warn() {},
  });
  assert.deepEqual(p.lookupRate('new-model'), { rate: { input: 4, output: 20 }, estimated: false });
  assert.deepEqual(p.lookupRate('claude-haiku-4-5').rate, { input: 2, output: 8 });
});

test('a custom default rate is used for unknown models', () => {
  const p = createPricing({ defaultRate: { input: 7, output: 9 }, warn() {} });
  assert.deepEqual(p.lookupRate('nope'), { rate: { input: 7, output: 9 }, estimated: true });
});

function tmpFile(content) {
  const file = join(mkdtempSync(join(tmpdir(), 'wa-pricing-')), 'pricing.json');
  writeFileSync(file, content);
  return file;
}

test('loadPricingOverrides: missing file is silent', () => {
  const { warn, messages } = collector();
  const out = loadPricingOverrides(join(tmpdir(), 'wa-does-not-exist', 'pricing.json'), warn);
  assert.deepEqual(out, { rates: {}, defaultRate: null });
  assert.equal(messages.length, 0);
});

test('loadPricingOverrides: parses models and default, skips invalid entries with a warning', () => {
  const { warn, messages } = collector();
  const file = tmpFile(
    JSON.stringify({
      default: { input: 3, output: 15 },
      good: { input: 1, output: 2 },
      bad: { input: 'x', output: 2 },
      negative: { input: -1, output: 2 },
    }),
  );
  const out = loadPricingOverrides(file, warn);
  assert.deepEqual(out.defaultRate, { input: 3, output: 15 });
  assert.deepEqual(out.rates, { good: { input: 1, output: 2 } });
  assert.equal(messages.length, 2);
});

test('loadPricingOverrides: malformed JSON or non-object is ignored with a warning', () => {
  for (const content of ['{ nope', '[1,2]', 'null']) {
    const { warn, messages } = collector();
    assert.deepEqual(loadPricingOverrides(tmpFile(content), warn), { rates: {}, defaultRate: null });
    assert.equal(messages.length, 1);
  }
});
