import { execFile } from 'node:child_process';
import path from 'node:path';

export class GitError extends Error {}

export function git(cwd, args, { allowFail = false } = {}) {
  return new Promise((resolve, reject) => {
    execFile('git', ['-C', cwd, ...args], { maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err && !allowFail) {
        return reject(new GitError((stderr || err.message).trim()));
      }
      resolve(err ? null : stdout);
    });
  });
}

/** Resolve any path inside a repo (or one of its worktrees) to the main worktree root. */
export async function resolveRepo(dir) {
  const common = (await git(dir, ['rev-parse', '--path-format=absolute', '--git-common-dir'])).trim();
  // Bare repo: common dir is the repo itself. Otherwise it is <root>/.git
  return path.basename(common) === '.git' ? path.dirname(common) : common;
}

export async function listWorktrees(repo) {
  const out = await git(repo, ['worktree', 'list', '--porcelain', '-z']);
  const list = [];
  let cur = null;
  for (const field of out.split('\0')) {
    if (field === '') {
      if (cur) list.push(cur);
      cur = null;
      continue;
    }
    const sp = field.indexOf(' ');
    const key = sp < 0 ? field : field.slice(0, sp);
    const val = sp < 0 ? true : field.slice(sp + 1);
    if (key === 'worktree') cur = { path: val };
    else if (cur) cur[key] = val;
  }
  if (cur) list.push(cur);
  return list.map((w, i) => ({
    path: w.path,
    head: w.HEAD ?? null,
    branch: w.branch ? w.branch.replace(/^refs\/heads\//, '') : null,
    detached: !!w.detached,
    bare: !!w.bare,
    locked: w.locked !== undefined,
    lockReason: typeof w.locked === 'string' ? w.locked : '',
    prunable: w.prunable !== undefined,
    main: i === 0,
  }));
}
