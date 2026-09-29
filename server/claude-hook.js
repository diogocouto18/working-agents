#!/usr/bin/env node
// Called BY Claude Code itself, for every session on this machine, on the
// hook events registered in ~/.claude/settings.json. Forwards the event to
// the working-agents server as telemetry.
//
// Safety contract (do not relax these):
//   - Must never block or slow down the user's real Claude Code session.
//   - Must never write anything to stdout (Claude Code reads stdout as a
//     hook response; silence = "no opinion, continue normally").
//   - Must never throw or exit non-zero — a failure here must be invisible.
//   - Must time out fast if the local server isn't running.

const EVENT = process.argv[2] ?? 'unknown';
const SERVER_URL = process.env.WORKING_AGENTS_URL ?? 'http://127.0.0.1:4242';

async function main() {
  let raw = '';
  try {
    for await (const chunk of process.stdin) raw += chunk;
  } catch {
    // no stdin — still fine, report the bare event
  }

  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = { raw: raw.slice(0, 2000) };
  }

  try {
    await fetch(`${SERVER_URL}/hook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: EVENT, payload, receivedAt: Date.now() }),
      signal: AbortSignal.timeout(400),
    });
  } catch {
    // server not running, or timed out — silently ignore, this must never
    // affect the real Claude Code session
  }
}

main().finally(() => process.exit(0));
