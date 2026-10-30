// Small math helpers shared by gameplay code.
import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential smoothing factor. */
export const dampT = (k, dt) => 1 - Math.exp(-k * dt);
export const damp = (a, b, k, dt) => lerp(a, b, dampT(k, dt));

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
/** Signed shortest difference b − a. */
export const angleDiff = (a, b) => wrapAngle(b - a);
export const lerpAngle = (a, b, t) => a + angleDiff(a, b) * t;

/** Heading angle (around +y) for a direction in the xz plane; 0 faces +z. */
export const headingOf = (x, z) => Math.atan2(x, z);

export function dist2D(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Distance from point p to segment a→b on the xz plane, plus param t (0..1). */
export function pointSegDist2D(p, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z;
  const len2 = abx * abx + abz * abz || 1e-6;
  let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2;
  t = clamp(t, 0, 1);
  const cx = a.x + abx * t, cz = a.z + abz * t;
  const dx = p.x - cx, dz = p.z - cz;
  return { d: Math.sqrt(dx * dx + dz * dz), t };
}

/** Seeded RNG (mulberry32) so a moment can be retried identically. */
export function makeRng(seed = (Math.random() * 2 ** 32) >>> 0) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed,
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    gauss: () => {
      let u = 0, v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    weighted: (weights) => {
      let total = 0;
      for (const k in weights) total += weights[k];
      let r = next() * total;
      for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
      return Object.keys(weights)[0];
    },
  };
}

/** Smooth, cheap 1-D noise built from incommensurate sines (−1..1). */
export class SmoothNoise {
  constructor(rng = makeRng()) {
    this.p = [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)];
  }
  sample(t) {
    return Math.sin(t * 1.73 + this.p[0]) * 0.55 +
      Math.sin(t * 2.91 + this.p[1]) * 0.3 +
      Math.sin(t * 5.37 + this.p[2]) * 0.15;
  }
}

export const tmpV1 = new THREE.Vector3();
export const tmpV2 = new THREE.Vector3();
export const tmpV3 = new THREE.Vector3();
export const UP = new THREE.Vector3(0, 1, 0);
