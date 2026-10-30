// Convert the chosen CMU BVH clips into compact keyframes for the game rig.
//
//   node tools/mocap/fetch.mjs <dir>     (downloads the CMU clips listed in clips.mjs)
//   node tools/mocap/convert.mjs <dir>
//
// Writes assets/mocap/clips.json and src/anim/clipData.js (the same data as an
// ES module, so the single-file build can embed it). Per frame (30 fps) a clip
// stores 34 int16s: 7 quaternions (x,y,z; w ≥ 0), 6 hinge angles, the pelvis
// offset, root motion (dx, dz, dyaw) and foot-contact bits.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { processClip, FPS, QUATS, HINGES } from './process.mjs';
import { SPEC } from './clips.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/mocap/convert.mjs <bvh dir>'); process.exit(1); }

// ---------------------------------------------------------------- helpers
const qI = new THREE.Quaternion();
function strikes(frames, foot) {
  const out = [];
  for (let i = 1; i < frames.length; i++) if (frames[i]['c' + foot] && !frames[i - 1]['c' + foot]) out.push(i);
  return out;
}

/** Make a loop seamless: spread the end→start mismatch over the whole range. */
function closeLoop(seg) {
  const n = seg.length;
  const a = seg[0], b = seg[n - 1];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const f = seg[i];
    for (const k of QUATS) {
      const c = a[k].clone().multiply(b[k].clone().invert());
      const corr = qI.clone().slerp(c, t);
      f[k] = corr.multiply(f[k]).normalize();
    }
    for (const k of HINGES) f[k] += (a[k] - b[k]) * t;
    f.off = f.off.clone().addScaledVector(new THREE.Vector3().subVectors(a.off, b.off), t);
  }
  return seg.slice(0, n - 1); // last frame == first
}

function crossfadeLoop(seg, fade) {
  // blend the tail into the head so a non-cyclic range loops smoothly
  const n = seg.length, m = Math.min(fade, Math.floor(n / 3));
  const out = seg.slice(0, n - m).map((f) => ({ ...f }));
  for (let i = 0; i < m; i++) {
    const w = (i + 1) / (m + 1);
    const tail = seg[n - m + i], head = out[i];
    const f = { ...head };
    for (const k of QUATS) f[k] = tail[k].clone().slerp(head[k], w);
    for (const k of HINGES) f[k] = tail[k] + (head[k] - tail[k]) * w;
    f.off = tail.off.clone().lerp(head.off, w);
    out[i] = f;
  }
  return closeLoop([...out, out[0]]);
}

function kickContact(frames, a, b) {
  let best = -1, bi = a, foot = 'R';
  for (let i = a; i < b; i++) for (const s of ['L', 'R']) {
    const f = frames[i];
    if (f['h' + s] < 0.2 && f['vmax' + s] > best) { best = f['vmax' + s]; bi = i; foot = s; }
  }
  return { frame: bi, foot, speed: best };
}

// ---------------------------------------------------------------- build
const out = { fps: FPS, quats: QUATS, hinges: HINGES, stride: 34, clips: {} };
const report = [];
for (const spec of SPEC) {
  for (const mirror of spec.mirror ? [false, true] : [false]) {
    const name = mirror ? spec.mirror : spec.name;
    const { frames } = processClip(path.join(dir, spec.file + '.bvh'), { mirror, smooth: spec.type === 'cycle' || spec.type === 'loop' ? 0.3 : 0.2 });
    let seg, loop = false, meta = {};
    if (spec.type === 'cycle') {
      // pick the full stride (same foot to same foot) nearest `at`, starting on a left footfall
      const L = strikes(frames, 'L'), R = strikes(frames, 'R');
      const at = Math.round(spec.at * FPS);
      let best = null;
      for (const S of [L, R]) for (let i = 0; i + 1 < S.length; i++) {
        const c = (S[i] + S[i + 1]) / 2, d = Math.abs(c - at);
        if (!best || d < best.d) best = { a: S[i], b: S[i + 1], d };
      }
      if (!best) throw new Error(`${name}: no stride found`);
      seg = frames.slice(best.a, best.b + 1).map((f) => ({ ...f }));
      seg = closeLoop(seg);
      // rotate to start on the left footfall
      const l0 = seg.findIndex((f, i) => f.cL && !seg[(i - 1 + seg.length) % seg.length].cL);
      if (l0 > 0) seg = [...seg.slice(l0), ...seg.slice(0, l0)];
      loop = true;
      const dist = seg.reduce((s, f) => s.add(new THREE.Vector3(f.dx, 0, f.dz)), new THREE.Vector3());
      const dur = seg.length / FPS;
      meta = { vz: dist.z / dur, vx: dist.x / dur, yawRate: seg.reduce((s, f) => s + f.dyaw, 0) / dur, strikeR: seg.findIndex((f, i) => i && f.cR && !seg[i - 1].cR) };
    } else if (spec.type === 'loop') {
      seg = crossfadeLoop(frames.slice(Math.round(spec.a * FPS), Math.round(spec.b * FPS)), 12);
      loop = true;
      meta = { vz: 0, vx: 0, yawRate: 0 };
    } else {
      let a = Math.round(spec.a * FPS), b = Math.round(spec.b * FPS);
      if (spec.type === 'kick') {
        if (spec.auto) {
          const k = kickContact(frames, 0, frames.length);
          a = Math.max(0, k.frame - Math.round(spec.auto * FPS)); b = Math.min(frames.length, k.frame + Math.round(0.6 * FPS));
        }
        const k = kickContact(frames, a, b);
        meta.contact = k.frame - a; meta.foot = k.foot; meta.footSpeed = +k.speed.toFixed(1);
      }
      seg = frames.slice(a, Math.min(b, frames.length));
      const tot = seg.reduce((s, f) => s + f.dyaw, 0);
      meta.yaw = +tot.toFixed(3);
    }
    // ---- encode
    const n = seg.length;
    const arr = new Int16Array(n * out.stride);
    const Q = 32767, H = 32767 / Math.PI, P = 10000;
    seg.forEach((f, i) => {
      let o = i * out.stride;
      for (const k of QUATS) {
        const q = f[k].clone().normalize();
        if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        arr[o++] = Math.round(q.x * Q); arr[o++] = Math.round(q.y * Q); arr[o++] = Math.round(q.z * Q);
      }
      for (const k of HINGES) arr[o++] = Math.round(THREE.MathUtils.clamp(Math.atan2(Math.sin(f[k]), Math.cos(f[k])), -Math.PI, Math.PI) * H);
      arr[o++] = Math.round(f.off.x * P); arr[o++] = Math.round(f.off.y * P); arr[o++] = Math.round(f.off.z * P);
      arr[o++] = Math.round(f.dx * P); arr[o++] = Math.round(f.dz * P); arr[o++] = Math.round(f.dyaw * P);
      arr[o++] = (f.cL ? 1 : 0) | (f.cR ? 2 : 0);
    });
    const clip = { n, loop, src: spec.file + (mirror ? 'm' : ''), ...meta, data: Buffer.from(arr.buffer).toString('base64') };
    for (const k of ['vz', 'vx', 'yawRate']) if (k in clip) clip[k] = +clip[k].toFixed(3);
    out.clips[name] = clip;
    report.push(`${name.padEnd(12)} ${spec.file.padEnd(7)} ${String(n).padStart(3)}f ${(n / FPS).toFixed(2)}s ${loop ? `v ${(meta.vz).toFixed(2)}/${meta.vx.toFixed(2)} yaw ${(meta.yawRate * 57.3).toFixed(0)}°/s` : ''}${meta.contact != null ? ` contact ${meta.contact} (${meta.foot}, ${meta.footSpeed} m/s)` : ''}${meta.yaw != null ? ` turn ${(meta.yaw * 57.3).toFixed(0)}°` : ''}`);
  }
}
fs.mkdirSync(path.join(root, 'assets/mocap'), { recursive: true });
const json = JSON.stringify(out);
fs.writeFileSync(path.join(root, 'assets/mocap/clips.json'), json);
fs.writeFileSync(path.join(root, 'src/anim/clipData.js'),
  '// GENERATED by tools/mocap/convert.mjs from the CMU Graphics Lab Motion Capture Database\n' +
  '// (mocap.cs.cmu.edu, BVH conversion by B. Hahne). See CREDITS.md. Do not edit by hand.\n' +
  `export const CLIP_DATA = ${json};\n`);
console.log(report.join('\n'));
console.log(`\n${Object.keys(out.clips).length} clips, ${(json.length / 1024).toFixed(0)} KB`);
