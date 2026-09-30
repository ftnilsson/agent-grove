// Bundles extension/extension.js (+ ../src/git.js) into extension/dist and ships the Claude Code hook next to it.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'extension', 'dist');
fs.rmSync(dist, { recursive: true, force: true });

await build({
  entryPoints: [path.join(root, 'extension', 'extension.js')],
  outfile: path.join(dist, 'extension.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  minify: process.argv.includes('--minify'),
  sourcemap: !process.argv.includes('--minify'),
});
fs.copyFileSync(path.join(root, 'agent-status', 'hook.mjs'), path.join(dist, 'hook.mjs'));
console.log('built extension/dist');
