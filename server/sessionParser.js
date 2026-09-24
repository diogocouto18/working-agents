// Parses a Claude Code session .jsonl file (as written under
// ~/.claude/projects/<project>/<session-id>.jsonl) into a summary of what
// that agent is doing right now.
//
// Status heuristic (fallback only — see hookState.js for the precise,
// hook-driven signal that overrides this when available):
//   working — the last conversation entry is within RECENT_MS
//   waiting — the last entry is an assistant tool_use with no matching
//             tool_result yet, and it's been longer than RECENT_MS but
//             less than STALE_MS (still plausibly mid-turn / blocked on
//             a permission prompt, not abandoned)
//   idle    — nothing in the last STALE_MS

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { estimateCostUsd } from './pricing.js';

const RECENT_MS = 12_000;
const STALE_MS = 5 * 60_000;

export async function parseSession(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const lines = raw.split('\n').filter(Boolean);

  let lastTimestamp = null;
  let firstTimestamp = null;
  let lastRole = null;
  let lastContentType = null;
  let pendingToolUse = false;
  let lastToolName = null;
  let isSidechain = false;
  let lastAssistantText = null;
  let cwd = null;
  let model = null;

  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  let toolCallCount = 0;

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    // only 'user' entries reliably carry the session's real project cwd —
    // other entry types (attachment, system, etc.) can carry a cwd pointing
    // at an internal/tool working directory instead. Take the most recent
    // one so the label reflects where the agent is working now (e.g. after
    // `cd`ing into a subproject), not just where the session first launched.
    if (entry.type === 'user' && entry.cwd) cwd = entry.cwd;
    if (entry.type !== 'assistant' && entry.type !== 'user') continue;

    const role = entry.message?.role;
    const content = entry.message?.content;
    if (!role || !content) continue;

    lastRole = role;
    firstTimestamp ??= entry.timestamp;
    lastTimestamp = entry.timestamp ?? lastTimestamp;
    isSidechain = Boolean(entry.isSidechain);

    const msgUsage = entry.message?.usage;
    if (msgUsage) {
      model = entry.message?.model ?? model;
      usage.inputTokens += msgUsage.input_tokens ?? 0;
      usage.outputTokens += msgUsage.output_tokens ?? 0;
      usage.cacheReadTokens += msgUsage.cache_read_input_tokens ?? 0;
      usage.cacheCreationTokens += msgUsage.cache_creation_input_tokens ?? 0;
    }

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_use') {
          pendingToolUse = true;
          lastToolName = block.name ?? lastToolName;
          toolCallCount += 1;
        } else if (block.type === 'tool_result') {
          pendingToolUse = false;
        } else if (block.type === 'text' && role === 'assistant') {
          lastAssistantText = block.text;
        }
      }
      lastContentType = content[content.length - 1]?.type ?? lastContentType;
    } else if (typeof content === 'string') {
      lastContentType = 'text';
    }
  }

  if (!lastTimestamp) {
    return null; // no real conversation turns yet
  }

  const ageMs = Date.now() - new Date(lastTimestamp).getTime();
  let status;
  if (ageMs < RECENT_MS) {
    status = 'working';
  } else if (pendingToolUse && ageMs < STALE_MS) {
    status = 'waiting';
  } else if (ageMs < STALE_MS) {
    status = 'working';
  } else {
    status = 'idle';
  }

  const totalTokens = usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheCreationTokens;

  return {
    id: basename(filePath, '.jsonl'),
    project: cwd ? basename(cwd) : 'unknown',
    cwd,
    isSubagent: isSidechain,
    status,
    lastRole,
    lastContentType,
    lastToolName: pendingToolUse ? lastToolName : null,
    lastAssistantText: lastAssistantText?.slice(0, 200) ?? null,
    lastTimestamp,
    ageMs,
    model,
    totalTokens,
    estimatedCostUsd: model ? estimateCostUsd(model, usage) : null,
    toolCallCount,
    sessionDurationMs: firstTimestamp ? new Date(lastTimestamp) - new Date(firstTimestamp) : 0,
  };
}
