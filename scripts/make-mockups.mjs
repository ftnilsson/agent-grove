// Generates illustrative mockups of Agent Grove inside VS Code (dark theme) into docs/images/.
// The logos are the real extension/media icons; the surrounding UI is drawn to resemble VS Code.
// Run: node scripts/make-mockups.mjs   (writes sidebar.svg, animated, and sidebar.png, static)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const glyph = (name) => fs.readFileSync(path.join(root, 'extension', 'media', `${name}.svg`), 'utf8').match(/ d="([^"]+)"/)[1];

const COLORS = { claude: '#D97757', copilot: '#8957E5', codex: '#10A37F', waiting: '#E3B341' };
const ANIM = 'dur="1.6s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"';

/** A 16px agent logo at (x, y): pulsing while running, static amber while waiting. */
function logo(agent, state, x, y) {
  const d = glyph(`${agent}-pulse`);
  const fill = state === 'waiting' ? COLORS.waiting : COLORS[agent];
  const pulse = state === 'running'
    ? `<animateTransform attributeName="transform" type="scale" values="0.78;1;0.78" ${ANIM}/><animate attributeName="opacity" values="0.4;1;0.4" ${ANIM}/>`
    : '';
  // 300-unit glyph scaled to 16px, pulsing around its centre.
  return `<g transform="translate(${x + 8} ${y + 8}) scale(${16 / 300})"><g>${pulse.replace(/<animate /, '<animate ')}<path transform="translate(-150 -150)" fill="${fill}" d="${d}"/></g></g>`;
}
const idleDot = (x, y) => `<circle cx="${x + 8}" cy="${y + 8}" r="4" fill="none" stroke="#c5c5c5" stroke-width="1.3"/>`;
const branch = (x, y) => `<g transform="translate(${x} ${y})" fill="none" stroke="#c5c5c5" stroke-width="1.2"><circle cx="5" cy="3.5" r="1.6"/><circle cx="5" cy="12.5" r="1.6"/><circle cx="11" cy="6" r="1.6"/><path d="M5 5.1v5.8M11 7.6c0 2.6-6 1.4-6 3.4"/></g>`;

const ROWS = [
  { icon: (x, y) => logo('claude', 'running', x, y), label: 'main', note: 'Claude running', selected: true },
  { icon: (x, y) => logo('copilot', 'waiting', x, y), label: 'feat/devcontainer', note: 'Copilot needs your input' },
  { icon: (x, y) => logo('codex', 'running', x, y), label: 'feat/terminal', note: 'Codex running' },
  { icon: idleDot, label: 'experiment/vscode-extension', note: 'Claude idle' },
  { icon: branch, label: 'docs/readme', note: '' },
];

const W = 780, H = 250, SIDE = 400, BAR = 24;
const rowsSvg = ROWS.map((r, i) => {
  const y = 76 + i * 26;
  const note = r.note ? `<text x="${56 + r.label.length * 6.7 + 10}" y="${y + 16}" font-size="12" fill="#8b8b8b">${r.note}</text>` : '';
  return `${r.selected ? `<rect x="0" y="${y}" width="${SIDE}" height="26" fill="#37373d"/>` : ''}${r.icon(26, y + 5)}<text x="56" y="${y + 17}" font-size="13" fill="#cccccc">${r.label}</text>${note}`;
}).join('\n  ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'Segoe UI', system-ui, -apple-system, sans-serif">
  <rect width="${W}" height="${H}" fill="#1e1e1e"/>
  <rect width="${SIDE}" height="${H - BAR}" fill="#252526"/>
  <text x="20" y="28" font-size="11" fill="#bbbbbb" letter-spacing="0.6">SOURCE CONTROL</text>
  <g fill="#c5c5c5" font-size="11">
    <path d="M16 59.5l3.5 3.5 3.5-3.5" fill="none" stroke="#c5c5c5" stroke-width="1.3"/><text x="30" y="64" letter-spacing="0.4">WORKTREE AGENTS</text>
  </g>
  ${rowsSvg}
  <g transform="translate(${SIDE + 40} 70)">
    <rect width="300" height="84" rx="4" fill="#252526" stroke="#454545"/>
    <g transform="translate(14 16)">${logo('copilot', 'waiting', 0, 0)}</g>
    <text x="40" y="29" font-size="13" fill="#cccccc">feat/devcontainer: Copilot needs your input</text>
    <text x="40" y="52" font-size="11" fill="#8b8b8b">Source: Agent Grove</text>
    <rect x="14" y="60" width="0" height="0"/>
  </g>
  <rect y="${H - BAR}" width="${W}" height="${BAR}" fill="#007acc"/>
  <g transform="translate(12 ${H - BAR + 5})" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round">
    <path d="M8 2.5a5.5 5.5 0 1 0 5.5 5.5"><animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="1.2s" repeatCount="indefinite"/></path>
  </g>
  <text x="34" y="${H - 8}" font-size="12" fill="#ffffff">2 running   1 waiting</text>
</svg>
`;

const out = path.join(root, 'docs', 'images');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'sidebar.svg'), svg);
fs.writeFileSync(path.join(out, 'sidebar.png'), new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 }, font: { loadSystemFonts: true } }).render().asPng());
console.log('wrote docs/images/sidebar.svg and sidebar.png');
