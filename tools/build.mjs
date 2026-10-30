// Single-file build: Breakaway.html with three.js bundled (esbuild), the CSS,
// the mocap clips and the audio all inlined — it opens straight from the
// file system on an iPhone, no server needed (the web font loads if online).
//   npm install && node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const js = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true, minify: true, format: 'iife', target: ['es2020', 'safari14'],
  write: false, legalComments: 'none',
  alias: { 'three/addons': 'three/examples/jsm' },
});
const code = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = (await esbuild.transform(r('src/ui/styles.css'), { loader: 'css', minify: true })).code;
const icon = `data:image/svg+xml;base64,${Buffer.from(r('icons/icon.svg')).toString('base64')}`;
const touch = `data:image/png;base64,${fs.readFileSync(path.join(root, 'icons/apple-touch-icon.png')).toString('base64')}`;

let html = r('index.html');
html = html
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/href="icons\/icon\.svg"/, `href="${icon}"`)
  .replace(/href="icons\/apple-touch-icon\.png"/, `href="${touch}"`)
  .replace(/<link rel="stylesheet" href="src\/ui\/styles\.css">/, () => `<style>${css}</style>`)
  .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(/<script type="module" src="src\/main\.js"><\/script>/, () => `<script>${code}</script>`);
const out = path.join(root, 'Breakaway.html');
fs.writeFileSync(out, html);
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`Breakaway.html ${kb} KB`);
if (fs.statSync(out).size > 2 * 1024 * 1024) { console.error('over 2 MB!'); process.exit(1); }
