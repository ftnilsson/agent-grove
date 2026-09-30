#!/usr/bin/env node
// Claude Code hook: records what the agent in this worktree is doing, one JSON file per session.
// Never throws or blocks the agent; every failure is swallowed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const STATES = {
  SessionStart: 'idle',
  UserPromptSubmit: 'running',
  PostToolUse: 'running', // flips waiting -> running once a permission prompt is answered
  Notification: 'waiting',
  Stop: 'idle',
};

export const statusDir = () => process.env.JUNGLE_STATUS_DIR || path.join(os.homedir(), '.git-jungle', 'agents');

export function apply(event, dir = statusDir()) {
  const id = String(event.session_id || 'unknown').replace(/[^\w-]/g, '_');
  const file = path.join(dir, `${id}.json`);
  if (event.hook_event_name === 'SessionEnd') return fs.rmSync(file, { force: true });
  const state = STATES[event.hook_event_name];
  if (!state) return;

  let root = event.cwd;
  try {
    root = execFileSync('git', ['-C', event.cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { /* not a git dir: fall back to cwd */ }

  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ sessionId: event.session_id, root, cwd: event.cwd, state, event: event.hook_event_name, updatedAt: Date.now() }));
  fs.renameSync(tmp, file);
}

if (import.meta.url === new URL(process.argv[1], 'file:///').href || process.argv[1]?.endsWith('hook.mjs')) {
  let input = '';
  process.stdin.on('data', (c) => (input += c));
  process.stdin.on('end', () => {
    try { apply(JSON.parse(input)); } catch { /* ignore */ }
    process.exit(0);
  });
}
