import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hook = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'agent-status', 'hook.mjs');

test('hook tracks running -> waiting -> idle -> removed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jungle-status-'));
  const send = (hook_event_name) => spawnSync('node', [hook], {
    input: JSON.stringify({ session_id: 's1', cwd: process.cwd(), hook_event_name }),
    env: { ...process.env, JUNGLE_STATUS_DIR: dir },
  });
  const read = () => JSON.parse(fs.readFileSync(path.join(dir, 's1.json'), 'utf8'));

  assert.equal(send('UserPromptSubmit').status, 0);
  assert.equal(read().state, 'running');
  send('Notification');
  assert.equal(read().state, 'waiting');
  send('PostToolUse');
  assert.equal(read().state, 'running');
  send('Stop');
  assert.equal(read().state, 'idle');
  assert.ok(path.isAbsolute(read().root));
  send('SessionEnd');
  assert.equal(fs.existsSync(path.join(dir, 's1.json')), false);
  assert.equal(spawnSync('node', [hook], { input: 'not json' }).status, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
