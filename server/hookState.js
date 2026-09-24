// In-memory state built from real Claude Code hook events (POSTed by
// claude-hook.js). This is the precise signal — when present and recent
// enough, it overrides the JSONL-timestamp heuristic in sessionParser.js.
//
// The exact payload shape of each hook event isn't something we have
// documented with certainty for every field, so this logs unrecognized
// shapes rather than guessing silently wrong — check server logs and
// refine statusFromHookEvent() against real payloads as they arrive.

const HOOK_FRESH_MS = 20_000; // ignore hook state older than this — fall back to JSONL heuristic

const bySession = new Map(); // sessionId -> { status, event, updatedAt }

function statusFromHookEvent(event, payload) {
  switch (event) {
    case 'SessionStart':
      return 'idle';
    case 'SessionEnd':
      return null; // handled specially — session removed, not just statused
    case 'PreToolUse':
    case 'PostToolUse':
    case 'SubagentStart':
      return 'working';
    case 'PermissionRequest':
      return 'waiting';
    case 'Notification': {
      const type = payload?.notification_type ?? payload?.type ?? '';
      const msg = payload?.message ?? '';
      if (/permission/i.test(type) || /permission/i.test(msg)) return 'waiting';
      return null;
    }
    case 'Stop':
    case 'SubagentStop': {
      const reason = payload?.reason ?? payload?.stop_reason;
      if (reason === 'idle_prompt' || payload?.awaiting_input) return 'waiting';
      return 'idle';
    }
    default:
      return null;
  }
}

export function recordHookEvent(event, payload) {
  const sessionId = payload?.session_id ?? payload?.sessionId;
  if (!sessionId) {
    console.log(`[hook] ${event} — no session_id in payload, ignoring for state:`, JSON.stringify(payload)?.slice(0, 300));
    return;
  }

  if (event === 'SessionEnd') {
    bySession.delete(sessionId);
    return;
  }

  const status = statusFromHookEvent(event, payload);
  if (!status) return;

  bySession.set(sessionId, { status, event, updatedAt: Date.now() });
}

// Returns the live hook-derived status for a session, or null if we have
// none or it's gone stale (server restarted, hooks not installed for that
// session, etc.) — caller should fall back to the JSONL heuristic.
export function liveStatusFor(sessionId) {
  const entry = bySession.get(sessionId);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > HOOK_FRESH_MS) return null;
  return entry.status;
}

export function hookStateSnapshot() {
  return Object.fromEntries(bySession);
}
