import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { parseSession } from '../server/sessionParser.js';

// Every fixture's last conversation entry is stamped 2026-01-01T12:00:00Z;
// the tests move the clock relative to that instant.
const T0 = Date.parse('2026-01-01T12:00:00.000Z');
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}.jsonl`, import.meta.url));

const realNow = Date.now;
const setAge = (ms) => {
  Date.now = () => T0 + ms;
};
beforeEach(() => setAge(0));
afterEach(() => {
  Date.now = realNow;
});

test('recent activity is working', async () => {
  setAge(5_000);
  const s = await parseSession(fixture('text-reply'));
  assert.equal(s.status, 'working');
  assert.equal(s.ageMs, 5_000);
});

test('a finished reply older than 12s but under 5min still reads as working', async () => {
  setAge(60_000);
  assert.equal((await parseSession(fixture('text-reply'))).status, 'working');
});

test('nothing for 5 minutes is idle', async () => {
  setAge(5 * 60_000);
  assert.equal((await parseSession(fixture('text-reply'))).status, 'idle');
  setAge(60 * 60_000);
  assert.equal((await parseSession(fixture('dangling-tool-use'))).status, 'idle');
});

test('dangling tool_use is working while fresh, waiting once past 12s', async () => {
  setAge(11_000);
  assert.equal((await parseSession(fixture('dangling-tool-use'))).status, 'working');
  setAge(13_000);
  const s = await parseSession(fixture('dangling-tool-use'));
  assert.equal(s.status, 'waiting');
  assert.equal(s.lastToolName, 'Bash');
});

test('a tool_result clears the dangling tool_use', async () => {
  setAge(60_000);
  const s = await parseSession(fixture('resolved-tool-use'));
  assert.equal(s.status, 'working');
  assert.equal(s.lastToolName, null);
  assert.equal(s.toolCallCount, 1);
});

test('extracts project, model, tokens, text and duration', async () => {
  setAge(1_000);
  const s = await parseSession(fixture('text-reply'));
  assert.equal(s.id, 'text-reply');
  assert.equal(s.project, 'proj-a');
  assert.equal(s.model, 'claude-sonnet-5');
  assert.equal(s.totalTokens, 10 + 5 + 200 + 300);
  assert.equal(s.lastAssistantText, 'All done.');
  assert.equal(s.sessionDurationMs, 10_000);
  assert.equal(s.isSubagent, false);
});

test('malformed lines and non-conversation entries are skipped', async () => {
  setAge(1_000);
  const s = await parseSession(fixture('malformed-lines'));
  assert.equal(s.status, 'working');
  assert.equal(s.lastAssistantText, 'All done.');
});

test('a file with no conversation turns yields null', async () => {
  assert.equal(await parseSession(fixture('no-turns')), null);
});

test('sidechain entries are flagged as subagents', async () => {
  assert.equal((await parseSession(fixture('sidechain'))).isSubagent, true);
});
