import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as g from './git.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const RECENTS = path.join(os.homedir(), '.git-jungle.json');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

async function loadRecents() {
  try { return JSON.parse(await fs.readFile(RECENTS, 'utf8')).recents ?? []; } catch { return []; }
}
async function pushRecent(repo) {
  const list = [repo, ...(await loadRecents()).filter((r) => r !== repo)].slice(0, 12);
  try { await fs.writeFile(RECENTS, JSON.stringify({ recents: list }, null, 2)); } catch { /* best effort */ }
  return list;
}

const routes = {
  'GET /api/recents': async () => ({ recents: await loadRecents() }),
  'POST /api/open': async ({ dir }) => {
    const repo = await g.resolveRepo(dir);
    return { repo, recents: await pushRecent(repo) };
  },
  'POST /api/overview': ({ repo }) => g.repoOverview(repo),
  'POST /api/branches': ({ repo }) => g.listBranches(repo),
  'POST /api/add': async ({ repo, ...a }) => { await g.addWorktree(repo, a); return {}; },
  'POST /api/remove': async ({ repo, ...a }) => { await g.removeWorktree(repo, a); return {}; },
  'POST /api/lock': async ({ repo, ...a }) => { await g.lockWorktree(repo, a); return {}; },
  'POST /api/unlock': async ({ repo, ...a }) => { await g.unlockWorktree(repo, a); return {}; },
  'POST /api/move': async ({ repo, ...a }) => { await g.moveWorktree(repo, a); return {}; },
  'POST /api/prune': async ({ repo }) => { await g.pruneWorktrees(repo); return {}; },
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

export function createServer({ port }) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);

  return http.createServer(async (req, res) => {
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    // Blocks DNS-rebinding; the custom header below forces a CORS preflight (which we never grant) against CSRF.
    if (!allowedHosts.has(req.headers.host)) return send(403, { error: 'Forbidden host' });

    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const handler = routes[`${req.method} ${url.pathname}`];
      if (!handler) return send(404, { error: 'Not found' });
      if (req.headers['x-git-jungle'] !== '1') return send(403, { error: 'Missing header' });
      try {
        send(200, await handler(await readBody(req)));
      } catch (e) {
        send(e instanceof g.GitError ? 400 : 500, { error: e.message });
      }
      return;
    }

    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const full = path.join(PUBLIC, file);
    if (!full.startsWith(PUBLIC + path.sep)) return send(403, { error: 'Forbidden' });
    try {
      send(200, await fs.readFile(full), TYPES[path.extname(full)] ?? 'application/octet-stream');
    } catch {
      send(404, { error: 'Not found' });
    }
  });
}
