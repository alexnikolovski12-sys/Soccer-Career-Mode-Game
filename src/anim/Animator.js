// Per-player animation: a motion-capture locomotion blend tree, one-shot
// transitions (starts, stops, cuts, turns), action layers (kicks, falls,
// celebrations, hand-made skill moves) and a light physics layer on top
// (momentum lean, torso/head springs, hit reactions, a spring-driven
// ragdoll for falls). Foot IK runs in Animator.solveIK() after the root has
// been placed for the frame.
import * as THREE from 'three';
import { RIG } from '../entities/HumanBody.js';
import { clamp } from '../config.js';
import { clips, newPose, Accum, blendInto, Q, H, OFF } from './Clips.js';
import { handPose, HAND_KEYS } from './HandPoses.js';
import { gaitPose } from './Gait.js';

const G = 9.81;
const TAU = Math.PI * 2;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const X_AXIS = new THREE.Vector3(1, 0, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);

// Per-joint layer masks: pelvis, torso, head, hipL, hipR, shL, shR (knees/ankles follow the hips, elbows the shoulders).
const MASK = {
  full: [1, 1, 1, 1, 1, 1, 1],
  legs: [0.55, 0.6, 0.35, 0.92, 0.92, 0.3, 0.3],   // skill moves: the legs do the trick, the arms keep swinging
  light: [0.3, 0.4, 0.15, 0.5, 0.5, 0.15, 0.15],   // dribble touches / cushions over the run
  arms: [0, 0.25, 0.4, 0, 0, 1, 1],                 // celebrations over a mocap base
  armR: [0, 0, 0.3, 0, 0, 0, 1],
  upper: [0.35, 0.85, 0.8, 0.2, 0.2, 1, 1],
  dive: [1, 1, 1, 0.55, 0.55, 1, 1],
  none: [0, 0, 0, 0, 0, 0, 0],
};

// Which mocap clips / hand poses each action uses.
//   clip(an, A): name of the clip, or null for a hand-made pose over the current base
//   hand: mask for the hand-made layer (null = mocap only)
const ACTIONS = {
  touch: { hand: 'light', fadeIn: 0.05, fadeOut: 0.12 },
  control: { hand: 'light', fadeIn: 0.06, fadeOut: 0.15, handMask: (an) => (an.variant === 'chest' ? 'upper' : an.variant === 'thigh' ? 'legs' : 'light') },
  turn: { fadeIn: 0.06, fadeOut: 0.22, clip: (an, A) => (an.variant === 'cut' ? A.pickTurnClip('cut', an.side) : null), hand: 'legs', handMask: (an) => (an.variant === 'cut' ? null : an.variant === 'inside' || an.variant === 'outside' ? 'light' : 'legs') },
  pass: { fadeIn: 0.05, fadeOut: 0.25, kick: true, clip: (an, A) => A.pickKick('pass', an), handMask: (an) => (['outside', 'flick', 'backheel', 'chipped'].includes(an.variant) ? 'legs' : null) },
  shoot: { fadeIn: 0.05, fadeOut: 0.3, kick: true, clip: (an, A) => A.pickKick('shoot', an), handMask: (an) => (an.variant === 'chip' ? 'legs' : an.variant === 'finesse' ? 'light' : null) },
  fakeshot: { hand: 'legs', fadeIn: 0.06, fadeOut: 0.2 },
  tackle: { hand: 'full', fadeIn: 0.06, fadeOut: 0.2 },
  block: { hand: 'full', fadeIn: 0.06, fadeOut: 0.25 },
  stumble: { fadeIn: 0.08, fadeOut: 0.3, clip: (an, A) => A.pickStumble(an), handMask: () => null, react: true },
  fall: { fadeIn: 0.05, fadeOut: 0.3, ragdoll: true },
  dive: { hand: 'dive', fadeIn: 0.05, fadeOut: 0.3, clip: (an) => (an.side > 0 ? 'jumpSide' : 'jumpSideM'), clipWeight: 0.6 },
  catch: { hand: 'upper', fadeIn: 0.06, fadeOut: 0.25 },
  gkset: { hand: 'full', fadeIn: 0.25, fadeOut: 0.25, clip: (an, A) => A.set.idle },
  gkup: { hand: 'full', fadeIn: 0.05, fadeOut: 0.3 },
  smother: { hand: 'full', fadeIn: 0.06, fadeOut: 0.3 },
  gkthrow: { hand: 'upper', fadeIn: 0.1, fadeOut: 0.3, clip: (an, A) => A.set.idle },
  dejected: { hand: 'upper', fadeIn: 0.35, fadeOut: 0.4, clip: (an, A) => A.set.idle },
  hipshands: { hand: 'upper', fadeIn: 0.35, fadeOut: 0.4, clip: (an, A) => A.set.idle },
  sitdown: { hand: 'full', fadeIn: 0.5, fadeOut: 0.5 },
  crouchsad: { hand: 'full', fadeIn: 0.4, fadeOut: 0.4 },
  stepover: { hand: 'legs' }, feint: { hand: 'legs' }, croqueta: { hand: 'legs' }, spin: { hand: 'legs' },
  dragback: { hand: 'legs' }, elastico: { hand: 'legs' }, flick: { hand: 'legs' },
  point: { hand: 'armR', fadeIn: 0.1, fadeOut: 0.25 },
  // first-time finishes off a cross + the referee showing a card
  volley: { hand: 'full', fadeIn: 0.2, fadeOut: 0.35 },
  sidevolley: { hand: 'full', fadeIn: 0.2, fadeOut: 0.35 },
  bicycle: { hand: 'full', fadeIn: 0.22, fadeOut: 0.4 },
  cuptheear: { hand: 'upper', fadeIn: 0.2, fadeOut: 0.3, clip: (an, A) => A.set.idle },
  shush: { hand: 'upper', fadeIn: 0.2, fadeOut: 0.3, clip: (an, A) => A.set.idle },
  armscrossed: { hand: 'upper', fadeIn: 0.25, fadeOut: 0.3, clip: (an, A) => A.set.idle },
  salute: { hand: 'upper', fadeIn: 0.2, fadeOut: 0.3, clip: (an, A) => A.set.idle },
  calmdown: { hand: 'upper', fadeIn: 0.2, fadeOut: 0.3, clip: (an, A) => A.set.idle },
  heart: { hand: 'upper', fadeIn: 0.2, fadeOut: 0.3, clip: (an, A) => A.set.idle },
  badgepoint: { hand: 'upper', fadeIn: 0.2, fadeOut: 0.3, clip: (an, A) => A.set.idle },
  robot: { hand: 'full', fadeIn: 0.15, fadeOut: 0.3 },
  backflip: { hand: 'full', fadeIn: 0.06, fadeOut: 0.3 },
  bellyslide: { hand: 'full', fadeIn: 0.1, fadeOut: 0.3 },
  card: { hand: 'full', fadeIn: 0.15, fadeOut: 0.3 },
  // celebrations
  kneeslide: { hand: 'full', fadeIn: 0.12, fadeOut: 0.3 },
  airplane: { hand: 'arms', fadeIn: 0.25, fadeOut: 0.3 },
  jumpfist: { hand: 'arms', fadeIn: 0.2, fadeOut: 0.3, clip: () => 'jumpLoop' },
  spinjump: { hand: 'arms', fadeIn: 0.12, fadeOut: 0.3, clip: () => 'jump', clipFrom: 0.35 },
  pointsky: { hand: 'arms', fadeIn: 0.25, fadeOut: 0.3, clip: (an, A) => A.set.idle },
  teamjump: { hand: 'arms', fadeIn: 0.2, fadeOut: 0.3, clip: () => 'jumpLoop', phaseFrom: 'offset' },
  armsup: { hand: 'arms', fadeIn: 0.25, fadeOut: 0.3 },
  hug: { hand: 'upper', fadeIn: 0.2, fadeOut: 0.3, clip: (an, A) => A.set.idle },
  highfive: { hand: 'arms', fadeIn: 0.1, fadeOut: 0.2 },
  pointat: { hand: 'arms', fadeIn: 0.15, fadeOut: 0.25 },
  thumbsback: { hand: 'upper', fadeIn: 0.25, fadeOut: 0.3, clip: (an, A) => A.set.idle },
  bow: { hand: 'upper', fadeIn: 0.3, fadeOut: 0.3, clip: (an, A) => A.set.idle },
  celebrate: { hand: 'arms', fadeIn: 0.2, fadeOut: 0.3, clip: (an, A) => (A.rand < 0.5 ? 'jumpLoop' : A.rand < 0.75 ? 'happy1' : 'happy2'), handWeight: 0.7 },
};

const SETS = {
  idle: ['idle1', 'idle2'], walk: ['walk1', 'walk2', 'walk3'], jog: ['jog1', 'jog2', 'jog3'],
  run: ['run1', 'run2', 'run3'], sprint: ['sprint1', 'sprint2'], back: ['back1', 'back2'],
};

let uid = 0;

/** What everyone watches: set by the game each frame (the ball). */
export const ANIM_WORLD = { ball: new THREE.Vector3(), on: true };
const NO_LOOK = new Set(['fall', 'dive', 'sitdown', 'crouchsad', 'dejected', 'hipshands', 'gkup', 'smother', 'stumble', 'tackle', 'celebrate', 'kneeslide', 'siu', 'crossarms', 'teamjump', 'gkthrow', 'card', 'volley', 'sidevolley', 'bicycle', 'header', 'hug', 'highfive', 'thumbsback', 'bow', 'armscrossed', 'spinjump', 'airplane', 'backflip', 'bellyslide']);
const _hp = new THREE.Vector3(), _qt = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _fd = new THREE.Vector3(), _dl = new THREE.Vector3(), _qd = new THREE.Quaternion();

/** Steps per second at a running speed (m/s), from sprint studies of footballers / sprinters. */
const CAD = [[0, 1.4], [1.4, 1.85], [2.5, 2.45], [3.5, 2.75], [5, 3.0], [6.5, 3.3], [8, 3.8], [9.3, 4.3], [10.5, 4.55]];
function cadenceAt(v) {
  if (v <= CAD[0][0]) return CAD[0][1];
  for (let i = 1; i < CAD.length; i++) if (v <= CAD[i][0]) { const [a, fa] = CAD[i - 1], [b, fb] = CAD[i]; return fa + ((v - a) / (b - a)) * (fb - fa); }
  return CAD[CAD.length - 1][1];
}

export class Animator {
  constructor(player) {
    this.p = player;
    this.lib = clips();
    const r = Math.random;
    this.rand = r();
    this.id = uid++;
    // every player moves a little differently
    this.style = {
      stride: 0.95 + r() * 0.1,        // leg amplitude → stride length
      arm: 0.85 + r() * 0.4,           // arm swing
      lean: (r() - 0.5) * 0.06,        // posture
      head: (r() - 0.5) * 0.1,
      cadence: 0.97 + r() * 0.06,
    };
    this.set = {};
    for (const k in SETS) this.set[k] = SETS[k][Math.floor(r() * SETS[k].length)];
    this.phase = r();                  // locomotion phase (0 = left footfall)
    this.phaseRate = 0;                // phase per second
    this.pose = newPose();             // final pose this frame
    this.base = newPose();
    this._tmp = newPose(); this._tmp2 = newPose(); this._tmp3 = newPose();
    this._acc = new Accum(); this._accG = new Accum();
    this.layers = [];                  // action layers, oldest first
    this.overlay = null;               // start / stop / cut / turn one-shot
    this.contact = [1, 1];             // foot contact weights (L, R)
    this.spinYaw = 0;
    this.visYaw = 0;                   // extra visual yaw (falls twist toward the hit)
    // physics state
    this.sp = 0; this.prevV = new THREE.Vector2(); this.acc = new THREE.Vector2(); this.accS = new THREE.Vector2();
    this.yawRate = 0; this._lastHeading = player.heading;
    this.lean = new THREE.Vector2(); this.leanV = new THREE.Vector2();       // whole-body lean (pitch, roll)
    this.sec = new THREE.Vector2(); this.secV = new THREE.Vector2();         // torso/head wobble
    this.hit = new THREE.Vector2(); this.hitV = new THREE.Vector2();         // stagger from bumps / tackles
    this.arms = 0; this.armsV = 0;                                           // balance arms
    this.rag = null;                                                         // active fall
    this.idleT = 0;
    // IK state
    this.lock = [null, null];
    this.lockW = [0, 0];
    this.lastFoot = [null, null];
    this.reach = null;                 // { foot: 'L'|'R', x, y, z, t }
    this.T = {};
    this.speedNodes();
  }

  speedNodes() {
    const L = this.lib, s = this.set;
    this.vWalk = L[s.walk].speed; this.vJog = L[s.jog].speed; this.vRun = L[s.run].speed; this.vSprint = L[s.sprint].speed;
  }

  // ------------------------------------------------------------ public helpers
  /** Seconds until `foot` (1 = right, −1 = left) next plants, from the stride phase. */
  footDue(foot) {
    if (this.phaseRate < 0.3) return 9;
    const c = this.lib[this.set.run];
    const at = foot > 0 ? c.strikeR : 0;
    let d = at - this.phase;
    d -= Math.floor(d);
    return d / this.phaseRate;
  }

  pickKick(kind, an) {
    const leg = an.kickLeg >= 0 ? '' : 'L';
    const va = an.variant;
    if (an.setPiece) return (this.rand < 0.5 ? 'kickRunup' : 'kickRunup2') + leg;
    if (kind === 'pass') {
      if (va === 'lofted' || va === 'driven') return 'kickLong' + leg;
      return (this.rand < 0.5 ? 'kickPass' : 'kickPass2') + leg;
    }
    if (va === 'driven' || va === 'offbalance') return 'kickShot2' + leg;
    return (this.rand < 0.6 ? 'kickShot' : 'kickShot2') + leg;
  }

  /** A cut / sidestep clip that turns the right way (side +1 = left turn). */
  pickTurnClip(kind, side) {
    const L = this.lib;
    const names = kind === 'cut' ? ['cutR', 'cutL', 'cutL2', 'cutR2', 'sidestepL', 'sidestepR'] : kind === '90' ? ['turn90L', 'turn90R'] : ['turn180', 'turn180m'];
    const ok = names.filter((n) => L[n] && Math.sign(L[n].yaw) === (side >= 0 ? 1 : -1));
    return ok.length ? ok[(this.id + Math.floor(this.rand * 7)) % ok.length] : names[0];
  }

  pickStumble(an) {
    const s = an.side || 1;
    return (this.rand < 0.5 ? 'stumble1' : 'stumble2') + (s > 0 ? '' : 'm');
  }

  /** Physical knock: dir (x, z) in world space, strength in m/s of velocity change. */
  impulse(x, z, f) {
    const h = this.p.heading;
    const fw = x * Math.sin(h) + z * Math.cos(h);
    const lt = x * Math.cos(h) - z * Math.sin(h); // + = toward the player's left
    // the upper body is thrown along the push (pitch forward = +, roll toward left = −)
    this.hitV.x += fw * f * 0.9;
    this.hitV.y += -lt * f * 0.9;
    this.armsV += Math.min(4, f * 2.2);
    this.lastHit = { x, z, f };
  }

  // ------------------------------------------------------------ actions
  /** Called by Player.playAction (gameplay keeps its own anim.action / anim.t). */
  onAction(name, dur, opts) {
    const spec = ACTIONS[name];
    if (!spec) return;
    this.rand = Math.random();
    const an = { ...opts, name, dur, t: 0, kickLeg: opts.kickLeg ?? 1, side: opts.side ?? 1 };
    if (spec.ragdoll) { this._startFall(an); return; }
    if (spec.react) {
      // a stumble is a push: knock the body the way it's going
      const lh = this.lastHit && this.lastHit.fresh ? this.lastHit : null;
      if (!lh) {
        const h = this.p.heading, sd = an.side;
        this.impulse(Math.sin(h) * 1.2 + Math.cos(h) * sd * 1.4, Math.cos(h) * 1.2 - Math.sin(h) * sd * 1.4, 1.4);
      }
    }
    const layer = {
      name, spec, an, w: 0, fade: 1, t: 0,
      clip: spec.clip ? spec.clip(an, this) : null,
      hand: spec.handMask ? spec.handMask(an) : spec.hand || null,
      fadeIn: spec.fadeIn ?? 0.08, fadeOut: spec.fadeOut ?? 0.2,
      ended: false,
    };
    if (layer.clip && !this.lib[layer.clip]) layer.clip = null;
    if (layer.clip) this._timeClip(layer, spec, an);
    // older layers fade out
    for (const l of this.layers) l.ended = true;
    this.layers.push(layer);
    if (this.layers.length > 4) this.layers.shift();
  }

  /** Map gameplay time → clip time. Kicks hit the ball on the clip's strike frame at an.contactAt. */
  _timeClip(layer, spec, an) {
    const c = this.lib[layer.clip];
    layer.c = c;
    if (spec.kick && c.contact != null) {
      const tc = c.contact / 30;
      const ca = an.contactAt ?? 0.09;
      const pre = an.setPiece ? Math.min(tc, ca * 1.0) : Math.min(tc, 0.24);
      layer.c0 = tc - pre;                       // where the clip starts
      layer.rate1 = ca > 0.01 ? pre / ca : 4;    // wind-up speed (time-warped)
      layer.tc = tc;
      layer.rate2 = 1.15;                        // follow-through
      layer.end = Math.min(c.dur, tc + 0.42);
      layer.contactAt = ca;
    } else if (layer.name === 'turn') {
      // the plant-and-push-off part of a cut, played quickly
      layer.c0 = c.dur * 0.18; layer.rate1 = 1.45; layer.end = c.dur * 0.72;
    } else if (layer.name === 'stumble') {
      layer.c0 = 0; layer.rate1 = c.dur / Math.max(0.5, an.dur * 1.2); layer.end = c.dur;
    } else {
      layer.c0 = (spec.clipFrom || 0) * c.dur; layer.rate1 = 1; layer.end = c.loop ? Infinity : c.dur;
      if (spec.phaseFrom === 'offset') layer.c0 = ((an.offset || 0) * 0.37) % c.dur;
    }
  }

  _clipTime(layer) {
    if (layer.tc != null) {
      const t = layer.t;
      return t < layer.contactAt ? layer.c0 + t * layer.rate1 : layer.tc + (t - layer.contactAt) * layer.rate2;
    }
    return layer.c0 + layer.t * layer.rate1;
  }

  // ------------------------------------------------------------ main update
  update(dt, hasBall) {
    const p = this.p, an = p.anim;
    this.spinYaw = 0;
    const out = this.pose;
    if (dt <= 0) return out;
    if (this.debugGait != null) { gaitPose(this.debugGait, this.debugGaitV || 9, out); this.contact[0] = this.contact[1] = 0; return out; }
    if (this.debugClip) {
      // viewer / tests: show one clip as-is
      this._dbgT = (this._dbgT || 0) + dt;
      const c = this.lib[this.debugClip];
      c.sample(c.loop ? this._dbgT : Math.min(this._dbgT, c.dur), out);
      const bits = c.contactAt(this._dbgT);
      this.contact[0] = bits & 1 ? 1 : 0; this.contact[1] = bits & 2 ? 1 : 0;
      return out;
    }
    // ---- motion state (visual): speed, local velocity, acceleration, yaw rate
    const vx = p.vel.x, vz = p.vel.z;
    const speed = Math.hypot(vx, vz);
    this.sp += (speed - this.sp) * (1 - Math.exp(-14 * dt));
    const h = p.heading;
    const sh = Math.sin(h), ch = Math.cos(h);
    const vf = vx * sh + vz * ch, vl = vx * ch - vz * sh;
    let dh = h - this._lastHeading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this._lastHeading = h;
    this.yawRate += (clamp(dh / dt, -10, 10) - this.yawRate) * (1 - Math.exp(-10 * dt));
    const ax = (vx - this.prevV.x) / dt, az = (vz - this.prevV.y) / dt;
    this.prevV.set(vx, vz);
    this.acc.set(clamp(ax * sh + az * ch, -25, 25), clamp(ax * ch - az * sh, -25, 25)); // (forward, left)
    this.accS.lerp(this.acc, 1 - Math.exp(-12 * dt));

    // ---- locomotion base
    this._locomotion(dt, this.sp, vf, vl, hasBall, out);
    this._overlays(dt, p, hasBall, out);

    // ---- action layers
    this._layers(dt, an, out);
    if (this.rag) this._ragdoll(dt, out);

    // ---- physics on top
    this._physics(dt, hasBall, out);
    this._styleArms(out);
    return out;
  }

  // ------------------------------------------------------------ locomotion blend tree
  _locomotion(dt, s, vf, vl, hasBall, out) {
    const L = this.lib, set = this.set;
    // directional groups: forward, backpedal, strafe (defenders jockeying)
    let wF = 1, wB = 0, wS = 0;
    if (s > 0.25) {
      const c = vf / s, sn = vl / s;
      wF = Math.max(0, c) ** 2; wB = Math.max(0, -c) ** 2; wS = sn * sn;
      const t = wF + wB + wS; wF /= t; wB /= t; wS /= t;
    }
    // idle: occasionally switch idles / gaits so nobody loops in sync
    if (s < 0.2) {
      this.idleT += dt;
      if (this.idleT > 6 + this.rand * 6) {
        this.idleT = 0;
        for (const k of ['idle', 'walk', 'jog']) this.set[k] = SETS[k][Math.floor(Math.random() * SETS[k].length)];
        this.speedNodes();
      }
    } else this.idleT = 0;

    const acc = this._accG;
    acc.reset();
    const tmp = this._tmp;
    const ph = this.phase;
    let strideSum = 0, strideW = 0, cL = 0, cR = 0, cW = 0;
    const strideK = this.style.stride * (hasBall ? 0.88 : 1);
    const sample = (name, w, phase = ph) => {
      if (w <= 1e-3) return;
      const c = L[name];
      c.sampleNorm(phase, tmp);
      acc.add(tmp, w);
      const bits = c.contactAt(phase * c.dur);
      cL += (bits & 1 ? 1 : 0) * w; cR += (bits & 2 ? 1 : 0) * w; cW += w;
      if (c.speed > 0.1) { strideSum += c.speed * c.dur * w; strideW += w; }
    };
    const idleW = (v1) => clamp(1 - s / v1, 0, 1);
    const idleName = this.p.isKeeper || this.ready ? 'ready' : set.idle;
    const idleT = this.p.anim.time || 0;
    const idle = (w) => {
      if (w <= 1e-3) return;
      const c = L[idleName];
      c.sample(idleT + this.id * 0.7, tmp);
      acc.add(tmp, w);
      cL += w; cR += w; cW += w;
    };

    // forward: idle ↔ walk ↔ jog ↔ run ↔ sprint, with turn variants for jog/run
    if (wF > 1e-3) {
      const v = [0, this.vWalk, this.vJog, this.vRun, this.vSprint];
      const w = [0, 0, 0, 0, 0];
      if (s >= v[4]) w[4] = 1;
      else for (let i = 0; i < 4; i++) if (s >= v[i] && s < v[i + 1]) { const t = (s - v[i]) / (v[i + 1] - v[i]); w[i] = 1 - t; w[i + 1] = t; }
      idle(w[0] * wF);
      sample(set.walk, w[1] * wF);
      const yr = this.yawRate, side = yr >= 0 ? 'L' : 'R';
      const tj = clamp(Math.abs(yr) / 0.56, 0, 1), tr = clamp(Math.abs(yr) / 0.94, 0, 1);
      sample(set.jog, w[2] * wF * (1 - tj));
      sample('jogTurn' + side, w[2] * wF * tj);
      sample(set.run, w[3] * wF * (1 - tr));
      sample('runTurn' + side + (this.id & 1 ? '2' : ''), w[3] * wF * tr);
      sample(set.sprint, w[4] * wF);
    }
    if (wB > 1e-3) {
      const c = L[set.back], wi = idleW(c.speed * 0.6);
      idle(wB * wi);
      sample(set.back, wB * (1 - wi));
    }
    if (wS > 1e-3) {
      const name = vl >= 0 ? 'strafeL' : 'strafeR';
      const c = L[name], wi = idleW(c.speed * 0.4);
      idle(wS * wi);
      sample(name, wS * (1 - wi));
    }
    acc.out(out);

    // at real running speeds, hand over to the biomechanical sprint gait (long strides, real cadence)
    const wP = wF * clamp((s - 4.6) / 1.8, 0, 1) * 0.9;
    this.gaitW = wP;
    if (wP > 0.01) {
      const D = gaitPose(this.phase, s, this._tmp3, this.style);
      blendInto(out, this._tmp3, wP);
      const ph = this.phase, cLg = ph < D ? 1 : 0, cRg = ((ph + 0.5) % 1) < D ? 1 : 0;
      cL = cL * (1 - wP) * (cW ? 1 / cW : 0) * cW + cLg * wP * cW; cR = cR * (1 - wP) + cRg * wP * cW;
    }

    // stride: phase speed so planted feet don't slide (ground speed / stride length)
    let stride = strideW > 0 ? strideSum / strideW : L[set.walk].speed * L[set.walk].dur;
    let amp = strideK;
    if (s < this.vWalk) stride *= 0.55 + 0.45 * (s / this.vWalk);  // tiny steps when shuffling
    stride *= amp;
    let rate = s > 0.05 ? (s / Math.max(0.3, stride)) * this.style.cadence : 0;
    // Real footballers lengthen their stride far more than they quicken it: about 2.75
    // steps/s at a 3.5 m/s jog, ~3.3 at 6.5 m/s, ~4.3 at a 9.3 m/s sprint (≈2.1 m per step).
    // The mocap runs are slow, so above a jog we hold the cadence to that curve and open the
    // legs up instead (bigger hip / knee swing) — no more legs spinning at 7–8 steps a second.
    if (wF > 0.5 && s > 3.4) {
      const want = cadenceAt(s) * 0.5 * this.style.cadence;          // cycles per second
      const ramp = clamp((s - 3.4) / 1.2, 0, 1);
      const extra = Math.min(clamp(rate / want, 1, 1.5), 1 + 0.5 * (1 - this.gaitW)) * ramp + (1 - ramp);
      // the gait layer sets its own stride: cadence straight from the curve
      rate = this.gaitW > 0.01 ? want : rate / extra;
      amp *= extra * (1 - this.gaitW) + this.gaitW;
      this.strideExtra = extra;
    } else this.strideExtra = 1;
    this.phaseRate = rate;
    // turning on the spot: little shuffle steps
    if (s < 0.6 && Math.abs(this.yawRate) > 1.5) this.phaseRate = Math.max(this.phaseRate, 0.9);
    this.phase = (this.phase + this.phaseRate * dt) % 1;
    this.contact[0] = cW > 0 ? cL / cW : 1; this.contact[1] = cW > 0 ? cR / cW : 1;
    // leg amplitude around the mean stride pose
    if (amp !== 1 && s > 0.3) this._scaleLegs(out, L[s > this.vRun ? set.sprint : s > this.vJog ? set.run : s > this.vWalk ? set.jog : set.walk].mean, amp);
    this.p.anim.phase = this.phase * TAU; // legacy: Possession reads it
  }

  _scaleLegs(p, mean, k) {
    for (const j of [Q.hipL, Q.hipR]) {
      let x = mean[j], y = mean[j + 1], z = mean[j + 2], w = mean[j + 3];
      if (x * p[j] + y * p[j + 1] + z * p[j + 2] + w * p[j + 3] < 0) { x = -x; y = -y; z = -z; w = -w; }
      const nx = x + (p[j] - x) * k, ny = y + (p[j + 1] - y) * k, nz = z + (p[j + 2] - z) * k, nw = w + (p[j + 3] - w) * k;
      const l = Math.hypot(nx, ny, nz, nw) || 1;
      p[j] = nx / l; p[j + 1] = ny / l; p[j + 2] = nz / l; p[j + 3] = nw / l;
    }
    for (const j of [H.kneeL, H.kneeR]) p[j] = clamp(mean[j] + (p[j] - mean[j]) * Math.min(k, 1.6), 0, 2.35);
  }

  // ------------------------------------------------------------ starts, stops, cuts, turns
  _overlays(dt, p, hasBall, out) {
    const L = this.lib;
    const s = this.sp;
    const want = p.moveSpeed * (hasBall ? p.attrs.dribbleSpeed : 1);
    let o = this.overlay;
    const busy = this.layers.some((l) => !l.ended && l.w > 0.3);
    if (!o && !busy && !this.rag) {
      const mdx = p.moveDir.x, mdz = p.moveDir.z;
      const turn = want > 0.5 ? Math.atan2(mdx * Math.cos(p.heading) - mdz * Math.sin(p.heading), mdx * Math.sin(p.heading) + mdz * Math.cos(p.heading)) : 0;
      if (s < 0.9 && want > 3.2 && this.accS.x > 2) {
        // explosive start: drive out low
        const name = ['start1', 'start2', 'start3'][Math.floor(Math.random() * 3)];
        o = { kind: 'start', c: L[name], t: 0, w: 0 };
        o.t = this._timeForSpeed(o.c, s, true);
      } else if (s > 3 && want < 0.6 && this.accS.x < -4) {
        const name = ['stop1', 'stop2', 'stop3'][Math.floor(Math.random() * 3)];
        o = { kind: 'stop', c: L[name], t: 0, w: 0 };
        o.t = this._timeForSpeed(o.c, s, false);
      } else if (s > 2.8 && !hasBall && Math.abs(turn) > 1.1 && p.stumble <= 0) {
        // sharp change of direction: plant and push off
        const c = L[this.pickTurnClip('cut', Math.sign(turn))];
        o = { kind: 'cut', c, t: c.dur * 0.2, w: 0, end: c.dur * 0.75, rate: 1.4 };
      } else if (s < 1.6 && want > 0.4 && Math.abs(turn) > 2.4 && !hasBall) {
        const c = L[this.pickTurnClip('180', Math.sign(turn))];
        o = { kind: 'turn', c, t: c.dur * 0.15, w: 0, end: c.dur * 0.8, rate: 1.8 };
      }
      this.overlay = o;
    }
    if (!o) return;
    // advance: starts/stops follow the actual speed, cuts/turns run on time
    if (o.kind === 'start') {
      o.t = Math.max(o.t + dt * 0.6, this._timeForSpeed(o.c, s, true));
      o.target = s < o.c.speedEnd * 0.85 && o.t < o.c.dur - 0.15 && want > 1 ? 1 : 0;
    } else if (o.kind === 'stop') {
      o.t = Math.max(o.t + dt * (s < 0.3 ? 1 : 0.6), this._timeForSpeed(o.c, s, false));
      o.target = o.t < o.c.dur - 0.2 && want < 0.8 ? 1 : 0;
    } else {
      o.t += dt * o.rate;
      o.target = o.t < o.end ? 1 : 0;
    }
    const k = 1 - Math.exp(-dt / (o.target ? 0.07 : 0.1));
    o.w += (o.target * 0.9 - o.w) * k;
    if (!o.target && o.w < 0.02) { this.overlay = null; return; }
    o.c.sample(o.t, this._tmp2);
    blendInto(out, this._tmp2, o.w);
    const bits = o.c.contactAt(o.t);
    this.contact[0] += ((bits & 1 ? 1 : 0) - this.contact[0]) * o.w;
    this.contact[1] += ((bits & 2 ? 1 : 0) - this.contact[1]) * o.w;
  }

  /** Clip time at which a start (rising) / stop (falling) clip moves at speed v. */
  _timeForSpeed(c, v, rising) {
    if (!c.speedTab) {
      c.speedTab = [];
      for (let f = 0; f < c.n; f++) c.speedTab.push(c.speedAt(f / 30));
      c.speedEnd = Math.max(...c.speedTab.slice(-6));
      c.speedTop = Math.max(...c.speedTab);
    }
    const T = c.speedTab;
    if (rising) { for (let f = 0; f < T.length; f++) if (T[f] >= v) return f / 30; return c.dur; }
    let top = 0; for (let f = 0; f < T.length; f++) if (T[f] > T[top]) top = f;
    for (let f = top; f < T.length; f++) if (T[f] <= v) return f / 30;
    return c.dur;
  }

  // ------------------------------------------------------------ action layers
  _layers(dt, an, out) {
    // the gameplay action ending (or replaced) fades its layer out
    for (const l of this.layers) {
      if (!l.ended && an.action !== l.name) l.ended = true;
    }
    const T = this.T;
    for (let i = 0; i < this.layers.length; i++) {
      const l = this.layers[i];
      l.t += dt;
      l.an.t = l.t;
      const clipDone = l.c && !l.c.loop && this._clipTime(l) >= l.end;
      const alive = !l.ended && !(clipDone && !l.an.hold);
      const target = alive || (l.c && l.spec.kick && !clipDone) ? 1 : 0;
      const tau = target ? l.fadeIn : l.fadeOut;
      l.w += (target - l.w) * (1 - Math.exp(-dt / Math.max(0.02, tau * 0.45)));
      if (!target && l.w < 0.01) { this.layers.splice(i--, 1); continue; }
      const base = this._tmp3;
      if (l.c) {
        const ct = Math.min(this._clipTime(l), l.c.loop ? Infinity : l.c.dur - 1e-3);
        l.c.sample(l.an.hold && clipDone ? l.c.dur - 1e-3 : ct, base);
        if (l.spec.clipWeight != null) { const b2 = this._tmp2; b2.set(out); blendInto(b2, base, l.spec.clipWeight); base.set(b2); }
        // a kick: the striking foot meets the ball on the clip's contact frame
        if (l.spec.kick && l.tc != null) l.kickPhase = this._clipTime(l) - l.tc;
      } else base.set(out);
      if (l.hand) {
        for (const k of HAND_KEYS) T[k] = NaN;
        const k = l.an.dur > 0 ? clamp(l.t / l.an.dur, 0, 1) : 0;
        const o = { spinYaw: 0 };
        const lan = l.an;
        handPose(l.name, l.an.loop ? (l.t % lan.dur) / lan.dur : k, T, lan, o);
        if (o.spinYaw) this.spinYaw = o.spinYaw * l.w + this.spinYaw * (1 - l.w);
        this._applyHand(T, base, MASK[l.hand], l.spec.handWeight ?? 1);
      }
      blendInto(out, base, l.w);
      // feet: a clip says which foot is down; a hand-made move frees the legs it moves
      if (l.c) {
        const bits = l.c.contactAt(Math.min(this._clipTime(l), l.c.dur));
        this.contact[0] += ((bits & 1 ? 1 : 0) - this.contact[0]) * l.w;
        this.contact[1] += ((bits & 2 ? 1 : 0) - this.contact[1]) * l.w;
      } else if (l.hand) {
        const m = MASK[l.hand];
        if (!Number.isNaN(T.hipL) || !Number.isNaN(T.kneeL)) this.contact[0] *= 1 - l.w * m[3];
        if (!Number.isNaN(T.hipR) || !Number.isNaN(T.kneeR)) this.contact[1] *= 1 - l.w * m[4];
      }
    }
  }

  /** Convert hand-pose keys to joint rotations and blend them in (only joints the move sets). */
  _applyHand(T, p, mask, w) {
    const set = (k) => !Number.isNaN(T[k]);
    const val = (k, d) => (set(k) ? T[k] : d);
    const put = (jo, ex, ey, ez, m) => {
      if (m <= 0) return;
      _e.set(ex, ey, ez, 'XYZ'); _q.setFromEuler(_e);
      let x = _q.x, y = _q.y, z = _q.z, ww = _q.w;
      if (x * p[jo] + y * p[jo + 1] + z * p[jo + 2] + ww * p[jo + 3] < 0) { x = -x; y = -y; z = -z; ww = -ww; }
      const t = m * w;
      const nx = p[jo] + (x - p[jo]) * t, ny = p[jo + 1] + (y - p[jo + 1]) * t, nz = p[jo + 2] + (z - p[jo + 2]) * t, nw = p[jo + 3] + (ww - p[jo + 3]) * t;
      const l = Math.hypot(nx, ny, nz, nw) || 1;
      p[jo] = nx / l; p[jo + 1] = ny / l; p[jo + 2] = nz / l; p[jo + 3] = nw / l;
    };
    const hinge = (i, v, m) => { if (m > 0) p[i] += (v - p[i]) * m * w; };
    if (set('bodyPitch') || set('bodyRoll')) put(Q.pelvis, val('bodyPitch', 0), 0, val('bodyRoll', 0), mask[0]);
    if (set('bodyY')) p[OFF + 1] += (0.92 + T.bodyY - p[OFF + 1]) * mask[0] * w;
    if (set('lean') || set('twist') || set('roll')) put(Q.torso, val('lean', 0.05), val('twist', 0), val('roll', 0), mask[1]);
    if (set('headPitch')) put(Q.head, T.headPitch, 0, 0, mask[2]);
    for (const [s, qi, kn, mi] of [['L', Q.hipL, H.kneeL, 3], ['R', Q.hipR, H.kneeR, 4]]) {
      if (set('hip' + s)) put(qi, -T['hip' + s], 0, 0, mask[mi]);
      if (set('knee' + s)) hinge(kn, T['knee' + s], mask[mi]);
    }
    for (const [s, qi, el, mi, sg] of [['L', Q.shL, H.elL, 5, 1], ['R', Q.shR, H.elR, 6, -1]]) {
      if (set('sh' + s) || set('sh' + s + 'z')) put(qi, -val('sh' + s, 0), 0, val('sh' + s + 'z', 0.1 * sg), mask[mi]);
      if (set('el' + s)) hinge(el, -T['el' + s], mask[mi]);
    }
  }

  // ------------------------------------------------------------ falls (spring-driven ragdoll-lite)
  _startFall(an) {
    const p = this.p;
    // direction of the fall: from the last hit, else from the side / the way he was running
    let dx, dz, f;
    const lh = this.lastHit;
    if (lh && lh.fresh) { dx = lh.x; dz = lh.z; f = lh.f; } else {
      const h = p.heading, sd = an.side || 1;
      const sp = Math.max(1.5, p.speed);
      dx = Math.sin(h) * sp + Math.cos(h) * sd * 1.2; dz = Math.cos(h) * sp - Math.sin(h) * sd * 1.2; f = 2.5;
    }
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    // fall forward or backward relative to the body; twist the visual yaw toward the push
    const h = p.heading;
    const fw = dx * Math.sin(h) + dz * Math.cos(h);
    const forward = fw >= -0.2;
    const fallYaw = Math.atan2(dx, dz) - (forward ? 0 : Math.PI);
    let twist = Math.atan2(Math.sin(fallYaw - h), Math.cos(fallYaw - h));
    twist = clamp(twist, -1.4, 1.4);
    const getup = forward ? 'getupFront' : (Math.random() < 0.5 ? 'getupBack' : 'getupSide');
    this.rag = {
      t: 0, phi: 0.05, omega: 0.9 + Math.min(2.2, f * 0.45), forward, twist, yaw0: 0,
      state: 'topple', getup: this.lib[getup], gt: 0, groundT: 0, from: newPose(), lying: newPose(),
      clip: this.lib[forward ? 'fallFwd' : (Math.random() < 0.5 ? 'fallBack' : 'fallSlip')],
    };
    this.rag.from.set(this.pose);
    // gameplay: down for the topple + a quick get-up (movement is blocked while the action runs)
    p.anim.dur = Math.max(p.anim.dur, 1.45);
    for (const l of this.layers) l.ended = true;
    this.overlay = null;
    this.lock = [null, null];
  }

  _ragdoll(dt, out) {
    const r = this.rag;
    r.t += dt;
    const lieTarget = 1.42;
    if (r.state === 'topple') {
      // inverted pendulum about the feet: gravity speeds the fall up
      const Lc = 0.95;
      r.omega += (G / Lc) * Math.sin(r.phi) * dt * 0.85;
      r.phi += r.omega * dt;
      if (r.phi >= lieTarget) { r.phi = lieTarget; r.omega *= -0.18; r.state = 'ground'; r.groundT = 0; this.hitV.x += r.forward ? 1.5 : -1.5; }
    } else if (r.state === 'ground') {
      r.omega -= r.omega * 8 * dt; r.phi = Math.min(lieTarget, r.phi + r.omega * dt);
      r.groundT += dt;
      // a fouled player stays down until the referee has dealt with it
      if (r.groundT > 0.22 && !this.p.stayDown) { r.state = 'getup'; r.gt = 0; r.lying.set(out); }
    } else if (r.state === 'getup') {
      r.gt += dt * 2.6;
      if (r.gt >= r.getup.dur * 0.97) { this.rag = null; this.p.anim.action === 'fall' && (this.p.anim.action = null); return; }
      // let play resume for the last steps of the get-up
      if (r.gt > r.getup.dur * 0.78 && this.p.anim.action === 'fall') this.p.anim.action = null;
    }
    const tw = clamp(r.phi / 0.6, 0, 1);
    this.visYaw = r.twist * tw * (r.state === 'getup' ? clamp(1 - r.gt / (r.getup.dur * 0.8), 0, 1) : 1);
    if (r.state !== 'getup') {
      // limbs: the fall clip gives the reaching arms / buckling legs, sampled by how far over he is
      const k = clamp(r.phi / lieTarget, 0, 1);
      r.clip.sample(Math.min(r.clip.dur * 0.55, k * r.clip.dur * 0.55), this._tmp2);
      out.set(r.from);
      blendInto(out, this._tmp2, clamp(k * 1.6, 0, 1), [0, 1, 1, 1, 1, 1, 1]);
      // whole body pivots over the feet
      const s = r.forward ? 1 : -1;
      _q.setFromAxisAngle(X_AXIS, s * r.phi);
      _q2.set(out[Q.pelvis], out[Q.pelvis + 1], out[Q.pelvis + 2], out[Q.pelvis + 3]);
      _q2.premultiply(_q);
      out[Q.pelvis] = _q2.x; out[Q.pelvis + 1] = _q2.y; out[Q.pelvis + 2] = _q2.z; out[Q.pelvis + 3] = _q2.w;
      _v.set(out[OFF], out[OFF + 1] - 0.05, out[OFF + 2]).applyQuaternion(_q);
      out[OFF] = _v.x; out[OFF + 1] = Math.max(0.15 + 0.05 * (1 - k), _v.y + 0.05); out[OFF + 2] = _v.z * 0.85;
      // knees fold as he goes down, arms brace forward / flail back
      out[H.kneeL] += 0.6 * k; out[H.kneeR] += 0.45 * k;
      this.arms = Math.max(this.arms, 0.6 * (1 - k));
    } else {
      // get up: the clip starts lying down the same way he landed
      const g = r.getup;
      g.sample(r.gt, this._tmp2);
      out.set(this._tmp2);
      const bw = clamp(r.gt / 0.45, 0, 1);
      if (bw < 1) { const b = this._tmp; b.set(r.lying); blendInto(b, this._tmp2, bw); out.set(b); }
    }
  }

  // ------------------------------------------------------------ physics
  _physics(dt, hasBall, out) {
    const p = this.p;
    const a = this.accS;
    const s = this.sp;
    // momentum lean: drive forward when accelerating, sit back when braking,
    // lean into the turn (centripetal acceleration)
    const latAcc = this.yawRate * s;     // + = turning left
    const turnClip = clamp(Math.abs(this.yawRate) / 0.94, 0, 1) * (s > 2.4 ? 0.12 : 0);
    let tp = clamp(Math.atan2(a.x, G) * 0.5, -0.32, 0.3) + this.style.lean + (hasBall ? 0.04 : 0);
    let tr = clamp(-Math.atan2(latAcc, G) * 0.55, -0.42, 0.42);
    tr -= Math.sign(tr) * Math.min(Math.abs(tr), turnClip);
    const acting = this.rag || this.layers.some((l) => l.w > 0.5 && (l.c || l.spec.hand === 'full'));
    if (acting) { tp *= 0.3; tr *= 0.3; }
    this._spring(this.lean, this.leanV, tp, tr, 140, 22, dt);
    // torso/head inertia: lags behind the body's acceleration, then wobbles
    const si = acting ? 0.3 : 1;
    this._spring(this.sec, this.secV, clamp(-a.x * 0.012, -0.2, 0.2) * si, clamp(a.y * 0.01, -0.15, 0.15) * si, 110, 9, dt);
    // stagger from bumps and tackles
    this._spring(this.hit, this.hitV, 0, 0, 70, 8, dt);
    this.armsV += (-this.arms * 60 - this.armsV * 9) * dt;
    this.arms = clamp(this.arms + this.armsV * dt, 0, 1.2);
    if (this.lastHit) this.lastHit.fresh = false;

    // whole body about the feet
    const lp = this.lean.x + this.hit.x * 0.6, lr = this.lean.y + this.hit.y * 0.6;
    if (Math.abs(lp) + Math.abs(lr) > 1e-4) {
      _e.set(lp, 0, lr, 'XYZ'); _q.setFromEuler(_e);
      _q2.set(out[Q.pelvis], out[Q.pelvis + 1], out[Q.pelvis + 2], out[Q.pelvis + 3]).premultiply(_q);
      out[Q.pelvis] = _q2.x; out[Q.pelvis + 1] = _q2.y; out[Q.pelvis + 2] = _q2.z; out[Q.pelvis + 3] = _q2.w;
      _v.set(out[OFF], out[OFF + 1], out[OFF + 2]).applyQuaternion(_q);
      out[OFF] = _v.x; out[OFF + 2] = _v.z; out[OFF + 1] = _v.y;
    }
    // upper body
    const tp2 = this.sec.x + this.hit.x * 0.5, tr2 = this.sec.y + this.hit.y * 0.5;
    if (Math.abs(tp2) + Math.abs(tr2) > 1e-4) {
      _e.set(tp2, 0, tr2, 'XYZ'); _q.setFromEuler(_e);
      _q2.set(out[Q.torso], out[Q.torso + 1], out[Q.torso + 2], out[Q.torso + 3]).premultiply(_q);
      out[Q.torso] = _q2.x; out[Q.torso + 1] = _q2.y; out[Q.torso + 2] = _q2.z; out[Q.torso + 3] = _q2.w;
      // the head keeps the eyes level-ish
      _e.set(-tp2 * 0.6 + this.style.head, 0, -tr2 * 0.5, 'XYZ'); _q.setFromEuler(_e);
      _q2.set(out[Q.head], out[Q.head + 1], out[Q.head + 2], out[Q.head + 3]).premultiply(_q);
      out[Q.head] = _q2.x; out[Q.head + 1] = _q2.y; out[Q.head + 2] = _q2.z; out[Q.head + 3] = _q2.w;
    }
    // balance arms: thrown out after a knock
    if (this.arms > 0.01) {
      for (const [j, sg] of [[Q.shL, 1], [Q.shR, -1]]) {
        _q.setFromAxisAngle(Z_AXIS, sg * this.arms * 0.9);
        _q2.set(out[j], out[j + 1], out[j + 2], out[j + 3]).premultiply(_q);
        out[j] = _q2.x; out[j + 1] = _q2.y; out[j + 2] = _q2.z; out[j + 3] = _q2.w;
      }
    }
  }

  _spring(x, v, tx, ty, k, c, dt) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) {
      v.x += (k * (tx - x.x) - c * v.x) * h; v.y += (k * (ty - x.y) - c * v.y) * h;
      x.x += v.x * h; x.y += v.y * h;
    }
  }

  /** Arm swing scale per player, and keep the arms clear of the torso. */
  _styleArms(out) {
    const k = this.style.arm;
    const mean = this.lib[this.set.run].mean;
    for (const [j, sg] of [[Q.shL, 1], [Q.shR, -1]]) {
      if ((k !== 1 || (this.strideExtra || 1) > 1) && this.sp > 1) {
        let x = mean[j], y = mean[j + 1], z = mean[j + 2], w = mean[j + 3];
        if (x * out[j] + y * out[j + 1] + z * out[j + 2] + w * out[j + 3] < 0) { x = -x; y = -y; z = -z; w = -w; }
        const t = (1 + (k - 1) * clamp(this.sp / 4, 0, 1)) * (1 + ((this.strideExtra || 1) - 1) * 0.55);
        const nx = x + (out[j] - x) * t, ny = y + (out[j + 1] - y) * t, nz = z + (out[j + 2] - z) * t, nw = w + (out[j + 3] - w) * t;
        const l = Math.hypot(nx, ny, nz, nw) || 1;
        out[j] = nx / l; out[j + 1] = ny / l; out[j + 2] = nz / l; out[j + 3] = nw / l;
      }
      // upper arm direction in torso space; push it out if it would cut into the body
      _q.set(out[j], out[j + 1], out[j + 2], out[j + 3]);
      _v.set(0, -1, 0).applyQuaternion(_q);
      const minX = 0.08;
      if (_v.y < -0.3 && _v.x * sg < minX) {
        const ang = (minX - _v.x * sg) * 1.05;
        _q2.setFromAxisAngle(Z_AXIS, sg * ang);
        _q.premultiply(_q2);
        out[j] = _q.x; out[j + 1] = _q.y; out[j + 2] = _q.z; out[j + 3] = _q.w;
      }
    }
  }

  // ------------------------------------------------------------ rig + IK (render time)
  /** Write the pose to the scene graph. */
  apply(pose, parts, sc) {
    const P = parts;
    const qset = (o, i) => o.quaternion.set(pose[i], pose[i + 1], pose[i + 2], pose[i + 3]);
    qset(P.body, Q.pelvis); qset(P.torso, Q.torso); qset(P.head, Q.head);
    qset(P.legL.hip, Q.hipL); qset(P.legR.hip, Q.hipR);
    qset(P.armL.sh, Q.shL); qset(P.armR.sh, Q.shR);
    P.legL.knee.quaternion.setFromAxisAngle(X_AXIS, pose[H.kneeL]);
    P.legR.knee.quaternion.setFromAxisAngle(X_AXIS, pose[H.kneeR]);
    P.legL.ankle.quaternion.setFromAxisAngle(X_AXIS, pose[H.ankL]);
    P.legR.ankle.quaternion.setFromAxisAngle(X_AXIS, pose[H.ankR]);
    P.armL.el.quaternion.setFromAxisAngle(X_AXIS, pose[H.elL]);
    P.armR.el.quaternion.setFromAxisAngle(X_AXIS, pose[H.elR]);
    // the mocap was retargeted to a 0.92 m pelvis; the human body stands a little taller
    // (blend the extra height out as he goes to ground so lying poses stay on the grass)
    // legs are longer than the rig the mocap was retargeted to: scale the pelvis height with them
    P.body.position.set(pose[OFF] * sc, pose[OFF + 1] * (RIG.bodyY / 0.92) * sc, pose[OFF + 2] * sc);
  }

  /**
   * Foot IK after the root is placed: planted feet stay locked to the grass,
   * feet never go through it, and a touching / kicking foot reaches the ball.
   */
  solveIK(parts, sc, dt) {
    const root = parts.root;
    root.updateMatrixWorld(true);
    const ground = RIG.ankleH * sc;
    for (let i = 0; i < 2; i++) {
      const leg = i ? parts.legR : parts.legL;
      const ank = _v.setFromMatrixPosition(leg.ankle.matrixWorld);
      // full-body moves (slides, dives, sitting, celebrations) place their own feet: planting
      // them would drag and snap the legs as the body moves
      const act = ACTIONS[this.p.anim.action];
      const free = act && (act.hand === 'full' || act.hand === 'dive');
      const want = this.contact[i] > 0.6 && !this.rag && this.sp < 9.5 && !free;
      let tx = ank.x, ty = Math.max(ank.y, ground), tz = ank.z, w = 0;
      // planted foot: lock where it landed
      if (want) {
        // lock where the foot actually is now (after last frame's IK), so it never jumps
        if (!this.lock[i]) { const f = this.lastFoot[i]; this.lock[i] = f && Math.hypot(f.x - ank.x, f.z - ank.z) < 0.3 ? new THREE.Vector3(f.x, ground, f.z) : new THREE.Vector3(ank.x, ground, ank.z); }
        const L = this.lock[i];
        if (Math.hypot(L.x - ank.x, L.z - ank.z) > (this.sp > 5 ? 0.35 : 0.5) * sc) { L.set(ank.x, ground, ank.z); }
        this.lockW[i] = Math.min(1, this.lockW[i] + dt * 30);
      } else {
        // let go fast at speed: a sprinting foot is only down ~0.1 s
        this.lockW[i] = Math.max(0, this.lockW[i] - dt * (10 + this.sp * 6));
        if (this.lockW[i] <= 0) this.lock[i] = null;
      }
      if (this.lock[i] && this.lockW[i] > 0) {
        const L = this.lock[i], lw = this.lockW[i];
        tx += (L.x - tx) * lw; tz += (L.z - tz) * lw; ty += (L.y - ty) * lw * 0.8;
        w = 1;
      }
      // reach for the ball (dribble touch / kick contact)
      const r = this.reach;
      if (r && r.foot === i) {
        const age = r.age;
        const rw = age < 0 ? clamp(1 + age / 0.1, 0, 1) : clamp(1 - age / r.hold, 0, 1);
        if (rw > 0 && this.lockW[i] < 1) {
          tx += (r.x - tx) * rw; ty += (Math.max(ground, r.y) - ty) * rw; tz += (r.z - tz) * rw;
          w = 1;
        }
      }
      if (ank.y < ground) w = 1;
      if (w) this._ik2(leg, parts.body, tx, ty, tz, sc);
      (this.lastFoot[i] || (this.lastFoot[i] = new THREE.Vector3())).setFromMatrixPosition(leg.ankle.matrixWorld);
    }
    if (this.reach) { this.reach.age += dt; if (this.reach.age > this.reach.hold) this.reach = null; }
    this._look(parts, dt);
  }

  /**
   * Watch the ball: the head (and a little of the trunk) turns to follow it, with
   * glances away to scan the pitch — players check their shoulders constantly;
   * the man on the ball looks down at it and lifts his head every second or so.
   */
  _look(parts, dt) {
    if (!ANIM_WORLD.on || dt <= 0) return;
    const p = this.p, an = p.anim;
    const busy = this.rag || (an.action && NO_LOOK.has(an.action)) || this.debugGait != null || this.debugClip;
    const hasBall = p.ownsBall;
    // scanning schedule
    this.scanT = (this.scanT ?? Math.random() * 2) - dt;
    if (this.scanT <= 0) {
      if (this.scan) { this.scan = null; this.scanT = hasBall ? 0.9 + Math.random() * 1.1 : 1.8 + Math.random() * 3; }
      else { this.scan = { yaw: (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.7), pitch: hasBall ? -0.25 : 0 }; this.scanT = hasBall ? 0.3 : 0.4 + Math.random() * 0.3; }
    }
    const wT = busy ? 0 : p.isKeeper ? 1 : an.action ? 0.5 : 0.9;
    this.lookW = (this.lookW || 0) + (wT - (this.lookW || 0)) * Math.min(1, dt * 6);
    if (this.lookW < 0.02) return;
    const head = parts.head, torso = parts.torso;
    head.getWorldPosition(_hp);
    torso.getWorldQuaternion(_qt);
    _qi.copy(_qt).invert();
    const b = ANIM_WORLD.ball;
    _dl.set(b.x - _hp.x, (hasBall ? b.y : b.y + 0.4) - _hp.y, b.z - _hp.z).applyQuaternion(_qi);
    let yaw = Math.atan2(_dl.x, _dl.z), pitch = Math.atan2(-_dl.y, Math.hypot(_dl.x, _dl.z));
    if (this.scan) { yaw = this.scan.yaw; pitch = this.scan.pitch; }
    yaw = clamp(yaw, -1.3, 1.3); pitch = clamp(pitch, -0.45, 0.7);
    const k = Math.min(1, dt * 9);
    this.lkY = (this.lkY || 0) + (yaw - (this.lkY || 0)) * k;
    this.lkP = (this.lkP || 0) + (pitch - (this.lkP || 0)) * k;
    const w = this.lookW;
    // a little of the turn in the trunk when not sprinting
    const tw = this.lkY * 0.22 * w * clamp(1 - this.sp / 7, 0, 1);
    if (Math.abs(tw) > 1e-3) { _qd.setFromAxisAngle(_fd.set(0, 1, 0), tw); torso.quaternion.premultiply(_qd); torso.updateMatrixWorld(true); torso.getWorldQuaternion(_qt); _qi.copy(_qt).invert(); }
    // current head forward in trunk space → wanted direction
    head.getWorldQuaternion(_qd);
    _fd.set(0, 0, 1).applyQuaternion(_qd).applyQuaternion(_qi);
    const yy = this.lkY - tw;
    _dl.set(Math.sin(yy) * Math.cos(this.lkP), -Math.sin(this.lkP), Math.cos(yy) * Math.cos(this.lkP));
    _qd.setFromUnitVectors(_fd.normalize(), _dl);
    _qd.slerp(_qi.identity(), 1 - w);
    head.quaternion.premultiply(_qd);
  }

  _ik2(leg, body, tx, ty, tz, sc) {
    const a = RIG.thigh * sc, b = RIG.shin * sc;
    leg.hip.updateMatrixWorld(true);
    const hipP = _v2.setFromMatrixPosition(leg.hip.matrixWorld);
    const T = _v3.set(tx, ty, tz);
    let d = hipP.distanceTo(T);
    d = clamp(d, Math.abs(a - b) + 0.01, a + b - 0.002);
    const cosK = clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1);
    const knee = Math.PI - Math.acos(cosK);
    leg.knee.quaternion.setFromAxisAngle(X_AXIS, knee);
    // where the ankle is with the new knee, from the hip, in world space
    leg.hip.getWorldQuaternion(_q);
    const local = _v4.set(0, -b, 0).applyAxisAngle(X_AXIS, knee);
    local.y -= a;
    local.applyQuaternion(_q);
    const want = _v.subVectors(T, hipP);
    if (local.lengthSq() < 1e-8 || want.lengthSq() < 1e-8) return;
    _q2.setFromUnitVectors(local.normalize(), want.normalize());
    _q.premultiply(_q2);
    // back to the hip's local space
    leg.hip.parent.getWorldQuaternion(_q3);
    leg.hip.quaternion.copy(_q3.invert().multiply(_q));
    leg.hip.updateMatrixWorld(true);
  }
}
