const vscode = require('vscode');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STALE_MS = 30 * 60 * 1000; // a "running" file this old is a crashed session, not a busy agent
const PRIORITY = { waiting: 3, running: 2, idle: 1 };
const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));

function statusDir() {
  return process.env.JUNGLE_STATUS_DIR || path.join(os.homedir(), '.git-jungle', 'agents');
}

/** Reads every session file and folds them into one state per worktree root. */
function readAgents() {
  const byRoot = new Map();
  let files = [];
  try { files = fs.readdirSync(statusDir()).filter((f) => f.endsWith('.json')); } catch { return byRoot; }
  for (const f of files) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(statusDir(), f), 'utf8'));
      if (Date.now() - s.updatedAt > STALE_MS && s.state !== 'idle') continue;
      const key = norm(s.root);
      const cur = byRoot.get(key);
      if (!cur) byRoot.set(key, { state: s.state, sessions: 1 });
      else {
        cur.sessions++;
        if (PRIORITY[s.state] > PRIORITY[cur.state]) cur.state = s.state;
      }
    } catch { /* half-written or corrupt file */ }
  }
  return byRoot;
}

async function loadWorktrees(gitApi) {
  const seen = new Map();
  // Workspace folders plus every repository the built-in Git extension found (it scans sub-folders,
  // so opening a parent folder of several worktrees still works).
  const dirs = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
  try {
    const gitExt = vscode.extensions.getExtension('vscode.git');
    const git = (gitExt?.isActive ? gitExt.exports : await gitExt?.activate())?.getAPI(1);
    for (const r of git?.repositories ?? []) dirs.push(r.rootUri.fsPath);
  } catch { /* git extension unavailable */ }
  for (const dir of dirs) {
    try {
      const repo = await gitApi.resolveRepo(dir);
      for (const w of await gitApi.listWorktrees(repo)) seen.set(norm(w.path), w);
    } catch { /* not a repo */ }
  }
  return [...seen.values()];
}

const ICONS = {
  running: () => new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue')),
  waiting: () => new vscode.ThemeIcon('bell-dot', new vscode.ThemeColor('charts.yellow')),
  idle: () => new vscode.ThemeIcon('circle-outline'),
};
const LABEL = { running: 'agent running', waiting: 'needs your input', idle: 'idle' };

async function activate(context) {
  // A literal specifier lets esbuild inline src/git.js into dist/extension.js.
  const gitApi = await import('../src/git.js');

  let worktrees = [];
  let agents = new Map();
  const previous = new Map();
  const changed = new vscode.EventEmitter();

  const tree = vscode.window.createTreeView('gitJungle.worktrees', {
    treeDataProvider: {
      onDidChangeTreeData: changed.event,
      getChildren: () => worktrees,
      getTreeItem(w) {
        const a = agents.get(norm(w.path));
        const item = new vscode.TreeItem(w.branch ?? `detached @ ${w.head?.slice(0, 7)}`);
        item.description = a ? `${LABEL[a.state]}${a.sessions > 1 ? ` (${a.sessions})` : ''}` : '';
        item.iconPath = a ? ICONS[a.state]() : new vscode.ThemeIcon('git-branch');
        item.tooltip = w.path;
        item.contextValue = 'worktree';
        return item;
      },
    },
  });

  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  bar.command = 'gitJungle.showView';

  const findWt = (key) => worktrees.find((w) => norm(w.path) === key);

  function applyAgents() {
    const running = {};
    const waiting = {};
    let nRun = 0;
    let nWait = 0;
    for (const [key, a] of agents) {
      const wt = findWt(key);
      const name = wt?.branch ?? path.basename(key);
      const uri = vscode.Uri.file(wt?.path ?? key).toString();
      if (a.state === 'running') { running[uri] = true; nRun++; }
      if (a.state === 'waiting') { waiting[uri] = true; nWait++; }
      const before = previous.get(key);
      if (before && before !== a.state) {
        if (a.state === 'waiting') vscode.window.showInformationMessage(`${name}: agent needs your input`);
        else if (a.state === 'idle' && before === 'running') vscode.window.showInformationMessage(`${name}: agent finished`);
      }
      previous.set(key, a.state);
    }
    for (const key of [...previous.keys()]) if (!agents.has(key)) previous.delete(key);

    // Inline row actions in the built-in Source Control view match on these maps (see package.json menus).
    vscode.commands.executeCommand('setContext', 'gitJungle.running', running);
    vscode.commands.executeCommand('setContext', 'gitJungle.waiting', waiting);
    if (nRun + nWait === 0) {
      bar.hide();
    } else {
      bar.text = [nRun > 0 && `$(sync~spin) ${nRun} running`, nWait > 0 && `$(bell-dot) ${nWait} waiting`].filter(Boolean).join('  ');
      bar.show();
    }
    changed.fire();
  }

  async function refreshAll() {
    worktrees = await loadWorktrees(gitApi);
    agents = readAgents();
    applyAgents();
  }
  const pollAgents = () => { agents = readAgents(); applyAgents(); };

  fs.mkdirSync(statusDir(), { recursive: true });
  let watcher;
  try { watcher = fs.watch(statusDir(), pollAgents); } catch { /* the interval below still covers it */ }
  const poll = setInterval(pollAgents, 3000);
  const slow = setInterval(refreshAll, 15000);

  const focusView = () => vscode.commands.executeCommand('gitJungle.worktrees.focus');
  context.subscriptions.push(
    tree, bar, changed,
    { dispose: () => { watcher?.close(); clearInterval(poll); clearInterval(slow); } },
    vscode.commands.registerCommand('gitJungle.refresh', refreshAll),
    vscode.commands.registerCommand('gitJungle.installHooks', () => installHooks(context)),
    vscode.commands.registerCommand('gitJungle.showView', focusView),
    vscode.commands.registerCommand('gitJungle.showViewWaiting', focusView),
    vscode.commands.registerCommand('gitJungle.openInNewWindow', (w) =>
      vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(w.path), { forceNewWindow: true })),
    vscode.commands.registerCommand('gitJungle.openTerminal', (w) =>
      vscode.window.createTerminal({ name: w.branch ?? 'worktree', cwd: w.path }).show()),
    vscode.workspace.onDidChangeWorkspaceFolders(refreshAll),
  );
  await refreshAll();
}

/** Copies the bundled hook to a stable path and hands the user the settings.json snippet (never edits settings itself). */
async function installHooks(context) {
  const target = path.join(os.homedir(), '.git-jungle', 'hook.mjs');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(context.extensionPath, 'dist', 'hook.mjs'), target);

  const entry = [{ hooks: [{ type: 'command', command: `node "${target.replace(/\\/g, '/')}"` }] }];
  const events = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Notification', 'Stop', 'SessionEnd'];
  const snippet = JSON.stringify({ hooks: Object.fromEntries(events.map((e) => [e, entry])) }, null, 2);
  await vscode.env.clipboard.writeText(snippet);

  const pick = await vscode.window.showInformationMessage(
    'Hook installed and the settings snippet is on your clipboard. Merge its "hooks" block into ~/.claude/settings.json.',
    'Open settings.json',
  );
  if (pick) {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(os.homedir(), '.claude', 'settings.json')));
    await vscode.window.showTextDocument(doc);
  }
}

module.exports = { activate, deactivate() {}, installHooks };
