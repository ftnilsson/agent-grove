import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as g from '../lib/git.js';

const run = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { stdio: 'pipe' }).toString();

test('lists worktrees and resolves any of them to the main repo', async () => {
  const tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'agent-grove-')));
  try {
    const repo = path.join(tmp, 'repo');
    await fs.mkdir(repo);
    run(repo, 'init', '-b', 'main');
    run(repo, '-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-m', 'init');

    const wt = path.join(tmp, 'repo-worktrees', 'feat');
    run(repo, 'worktree', 'add', '-b', 'feat', wt);
    run(repo, 'worktree', 'lock', '--reason', 'busy', wt);

    const list = await g.listWorktrees(repo);
    assert.equal(list.length, 2);
    assert.equal(list[0].main, true);
    assert.equal(list[0].branch, 'main');
    const feat = list.find((w) => w.branch === 'feat');
    assert.deepEqual([feat.locked, feat.lockReason, feat.main], [true, 'busy', false]);

    assert.equal(await g.resolveRepo(wt), await g.resolveRepo(repo));
    await assert.rejects(g.resolveRepo(tmp), /not a git repository/i);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
