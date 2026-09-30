// Generates extension/media/*.svg from the VS Code codicon font (logo shapes) with brand colours and a pulse animation.
// Run after `npm install`: node scripts/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const buf = fs.readFileSync(path.join(root, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.ttf'));
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

// codepoint = the glyph's codicon; colour = the brand colour shown while the agent works.
const AGENTS = {
  claude: { codepoint: 0xEC82, color: '#D97757' },
  copilot: { codepoint: 0xEC1E, color: '#8957E5' },
  codex: { codepoint: 0xEC81, color: '#10A37F' }, // OpenAI mark
};
const WAITING = '#E3B341';

const pulse = (d, color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="16" height="16">
  <g transform="translate(150 150)">
    <g>
      <animateTransform attributeName="transform" type="scale" values="0.78;1;0.78" dur="1.6s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
      <path transform="translate(-150 -150)" fill="${color}" d="${d}">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
      </path>
    </g>
  </g>
</svg>
`;
const still = (d, color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="16" height="16"><path fill="${color}" d="${d}"/></svg>\n`;

const out = path.join(root, 'extension', 'media');
fs.mkdirSync(out, { recursive: true });
for (const [name, { codepoint, color }] of Object.entries(AGENTS)) {
  // unitsPerEm is 300, so font size 300 keeps 1 unit = 1 svg unit; baseline y=300 flips the y-up glyph.
  const d = font.charToGlyph(String.fromCodePoint(codepoint)).getPath(0, 300, 300).toPathData(2);
  fs.writeFileSync(path.join(out, `${name}-pulse.svg`), pulse(d, color));
  fs.writeFileSync(path.join(out, `${name}-waiting.svg`), still(d, WAITING));
}
console.log('wrote', fs.readdirSync(out).join(', '));
