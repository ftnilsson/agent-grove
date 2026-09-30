import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as g from '../src/git.js';

const run = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { stdio: 'pipe' }).toString();

test('worktree lifecycle', async () => {
  const tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'jungle-')));
  const repo = path.join(tmp, 'repo');
  await fs.mkdir(repo);
  run(repo, 'init', '-b', 'main');
  run(repo, '-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-m', 'init');

  const wt = path.join(tmp, 'repo-worktrees', 'feat');
  await g.addWorktree(repo, { path: wt, branch: 'feat', newBranch: true, base: 'main' });
  await fs.writeFile(path.join(wt, 'a.txt'), 'x');

  const o = await g.repoOverview(repo);
  assert.equal(o.base, 'main');
  assert.equal(o.worktrees.length, 2);
  const feat = o.worktrees.find((w) => w.branch === 'feat');
  assert.equal(feat.status.untracked, 1);
  assert.deepEqual(feat.vsBase, { ahead: 0, behind: 0 });
  assert.equal(await g.resolveRepo(wt), await g.resolveRepo(repo));

  await g.lockWorktree(repo, { path: wt, reason: 'busy' });
  assert.equal((await g.listWorktrees(repo)).find((w) => w.branch === 'feat').lockReason, 'busy');
  await g.unlockWorktree(repo, { path: wt });

  await assert.rejects(g.removeWorktree(repo, { path: wt }), /untracked|modified|force/i);
  await g.removeWorktree(repo, { path: wt, force: true, deleteBranch: true, branch: 'feat' });
  assert.equal((await g.listWorktrees(repo)).length, 1);
  await fs.rm(tmp, { recursive: true, force: true });
});
