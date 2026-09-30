import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hook = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'agent-status', 'hook.mjs');

function harness() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jungle-status-'));
  const send = (payload, ...args) => spawnSync('node', [hook, ...args], {
    input: typeof payload === 'string' ? payload : JSON.stringify({ cwd: process.cwd(), ...payload }),
    env: { ...process.env, JUNGLE_STATUS_DIR: dir },
  });
  const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  return { dir, send, read, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('claude (default agent): running -> waiting -> running -> idle -> removed', () => {
  const { dir, send, read, done } = harness();
  const ev = (hook_event_name) => ({ session_id: 's1', hook_event_name });

  assert.equal(send(ev('UserPromptSubmit')).status, 0);
  assert.equal(read('claude-s1.json').state, 'running');
  assert.equal(read('claude-s1.json').agent, 'claude');
  send(ev('Notification'));
  assert.equal(read('claude-s1.json').state, 'waiting');
  send(ev('PostToolUse'));
  assert.equal(read('claude-s1.json').state, 'running');
  send(ev('Stop'));
  assert.equal(read('claude-s1.json').state, 'idle');
  assert.ok(path.isAbsolute(read('claude-s1.json').root));
  send(ev('SessionEnd'));
  assert.equal(fs.existsSync(path.join(dir, 'claude-s1.json')), false);
  assert.equal(send('not json').status, 0);
  done();
});

test('claude idle_prompt notification is idle, a permission notification is waiting', () => {
  const { send, read, done } = harness();
  const ev = (hook_event_name, extra = {}) => ({ session_id: 'n1', hook_event_name, ...extra });

  send(ev('UserPromptSubmit'));
  send(ev('Notification', { notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' }));
  assert.equal(read('claude-n1.json').state, 'waiting');
  send(ev('Stop'));
  send(ev('Notification', { notification_type: 'idle_prompt', message: 'Claude is waiting for your input' }));
  assert.equal(read('claude-n1.json').state, 'idle');
  done();
});

test('codex and copilot are tracked separately, and copilot camelCase events work', () => {
  const { send, read, done } = harness();

  send({ session_id: 'c1', hook_event_name: 'UserPromptSubmit' }, '--agent', 'codex');
  assert.deepEqual([read('codex-c1.json').agent, read('codex-c1.json').state], ['codex', 'running']);

  // Copilot's camelCase payload has sessionId and no event name, so the name comes from --event.
  send({ sessionId: 'p1' }, '--agent', 'copilot', '--event', 'userPromptSubmitted');
  assert.equal(read('copilot-p1.json').state, 'running');
  send({ sessionId: 'p1' }, '--agent', 'copilot', '--event', 'permissionRequest');
  assert.equal(read('copilot-p1.json').state, 'waiting');
  send({ sessionId: 'p1' }, '--agent', 'copilot', '--event', 'agentStop');
  assert.equal(read('copilot-p1.json').state, 'idle');
  done();
});
