// Shared player class for every footballer (user, teammates, defenders, keeper).
// Appearance comes only from `look`, so the primitive body can later be swapped
// for a skinned model with face morphs/hair without touching gameplay code.
import * as THREE from 'three';
import { CONFIG, clamp } from '../config.js';
import { damp, dampT, lerpAngle, angleDiff, headingOf, wrapAngle } from '../core/MathUtil.js';

export const POSE_KEYS = [
  'hipL', 'hipR', 'kneeL', 'kneeR', 'shL', 'shR', 'shLz', 'shRz', 'elL', 'elR',
  'lean', 'roll', 'twist', 'bodyY', 'bodyPitch', 'bodyRoll', 'headPitch',
];
const NPOSE = POSE_KEYS.length;

// ---------------------------------------------------------------- shared resources
const GEO = {};
function geo() {
  if (GEO.torso) return GEO;
  GEO.torso = new THREE.CapsuleGeometry(0.16, 0.3, 4, 10);
  GEO.pelvis = new THREE.CylinderGeometry(0.165, 0.15, 0.24, 10);
  GEO.head = new THREE.SphereGeometry(0.115, 14, 10);
  GEO.hair = new THREE.SphereGeometry(0.122, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  GEO.neck = new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8);
  GEO.upperArm = new THREE.CylinderGeometry(0.052, 0.046, 0.28, 8);
  GEO.foreArm = new THREE.CylinderGeometry(0.044, 0.038, 0.26, 8);
  GEO.hand = new THREE.SphereGeometry(0.045, 8, 6);
  GEO.thigh = new THREE.CylinderGeometry(0.075, 0.06, 0.44, 8);
  GEO.shin = new THREE.CylinderGeometry(0.058, 0.045, 0.42, 8);
  GEO.boot = new THREE.BoxGeometry(0.1, 0.075, 0.24);
  GEO.ring = new THREE.RingGeometry(0.48, 0.62, 40);
  GEO.blob = new THREE.CircleGeometry(0.42, 16);
  GEO.numPlane = new THREE.PlaneGeometry(0.22, 0.22);
  return GEO;
}

const MATS = new Map();
function mat(colour) {
  let m = MATS.get(colour);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: colour }); MATS.set(colour, m); }
  return m;
}

const NUM_TEX = new Map();
function numberTexture(n, fg) {
  const key = `${n}|${fg}`;
  let t = NUM_TEX.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = fg;
  g.font = 'bold 50px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 32, 35);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  NUM_TEX.set(key, t);
  return t;
}

let BLOB_MAT = null;
function blobMat() {
  if (BLOB_MAT) return BLOB_MAT;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(0,0,0,0.45)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  BLOB_MAT = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
  return BLOB_MAT;
}

function contrastText(hex) {
  const c = new THREE.Color(hex);
  return (c.r * 0.3 + c.g * 0.59 + c.b * 0.11) > 0.55 ? '#14181f' : '#f5f7fa';
}

// ---------------------------------------------------------------- Player
export class Player {
  /**
   * @param {object} o { id, team: 'home'|'away', role: 'user'|'mate'|'def'|'gk', look, stats, rating, name }
   */
  constructor(scene, o) {
    this.id = o.id;
    this.team = o.team;
    this.role = o.role;
    this.name = o.name || '';
    this.isUser = o.role === 'user';
    this.isKeeper = o.role === 'gk';
    this.rating = o.rating ?? 70;
    this.look = o.look;
    this.scene = scene;

    this.pos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;           // facing angle (0 = +z); attack direction is +x → π/2
    this.prevHeading = 0;
    this.moveDir = new THREE.Vector3(); // desired direction (unit or zero)
    this.moveSpeed = 0;         // desired speed
    this.sprinting = false;
    this.stamina = 1;
    this.stumble = 0;           // seconds of reduced control (failed tackle / knocked)
    this.touchCooldown = 0;
    this.tackleCooldown = 0;
    this.ai = {};               // free-form controller state
    this.aiLabel = '';
    this.signal = false;        // teammate wants the ball (raises arm)

    this.anim = { action: null, t: 0, dur: 0, phase: 0, time: Math.random() * 10, side: 1, kickLeg: 1 };
    this.pose = {};
    this.target = {};
    for (const k of POSE_KEYS) { this.pose[k] = 0; this.target[k] = 0; }
    this.renderSpeed = 0;
    this.visible = true;

    this._build();
    this.setStats(o.stats);
  }

  // ------------------------------------------------------------ stats
  setStats(stats) {
    this.stats = { ...stats };
    const M = CONFIG.statMap;
    const s = this.stats;
    const teamMul = this.isUser ? 1 : CONFIG.teamMap.speedMult(this.rating);
    this.attrs = {
      sprintSpeed: M.sprintSpeed(s.pace) * teamMul,
      accel: M.accel(s.acceleration) * teamMul,
      decel: M.decel(s.acceleration),
      dribbleSpeed: M.dribbleSpeedFactor(s.dribbling),
      touchMult: M.touchMult(s.dribbling),
      sprintTouch: M.sprintTouchExtra(s.dribbling),
      touchError: M.touchError(s.dribbling),
      reach: M.controlReach(s.ballControl),
      turnControl: M.turnControl(s.ballControl),
      firstTouch: M.firstTouch(s.ballControl),
      tackleResist: M.tackleResist(s.ballControl, s.dribbling),
      reaction: CONFIG.teamMap.reaction(this.rating),
    };
  }

  get runSpeed() { return this.attrs.sprintSpeed * CONFIG.statMap.runFactor; }
  get jogSpeed() { return this.attrs.sprintSpeed * CONFIG.statMap.jogFactor; }
  get speed() { return Math.hypot(this.vel.x, this.vel.z); }

  /** Speed multiplier from current stamina. */
  staminaFactor() {
    const M = CONFIG.statMap;
    if (this.stamina >= M.lowStaminaThreshold) return 1;
    return 1 - M.lowStaminaSpeedPenalty * (1 - this.stamina / M.lowStaminaThreshold);
  }

  // ------------------------------------------------------------ mesh
  _build() {
    const G = geo();
    const L = this.look;
    const root = new THREE.Group();
    const body = new THREE.Group();
    body.position.y = 0.92;
    root.add(body);

    // home outfielders get private materials so whoever you control can be ghosted
    // during the shot camera (control switches between home players on passes)
    this._privateMats = this.team === 'home' && !this.isKeeper;
    const m = this._privateMats ? (c) => new THREE.MeshLambertMaterial({ color: c }) : mat;
    const kit = m(L.kitColour), shorts = m(L.shortsColour), socks = m(L.socksColour || L.kitColour);
    const skin = m(L.skinTone), hair = m(L.hairColour || '#222'), boot = m(L.bootColour || '#111');
    const meshes = [];
    const add = (parent, g, m, x, y, z) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      meshes.push(mesh);
      return mesh;
    };

    add(body, G.pelvis, shorts, 0, -0.02, 0);
    const torso = new THREE.Group();
    torso.position.y = 0.05;
    body.add(torso);
    add(torso, G.torso, kit, 0, 0.3, 0);
    add(torso, G.neck, skin, 0, 0.6, 0);
    const head = new THREE.Group();
    head.position.y = 0.71;
    torso.add(head);
    add(head, G.head, skin, 0, 0, 0);
    const hairMesh = add(head, G.hair, hair, 0, 0.012, -0.008);
    hairMesh.rotation.x = -0.25;
    // number on the back
    const num = new THREE.Mesh(G.numPlane, new THREE.MeshBasicMaterial({
      map: numberTexture(L.number ?? 0, contrastText(L.kitColour)), transparent: true,
    }));
    num.position.set(0, 0.36, -0.163);
    num.rotation.y = Math.PI;
    torso.add(num);

    const arm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(0.215 * side, 0.52, 0);
      torso.add(sh);
      add(sh, G.upperArm, kit, 0, -0.14, 0);
      const el = new THREE.Group();
      el.position.y = -0.28;
      sh.add(el);
      add(el, G.foreArm, skin, 0, -0.13, 0);
      add(el, G.hand, this.isKeeper ? mat('#f0f0f0') : skin, 0, -0.28, 0);
      return { sh, el };
    };
    const leg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(0.095 * side, -0.04, 0);
      body.add(hip);
      add(hip, G.thigh, shorts, 0, -0.2, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.43;
      hip.add(knee);
      add(knee, G.shin, socks, 0, -0.2, 0);
      add(knee, G.boot, boot, 0, -0.43, 0.05);
      return { hip, knee };
    };
    this.parts = { root, body, torso, head, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1) };
    this.meshes = meshes;

    // blob shadow (shown when real shadows are off)
    this.blob = new THREE.Mesh(G.blob, blobMat());
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.011;
    this.blob.renderOrder = 1;
    root.add(this.blob);

    const sc = (L.height || 1.8) / 1.8;
    body.scale.setScalar(sc);
    body.position.y *= sc;
    this.heightScale = sc;

    this.scene.add(root);
    if (this.isUser) this._makeMarker();
  }

  /** Ring under the feet + name label for the player you control. */
  _makeMarker() {
    if (this.ring) return;
    const root = this.parts.root;
    this.ring = new THREE.Mesh(geo().ring, new THREE.MeshBasicMaterial({
      color: CONFIG.colors.userRing, transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.ring.renderOrder = 2;
    root.add(this.ring);
    this.label = this._makeLabel(this.name || `#${this.look.number ?? ''}`);
    root.add(this.label);
  }

  /** Hand control to / take control from this player. */
  setControlled(on) {
    if (on && !this._privateMats) return;
    if (!on) this.setGhost(1);
    this.isUser = on;
    this.role = on ? 'user' : 'mate';
    if (on) this._makeMarker();
    if (this.ring) { this.ring.visible = on; this.label.visible = on; }
  }

  _makeLabel(text) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 34px "Barlow Condensed", "Arial Narrow", sans-serif';
    const w = g.measureText(text).width + 34;
    g.fillStyle = 'rgba(10,14,22,0.72)';
    const x0 = 128 - w / 2;
    g.beginPath();
    g.roundRect ? g.roundRect(x0, 10, w, 44, 22) : g.rect(x0, 10, w, 44);
    g.fill();
    g.fillStyle = CONFIG.colors.userRing;
    g.fillRect(x0 + 14, 26, 6, 12);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128 + 6, 33);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    // constant on-screen size so the label stays readable at any camera distance
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
    s.scale.set(0.22, 0.055, 1);
    s.position.y = CONFIG.player.labelHeight;
    s.renderOrder = 10;
    return s;
  }

  setShadows(on) {
    for (const m of this.meshes) m.castShadow = on;
    this.blob.visible = !on;
  }

  /** Fade the body (user only — other players share materials). */
  setGhost(alpha) {
    if (!this._privateMats || this._ghost === alpha) return;
    this._ghost = alpha;
    const on = alpha < 0.999;
    for (const mesh of this.meshes) {
      const mt = mesh.material;
      if (mt.transparent !== on) { mt.transparent = on; mt.needsUpdate = true; }
      mt.opacity = alpha;
      mt.depthWrite = !on;
    }
  }

  setVisible(v) {
    this.visible = v;
    this.parts.root.visible = v;
  }

  dispose() {
    this.scene.remove(this.parts.root);
    if (this.label) { this.label.material.map.dispose(); this.label.material.dispose(); }
    if (this.ring) this.ring.material.dispose();
  }

  // ------------------------------------------------------------ simulation
  place(x, z, heading = Math.PI / 2) {
    this.pos.set(x, 0, z);
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.heading = this.prevHeading = heading;
    this.moveDir.set(0, 0, 0);
    this.moveSpeed = 0;
    this.stumble = 0;
    this.touchCooldown = 0;
    this.tackleCooldown = 0;
    this.anim.action = null;
    this.ai = {};
    this.signal = false;
    this.parts.root.rotation.set(0, heading, 0);
    this.parts.root.position.copy(this.pos);
  }

  savePrev() { this.prevPos.copy(this.pos); this.prevHeading = this.heading; }

  footPoint(out) {
    const f = CONFIG.dribble.footOffset;
    return out.set(this.pos.x + Math.sin(this.heading) * f, 0, this.pos.z + Math.cos(this.heading) * f);
  }

  /** Set desired movement: dir (Vector3 xz, any length) and speed. */
  steer(dx, dz, speed) {
    const l = Math.hypot(dx, dz);
    if (l < 1e-5 || speed <= 0.01) { this.moveDir.set(0, 0, 0); this.moveSpeed = 0; return; }
    this.moveDir.set(dx / l, 0, dz / l);
    this.moveSpeed = speed;
  }

  /** Move toward a point, slowing on arrival. */
  moveTo(x, z, speed, arrive = 1.5) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) { this.steer(0, 0, 0); return d; }
    this.steer(dx, dz, Math.min(speed, speed * (d / arrive)));
    return d;
  }

  faceTowards(x, z) { this.faceTarget = { x, z }; }

  integrate(dt, hasBall) {
    const P = CONFIG.player;
    const A = this.attrs;
    this.touchCooldown = Math.max(0, this.touchCooldown - dt);
    this.tackleCooldown = Math.max(0, this.tackleCooldown - dt);

    let desiredSpeed = this.moveSpeed;
    if (this.stumble > 0) {
      this.stumble -= dt;
      desiredSpeed *= 0.2;
    }
    if (this.anim.action === 'fall' || this.anim.action === 'dive' || this.anim.action === 'tackle') {
      desiredSpeed = this.anim.action === 'tackle' ? desiredSpeed : 0;
    }
    if (hasBall) desiredSpeed *= A.dribbleSpeed;
    desiredSpeed *= this.staminaFactor();
    const maxSpeed = A.sprintSpeed * (hasBall ? A.dribbleSpeed : 1) * 1.02;
    desiredSpeed = Math.min(desiredSpeed, maxSpeed);

    const curSpeed = Math.hypot(this.vel.x, this.vel.z);
    let curDir = curSpeed > 0.05 ? Math.atan2(this.vel.x, this.vel.z) : this.heading;
    let speed = curSpeed;

    if (desiredSpeed > 0.01) {
      const want = Math.atan2(this.moveDir.x, this.moveDir.z);
      const diff = angleDiff(curDir, want);
      const t = clamp(curSpeed / A.sprintSpeed, 0, 1);
      let turnRate = P.turnRateStill + (P.turnRateRun - P.turnRateStill) * Math.sqrt(t);
      if (hasBall) turnRate *= A.turnControl;
      const maxTurn = turnRate * dt;
      curDir = wrapAngle(curDir + clamp(diff, -maxTurn, maxTurn));
      // sharp turns brake the player (less with better control)
      const sharp = Math.abs(diff) - P.sharpTurnAngle;
      if (sharp > 0 && curSpeed > 2) {
        const brake = P.sharpTurnBrake * sharp * (hasBall ? 1.6 - A.turnControl : 1);
        desiredSpeed *= Math.max(0.25, 1 - brake);
      }
    }
    const a = desiredSpeed > speed ? A.accel : A.decel;
    const ds = desiredSpeed - speed;
    speed += clamp(ds, -a * dt, a * dt);
    if (speed < 0.02 && desiredSpeed <= 0.01) speed = 0;
    this.vel.set(Math.sin(curDir) * speed, 0, Math.cos(curDir) * speed);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // body heading: follow velocity, or a face target when slow
    let wantHeading = this.heading;
    if (speed > 0.4) wantHeading = curDir;
    else if (this.faceTarget) wantHeading = headingOf(this.faceTarget.x - this.pos.x, this.faceTarget.z - this.pos.z);
    else if (desiredSpeed > 0.01) wantHeading = Math.atan2(this.moveDir.x, this.moveDir.z);
    this.heading = wrapAngle(this.heading + angleDiff(this.heading, wantHeading) * dampT(P.headingLerp, dt));
    this.faceTarget = null;
  }

  // ------------------------------------------------------------ animation
  playAction(name, dur, opts = {}) {
    this.anim.action = name;
    this.anim.t = 0;
    this.anim.dur = dur;
    // reset per-action options so a variant never leaks into the next action
    this.anim.variant = null; this.anim.loop = false; this.anim.hold = false; this.anim.spinAmt = 0;
    Object.assign(this.anim, opts);
  }

  /** Visual-only; dt is scaled sim time (freezes during aim, slows in slow-mo). */
  updateAnimation(dt, hasBall) {
    const an = this.anim;
    an.time += dt;
    this.spinYaw = 0;
    const T = this.target;
    const speed = this.speed;
    this.renderSpeed = damp(this.renderSpeed, speed, 10, dt);
    const sp = this.renderSpeed;
    const stride = CONFIG.player.strideLength * (0.75 + Math.min(sp, 9) / 18);
    an.phase += (sp / stride) * Math.PI * 2 * dt;
    const amp = clamp(sp / 7.5, 0, 1);
    const s = Math.sin(an.phase), c = Math.cos(an.phase);

    // ---- locomotion base (idle / jog / sprint / dribble blend continuously by speed)
    T.hipL = s * (0.08 + 0.62 * amp);
    T.hipR = -T.hipL;
    T.kneeL = 0.12 + Math.max(0, -c) * (0.2 + 1.0 * amp);
    T.kneeR = 0.12 + Math.max(0, c) * (0.2 + 1.0 * amp);
    T.shL = -s * (0.08 + 0.65 * amp);
    T.shR = -T.shL;
    T.shLz = 0.1 + amp * 0.05; T.shRz = -T.shLz;
    T.elL = T.elR = 0.25 + amp * 1.0;
    T.lean = 0.03 + amp * 0.2 + (hasBall ? 0.08 : 0) + (this.sprinting ? 0.06 : 0);
    T.roll = 0; T.twist = -s * 0.12 * amp;
    T.bodyY = -Math.abs(c) * 0.045 * amp + (sp < 0.3 ? Math.sin(an.time * 2.2) * 0.006 : 0);
    T.bodyPitch = 0; T.bodyRoll = 0; T.headPitch = -T.lean * 0.6;

    if (this.isKeeper && !an.action && sp < 2.5) {
      // ready stance
      T.bodyY = -0.14; T.kneeL = T.kneeR = 0.65; T.hipL = T.hipR = 0.35;
      T.lean = 0.22; T.shL = T.shR = 0.55; T.shLz = 0.55; T.shRz = -0.55; T.elL = T.elR = 0.7;
      T.headPitch = -0.15;
    }

    if (this.signal && !an.action) {
      T.shR = 2.55; T.shRz = -0.25; T.elR = 0.15;
    }

    let rate = CONFIG.player.animBlend;
    if (an.action) {
      an.t += dt;
      const k = clamp(an.t / an.dur, 0, 1);
      rate = 22;
      this._actionPose(an.action, k, T);
      if (an.t >= an.dur) {
        if (an.hold) an.t = an.dur;            // freeze on the last frame (e.g. kneeling after a knee slide)
        else if (an.loop) an.t = 0;
        else an.action = null;
      }
    }

    const f = dampT(rate, dt);
    for (const key of POSE_KEYS) this.pose[key] += (T[key] - this.pose[key]) * f;
  }

  _actionPose(name, k, T) {
    const kick = this.anim.kickLeg >= 0 ? 'R' : 'L';
    const other = kick === 'R' ? 'L' : 'R';
    const ease = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
    switch (name) {
      case 'touch': {
        const v = Math.sin(k * Math.PI);
        const va = this.anim.variant;
        if (va === 'outside') {
          T['hip' + kick] = 0.2 + v * 0.4; T['knee' + kick] = 0.35 + v * 0.25;
          T.twist = (kick === 'R' ? -1 : 1) * 0.25 * v; T.bodyRoll = (kick === 'R' ? 1 : -1) * 0.08 * v;
        } else if (va === 'sole') {
          T['hip' + kick] = 0.3 * v; T['knee' + kick] = 0.4 + v * 0.7; T.lean = 0.12;
        } else {
          T['hip' + kick] = 0.15 + v * 0.55;
          T['knee' + kick] = 0.3 + v * 0.2;
        }
        break;
      }
      case 'control': {
        // receiving: cushion with the inside, on the thigh, or chest it down
        const v = Math.sin(k * Math.PI);
        const va = this.anim.variant;
        if (va === 'chest') {
          T.lean = -0.4 * v; T.headPitch = 0.3 * v; T.shLz = 0.7 * v + 0.1; T.shRz = -0.7 * v - 0.1;
          T.shL = T.shR = 0.5 * v; T.kneeL = T.kneeR = 0.35; T.bodyY = -0.05 * v;
        } else if (va === 'thigh') {
          T['hip' + kick] = 1.1 * v; T['knee' + kick] = 1.3 * v; T.lean = -0.1 * v;
          T.shLz = 0.5; T.shRz = -0.5;
        } else if (va === 'heavy') {
          T.lean = 0.35 * v; T.bodyRoll = 0.2 * v * (this.anim.side || 1);
          T.shLz = 0.9 * v; T.shRz = -0.9 * v; T['hip' + kick] = 0.6 * v;
        } else {
          T['hip' + kick] = 0.35 * v; T['knee' + kick] = 0.45 * v; T.twist = (kick === 'R' ? 0.3 : -0.3) * v;
          T.lean = 0.1;
        }
        break;
      }
      case 'pass': {
        const va = this.anim.variant || 'side';
        const sg = kick === 'R' ? 1 : -1;
        const back = k < 0.35;
        const fwd = Math.min(1, (k - 0.35) / 0.3);
        if (va === 'backheel') {
          // heel it backwards: leg swings behind the body
          T['hip' + kick] = back ? ease(0, 0.45, k / 0.35) : ease(0.45, -0.95, fwd);
          T['knee' + kick] = back ? ease(0.2, 0.3, k / 0.35) : ease(0.3, 1.0, fwd);
          T['hip' + other] = 0.05; T['knee' + other] = 0.3;
          T.lean = 0.28; T.headPitch = -0.2; T.shLz = 0.5; T.shRz = -0.5;
        } else if (va === 'outside') {
          // trivela: flick across the body with the outside of the boot
          T['hip' + kick] = back ? ease(0, -0.6, k / 0.35) : ease(-0.6, 0.75, fwd);
          T['knee' + kick] = back ? ease(0.2, 1.3, k / 0.35) : ease(1.3, 0.15, fwd);
          T['hip' + other] = -0.12; T['knee' + other] = 0.3;
          T.twist = -sg * (back ? 0.15 : 0.5 * Math.sin(fwd * Math.PI * 0.5));
          T.bodyRoll = sg * 0.14 * Math.sin(k * Math.PI);
          T.shLz = 0.6; T.shRz = -0.6; T.lean = 0.12;
        } else if (va === 'flick') {
          const v = Math.sin(k * Math.PI);
          T['hip' + kick] = 0.15 + 0.5 * v; T['knee' + kick] = 0.5 * v; T.twist = sg * 0.3 * v; T.lean = 0.1;
        } else if (va === 'lofted' || va === 'chipped') {
          // lean back and get under it; a chipped ball is a short stab
          const top = va === 'chipped' ? 0.65 : 1.55;
          T['hip' + kick] = back ? ease(0, -1.0, k / 0.35) : ease(-1.0, top, fwd);
          T['knee' + kick] = back ? ease(0.2, 1.5, k / 0.35) : ease(1.5, va === 'chipped' ? 0.7 : 0.2, fwd);
          T['hip' + other] = -0.2; T['knee' + other] = 0.5;
          T.lean = back ? 0.0 : -0.28; T.bodyRoll = -sg * 0.18 * Math.sin(k * Math.PI);
          T.shLz = 1.0; T.shRz = -1.0; T.shL = back ? 0.2 : -0.3; T.shR = back ? -0.2 : 0.6;
          T.bodyY = -0.06;
        } else if (va === 'offbalance') {
          T['hip' + kick] = back ? ease(0.1, -0.6, k / 0.35) : ease(-0.6, 0.8, fwd);
          T['knee' + kick] = back ? ease(0.2, 1.2, k / 0.35) : ease(1.2, 0.2, fwd);
          T['hip' + other] = 0.1; T['knee' + other] = 0.5;
          T.bodyRoll = sg * 0.32 * Math.sin(k * Math.PI); T.lean = -0.15;
          T.shL = 1.2 * Math.sin(k * 7); T.shR = -0.5; T.shLz = 1.1; T.shRz = -0.4;
          T.bodyY = 0.06 * Math.sin(k * Math.PI);
        } else {
          // side-foot (and the bigger 'driven' version)
          const big = va === 'driven' ? 1.35 : 1;
          T['hip' + kick] = back ? ease(0.1, -0.85 * big, k / 0.35) : ease(-0.85 * big, 1.05 * big, fwd);
          T['knee' + kick] = back ? ease(0.2, 1.35, k / 0.35) : ease(1.35, 0.1, fwd);
          T['hip' + other] = -0.18; T['knee' + other] = 0.35;
          T.twist = sg * (back ? -0.3 * (k / 0.35) : 0.35 * Math.sin(fwd * Math.PI * 0.5));
          T.shLz = 0.7 * big; T.shRz = -0.7 * big; T.shL = back ? 0.3 : -0.2; T.shR = back ? -0.3 : 0.2;
          T.lean = back ? 0.05 : va === 'driven' ? 0.3 : 0.18;
          T.bodyY = -0.05;
        }
        break;
      }
      case 'shoot': {
        const va = this.anim.variant || 'laces';
        const sg = kick === 'R' ? 1 : -1;
        const back = k < 0.3;
        const fwd = Math.min(1, (k - 0.3) / 0.28);
        if (va === 'chip') {
          T['hip' + kick] = back ? ease(0, -0.7, k / 0.3) : ease(-0.7, 0.75, Math.min(1, (k - 0.3) / 0.15));
          T['knee' + kick] = back ? ease(0.2, 1.4, k / 0.3) : ease(1.4, 0.8, fwd);
          T['hip' + other] = -0.2; T['knee' + other] = 0.45;
          T.lean = back ? 0.05 : -0.35; T.shLz = 0.9; T.shRz = -0.9; T.headPitch = 0.25;
          break;
        }
        if (va === 'placed') {
          T['hip' + kick] = back ? ease(0, -0.75, k / 0.3) : ease(-0.75, 1.1, fwd);
          T['knee' + kick] = back ? ease(0.2, 1.3, k / 0.3) : ease(1.3, 0.1, fwd);
          T['hip' + other] = -0.15; T['knee' + other] = 0.35;
          T.twist = sg * (back ? -0.25 : 0.55 * Math.sin(fwd * Math.PI * 0.5)); T.lean = 0.15;
          T.shLz = 0.7; T.shRz = -0.7;
          break;
        }
        // power family: laces / driven / finesse / off-balance
        const peak = va === 'driven' ? 1.0 : va === 'finesse' ? 1.5 : 1.85;
        T['hip' + kick] = back ? ease(0, -1.25, k / 0.3) : k < 0.75 ? ease(-1.25, peak, fwd) : ease(peak, 0.2, (k - 0.75) / 0.25);
        T['knee' + kick] = back ? ease(0.2, 1.9, k / 0.3) : ease(1.9, 0.05, Math.min(1, (k - 0.3) / 0.2));
        T['hip' + other] = back ? -0.1 : -0.3; T['knee' + other] = back ? 0.45 : 0.25;
        T.shLz = 1.0; T.shRz = -1.0; T.shL = back ? 0.6 : -0.4; T.shR = back ? -0.6 : 0.5;
        T.lean = back ? 0.25 : k < 0.75 ? -0.2 : 0.05;
        T.twist = sg * (back ? -0.45 * (k / 0.3) : 0.55 * Math.sin(fwd * Math.PI * 0.6));
        T.bodyRoll = -sg * 0.12 * Math.sin(k * Math.PI);
        T.bodyY = k > 0.35 && k < 0.75 ? 0.07 : -0.04;
        if (va === 'driven') {
          // knee over the ball, keep it down
          T.lean = back ? 0.35 : 0.32; T.bodyY = -0.08; T.headPitch = -0.35;
        } else if (va === 'finesse') {
          // open the body, wrap the inside of the foot round it, lean away
          T.twist = sg * (back ? -0.3 : 0.85 * Math.sin(fwd * Math.PI * 0.6));
          T.bodyRoll = sg * 0.28 * Math.sin(k * Math.PI);
          T.shL = back ? 0.4 : 1.4; T.shLz = 1.2; T.lean = back ? 0.15 : -0.1;
        } else if (va === 'offbalance') {
          // snatched at while falling away
          const fall = Math.max(0, (k - 0.5) / 0.5);
          T.bodyRoll = -sg * (0.15 + 0.55 * fall); T.lean = -0.3; T.bodyY = -0.35 * fall;
          T.shL = 1.6 * Math.sin(k * 8); T.shLz = 1.4; T.shRz = -1.2;
        }
        break;
      }
      case 'tackle': {
        if (this.anim.variant === 'stand') {
          // standing poke: lunge a leg in
          const v = Math.sin(k * Math.PI);
          T.hipR = 1.25 * v; T.kneeR = 0.15; T.hipL = -0.2 * v; T.kneeL = 0.7 * v;
          T.lean = 0.35 * v; T.bodyY = -0.18 * v; T.shLz = 0.8 * v; T.shRz = -0.8 * v;
          break;
        }
        const v = k < 0.25 ? k / 0.25 : k > 0.75 ? (1 - k) / 0.25 : 1;
        T.bodyY = -0.62 * v; T.bodyPitch = -0.75 * v;
        T.hipR = 1.4 * v; T.kneeR = 0.1; T.hipL = 0.5 * v; T.kneeL = 1.3 * v;
        T.shL = -0.6 * v; T.shR = 0.4 * v; T.shLz = 0.9 * v; T.shRz = -0.9 * v;
        T.lean = -0.3 * v;
        break;
      }
      case 'block': {
        // throws himself in front of a shot that never comes
        const v = k < 0.2 ? k / 0.2 : k > 0.7 ? (1 - k) / 0.3 : 1;
        const sd = this.anim.side || 1;
        T.hipL = 1.0 * v; T.kneeL = 0.2; T.hipR = -0.2; T.kneeR = 0.9 * v;
        T.bodyRoll = sd * 0.5 * v; T.bodyY = -0.3 * v; T.shL = T.shR = -0.4 * v; T.shLz = 0.2; T.shRz = -0.2;
        T.lean = 0.25 * v; T.headPitch = -0.3 * v;
        break;
      }
      // ---- goal celebrations
      case 'kneeslide': {
        const v = Math.min(1, k / 0.12);
        T.bodyY = -0.46 * v; T.hipL = T.hipR = -0.05; T.kneeL = T.kneeR = 1.75 * v;
        T.lean = -0.45 * v; T.headPitch = 0.45 * v;
        T.shL = T.shR = 0.3 + 1.1 * v; T.shLz = 1.25 * v; T.shRz = -1.25 * v; T.elL = T.elR = 0.15;
        if (k > 0.55) { T.shL = T.shR = 2.6; T.shLz = 0.6; T.shRz = -0.6; } // arms up to the crowd
        break;
      }
      case 'airplane': {
        T.shLz = 1.5; T.shRz = -1.5; T.shL = T.shR = 0; T.elL = T.elR = 0.05;
        T.bodyRoll = Math.sin(this.anim.t * 2.4) * 0.32; T.lean = 0.1; T.headPitch = 0.15;
        break;
      }
      case 'jumpfist': {
        const t = this.anim.t;
        T.bodyY = Math.abs(Math.sin(t * 5.5)) * 0.38;
        T.shR = 2.95 - Math.abs(Math.sin(t * 5.5)) * 0.4; T.elR = 0.5; T.shRz = -0.2;
        T.shL = 0.4; T.elL = 1.6; T.shLz = 0.3;
        T.kneeL = T.kneeR = 0.3 + Math.abs(Math.cos(t * 5.5)) * 0.6; T.hipL = T.hipR = 0.25; T.headPitch = 0.3;
        break;
      }
      case 'spinjump': {
        const sd = this.anim.side || 1;
        if (k < 0.55) {
          const j = k / 0.55;
          T.bodyY = Math.sin(j * Math.PI) * 0.55; this.spinYaw = sd * Math.PI * j;
          T.kneeL = T.kneeR = 0.4 + Math.sin(j * Math.PI) * 0.6; T.hipL = T.hipR = 0.35 * Math.sin(j * Math.PI);
          T.shL = T.shR = 1.2; T.shLz = 0.6; T.shRz = -0.6;
        } else {
          this.spinYaw = sd * Math.PI;
          // land wide, arms down and out, chest out
          T.bodyY = -0.12; T.kneeL = T.kneeR = 0.35; T.hipL = 0.25; T.hipR = -0.25;
          T.shL = T.shR = -0.25; T.shLz = 0.75; T.shRz = -0.75; T.elL = T.elR = 0.05; T.lean = -0.2; T.headPitch = 0.25;
        }
        break;
      }
      case 'pointsky': {
        const t = this.anim.t;
        T.shL = T.shR = 2.95; T.elL = T.elR = 0.05; T.shLz = 0.15; T.shRz = -0.15;
        T.headPitch = 0.55; T.lean = -0.15; T.bodyY = Math.sin(t * 3) * 0.02;
        break;
      }
      case 'teamjump': {
        const t = this.anim.t + (this.anim.offset || 0);
        T.bodyY = Math.abs(Math.sin(t * 6.5)) * 0.28;
        T.shL = 2.6 + Math.sin(t * 6.5) * 0.25; T.shR = 2.6 - Math.sin(t * 6.5) * 0.25; T.elL = T.elR = 0.3;
        T.shLz = 0.4; T.shRz = -0.4; T.kneeL = T.kneeR = 0.3 + Math.abs(Math.cos(t * 6.5)) * 0.5; T.headPitch = 0.2;
        break;
      }
      case 'armsup': {
        T.shL = 2.5; T.shR = 2.5; T.elL = T.elR = 0.2; T.shLz = 0.5; T.shRz = -0.5; T.headPitch = 0.2;
        break;
      }
      case 'stumble': {
        const v = Math.sin(k * Math.PI);
        T.lean = 0.55 * v; T.shLz = 0.9 * v; T.shRz = -0.9 * v; T.shL = 0.8 * v; T.shR = 0.6 * v;
        T.bodyY = -0.12 * v; T.roll = 0.25 * v * (this.anim.side || 1);
        break;
      }
      case 'fall': {
        const v = k < 0.3 ? k / 0.3 : k > 0.78 ? (1 - k) / 0.22 : 1;
        T.bodyPitch = 1.35 * v; T.bodyY = -0.72 * v;
        T.shL = T.shR = 2.0 * v; T.elL = T.elR = 0.5;
        T.hipL = T.hipR = -0.2 * v; T.kneeL = T.kneeR = 0.6 * v;
        break;
      }
      case 'celebrate': {
        const t = this.anim.t;
        T.shL = 2.7 + Math.sin(t * 9) * 0.25; T.shR = 2.7 + Math.sin(t * 9 + 1) * 0.25;
        T.shLz = 0.55; T.shRz = -0.55; T.elL = T.elR = 0.2;
        T.bodyY = Math.abs(Math.sin(t * 6)) * 0.22;
        T.kneeL = T.kneeR = 0.4 + Math.abs(Math.cos(t * 6)) * 0.4;
        T.hipL = T.hipR = 0.2; T.lean = -0.15; T.headPitch = 0.35;
        break;
      }
      case 'dive': {
        // keeper dive: whole-body roll is set by Keeper via anim.side / anim.height
        const v = k < 0.35 ? k / 0.35 : 1;
        const side = this.anim.side || 1;
        T.bodyRoll = -side * (this.anim.roll ?? 1.25) * v;
        T.bodyY = (this.anim.lift ?? 0.3) * Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.85) - (k > 0.7 ? (k - 0.7) * 1.2 : 0);
        T.shL = T.shR = 2.9 * v; T.shLz = 0.25; T.shRz = -0.25; T.elL = T.elR = 0.1;
        T.hipL = T.hipR = 0.15; T.kneeL = T.kneeR = 0.25;
        T.lean = 0.05; T.headPitch = 0;
        break;
      }
      case 'catch': {
        T.shL = T.shR = 1.35; T.elL = T.elR = 0.9; T.shLz = 0.15; T.shRz = -0.15;
        T.lean = 0.35; T.bodyY = -0.1; T.kneeL = T.kneeR = 0.4;
        break;
      }
      case 'stepover': {
        // swing the leg round the ball, dip the shoulder
        const side = this.anim.side || 1;
        const v = Math.sin(k * Math.PI);
        T['hip' + kick] = 0.25 + 0.55 * v; T['knee' + kick] = 0.4 + 0.8 * v;
        T.twist = side * 0.45 * Math.sin(k * Math.PI * 2);
        T.bodyRoll = side * 0.18 * v; T.lean = 0.18;
        T.shLz = 0.35; T.shRz = -0.35;
        break;
      }
      case 'feint': {
        const side = this.anim.side || 1;
        const v = Math.sin(k * Math.PI);
        T.bodyRoll = -side * 0.3 * Math.sin(k * Math.PI * 1.6);
        T.twist = side * 0.3 * v; T.lean = 0.2; T.bodyY = -0.06 * v;
        T.shLz = 0.55 * v + 0.1; T.shRz = -0.55 * v - 0.1;
        break;
      }
      case 'croqueta': {
        // shift the ball foot to foot across the body
        const v = Math.sin(k * Math.PI);
        T.hipL = 0.25 * v; T.hipR = 0.25 * v; T.kneeL = T.kneeR = 0.35;
        T.bodyRoll = (this.anim.side || 1) * 0.15 * Math.sin(k * Math.PI * 2);
        T.lean = 0.2; T.bodyY = -0.05;
        break;
      }
      case 'spin': {
        // roulette / McGeady / Berba / scoop: the body spins over the ball
        this.spinYaw = (this.anim.spinAmt || Math.PI * 2) * (k * k * (3 - 2 * k));
        const v = Math.sin(k * Math.PI);
        T.hipL = 0.3 * Math.sin(k * Math.PI * 2); T.hipR = -T.hipL;
        T.kneeL = T.kneeR = 0.4; T.bodyY = -0.06 * v;
        T.shLz = 0.6; T.shRz = -0.6; T.lean = 0.1;
        break;
      }
      case 'dragback': {
        // sole on top of the ball, roll it back and across
        const v = Math.sin(k * Math.PI);
        T['hip' + kick] = 0.45 * v - 0.25 * Math.max(0, k - 0.5); T['knee' + kick] = 0.7 * v;
        T['hip' + other] = -0.1; T.lean = -0.12 * v; T.bodyY = -0.04 * v;
        T.twist = (this.anim.side || 1) * 0.35 * v;
        T.shLz = 0.5; T.shRz = -0.5;
        break;
      }
      case 'fakeshot': {
        // big shooting wind-up... then chop it the other way instead
        const back = k < 0.4;
        T['hip' + kick] = back ? ease(0, -1.1, k / 0.4) : ease(-1.1, 0.35, Math.min(1, (k - 0.4) / 0.2));
        T['knee' + kick] = back ? ease(0.2, 1.7, k / 0.4) : ease(1.7, 0.5, Math.min(1, (k - 0.4) / 0.2));
        T['hip' + other] = -0.15; T['knee' + other] = 0.35;
        T.shLz = 0.9; T.shRz = -0.9; T.lean = back ? 0.22 : 0.1;
        T.twist = (this.anim.side || 1) * (back ? -0.35 : 0.45);
        break;
      }
      case 'elastico': {
        const side = this.anim.side || 1;
        const v = Math.sin(k * Math.PI);
        T['hip' + kick] = 0.35 * v; T['knee' + kick] = 0.5 * v;
        T.twist = side * (k < 0.5 ? -0.5 : 0.6) * v;
        T.bodyRoll = side * 0.25 * (k < 0.5 ? -1 : 1) * v; T.lean = 0.2;
        break;
      }
      case 'flick': {
        // rainbow: heel flicks it up behind and over the head
        if (k < 0.45) {
          const v = Math.sin((k / 0.45) * Math.PI);
          T['hip' + kick] = -0.7 * v; T['knee' + kick] = 1.7 * v;
          T['hip' + other] = 0.15; T.lean = -0.1;
        }
        T.bodyY = k > 0.2 && k < 0.6 ? 0.08 : 0;
        T.shLz = 0.5; T.shRz = -0.5;
        break;
      }
      case 'point': {
        T.shR = 2.5; T.shRz = -0.3; T.elR = 0.1;
        break;
      }
      default: break;
    }
  }

  /** Apply pose + transform to the mesh (with interpolation). */
  render(alpha, time) {
    const r = this.parts.root;
    r.position.lerpVectors(this.prevPos, this.pos, alpha);
    r.rotation.y = lerpAngle(this.prevHeading, this.heading, alpha) + (this.spinYaw || 0);
    this._applyPose(this.pose);
    if (this.ring) {
      const pulse = 0.85 + Math.sin(time * 4) * 0.12;
      this.ring.scale.setScalar(pulse);
      this.ring.material.opacity = 0.55 + Math.sin(time * 4) * 0.2;
    }
  }

  _applyPose(p) {
    const P = this.parts;
    P.legL.hip.rotation.x = -p.hipL; P.legR.hip.rotation.x = -p.hipR;
    P.legL.knee.rotation.x = p.kneeL; P.legR.knee.rotation.x = p.kneeR;
    P.armL.sh.rotation.x = -p.shL; P.armR.sh.rotation.x = -p.shR;
    P.armL.sh.rotation.z = p.shLz; P.armR.sh.rotation.z = p.shRz;
    P.armL.el.rotation.x = -p.elL; P.armR.el.rotation.x = -p.elR;
    P.torso.rotation.set(p.lean, p.twist, p.roll);
    P.head.rotation.x = p.headPitch;
    P.body.position.y = (0.92 + p.bodyY) * this.heightScale;
    P.body.rotation.set(p.bodyPitch, 0, p.bodyRoll);
  }

  // ------------------------------------------------------------ replay support
  static get RECORD_SIZE() { return 4 + NPOSE; }

  writeRecord(arr, o) {
    const r = this.parts.root;
    arr[o] = r.position.x; arr[o + 1] = r.position.y; arr[o + 2] = r.position.z; arr[o + 3] = r.rotation.y;
    for (let i = 0; i < NPOSE; i++) arr[o + 4 + i] = this.pose[POSE_KEYS[i]];
  }

  readRecord(a, b, o, t) {
    const r = this.parts.root;
    r.position.set(a[o] + (b[o] - a[o]) * t, a[o + 1] + (b[o + 1] - a[o + 1]) * t, a[o + 2] + (b[o + 2] - a[o + 2]) * t);
    r.rotation.y = lerpAngle(a[o + 3], b[o + 3], t);
    const p = this._replayPose || (this._replayPose = {});
    for (let i = 0; i < NPOSE; i++) p[POSE_KEYS[i]] = a[o + 4 + i] + (b[o + 4 + i] - a[o + 4 + i]) * t;
    this._applyPose(p);
  }
}
