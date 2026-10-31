// Simplify + quantise the footballer body (tools/human/out/human_full.json) into
// src/entities/humanData.js (one base64 blob + a small JSON header).
//   node tools/human/pack_human.mjs [targetTris=13000]
import fs from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';

const dir = new URL('./', import.meta.url).pathname;
const H = JSON.parse(fs.readFileSync(dir + 'out/human_full.json', 'utf8'));
const target = +(process.argv[2] || 13000);
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;

const nV = H.positions.length;
const remap = new Map(H.used.map((v, i) => [v, i]));
const tris = H.tris.map((t) => t.map((v) => remap.get(v)));
const isEye = (i) => H.eye[i] > 0;
const bodyTris = tris.filter((t) => !isEye(t[0]));
const eyeTris = tris.filter((t) => isEye(t[0]));

const pos = new Float32Array(nV * 3);
H.positions.forEach((p, i) => pos.set(p, i * 3));
// simplify the body; region attributes as extra error terms so hems/hairline/face keep their edges
const attrs = new Float32Array(nV * 3);
for (let i = 0; i < nV; i++) {
  attrs[i * 3] = Math.max(-1, Math.min(13, H.limb[i])) * 0.02;
  attrs[i * 3 + 1] = Math.max(-1, H.hair[i]) * 0.02;
  attrs[i * 3 + 2] = pos[i * 3 + 1] > 1.55 ? pos[i * 3 + 1] * 0.5 : 0; // the head matters most
}
const idx = new Uint32Array(bodyTris.flat());
const [simp, err] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, attrs, 3, [1, 1, 1], null, Math.max(3, target - eyeTris.length) * 3, 0.02, ['LockBorder']);
console.log(`body ${bodyTris.length} → ${simp.length / 3} tris (error ${err.toFixed(4)}), eyes ${eyeTris.length}`);
const allIdx = [...simp, ...eyeTris.flat()];

// compact the vertices that survived
const keep = [...new Set(allIdx)].sort((a, b) => a - b);
const nk = new Map(keep.map((v, i) => [v, i]));
const n = keep.length;
const index = Uint16Array.from(allIdx.map((v) => nk.get(v)));

// ---------------------------------------------------------------- quantise
const PQ = 16000;                       // position: 1/16000 m
const position = new Int16Array(n * 3);
keep.forEach((v, i) => { for (let k = 0; k < 3; k++) position[i * 3 + k] = Math.round(H.positions[v][k] * PQ); });
const skinIndex = new Uint8Array(n * 4), skinWeight = new Uint8Array(n * 4);
keep.forEach((v, i) => {
  const w = H.weights[v].map((x, b) => [x, b]).sort((a, b) => b[0] - a[0]).slice(0, 4);
  const sum = w.reduce((s, x) => s + x[0], 0) || 1;
  let acc = 0;
  w.forEach(([x, b], k) => {
    skinIndex[i * 4 + k] = b;
    const q = k === 3 ? 255 - acc : Math.round((x / sum) * 255);
    skinWeight[i * 4 + k] = Math.max(0, q); acc += Math.max(0, q);
  });
});
const limb = new Int16Array(n), hair = new Int16Array(n), eye = new Uint8Array(n), face = new Uint8Array(n * 3);
keep.forEach((v, i) => { for (let k = 0; k < 3; k++) face[i * 3 + k] = Math.round(Math.min(1, H.face[v][k]) * 255); });
keep.forEach((v, i) => { limb[i] = Math.round(H.limb[v] * 1000); hair[i] = Math.round(Math.max(-2, H.hair[v]) * 1000); eye[i] = H.eye[v] ? (H.positions[v][0] > 0 ? 1 : 2) : 0; });
// morphs, sparse: vertex index + delta (1/40000 m)
const MQ = 40000;
const morphNames = Object.keys(H.morphs);
const morphParts = [];
for (const name of morphNames) {
  const D = H.morphs[name];
  const ids = [], ds = [];
  keep.forEach((v, i) => { const d = D[v]; if (Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) > 9e-4) { ids.push(i); ds.push(...d.map((x) => Math.max(-32767, Math.min(32767, Math.round(x * MQ))))); } });
  morphParts.push({ name, count: ids.length, ids: Uint16Array.from(ids), d: Int16Array.from(ds) });
}

// ---------------------------------------------------------------- one blob
const chunks = [];
const meta = { n, tris: index.length / 3, PQ, MQ, bones: H.bones, rig: H.rig, bind: H.bind, landmarks: H.landmarks, layout: [], morphs: [] };
let off = 0;
const add = (name, arr) => {
  const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(new Uint8Array(pad)); off += pad; }
  meta.layout.push([name, arr.constructor.name, off, arr.length]);
  chunks.push(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)); off += arr.byteLength;
};
add('position', position); add('index', index); add('skinIndex', skinIndex); add('skinWeight', skinWeight);
add('limb', limb); add('hair', hair); add('eye', eye); add('face', face);
for (const m of morphParts) { add(`m:${m.name}:ids`, m.ids); add(`m:${m.name}:d`, m.d); meta.morphs.push([m.name, m.count]); }
const blob = Buffer.concat(chunks.map((c) => Buffer.from(c)));
const out = `// Footballer body: MakeHuman base mesh (CC0 1.0), shaped + simplified by tools/human/.\n` +
  `// Generated — do not edit. ${n} verts, ${meta.tris} tris, ${(blob.length / 1024).toFixed(0)} KB.\n` +
  `export const HUMAN_META = ${JSON.stringify(meta)};\nexport const HUMAN_BLOB = '${blob.toString('base64')}';\n`;
fs.writeFileSync(new URL('../../src/entities/humanData.js', import.meta.url), out);
console.log(`verts ${n}, tris ${meta.tris}, blob ${(blob.length / 1024).toFixed(0)} KB, morphs ${meta.morphs.map((m) => m.join(':')).join(' ')}`);
