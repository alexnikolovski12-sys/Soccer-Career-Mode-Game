// Retarget CMU BVH frames onto the game's footballer rig.
//
// Game rig (src/anim/Rig.js): pelvis (body) → hips → knees → ankles,
// pelvis → torso → head, torso → shoulders → elbows. Limbs hang straight
// down (−Y) in the rest pose and the character faces +Z with its left on +X,
// which is also how the CMU T-pose stands, so:
//  * pelvis / torso / head use the mocap joint rotation relative to the T-pose
//  * thighs and upper arms are aimed along the real bone direction, with the
//    twist taken from the knee / elbow bend plane (or the foot / thumb when
//    the limb is straight)
//  * knees, elbows and ankles are hinges about their local X axis.
import * as THREE from 'three';
import { fk } from './bvh.mjs';

export const RIG = {
  hipY: -0.04,        // hip joints below the pelvis origin
  thigh: 0.43, shin: 0.39,
  ankleFlat: 0.0775,  // ankle height above the grass with the boot flat
};

const v = () => new THREE.Vector3();
const PAIRS = [['Left', 'Right'], ['LHip', 'RHip'], ['LThumb', 'RThumb']];
function mirrorName(n) {
  for (const [a, b] of PAIRS) {
    if (n.startsWith(a)) return b + n.slice(a.length);
    if (n.startsWith(b)) return a + n.slice(b.length);
  }
  return n;
}

/** World positions/rotations keyed by joint name, optionally mirrored left↔right. */
export function sample(bvh, f, mirror = false) {
  const { pos, rot } = fk(bvh, f);
  const P = {}, R = {};
  for (const j of bvh.joints) {
    const p = pos[j.index].clone(), q = rot[j.index].clone();
    if (mirror) { p.x = -p.x; q.set(q.x, -q.y, -q.z, q.w); }
    const n = mirror ? mirrorName(j.name) : j.name;
    P[n] = p; R[n] = q;
  }
  return { P, R };
}

/** Rotation whose local −Y is `down` and local +Z is (as near as possible) `fwd`. */
function basis(down, fwd, out = new THREE.Quaternion()) {
  const Y = down.clone().negate();
  const Z = fwd.clone().addScaledVector(Y, -fwd.dot(Y)).normalize();
  const X = v().crossVectors(Y, Z).normalize();
  Z.crossVectors(X, Y);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z);
  return out.setFromRotationMatrix(m);
}

const perp = (a, axis) => a.clone().addScaledVector(axis, -a.dot(axis));

/**
 * One frame → game-rig joint data (world space; the caller makes it facing-relative).
 * tpose: sample of the T-pose frame (for rotation-relative joints and ankle calibration).
 */
export function retargetFrame(S, T, cal) {
  const { P, R } = S;
  // trunk frames from joint positions (left-right line + up direction): some
  // subjects' T-pose frames aren't upright, so rotations relative to them lie
  const frame = (left, up) => {
    const Xa = left.clone().normalize();
    const Ya = up.clone().addScaledVector(Xa, -up.dot(Xa)).normalize();
    const Za = v().crossVectors(Xa, Ya);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xa, Ya, Za));
  };
  const pelvisW = frame(v().subVectors(P.LeftUpLeg, P.RightUpLeg), v().subVectors(P.Spine, P.Hips));
  const chestW = frame(v().subVectors(P.LeftArm, P.RightArm), v().subVectors(P.Neck, P.Spine));
  const headW = frame(v().subVectors(P.LeftArm, P.RightArm).applyQuaternion(chestW.clone().invert()).applyQuaternion(chestW),
    v().subVectors(P.Head_End, P.Neck1));
  const out = { pelvisW, torso: pelvisW.clone().invert().multiply(chestW), head: chestW.clone().invert().multiply(headW) };

  for (const [side, L] of [['L', 'Left'], ['R', 'Right']]) {
    // ---- leg
    const hip = P[L + 'UpLeg'], knee = P[L + 'Leg'], ankle = P[L + 'Foot'], toe = P[L + 'ToeBase'];
    const d = v().subVectors(knee, hip).normalize();
    const s = v().subVectors(ankle, knee).normalize();
    const ft = v().subVectors(toe, ankle).normalize();
    const bend = Math.acos(THREE.MathUtils.clamp(d.dot(s), -1, 1));
    const kneeFwd = perp(s, d).negate();
    const footFwd = perp(ft, d);
    const w = THREE.MathUtils.clamp(bend / 0.35, 0, 1);
    const f = (kneeFwd.lengthSq() > 1e-8 ? kneeFwd.normalize() : v()).multiplyScalar(w)
      .addScaledVector(footFwd.lengthSq() > 1e-8 ? footFwd.normalize() : new THREE.Vector3(0, 0, 1), 1 - w);
    const thighW = basis(d, f);
    out['hip' + side] = pelvisW.clone().invert().multiply(thighW);
    const X = new THREE.Vector3(1, 0, 0).applyQuaternion(thighW);
    const Zt = new THREE.Vector3(0, 0, 1).applyQuaternion(thighW);
    out['knee' + side] = Math.atan2(-s.dot(Zt), s.dot(d)); // + = bends back
    const Ys = s.clone().negate();
    const Zs = v().crossVectors(X, Ys);
    out['ank' + side] = Math.atan2(-ft.dot(Ys), ft.dot(Zs)) - (cal ? cal['ank' + side] : 0);

    // ---- arm
    const sh = P[L + 'Arm'], el = P[L + 'ForeArm'], wr = P[L + 'Hand'], th = P[side === 'L' ? 'LThumb' : 'RThumb'];
    const da = v().subVectors(el, sh).normalize();
    const sa = v().subVectors(wr, el).normalize();
    const bendA = Math.acos(THREE.MathUtils.clamp(da.dot(sa), -1, 1));
    const elbowFwd = perp(sa, da);
    const thumbFwd = perp(v().subVectors(th, wr), da);
    const wa = THREE.MathUtils.clamp(bendA / 0.3, 0, 1);
    const fa = (elbowFwd.lengthSq() > 1e-8 ? elbowFwd.normalize() : v()).multiplyScalar(wa)
      .addScaledVector(thumbFwd.lengthSq() > 1e-8 ? thumbFwd.normalize() : new THREE.Vector3(0, 0, 1), 1 - wa);
    const armW = basis(da, fa);
    out['sh' + side] = chestW.clone().invert().multiply(armW);
    const Za = new THREE.Vector3(0, 0, 1).applyQuaternion(armW);
    out['el' + side] = -Math.atan2(sa.dot(Za), sa.dot(da)); // rotation.x; − = forearm forward
  }
  // reference points
  out.p = {
    hipMid: v().addVectors(P.LeftUpLeg, P.RightUpLeg).multiplyScalar(0.5),
    ankleL: P.LeftFoot.clone(), ankleR: P.RightFoot.clone(),
    toeL: P.LeftToeBase.clone(), toeR: P.RightToeBase.clone(),
    hips: P.Hips.clone(), head: P.Head.clone(),
    hipL: P.LeftUpLeg.clone(), hipR: P.RightUpLeg.clone(),
  };
  return out;
}

/** Ankle angle with the feet flat in the T-pose. */
export function calibrate(T) {
  const r = retargetFrame(T, T, null);
  return { ankL: r.ankL, ankR: r.ankR };
}
