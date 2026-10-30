// Motion-capture clip library: decodes the quantised keyframes produced by
// tools/mocap/convert.mjs and samples them into rig poses.
//
// A pose is a Float32Array(POSE_SIZE):
//   [0..27]  quaternions (x,y,z,w) for pelvis, torso, head, hipL, hipR, shL, shR
//   [28..33] hinge angles (rotation.x) for kneeL, kneeR, ankL, ankR, elL, elR
//   [34..36] pelvis offset from the root (x, y, z) in metres for a 1.8 m player
import { CLIP_DATA } from './clipData.js';

export const Q = { pelvis: 0, torso: 4, head: 8, hipL: 12, hipR: 16, shL: 20, shR: 24 };
export const H = { kneeL: 28, kneeR: 29, ankL: 30, ankR: 31, elL: 32, elR: 33 };
export const OFF = 34;
export const POSE_SIZE = 37;
export const NQ = 7;
export const FPS = CLIP_DATA.fps;

export const newPose = () => {
  const p = new Float32Array(POSE_SIZE);
  for (let j = 0; j < NQ; j++) p[j * 4 + 3] = 1;
  p[OFF + 1] = 0.92;
  return p;
};

function b64ToInt16(s) {
  const bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Int16Array(u8.buffer);
}

class Clip {
  constructor(name, c) {
    this.name = name;
    this.n = c.n;
    this.loop = c.loop;
    this.src = c.src;
    this.vz = c.vz || 0; this.vx = c.vx || 0;
    this.yawRate = c.yawRate || 0;
    this.yaw = c.yaw || 0;
    this.contact = c.contact;   // kick: strike frame
    this.foot = c.foot;
    this.dur = c.n / FPS;
    this.speed = Math.hypot(this.vz, this.vx);
    const S = CLIP_DATA.stride;
    const raw = b64ToInt16(c.data);
    const n = c.n;
    this.pose = new Float32Array(n * POSE_SIZE);
    this.contacts = new Uint8Array(n);
    // cumulative root motion (x, z, yaw) in the clip's starting frame
    this.root = new Float32Array((n + 1) * 3);
    let rx = 0, rz = 0, ry = 0;
    for (let f = 0; f < n; f++) {
      const i = f * S, o = f * POSE_SIZE;
      for (let j = 0; j < NQ; j++) {
        const x = raw[i + j * 3] / 32767, y = raw[i + j * 3 + 1] / 32767, z = raw[i + j * 3 + 2] / 32767;
        const w = Math.sqrt(Math.max(0, 1 - x * x - y * y - z * z));
        this.pose[o + j * 4] = x; this.pose[o + j * 4 + 1] = y; this.pose[o + j * 4 + 2] = z; this.pose[o + j * 4 + 3] = w;
      }
      for (let k = 0; k < 6; k++) this.pose[o + 28 + k] = (raw[i + 21 + k] * Math.PI) / 32767;
      for (let k = 0; k < 3; k++) this.pose[o + OFF + k] = raw[i + 27 + k] / 10000;
      const dx = raw[i + 30] / 10000, dz = raw[i + 31] / 10000, dy = raw[i + 32] / 10000;
      this.contacts[f] = raw[i + 33];
      this.root[f * 3] = rx; this.root[f * 3 + 1] = rz; this.root[f * 3 + 2] = ry;
      const c0 = Math.cos(ry), s0 = Math.sin(ry);
      rx += dx * c0 + dz * s0; rz += -dx * s0 + dz * c0; ry += dy;
    }
    this.root[n * 3] = rx; this.root[n * 3 + 1] = rz; this.root[n * 3 + 2] = ry;
    // phase (0..1) of the right footfall; the left one is at 0 for cycles
    this.strikeR = 0.5;
    if (this.loop) {
      for (let f = 1; f < n; f++) if ((this.contacts[f] & 2) && !(this.contacts[f - 1] & 2)) { this.strikeR = f / n; break; }
      this.strikeL = 0;
      for (let f = 1; f < n; f++) if ((this.contacts[f] & 1) && !(this.contacts[f - 1] & 1)) { this.strikeL = f / n; break; }
    }
    // average pose (stride scaling pulls the legs toward it)
    this.mean = new Float32Array(POSE_SIZE);
    for (let f = 0; f < n; f++) for (let k = 0; k < POSE_SIZE; k++) this.mean[k] += this.pose[f * POSE_SIZE + k] / n;
    normQuats(this.mean);
  }

  /** Sample at time t (seconds) into out. Loops wrap, one-shots clamp. */
  sample(t, out) {
    let f = t * FPS;
    const n = this.n;
    if (this.loop) { f %= n; if (f < 0) f += n; } else f = Math.max(0, Math.min(n - 1, f));
    const f0 = Math.floor(f);
    const f1 = this.loop ? (f0 + 1) % n : Math.min(n - 1, f0 + 1);
    lerpPose(this.pose, f0 * POSE_SIZE, this.pose, f1 * POSE_SIZE, f - f0, out);
    return out;
  }

  sampleNorm(phase, out) { return this.sample(phase * this.dur, out); }

  /** Contact bits (1 = left, 2 = right) at time t. */
  contactAt(t) {
    let f = Math.round(t * FPS);
    if (this.loop) { f %= this.n; if (f < 0) f += this.n; } else f = Math.max(0, Math.min(this.n - 1, f));
    return this.contacts[f];
  }

  /** Root position/yaw at time t (one-shots), relative to the clip start. */
  rootAt(t, out) {
    const f = Math.max(0, Math.min(this.n, t * FPS));
    const f0 = Math.floor(f), f1 = Math.min(this.n, f0 + 1), a = f - f0;
    for (let k = 0; k < 3; k++) out[k] = this.root[f0 * 3 + k] + (this.root[f1 * 3 + k] - this.root[f0 * 3 + k]) * a;
    return out;
  }

  /** Root speed (m/s) around time t. */
  speedAt(t) {
    const a = this.rootAt(t - 0.05, [0, 0, 0]), b = this.rootAt(t + 0.05, [0, 0, 0]);
    return Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1;
  }
}

export function normQuats(p) {
  for (let j = 0; j < NQ; j++) {
    const o = j * 4;
    const l = Math.hypot(p[o], p[o + 1], p[o + 2], p[o + 3]) || 1;
    p[o] /= l; p[o + 1] /= l; p[o + 2] /= l; p[o + 3] /= l;
  }
}

/** out = lerp(a, b, t) (quaternions nlerped along the short arc). */
export function lerpPose(A, ao, B, bo, t, out) {
  for (let j = 0; j < NQ; j++) {
    const i = j * 4;
    let bx = B[bo + i], by = B[bo + i + 1], bz = B[bo + i + 2], bw = B[bo + i + 3];
    const ax = A[ao + i], ay = A[ao + i + 1], az = A[ao + i + 2], aw = A[ao + i + 3];
    if (ax * bx + ay * by + az * bz + aw * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t, w = aw + (bw - aw) * t;
    const l = Math.hypot(x, y, z, w) || 1;
    out[i] = x / l; out[i + 1] = y / l; out[i + 2] = z / l; out[i + 3] = w / l;
  }
  for (let k = 28; k < POSE_SIZE; k++) out[k] = A[ao + k] + (B[bo + k] - A[ao + k]) * t;
  return out;
}

/** Blend b into a in place: a = lerp(a, b, w), optionally per joint (mask: 13 joint weights). */
export function blendInto(a, b, w, mask = null) {
  if (w <= 0) return a;
  for (let j = 0; j < NQ; j++) {
    const t = mask ? w * mask[j] : w;
    if (t <= 0) continue;
    const i = j * 4;
    let bx = b[i], by = b[i + 1], bz = b[i + 2], bw = b[i + 3];
    if (a[i] * bx + a[i + 1] * by + a[i + 2] * bz + a[i + 3] * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let x = a[i] + (bx - a[i]) * t, y = a[i + 1] + (by - a[i + 1]) * t, z = a[i + 2] + (bz - a[i + 2]) * t, ww = a[i + 3] + (bw - a[i + 3]) * t;
    const l = Math.hypot(x, y, z, ww) || 1;
    a[i] = x / l; a[i + 1] = y / l; a[i + 2] = z / l; a[i + 3] = ww / l;
  }
  // hinges follow their limb: knee/ankle with the hip, elbow with the shoulder
  const hm = mask ? [mask[3], mask[4], mask[3], mask[4], mask[5], mask[6]] : null;
  for (let k = 0; k < 6; k++) {
    const t = hm ? w * hm[k] : w;
    a[28 + k] += (b[28 + k] - a[28 + k]) * t;
  }
  const to = mask ? w * mask[0] : w;
  for (let k = OFF; k < OFF + 3; k++) a[k] += (b[k] - a[k]) * to;
  return a;
}

/** Weighted accumulation helper for blend trees. */
export class Accum {
  constructor() { this.p = new Float32Array(POSE_SIZE); this.w = 0; }
  reset() { this.p.fill(0); this.w = 0; }
  add(src, w) {
    if (w <= 1e-4) return;
    const p = this.p;
    for (let j = 0; j < NQ; j++) {
      const i = j * 4;
      // keep every contribution on the same hemisphere as what's there
      const d = p[i] * src[i] + p[i + 1] * src[i + 1] + p[i + 2] * src[i + 2] + p[i + 3] * src[i + 3];
      const s = d < 0 ? -w : w;
      p[i] += src[i] * s; p[i + 1] += src[i + 1] * s; p[i + 2] += src[i + 2] * s; p[i + 3] += src[i + 3] * s;
    }
    for (let k = 28; k < POSE_SIZE; k++) p[k] += src[k] * w;
    this.w += w;
  }
  out(dst) {
    if (this.w <= 0) return dst;
    for (let k = 0; k < 28; k++) dst[k] = this.p[k];
    normQuats(dst);
    for (let k = 28; k < POSE_SIZE; k++) dst[k] = this.p[k] / this.w;
    return dst;
  }
}

let LIB = null;
/** All clips by name (decoded once, shared by every player). */
export function clips() {
  if (LIB) return LIB;
  LIB = {};
  for (const [name, c] of Object.entries(CLIP_DATA.clips)) LIB[name] = new Clip(name, c);
  return LIB;
}
