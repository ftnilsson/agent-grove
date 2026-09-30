const $ = (s) => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
let repo = null;
let timer = null;
let overview = null;

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  el.append(...kids.filter((k) => k != null && k !== false));
  return el;
}
function s(tag, attrs = {}, text) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
}

async function api(route, body = {}) {
  const res = await fetch(`/api/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Git-Jungle': '1' },
    body: JSON.stringify({ repo, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

let toastTimer;
function toast(msg, ok = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = ok ? 'ok' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ok ? 2500 : 8000);
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };

// ---------- opening a repo ----------
async function openRepo(dir) {
  const r = await api('open', { dir });
  repo = r.repo;
  location.hash = `repo=${encodeURIComponent(repo)}`;
  $('#repo-input').value = repo;
  fillRecents(r.recents);
  await refresh();
  clearInterval(timer);
  timer = setInterval(() => document.hidden || refresh().catch(() => {}), 5000);
}
function fillRecents(list) {
  $('#recents').replaceChildren(...list.map((r) => h('option', { value: r })));
}

// ---------- rendering ----------
async function refresh() {
  if (!repo) return;
  const o = await api('overview');
  overview = o;
  $('#repo-title').textContent = `${o.name} — ${o.worktrees.length} worktree${o.worktrees.length === 1 ? '' : 's'}` + (o.base ? ` · base: ${o.base}` : '');
  $('#graph').replaceChildren(renderGraph(o));
  $('#cards').replaceChildren(...o.worktrees.map((w) => card(o, w)));
}

const stateOf = (w) => w.prunable ? 'prunable' : w.locked ? 'locked' : (w.status.dirty || w.status.untracked) ? 'dirty' : 'clean';
const label = (w) => w.branch ?? (w.bare ? '(bare)' : `detached @ ${w.head?.slice(0, 7)}`);

function card(o, w) {
  const st = stateOf(w);
  const badges = [
    w.main && h('span', { class: 'badge' }, 'main worktree'),
    w.locked && h('span', { class: 'badge' }, `🔒 locked${w.lockReason ? `: ${w.lockReason}` : ''}`),
    w.prunable && h('span', { class: 'badge bad' }, 'missing on disk'),
    w.status.dirty > 0 && h('span', { class: 'badge warn' }, `${w.status.dirty} changed`),
    w.status.untracked > 0 && h('span', { class: 'badge warn' }, `${w.status.untracked} untracked`),
    w.vsBase && w.branch !== o.base && h('span', { class: 'badge' }, `↑${w.vsBase.ahead} ↓${w.vsBase.behind} vs ${o.base}`),
    w.status.upstream && (w.status.ahead || w.status.behind) && h('span', { class: 'badge' }, `remote ↑${w.status.ahead} ↓${w.status.behind}`),
  ];
  const actions = [];
  if (!w.main) {
    const toggleLock = () => api(w.locked ? 'unlock' : 'lock', { path: w.path }).then(refresh);
    actions.push(h('button', { class: 'small', onclick: guard(toggleLock) }, w.locked ? 'Unlock' : 'Lock'));
    actions.push(h('button', { class: 'small', onclick: guard(() => moveWorktree(w)) }, 'Move'));
    actions.push(h('button', { class: 'small', onclick: guard(() => removeDialog(w)) }, 'Remove'));
  }
  actions.push(h('button', { class: 'small', onclick: () => navigator.clipboard?.writeText(w.path).then(() => toast('Path copied', true)) }, 'Copy path'));
  return h('div', { class: `card ${st}` },
    h('div', { class: 'card-head' }, h('span', { class: 'branch' }, label(w)), ...badges, h('span', { class: 'card-actions' }, ...actions)),
    h('div', { class: 'path' }, w.path),
    w.commit && h('div', { class: 'commit' }, `${w.commit.hash} ${w.commit.subject} · ${w.commit.author} · ${new Date(w.commit.date).toLocaleString()}`));
}

const COLORS = { clean: 'var(--clean)', dirty: 'var(--dirty)', locked: 'var(--locked)', prunable: 'var(--bad)' };

// Trunk = base branch. Each other worktree forks off it `behind` commits before the tip and runs `ahead` commits long.
function renderGraph(o) {
  const lanes = o.worktrees.filter((w) => w.branch !== o.base && !w.bare && w.vsBase);
  const baseWt = o.worktrees.find((w) => w.branch === o.base);
  const unit = 14;
  const cap = (n) => Math.min(n, 40);
  const left = 24, trunkY = 40, laneH = 46;
  const maxBehind = Math.max(0, ...lanes.map((w) => w.vsBase.behind));
  const tipX = left + Math.max(120, cap(maxBehind) * unit + 40);
  const maxAhead = Math.max(1, ...lanes.map((w) => cap(w.vsBase.ahead)));
  const width = tipX + Math.max(300, maxAhead * unit + 300);
  const height = trunkY + 30 + Math.max(1, lanes.length) * laneH;
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': 'Worktree graph' });

  svg.append(s('line', { x1: left, y1: trunkY, x2: tipX, y2: trunkY, stroke: 'var(--accent)', 'stroke-width': 4, 'stroke-linecap': 'round' }));
  svg.append(s('circle', { cx: tipX, cy: trunkY, r: 8, fill: 'var(--accent)' }));
  svg.append(s('text', { x: tipX + 14, y: trunkY + 4 }, `${o.base ?? '(no base)'}${o.baseTip ? ` @ ${o.baseTip}` : ''}`));
  if (baseWt) {
    svg.append(s('text', { x: tipX + 14, y: trunkY + 18, class: 'muted' }, `checked out in the main worktree${stateOf(baseWt) === "dirty" ? " (dirty)" : ""}`));
  }

  lanes.forEach((w, i) => {
    const y = trunkY + 40 + i * laneH;
    const forkX = tipX - cap(w.vsBase.behind) * unit;
    const endX = forkX + 40 + cap(w.vsBase.ahead) * unit;
    const color = COLORS[stateOf(w)];
    svg.append(s('path', { d: `M ${forkX} ${trunkY} C ${forkX} ${y}, ${forkX + 4} ${y}, ${forkX + 30} ${y}`, fill: 'none', stroke: color, 'stroke-width': 3 }));
    svg.append(s('line', { x1: forkX + 30, y1: y, x2: endX, y2: y, stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    svg.append(s('circle', { cx: forkX, cy: trunkY, r: 4, fill: color }));
    svg.append(s('circle', { cx: endX, cy: y, r: 7, fill: color, stroke: w.locked ? 'var(--text)' : 'none' }));
    const detail = [w.vsBase.ahead ? `+${w.vsBase.ahead}` : '', w.vsBase.behind ? `${w.vsBase.behind} behind` : '', w.status.dirty + w.status.untracked ? '● dirty' : ''].filter(Boolean).join('  ');
    svg.append(s('text', { x: endX + 14, y: y + 4 }, `${label(w)}${w.locked ? ' 🔒' : ''}`));
    svg.append(s('text', { x: endX + 14, y: y + 18, class: 'muted' }, detail || 'even with base'));
  });
  if (!lanes.length) svg.append(s('text', { x: left, y: trunkY + 50, class: 'muted' }, 'No other worktrees yet — create one to see it branch off.'));
  return svg;
}

// ---------- dialogs ----------
document.addEventListener('click', (e) => e.target.closest('[data-close]')?.closest('dialog').close());

function suggestPath(name) {
  const sep = repo.includes('\\') ? '\\' : '/';
  const cut = repo.lastIndexOf(sep);
  const safe = name.replace(/[\\/:*?"<>|]+/g, '-');
  return `${repo.slice(0, cut)}${sep}${repo.slice(cut + 1)}-worktrees${sep}${safe}`;
}

async function addDialog() {
  const b = await api('branches');
  const dlg = $('#add-dialog'), f = $('#add-form');
  f.reset();
  f.base.value = overview?.base ?? '';
  $('#branch-list').replaceChildren(...[...b.local, ...b.remote].map((x) => h('option', { value: x })));
  let pathEdited = false;
  f.path.oninput = () => (pathEdited = true);
  f.branch.oninput = () => { if (!pathEdited) f.path.value = f.branch.value ? suggestPath(f.branch.value) : ''; };
  const syncMode = () => { $('#base-row').hidden = f.mode.value !== 'new'; };
  f.querySelectorAll('[name=mode]').forEach((r) => (r.onchange = syncMode));
  syncMode();
  f.onsubmit = guard(async () => {
    await api('add', { path: f.path.value, branch: f.branch.value, newBranch: f.mode.value === 'new', base: f.base.value || undefined });
    toast('Worktree created', true);
    await refresh();
  });
  dlg.showModal();
}

function confirmDialog({ title, body, optionLabel, okText = 'Confirm' }) {
  return new Promise((resolve) => {
    const dlg = $('#confirm-dialog');
    $('#confirm-title').textContent = title;
    $('#confirm-body').textContent = body;
    const opt = $('#confirm-opt');
    opt.hidden = !optionLabel;
    $('#confirm-opt-box').checked = false;
    opt.querySelector('span').textContent = optionLabel ?? '';
    const ok = $('#confirm-ok');
    ok.textContent = okText;
    dlg.dataset.ok = '';
    ok.onclick = () => { dlg.dataset.ok = '1'; };
    dlg.onclose = () => resolve(dlg.dataset.ok ? { checked: $('#confirm-opt-box').checked } : null);
    dlg.showModal();
  });
}

async function removeDialog(w) {
  const dirty = w.status.dirty + w.status.untracked > 0;
  const r = await confirmDialog({
    title: `Remove worktree ${label(w)}?`,
    body: `${w.path}\n${dirty ? `Warning: ${w.status.dirty} changed and ${w.status.untracked} untracked files will be DISCARDED.` : 'It is clean.'}${w.locked ? '\nIt is locked and will be force-removed.' : ''}`,
    optionLabel: w.branch ? `Also delete branch "${w.branch}" (safe delete unless forced)` : null,
    okText: dirty || w.locked ? 'Force remove' : 'Remove',
  });
  if (!r) return;
  await api('remove', { path: w.path, force: dirty || w.locked, deleteBranch: r.checked, branch: w.branch });
  toast('Worktree removed', true);
  await refresh();
}

async function moveWorktree(w) {
  const to = prompt('Move worktree to:', w.path);
  if (!to || to === w.path) return;
  await api('move', { path: w.path, to });
  await refresh();
}

// ---------- wiring ----------
$('#open-form').addEventListener('submit', (e) => { e.preventDefault(); guard(openRepo)($('#repo-input').value.trim()); });
$('#refresh').onclick = guard(refresh);
$('#add').onclick = guard(() => (repo ? addDialog() : toast('Open a repository first')));
$('#prune').onclick = guard(async () => {
  if (!repo) return;
  await api('prune');
  toast('Pruned stale worktree records', true);
  await refresh();
});

(async () => {
  const r = await fetch('/api/recents', { method: 'GET', headers: { 'X-Git-Jungle': '1' } }).then((x) => x.json()).catch(() => null);
  if (r) fillRecents(r.recents);
  const start = new URLSearchParams(location.hash.slice(1)).get('repo') ?? r?.recents?.[0];
  if (start) guard(openRepo)(start);
})();
