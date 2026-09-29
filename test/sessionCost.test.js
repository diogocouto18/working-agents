import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSession } from '../server/sessionParser.js';

function sessionWithModel(model) {
  const file = join(mkdtempSync(join(tmpdir(), 'wa-cost-')), 's.jsonl');
  const entry = {
    type: 'assistant',
    timestamp: new Date().toISOString(),
    message: { role: 'assistant', model, content: [{ type: 'text', text: 'hi' }], usage: { input_tokens: 1000, output_tokens: 1000 } },
  };
  writeFileSync(file, JSON.stringify(entry) + '\n');
  return file;
}

test('known model: cost is not flagged as estimated', async () => {
  const s = await parseSession(sessionWithModel('claude-sonnet-5'));
  assert.equal(s.costIsEstimated, false);
  assert.ok(s.estimatedCostUsd > 0);
});

test('unknown model: cost is flagged as estimated', async () => {
  const s = await parseSession(sessionWithModel('claude-unknown-model-x'));
  assert.equal(s.costIsEstimated, true);
  assert.ok(s.estimatedCostUsd > 0);
});
