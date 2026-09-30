#!/usr/bin/env node
// Agent hook (Claude Code, Codex CLI, Copilot CLI): records what the agent in this worktree is doing,
// one JSON file per session. Usage: node hook.mjs [--agent claude|codex|copilot|<name>] [--event <name>]
// Never throws or blocks the agent; every failure is swallowed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Copilot CLI also sends camelCase names; both spellings map to the same state.
const STATES = {
  sessionstart: 'idle',
  userpromptsubmit: 'running',
  userpromptsubmitted: 'running',
  pretooluse: 'running',
  posttooluse: 'running', // flips waiting -> running once a permission prompt is answered
  notification: 'waiting',
  permissionrequest: 'waiting',
  stop: 'idle',
  agentstop: 'idle',
};

export const statusDir = () => process.env.JUNGLE_STATUS_DIR || path.join(os.homedir(), '.git-jungle', 'agents');

export function apply(payload, { agent = 'claude', event, dir = statusDir() } = {}) {
  const name = String(event || payload.hook_event_name || '');
  const key = name.toLowerCase();
  const sessionId = payload.session_id ?? payload.sessionId ?? 'unknown';
  const safeAgent = agent.replace(/[^\w-]/g, '_');
  const file = path.join(dir, `${safeAgent}-${String(sessionId).replace(/[^\w-]/g, '_')}.json`);
  if (key === 'sessionend') return fs.rmSync(file, { force: true });
  let state = STATES[key];
  if (!state) return;
  // Claude fires Notification for "waiting for your input" after a finished turn too; that is idle, not blocked.
  if (key === 'notification' && (payload.notification_type === 'idle_prompt' || /waiting for your input/i.test(payload.message ?? ''))) state = 'idle';

  // Files from before per-agent naming would otherwise sit at their last state forever.
  fs.rmSync(path.join(dir, `${String(sessionId).replace(/[^\w-]/g, '_')}.json`), { force: true });

  const cwd = payload.cwd || process.cwd();
  let root = cwd;
  try {
    root = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { /* not a git dir: fall back to cwd */ }

  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ agent, sessionId, root, cwd, state, event: name, updatedAt: Date.now() }));
  fs.renameSync(tmp, file);
}

if (process.argv[1]?.endsWith('hook.mjs')) {
  const arg = (flag) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : undefined; };
  let input = '';
  process.stdin.on('data', (c) => (input += c));
  process.stdin.on('end', () => {
    try { apply(JSON.parse(input), { agent: arg('--agent') ?? 'claude', event: arg('--event') }); } catch { /* ignore */ }
    process.exit(0);
  });
}
