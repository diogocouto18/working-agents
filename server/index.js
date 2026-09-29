import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanActiveSessions, PROJECTS_DIR } from './scanSessions.js';
import { recordHookEvent } from './hookState.js';
import { updateWorld } from './world.js';
import { resolveClientPath } from './staticPath.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = join(__dirname, '..', 'client');
const PORT = process.env.PORT || 4242;
const POLL_MS = 5_000; // catches working -> idle transitions between file writes

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
};

const httpServer = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/hook') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 100_000) req.destroy(); });
    req.on('end', () => {
      try {
        const { event, payload } = JSON.parse(body);
        recordHookEvent(event, payload);
      } catch (err) {
        console.log('[hook] failed to parse body:', err.message);
      }
      res.writeHead(204);
      res.end();
      broadcast();
    });
    return;
  }

  const filePath = resolveClientPath(CLIENT_ROOT, req.url);
  if (!filePath) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  try {
    const body = await readFile(filePath);
    const ext = extname(filePath);
    // This is a dev tool whose own assets (office-bg.png, character
    // sprites) get regenerated during development — a cached stale copy
    // showing after a normal refresh is confusing, so never let the
    // browser cache these without revalidating.
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

const wss = new WebSocketServer({ server: httpServer });

let latestSessions = [];
const MOVEMENT_TICK_MS = 180;

async function broadcast() {
  latestSessions = await scanActiveSessions();
  const positions = updateWorld(latestSessions);
  const payload = JSON.stringify({ type: 'sessions', sessions: latestSessions, positions, at: Date.now() });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
  return latestSessions;
}

function tickMovement() {
  if (latestSessions.length === 0) return;
  const positions = updateWorld(latestSessions);
  const payload = JSON.stringify({ type: 'positions', positions, at: Date.now() });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}
setInterval(tickMovement, MOVEMENT_TICK_MS);

wss.on('connection', async (ws) => {
  const sessions = await scanActiveSessions();
  const positions = updateWorld(sessions);
  ws.send(JSON.stringify({ type: 'sessions', sessions, positions, at: Date.now() }));
});

let debounceTimer = null;
const watcher = chokidar.watch(`${PROJECTS_DIR}/**/*.jsonl`, {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
});
watcher.on('all', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(broadcast, 200);
});

setInterval(broadcast, POLL_MS);

httpServer.listen(PORT, () => {
  console.log(`working-agents server on http://localhost:${PORT}`);
  console.log(`watching ${PROJECTS_DIR}`);
});
