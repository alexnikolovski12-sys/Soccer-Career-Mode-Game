// Single-file build: Breakaway.html with three.js bundled (esbuild), the CSS,
// the mocap clips and the audio all inlined — it opens straight from the
// file system on an iPhone, no server needed (the web font loads if online).
//   npm install && node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// The two big data modules (the player body, the mocap) ship deflated and are
// inflated on load (fflate) — saves ~350 KB in the single file.
const z64 = (buf) => zlib.deflateRawSync(buf, { level: 9 }).toString('base64');
const squeeze = {
  name: 'squeeze-data',
  setup(b) {
    b.onLoad({ filter: /humanData\.js$/ }, async (a) => {
      const src = fs.readFileSync(a.path, 'utf8');
      const meta = src.match(/export const HUMAN_META = (.*);\n/)[1];
      const blob = src.match(/export const HUMAN_BLOB = '([^']*)'/)[1];
      return { loader: 'js', resolveDir: path.dirname(a.path), contents: `import { inflateSync } from 'fflate';
const u = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const raw = inflateSync(u('${z64(Buffer.from(blob, 'base64'))}'));
let s = ''; for (let i = 0; i < raw.length; i += 32768) s += String.fromCharCode.apply(null, raw.subarray(i, i + 32768));
export const HUMAN_META = ${meta};
export const HUMAN_BLOB = btoa(s);` };
    });
    b.onLoad({ filter: /clipData\.js$/ }, async (a) => {
      const src = fs.readFileSync(a.path, 'utf8');
      const json = src.match(/export const CLIP_DATA = (.*);?\s*$/s)[1].replace(/;\s*$/, '');
      return { loader: 'js', resolveDir: path.dirname(a.path), contents: `import { inflateSync, strFromU8 } from 'fflate';
export const CLIP_DATA = JSON.parse(strFromU8(inflateSync(Uint8Array.from(atob('${z64(Buffer.from(json))}'), (c) => c.charCodeAt(0)))));` };
    });
  },
};
const js = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true, minify: true, format: 'iife', target: ['es2020', 'safari14'],
  write: false, legalComments: 'none',
  alias: { 'three/addons': 'three/examples/jsm' },
  plugins: [squeeze],
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
if (fs.statSync(out).size > 3 * 1024 * 1024) { console.error('over 3 MB!'); process.exit(1); }
