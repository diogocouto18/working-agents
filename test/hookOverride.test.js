import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// scanSessions reads its projects directory at import time.
const projectsDir = mkdtempSync(join(tmpdir(), 'wa-hooks-'));
process.env.WORKING_AGENTS_PROJECTS_DIR = projectsDir;
const { recordHookEvent, liveStatusFor } = await import('../server/hookState.js');
const { scanActiveSessions } = await import('../server/scanSessions.js');

const realNow = Date.now;
let clock;
beforeEach(() => {
  clock = realNow();
  Date.now = () => clock;
});
afterEach(() => {
  Date.now = realNow;
});

test('hook status is used while fresh and expires after 20s', () => {
  recordHookEvent('PermissionRequest', { session_id: 'h1' });
  assert.equal(liveStatusFor('h1'), 'waiting');
  clock += 19_000;
  assert.equal(liveStatusFor('h1'), 'waiting');
  clock += 2_000;
  assert.equal(liveStatusFor('h1'), null);
});

test('event to status mapping', () => {
  const cases = [
    ['SessionStart', {}, 'idle'],
    ['PreToolUse', {}, 'working'],
    ['PostToolUse', {}, 'working'],
    ['SubagentStart', {}, 'working'],
    ['Stop', {}, 'idle'],
    ['Stop', { awaiting_input: true }, 'waiting'],
    ['Notification', { message: 'Claude needs your permission to use Bash' }, 'waiting'],
  ];
  for (const [event, extra, expected] of cases) {
    const id = `map-${event}-${JSON.stringify(extra)}`;
    recordHookEvent(event, { session_id: id, ...extra });
    assert.equal(liveStatusFor(id), expected, `${event} ${JSON.stringify(extra)}`);
  }
  recordHookEvent('Notification', { session_id: 'map-noop', message: 'Task finished' });
  assert.equal(liveStatusFor('map-noop'), null);
});

test('SessionEnd removes the session state', () => {
  recordHookEvent('PreToolUse', { session_id: 'h2' });
  recordHookEvent('SessionEnd', { session_id: 'h2' });
  assert.equal(liveStatusFor('h2'), null);
});

function writeSession(id, lastTurn) {
  mkdirSync(join(projectsDir, 'p'), { recursive: true });
  const ts = new Date(clock - lastTurn).toISOString();
  const lines = [
    { type: 'user', cwd: '/x/p', timestamp: ts, message: { role: 'user', content: 'hi' } },
    { type: 'assistant', timestamp: ts, message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } },
  ];
  writeFileSync(join(projectsDir, 'p', `${id}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

const findSession = async (id) => (await scanActiveSessions()).find((s) => s.id === id);

test('a fresh hook event overrides the heuristic; after 20s the heuristic wins again', async () => {
  // Last turn 60s ago: heuristic says "working". A hook says "waiting".
  writeSession('ov', 60_000);
  assert.deepEqual(
    (({ status, statusSource }) => ({ status, statusSource }))(await findSession('ov')),
    { status: 'working', statusSource: 'heuristic' },
  );

  recordHookEvent('PermissionRequest', { session_id: 'ov' });
  assert.deepEqual(
    (({ status, statusSource }) => ({ status, statusSource }))(await findSession('ov')),
    { status: 'waiting', statusSource: 'hook' },
  );

  clock += 21_000;
  writeSession('ov', 81_000); // same transcript, 21s older
  assert.deepEqual(
    (({ status, statusSource }) => ({ status, statusSource }))(await findSession('ov')),
    { status: 'working', statusSource: 'heuristic' },
  );
});
