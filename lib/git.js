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
    prunableReason: typeof w.prunable === 'string' ? w.prunable : '',
    main: i === 0,
  }));
}

export async function defaultBranch(repo) {
  const sym = await git(repo, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], { allowFail: true });
  if (sym) return sym.trim().replace(/^origin\//, '');
  for (const b of ['main', 'master', 'trunk', 'develop']) {
    if (await git(repo, ['show-ref', '--verify', '--quiet', `refs/heads/${b}`], { allowFail: true }) !== null) return b;
  }
  const cur = await git(repo, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFail: true });
  return cur ? cur.trim() : null;
}

async function status(wt) {
  if (wt.bare || wt.prunable) return { dirty: 0, untracked: 0, upstream: null, ahead: 0, behind: 0 };
  const out = await git(wt.path, ['status', '--porcelain=v2', '--branch'], { allowFail: true });
  if (out === null) return { dirty: 0, untracked: 0, upstream: null, ahead: 0, behind: 0, error: true };
  let dirty = 0, untracked = 0, upstream = null, ahead = 0, behind = 0;
  for (const line of out.split('\n')) {
    if (line.startsWith('# branch.upstream ')) upstream = line.slice(18);
    else if (line.startsWith('# branch.ab ')) {
      const m = /\+(\d+) -(\d+)/.exec(line);
      if (m) { ahead = +m[1]; behind = +m[2]; }
    } else if (line.startsWith('?')) untracked++;
    else if (line[0] === '1' || line[0] === '2' || line[0] === 'u') dirty++;
  }
  return { dirty, untracked, upstream, ahead, behind };
}

async function lastCommit(wt) {
  if (!wt.head || wt.bare) return null;
  const out = await git(wt.path, ['log', '-1', '--format=%h%x00%s%x00%cI%x00%an'], { allowFail: true });
  if (!out) return null;
  const [hash, subject, date, author] = out.trim().split('\0');
  return { hash, subject, date, author };
}

/** Distance of a worktree's HEAD from the default branch: where it forked and how far it has diverged. */
async function divergence(wt, base) {
  if (!base || !wt.head || wt.bare) return null;
  const out = await git(wt.path, ['rev-list', '--left-right', '--count', `${base}...${wt.head}`], { allowFail: true });
  if (!out) return null;
  const [behind, ahead] = out.trim().split(/\s+/).map(Number);
  return { ahead, behind };
}

export async function repoOverview(repo) {
  const base = await defaultBranch(repo);
  const wts = await listWorktrees(repo);
  const enriched = await Promise.all(wts.map(async (w) => ({
    ...w,
    status: await status(w),
    commit: await lastCommit(w),
    vsBase: w.branch === base ? { ahead: 0, behind: 0 } : await divergence(w, base),
  })));
  const baseTip = base ? (await git(repo, ['rev-parse', '--short', base], { allowFail: true }))?.trim() ?? null : null;
  return { repo, name: path.basename(repo), base, baseTip, worktrees: enriched };
}

export async function listBranches(repo) {
  const out = await git(repo, ['for-each-ref', '--format=%(refname:short)%00%(refname)', 'refs/heads', 'refs/remotes']);
  const local = [], remote = [];
  for (const line of out.split('\n').filter(Boolean)) {
    const [short, full] = line.split('\0');
    if (full.startsWith('refs/heads/')) local.push(short);
    else if (!full.endsWith('/HEAD')) remote.push(short);
  }
  return { local, remote };
}

export async function addWorktree(repo, { path: p, branch, newBranch, base }) {
  if (!p) throw new GitError('Path is required');
  const args = ['worktree', 'add'];
  if (newBranch) {
    if (!branch) throw new GitError('Branch name is required');
    args.push('-b', branch, p);
    if (base) args.push(base);
  } else {
    args.push(p);
    if (branch) args.push(branch);
  }
  await git(repo, args);
}

export async function removeWorktree(repo, { path: p, force, deleteBranch, branch }) {
  await git(repo, ['worktree', 'remove', ...(force ? ['--force'] : []), p]);
  if (deleteBranch && branch) await git(repo, ['branch', force ? '-D' : '-d', branch]);
}

export const lockWorktree = (repo, { path: p, reason }) =>
  git(repo, ['worktree', 'lock', ...(reason ? ['--reason', reason] : []), p]);
export const unlockWorktree = (repo, { path: p }) => git(repo, ['worktree', 'unlock', p]);
export const moveWorktree = (repo, { path: p, to }) => git(repo, ['worktree', 'move', p, to]);
export const pruneWorktrees = (repo) => git(repo, ['worktree', 'prune', '-v']);
