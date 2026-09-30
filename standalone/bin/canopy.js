#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createServer } from '../src/server.js';
import { resolveRepo } from '../src/git.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: git-jungle [repo-path] [--port 4173] [--no-open]');
  process.exit(0);
}
const port = Number(opt('--port', 4173));
const positional = args.filter((a, i) => !a.startsWith('--') && !['--port'].includes(args[i - 1]));
let repo = null;
try { repo = await resolveRepo(path.resolve(positional[0] ?? process.cwd())); } catch { /* start with the repo picker */ }

const server = createServer({ port });
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is in use (try --port)` : e.message); process.exit(1); });
server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}/${repo ? `#repo=${encodeURIComponent(repo)}` : ''}`;
  console.log(`git-jungle running at ${url}`);
  if (!args.includes('--no-open')) {
    const [cmd, cmdArgs] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url.replace(/&/g, '^&')]]
      : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  }
});
