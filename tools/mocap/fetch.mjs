// Download the CMU clips used by convert.mjs from the BVH mirror on GitHub
// (una-dinosauria/cmu-mocap — B. Hahne's BVH conversion of the CMU database).
//   node tools/mocap/fetch.mjs <out dir>
import fs from 'node:fs';
import path from 'node:path';
import { SPEC } from './clips.mjs';

const out = process.argv[2];
if (!out) { console.error('usage: node tools/mocap/fetch.mjs <out dir>'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const files = [...new Set(SPEC.map((s) => s.file))];
for (const f of files) {
  const dest = path.join(out, `${f}.bvh`);
  if (fs.existsSync(dest)) continue;
  const subj = f.split('_')[0].padStart(3, '0');
  const url = `https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/${subj}/${f}.bvh`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('got', f);
}
