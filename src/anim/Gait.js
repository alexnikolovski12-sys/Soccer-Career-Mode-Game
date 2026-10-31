// Procedural running / sprinting gait from sprint biomechanics.
//
// Lab motion capture (a few metres of space) tops out around 6 m/s with short,
// quick steps. Real footballers at speed take long strides at a modest cadence:
// ~3.3 steps/s at 6.5 m/s, ~4.3 at 9.3 m/s (≈2.1 m a step; 37 km/h for the very
// fastest). This builds the pose for any phase of that stride from joint-angle
// curves of max-velocity sprinting:
//  - short ground contact (≈22 % of the cycle at top speed, ≈33 % at 5 m/s)
//  - hip: ~38° flexed at touchdown, extends to ~-20° at toe-off, then the thigh
//    drives up to ~78° before "pawing" back down to the ground
//  - knee: flexes ~40° on landing, folds to ~125° in swing (heel to the backside),
//    opens out just before touchdown
//  - ankle: dorsiflexes through stance, plantarflexes at toe-off
//  - pelvis rises in the flight phase and rotates with the legs; the trunk
//    counter-rotates, the head stays level
//  - arms: driven ~opposite to the legs, elbows ~90°, more closed in front
// The result is blended over the mocap run as speed rises (Animator._locomotion).
import * as THREE from 'three';
import { Q, H, OFF } from './Clips.js';

const D2R = Math.PI / 180;
const _q = new THREE.Quaternion(), _e = new THREE.Euler();

/** Smooth periodic interpolation through [phase, value] keys (phase 0..1, sorted). */
function curve(keys, ph) {
  const n = keys.length;
  ph = ((ph % 1) + 1) % 1;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (keys[k][0] > ph) { i = k - 1; break; }
  if (i < 0) i = n - 1;
  const a = keys[i], b = keys[(i + 1) % n];
  const p0 = keys[(i - 1 + n) % n], p3 = keys[(i + 2) % n];
  let span = b[0] - a[0]; if (span <= 0) span += 1;
  let t = ph - a[0]; if (t < 0) t += 1;
  t /= span;
  // Catmull-Rom on values (uniform), good enough for joint curves
  const v0 = p0[1], v1 = a[1], v2 = b[1], v3 = p3[1];
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * v1) + (-v0 + v2) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 + (-v0 + 3 * v1 - 3 * v2 + v3) * t3);
}

const setQ = (out, j, x, y, z) => { _e.set(x, y, z, 'XYZ'); _q.setFromEuler(_e); out[j] = _q.x; out[j + 1] = _q.y; out[j + 2] = _q.z; out[j + 3] = _q.w; };

/**
 * Pose for the stride phase (0 = left footfall, 0.5 = right) at speed v (m/s).
 * Returns the stance fraction (duty factor) used, for foot contacts.
 */
export function gaitPose(phase, v, out, style = null, ball = 0) {
  // with the ball: a lower, more compact stride (less knee drive), head over it, arms out for balance
  const u = Math.min(1.15, Math.max(0, (v - 5) / 4.0)) * (1 - 0.3 * ball);
  const D = 0.33 - 0.11 * u;                                 // ground contact fraction
  const hTD = 28 + 12 * u, hTO = -12 - 12 * u, hPk = 52 + 32 * u;   // full extension behind, big knee drive in front
  const kSt = 38 + 6 * u, kTO = 22 + 2 * u, kMax = 95 + 38 * u;
  const hipK = [[0, hTD], [D * 0.5, (hTD + hTO) * 0.5 - 2], [D, hTO], [D + 0.05, hTO - 3], [0.5, hPk * 0.55], [0.72, hPk], [0.9, hTD + 8]];
  const kneeK = [[0, 22], [D * 0.45, kSt], [D, kTO], [0.38, kMax * 0.8], [0.55, kMax], [0.78, 60], [0.92, 30]];
  const ankK = [[0, 6], [D * 0.45, -14], [D, 26], [D + 0.12, 16], [0.6, -6], [0.88, 0]];
  const leg = (ph, side) => ({ hip: curve(hipK, ph), knee: curve(kneeK, ph), ank: curve(ankK, ph), side });
  const L = leg(phase, 1), R = leg(phase + 0.5, -1);
  const c = Math.cos(phase * Math.PI * 2);
  // pelvis: anterior tilt + lean, rotates with the leg that's forward, bounces in flight
  const pelvTilt = 16 + 9 * u + 5 * ball + (style ? style.lean * 40 : 0);
  setQ(out, Q.pelvis, pelvTilt * D2R, -6 * c * D2R, 2.5 * Math.sin(phase * Math.PI * 4) * D2R);
  setQ(out, Q.torso, (-3 - 2 * u) * D2R, 11 * c * D2R, 0);
  setQ(out, Q.head, (-12 - 4 * u + 14 * ball) * D2R, -4 * c * D2R, 0);
  // legs (rig: hip X negative = flexion; Y / Z mirrored on the right)
  setQ(out, Q.hipL, -L.hip * D2R, 0, -4 * D2R);
  setQ(out, Q.hipR, -R.hip * D2R, 0, 4 * D2R);
  out[H.kneeL] = L.knee * D2R; out[H.kneeR] = R.knee * D2R;
  out[H.ankL] = L.ank * D2R; out[H.ankR] = R.ank * D2R;
  // arms: opposite to the legs (left arm back when the left foot lands), slight lag
  const aAmp = 40 + 26 * u;          // arms pumping hard at top speed
  const cl = Math.cos((phase - 0.03) * Math.PI * 2), cr = -cl;
  setQ(out, Q.shL, (6 + aAmp * cl * (1 - 0.25 * ball)) * D2R, -6 * D2R, (12 + 14 * ball) * D2R);
  setQ(out, Q.shR, (6 + aAmp * cr * (1 - 0.25 * ball)) * D2R, 6 * D2R, -(12 + 14 * ball) * D2R);
  out[H.elL] = -(90 - 22 * cl) * D2R;
  out[H.elR] = -(90 - 22 * cr) * D2R;
  // pelvis height: lowest mid-stance, highest mid-flight (twice per cycle)
  const fl = Math.cos((phase - (D * 0.5 + 0.25)) * Math.PI * 4);
  out[OFF] = 0; out[OFF + 2] = 0.01;
  out[OFF + 1] = 0.925 + 0.012 * u - 0.025 * ball + (0.022 + 0.012 * u) * fl * (1 - 0.3 * ball);
  return D;
}
