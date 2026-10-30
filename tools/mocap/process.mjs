// BVH clip → per-frame game-rig data at 30 fps (facing-relative), plus
// foot contacts, root motion and diagnostics. Used by convert.mjs.
import * as THREE from 'three';
import { parseBVH } from './bvh.mjs';
import { sample, retargetFrame, calibrate, RIG } from './retarget.mjs';

export const FPS = 30;
export const QUATS = ['pelvis', 'torso', 'head', 'hipL', 'hipR', 'shL', 'shR'];
export const HINGES = ['kneeL', 'kneeR', 'ankL', 'ankR', 'elL', 'elR'];

const cache = new Map();
export function load(file) {
  if (!cache.has(file)) cache.set(file, parseBVH(file));
  return cache.get(file);
}

function gaussSmooth(arr, sigma) {
  if (sigma <= 0) return arr.slice();
  const r = Math.ceil(sigma * 3), out = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let s = 0, w = 0;
    for (let k = -r; k <= r; k++) {
      // odd reflection at the ends keeps linear trends (speed) intact
      const j = i + k, n = arr.length - 1;
      const val = j < 0 ? 2 * arr[0] - arr[Math.min(n, -j)] : j > n ? 2 * arr[n] - arr[Math.max(0, 2 * n - j)] : arr[j];
      const g = Math.exp(-(k * k) / (2 * sigma * sigma));
      s += val * g; w += g;
    }
    out[i] = s / w;
  }
  return out;
}

function percentile(a, p) {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))];
}

/**
 * opts: { mirror, smooth (seconds of facing smoothing) }
 * returns { frames: [...], scale, n }
 */
export function processClip(file, opts = {}) {
  const bvh = load(file);
  const mirror = !!opts.mirror;
  const step = Math.round(1 / FPS / bvh.frameTime);
  const T = sample(bvh, 0, mirror);
  const cal = calibrate(T);
  const J = bvh.byName;
  const scale = (RIG.thigh + RIG.shin) / (Math.hypot(...J.LeftLeg.offset) + Math.hypot(...J.LeftFoot.offset));
  const raw = [];
  for (let f = 1; f < bvh.frames; f += step) raw.push(retargetFrame(sample(bvh, f, mirror), T, cal));
  const n = raw.length;

  // ---- facing (hip line), unwrapped and smoothed
  const yawRaw = [];
  let prev = null;
  for (const r of raw) {
    const l = new THREE.Vector3().subVectors(r.p.hipL, r.p.hipR);
    let y = Math.atan2(-l.z, l.x); // heading of left × up
    if (prev !== null) { while (y - prev > Math.PI) y -= Math.PI * 2; while (y - prev < -Math.PI) y += Math.PI * 2; }
    yawRaw.push(y); prev = y;
  }
  const sig = (opts.smooth ?? 0.3) * FPS;
  const yaw = gaussSmooth(yawRaw, sig);
  const rx = gaussSmooth(raw.map((r) => r.p.hipMid.x), sig);
  const rz = gaussSmooth(raw.map((r) => r.p.hipMid.z), sig);

  // ---- ground + contacts
  const gA = percentile(raw.map((r) => Math.min(r.p.ankleL.y, r.p.ankleR.y)), 0.02);
  const gT = percentile(raw.map((r) => Math.min(r.p.toeL.y, r.p.toeR.y)), 0.02);
  const frames = [];
  for (let i = 0; i < n; i++) {
    const r = raw[i];
    const qf = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw[i]);
    const qfi = qf.clone().invert();
    const fr = {};
    fr.pelvis = qfi.clone().multiply(r.pelvisW);
    for (const k of ['torso', 'head', 'hipL', 'hipR', 'shL', 'shR']) fr[k] = r[k];
    for (const k of HINGES) fr[k] = r[k];
    // body (pelvis group) origin, our units, facing-relative
    const body = new THREE.Vector3((r.p.hipMid.x - rx[i]) * scale, (r.p.hipMid.y - gA) * scale + RIG.ankleFlat, (r.p.hipMid.z - rz[i]) * scale)
      .add(new THREE.Vector3(0, -RIG.hipY, 0).applyQuaternion(r.pelvisW));
    body.applyQuaternion(qfi);
    fr.off = body;
    // root motion to the next frame, in this frame's facing space
    const j = Math.min(n - 1, i + 1);
    const d = new THREE.Vector3((rx[j] - rx[i]) * scale, 0, (rz[j] - rz[i]) * scale).applyQuaternion(qfi);
    fr.dx = d.x; fr.dz = d.z; fr.dyaw = yaw[j] - yaw[i];
    // contacts + diagnostics
    for (const s of ['L', 'R']) {
      const a = r.p['ankle' + s], t = r.p['toe' + s];
      const k = Math.max(0, i - 1), m = Math.min(n - 1, i + 1);
      const va = raw[m].p['ankle' + s].clone().sub(raw[k].p['ankle' + s]).setY(0).length() * scale * FPS / (m - k || 1);
      const vt = raw[m].p['toe' + s].clone().sub(raw[k].p['toe' + s]).setY(0).length() * scale * FPS / (m - k || 1);
      const ha = (a.y - gA) * scale, ht = (t.y - gT) * scale;
      fr['h' + s] = Math.min(ha, ht);
      fr['v' + s] = Math.min(va, vt);
      fr['vmax' + s] = Math.max(va, vt);
      fr['c' + s] = Math.min(ha, ht) < 0.09 && Math.min(va, vt) < 1.2 ? 1 : 0;
      fr['foot' + s] = new THREE.Vector3((a.x - rx[i]) * scale, ha, (a.z - rz[i]) * scale).applyQuaternion(qfi);
    }
    fr.speed = Math.hypot(fr.dx, fr.dz) * FPS;
    fr.yawRate = fr.dyaw * FPS;
    frames.push(fr);
  }
  return { frames, scale, n, mirror };
}
