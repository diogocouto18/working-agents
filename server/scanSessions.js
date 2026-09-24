// Finds Claude Code session files worth showing in the office: only ones
// touched recently, so we don't parse years of history on every scan.

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseSession } from './sessionParser.js';
import { liveStatusFor } from './hookState.js';

// Overridable so a demo/screenshot run can point at a scratch directory of
// synthetic sessions instead of touching the user's real Claude Code data.
const PROJECTS_DIR = process.env.WORKING_AGENTS_PROJECTS_DIR ?? join(homedir(), '.claude', 'projects');
const RELEVANT_MS = 30 * 60_000; // only show sessions touched in the last 30 min

async function findJsonlFiles() {
  const files = [];
  let projectDirs;
  try {
    projectDirs = await readdir(PROJECTS_DIR, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const dirent of projectDirs) {
    if (!dirent.isDirectory()) continue;
    const dirPath = join(PROJECTS_DIR, dirent.name);
    let entries;
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      const filePath = join(dirPath, entry.name);
      try {
        const stats = await stat(filePath);
        if (Date.now() - stats.mtimeMs < RELEVANT_MS) {
          files.push(filePath);
        }
      } catch {
        // file disappeared between readdir and stat — skip
      }
    }
  }
  return files;
}

export async function scanActiveSessions() {
  const files = await findJsonlFiles();
  const results = await Promise.all(
    files.map(async (f) => {
      try {
        return await parseSession(f);
      } catch {
        return null;
      }
    }),
  );
  return results.filter(Boolean).map((session) => {
    // real hook events, when fresh, override the JSONL-timestamp heuristic
    const live = liveStatusFor(session.id);
    return live ? { ...session, status: live, statusSource: 'hook' } : { ...session, statusSource: 'heuristic' };
  });
}

export { PROJECTS_DIR };
