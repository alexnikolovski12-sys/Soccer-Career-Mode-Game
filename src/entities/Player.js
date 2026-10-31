// Shared player class for every footballer (user, teammates, defenders, keeper).
// Appearance comes only from `look`, so the primitive body can later be swapped
// for a skinned model with face morphs/hair without touching gameplay code.
import * as THREE from 'three';
import { CONFIG, clamp } from '../config.js';
import { dampT, lerpAngle, angleDiff, headingOf, wrapAngle } from '../core/MathUtil.js';
import { Animator } from '../anim/Animator.js';
import { humanGeometry, humanMaterial, garmentMaterial, bindHuman, RIG, BONE_NAMES, HAIR_STYLES } from './HumanBody.js';

// joints recorded for the goal replay (after IK), in order
const REC_JOINTS = (P) => [P.body, P.torso, P.head, P.legL.hip, P.legL.knee, P.legL.ankle, P.legR.hip, P.legR.knee,
  P.legR.ankle, P.armL.sh, P.armL.el, P.armR.sh, P.armR.el];
const NREC = 13;

// ---------------------------------------------------------------- shared resources
const GEO = {};
function geo() {
  if (GEO.ring) return GEO;
  GEO.ring = new THREE.RingGeometry(0.48, 0.62, 40);
  GEO.blob = new THREE.CircleGeometry(0.42, 16);
  return GEO;
}

// ---------------------------------------------------------------- automatic variety (seeded by player id)
function seeded(id, salt) {
  let h = 2166136261 ^ salt;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}
function darkness(hex) { const c = new THREE.Color(hex || '#c68a5e'); return 1 - (c.r * 0.5 + c.g * 0.35 + c.b * 0.15); }
/** Face + build shape from skin tone and id: ancestry morphs follow the skin, the rest is random. */
export function autoFace(id, skin) {
  const r = seeded(id, 7), d = darkness(skin);
  const f = {};
  f.african = Math.max(0, Math.min(1, (d - 0.45) * 2.2 + (r() - 0.5) * 0.3));
  f.asian = d < 0.55 && r() < 0.18 ? 0.5 + r() * 0.5 : 0;
  f.muscle = r() * 0.8; f.slim = r() * 0.7;
  f.headSquare = r() * 1.1 - 0.3; f.headRound = r() * 0.6; f.headFat = r() * 0.4;
  f.noseWide = r() * 0.9 * (r() < 0.5 ? 1 : 0); f.noseNarrow = f.noseWide ? 0 : r() * 0.8;
  f.noseLong = r() * 0.8 - 0.2; f.chinStrong = r() * 1.1 - 0.2; f.chinNarrow = r() * 0.6;
  f.lips = r() * 0.8; f.cheeks = r() * 0.8; f.browLow = r() * 0.8;
  return f;
}
const HAIR_POOL = ['short', 'short', 'crop', 'fade', 'fade', 'buzz', 'quiff', 'curly', 'receding', 'mohawk', 'long', 'bald'];
const HAIR_POOL_DARK = ['buzz', 'buzz', 'fade', 'afro', 'curly', 'crop', 'bald', 'short', 'mohawk'];
export function autoHair(id, skin) { const r = seeded(id, 13); const pool = darkness(skin) > 0.55 ? HAIR_POOL_DARK : HAIR_POOL; return pool[Math.floor(r() * pool.length)]; }
export function autoFacial(id) { const r = seeded(id, 29)(); return r < 0.5 ? 'none' : r < 0.72 ? 'stubble' : r < 0.86 ? 'beard' : r < 0.94 ? 'goatee' : 'moustache'; }

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
// Marker textures, drawn once and shared.
const _markerTex = {};
function markerTex(kind) {
  if (_markerTex[kind]) return _markerTex[kind];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (kind === 'triangle') {
    g.beginPath(); g.moveTo(14, 22); g.lineTo(114, 22); g.lineTo(64, 112); g.closePath();
    g.fillStyle = '#ff2a2a'; g.fill();
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.stroke();
  } else {
    // yellow disc with a star cut out of the middle
    g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2);
    g.fillStyle = '#ffd21f'; g.fill();
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.stroke();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 17 : 40, a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = 64 + Math.cos(a) * r, y = 66 + Math.sin(a) * r;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (_markerTex[kind] = t);
}

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
    this.visible = true;
    this.spinYaw = 0;

    this._build();
    this.setStats(o.stats);
    this.animator = new Animator(this);
  }

  // ------------------------------------------------------------ stats
  setStats(stats) {
    this.stats = { ...stats };
    const M = CONFIG.statMap;
    const s = this.stats;
    // same rating → pace mapping for everyone (who you happen to control doesn't make him faster)
    const teamMul = CONFIG.teamMap.speedMult(this.rating);
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
      // agility: how hard he can lean into a turn (sideways grip, m/s²)
      grip: CONFIG.player.lateralAccel * (0.85 + 0.3 * ((s.acceleration + s.dribbling) / 2 - 30) / 69),
    };
    // body mass for knocks: taller and better players hold their ground
    this.mass = 75 * this.heightScale * this.heightScale * (0.9 + this.rating / 500);
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
    const L = this.look;
    const root = new THREE.Group();
    // the rig: bones the animator drives (offsets match the human mesh, see HumanBody.js)
    const bone = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); parent.add(b); return b; };
    const body = bone(root, 0, RIG.bodyY, 0);
    const torso = bone(body, ...RIG.torso);
    const head = bone(torso, ...RIG.head);
    const arm = (side) => {
      const sh = bone(torso, RIG.sh[0] * side, RIG.sh[1], RIG.sh[2]);
      const el = bone(sh, 0, -RIG.upperArm, 0);
      return { sh, el };
    };
    const leg = (side) => {
      const hip = bone(body, RIG.hip[0] * side, RIG.hip[1], RIG.hip[2]);
      const knee = bone(hip, 0, -RIG.thigh, 0);
      const ankle = bone(knee, 0, -RIG.shin, 0);
      return { hip, knee, ankle };
    };
    this.parts = { root, body, torso, head, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1) };
    const P = this.parts;
    const byName = { body, torso, head, shL: P.armL.sh, elL: P.armL.el, shR: P.armR.sh, elR: P.armR.el,
      hipL: P.legL.hip, kneeL: P.legL.knee, ankleL: P.legL.ankle, hipR: P.legR.hip, kneeR: P.legR.knee, ankleR: P.legR.ankle };
    this._head = head;

    // one smooth skinned body; kit/skin/hair are shader uniforms
    this.material = humanMaterial();
    const mesh = new THREE.SkinnedMesh(humanGeometry(), this.material);
    mesh.castShadow = true;
    root.add(mesh);
    bindHuman(mesh, BONE_NAMES.map((n) => byName[n]), P);
    this.mesh = mesh;
    // shirt + shorts: a separate layer on the same skeleton that swings on its own
    this.garmentMat = garmentMaterial(this.material);
    const gm = new THREE.SkinnedMesh(mesh.geometry, this.garmentMat);
    gm.bind(mesh.skeleton, mesh.bindMatrix);
    gm.castShadow = true;
    gm.frustumCulled = false; mesh.frustumCulled = false;
    root.add(gm);
    this.garment = gm;
    this.meshes = [mesh, gm];
    this.u = this.material.userData.u;
    this._applyLook(L, true);

    // blob shadow (shown when real shadows are off)
    const G = geo();
    this.blob = new THREE.Mesh(G.blob, blobMat());
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.011;
    this.blob.renderOrder = 1;
    root.add(this.blob);

    const sc = (L.height || 1.8) / 1.8;
    body.scale.setScalar(sc);
    this.heightScale = sc;
    this._rec = REC_JOINTS(this.parts);

    this.scene.add(root);
    if (this.isUser) this._makeMarker();
  }

  /** Everything about how he looks → shader uniforms + face/body morphs. */
  _applyLook(L, first = false) {
    const u = this.u;
    const c = (k, v) => { if (v) u[k].value.set(v); };
    c('uKit', L.kitColour); c('uKit2', L.accent || L.kitColour2 || contrastText(L.kitColour || '#ffffff'));
    c('uShorts', L.shortsColour); c('uSocks', L.socksColour || L.kitColour);
    c('uSkin', L.skinTone); c('uHairC', L.hairColour || '#1a1310'); c('uBoot', L.bootColour || '#111111');
    c('uEyeC', L.eyeColour);
    u.uNumCol.value.set(contrastText(L.kitColour || '#ffffff'));
    if (L.pattern !== undefined) u.uPattern.value = L.pattern;
    if (L.sponsor !== undefined) u.uSpon.value = L.sponsor;
    u.uGK.value = this.isKeeper ? 1 : 0;
    if (L.gloveColour) u.uGlove.value.set(L.gloveColour);
    if (L.number !== undefined) this._num(L.number);
    if (first || L.hairStyle) this._hair(L.hairStyle || autoHair(this.id, L.skinTone));
    if (first || L.facial) u.uFacial.value = { none: 0, stubble: 1, beard: 2, goatee: 3, moustache: 4 }[L.facial || autoFacial(this.id)] ?? 0;
    if (L.sleeves) u.uSleeve.value = L.sleeves === 'long' ? 2.1 : 0.55;
    if (first || L.face) this._face(L.face || autoFace(this.id, L.skinTone));
  }

  _num(n) {
    if (n == null || n < 0) { this.u.uNum.value.set(-1, -1); return; }
    n = Math.max(0, Math.min(99, n | 0));
    this.u.uNum.value.set(n >= 10 ? Math.floor(n / 10) : -1, n % 10);
  }

  _hair(style) {
    this._hairStyle = style;
    const h = HAIR_STYLES[style] || HAIR_STYLES.short;
    this.u.uHairA.value.set(h[0], h[1], h[2], h[3]);
  }

  _face(f) {
    const inf = this.mesh.morphTargetInfluences, dict = this.mesh.morphTargetDictionary;
    inf.fill(0);
    for (const k in f) if (dict[k] !== undefined) inf[dict[k]] = f[k];
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
    this.ring.material.opacity = 0; this.ring.material.colorWrite = false;   // no circle under your man (more realistic)
    root.add(this.ring);
    // upside-down red triangle over whoever you control
    this.label = Player._sprite(markerTex('triangle'), 0.034, 0.03);
    this.label.position.y = CONFIG.player.labelHeight;
    root.add(this.label);
    // your own career player also gets the yellow star badge above it
    this.badge = Player._sprite(markerTex('star'), 0.062, 0.062);
    this.badge.position.y = CONFIG.player.labelHeight + 0.85;
    this.badge.visible = false;
    root.add(this.badge);
  }

  static _sprite(tex, w, h) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
    sp.scale.set(w, h, 1);
    sp.renderOrder = 10;
    return sp;
  }

  /** Change kit colours. */
  setKit(k) {
    this.look = { ...this.look, ...k };
    this._applyLook(k);
  }

  /** Body height in metres (scales the whole rig). */
  setHeight(h) {
    const sc = h / 1.8;
    this.heightScale = sc;
    this.parts.body.scale.setScalar(sc);
    this.look = { ...this.look, height: h };
    if (this.stats) this.setStats(this.stats);
  }

  setSkinHair(skin, hair) { this._applyLook({ skinTone: skin, hairColour: hair }); }

  /** Shirt number on the back. */
  setNumber(n) {
    this.look = { ...this.look, number: n };
    this._num(n);
  }

  /** Hair style + colour, facial hair, skin, sleeves, boots, number, face shape. */
  setAppearance(a) {
    this._applyLook({ skinTone: a.skin, hairColour: a.hairColour, bootColour: a.boots, number: a.number, sleeves: a.sleeves,
      hairStyle: a.hairStyle, facial: a.facial, face: a.face, eyeColour: a.eyeColour });
  }

  /** Show/hide the controlled-player markers without changing who's controlled. */
  setMarkerVisible(on) {
    if (!this.ring) return;
    this.ring.visible = on; this.label.visible = on;
    this.badge.visible = on && !!this.isCareer;
  }

  /** Hand control to / take control from this player. */
  setControlled(on) {
    if (!on) this.setGhost(1);
    this.isUser = on;
    this.role = on ? 'user' : 'mate';
    if (on) this._makeMarker();
    if (this.ring) {
      this.ring.visible = on; this.label.visible = on;
      this.badge.visible = on && !!this.isCareer;
    }
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
    this.mesh.castShadow = on;
    if (this.garment) this.garment.castShadow = on;
    this.blob.visible = !on;
  }

  /** Fade the body (user only — other players share materials). */
  setGhost(alpha) {
    if (this._ghost === alpha) return;
    this._ghost = alpha;
    const on = alpha < 0.999;
    for (const mt of [this.material, this.garmentMat]) {
      if (!mt) continue;
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
    if (this.label) { this.label.material.dispose(); }
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
    this.cutBoost = Math.max(0, (this.cutBoost || 0) - dt);
    this.cutCd = Math.max(0, (this.cutCd || 0) - dt);

    let desiredSpeed = this.moveSpeed;
    if (hasBall && this.drib && this.drib.stop) desiredSpeed = Math.min(desiredSpeed, 1.2);
    if (this.stumble > 0) {
      this.stumble -= dt;
      desiredSpeed *= 0.2;
    }
    if (this.anim.action === 'fall' || this.anim.action === 'dive' || this.anim.action === 'tackle') {
      desiredSpeed = this.anim.action === 'tackle' ? desiredSpeed : 0;
    }
    if (hasBall) desiredSpeed *= A.dribbleSpeed;
    desiredSpeed *= this.staminaFactor();
    // holds only last while someone keeps setting them (a skill script / braking on the ball)
    if (this.skillHold != null && !this._holdTick) this.skillHold = null;
    this._holdTick = false;
    if (this.skillHold != null) desiredSpeed = Math.min(desiredSpeed, this.skillHold);
    // a burst after a sharp cut / skill on the ball
    if (this.dribBoost > 0) { this.dribBoost -= dt; if (hasBall || this.isUser) desiredSpeed *= 1.12; }
    const maxSpeed = A.sprintSpeed * (hasBall ? A.dribbleSpeed : 1) * (this.isUser || this.controlled ? 1.14 : 1.02) * (this.dribBoost > 0 ? 1.12 : 1);
    desiredSpeed = Math.min(desiredSpeed, maxSpeed);

    const curSpeed = Math.hypot(this.vel.x, this.vel.z);
    let curDir = curSpeed > 0.05 ? Math.atan2(this.vel.x, this.vel.z) : this.heading;
    let speed = curSpeed;

    if (desiredSpeed > 0.01) {
      const want = Math.atan2(this.moveDir.x, this.moveDir.z);
      let diff = angleDiff(curDir, want);
      // QUICK CUT: a sharp flick of the stick on the ball = plant the foot and
      // snap most of the way to the new direction, then burst away
      if (this.isUser && hasBall && this.cutCd <= 0 && curSpeed > 1.5 && Math.abs(diff) > P.cutAngle && !(Math.abs(diff) > 1.75 && curSpeed > 3) && this.stumble <= 0) {
        const snap = diff * P.cutSnap;
        curDir = wrapAngle(curDir + snap);
        diff -= snap;
        speed = curSpeed * P.cutKeepSpeed;
        this.cutBoost = P.cutBurstTime;
        this.cutCd = P.cutCooldown;
        this.heading = wrapAngle(this.heading + snap * 0.8);
        this.playAction('turn', 0.32, { variant: 'cut', side: Math.sign(snap) || 1, kickLeg: Math.sign(snap) > 0 ? -1 : 1 });
        this.justCut = true;
        this.dribBoost = 1.2;
      }
      const t = clamp(curSpeed / A.sprintSpeed, 0, 1);
      let turnRate = P.turnRateStill + (P.turnRateRun - P.turnRateStill) * Math.sqrt(t);
      if (hasBall) turnRate *= A.turnControl;
      // momentum: at pace you can only turn as hard as your feet can grip
      if (curSpeed > 2) turnRate = Math.min(turnRate, Math.max(P.turnRateRun * 0.45, A.grip / curSpeed));
      const maxTurn = turnRate * dt;
      curDir = wrapAngle(curDir + clamp(diff, -maxTurn, maxTurn));
      // sharp turns brake the player (less with better control)
      const sharp = Math.abs(diff) - P.sharpTurnAngle;
      if (sharp > 0 && curSpeed > 2 && this.cutBoost <= 0) {
        const brake = P.sharpTurnBrake * sharp * (hasBall ? 1.6 - A.turnControl : 1);
        desiredSpeed *= Math.max(0.25, 1 - brake);
      }
    }
    const a = desiredSpeed > speed ? A.accel * (this.cutBoost > 0 ? P.cutBurstAccel : 1) : A.decel;
    const ds = desiredSpeed - speed;
    speed += clamp(ds, -a * dt, a * dt);
    if (speed < 0.02 && desiredSpeed <= 0.01) speed = 0;
    this.vel.set(Math.sin(curDir) * speed, 0, Math.cos(curDir) * speed);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // body heading: follow velocity, or a face target when slow
    let wantHeading = this.heading;
    // defenders jockey: shuffle sideways / backpedal while watching the ball
    const jockey = (this.role === 'def' || this.jockey) && this.faceTarget && !hasBall && speed < CONFIG.player.jockeyMaxSpeed;
    if (jockey) wantHeading = headingOf(this.faceTarget.x - this.pos.x, this.faceTarget.z - this.pos.z);
    else if (speed > 0.4) wantHeading = curDir;
    else if (this.faceTarget) wantHeading = headingOf(this.faceTarget.x - this.pos.x, this.faceTarget.z - this.pos.z);
    else if (desiredSpeed > 0.01) wantHeading = Math.atan2(this.moveDir.x, this.moveDir.z);
    this.heading = wrapAngle(this.heading + angleDiff(this.heading, wantHeading) * dampT(P.headingLerp, dt));
    this.faceTarget = null;
  }

  // ------------------------------------------------------------ animation
  /**
   * Start an action. anim.action / anim.t / anim.dur are the gameplay view of
   * it (AI and possession code read them); the Animator turns it into a
   * motion-capture (or hand-made) layer that fades in and out over the base.
   */
  playAction(name, dur, opts = {}) {
    this.anim.action = name;
    this.anim.t = 0;
    this.anim.dur = dur;
    // reset per-action options so a variant never leaks into the next action
    this.anim.variant = null; this.anim.loop = false; this.anim.hold = false; this.anim.spinAmt = 0;
    this.anim.contactAt = undefined; this.anim.setPiece = false; this.anim.offset = 0;
    Object.assign(this.anim, opts);
    this.animator.onAction(name, dur, this.anim);
  }

  /** A physical knock (bump, tackle): direction in world xz, strength ~ m/s of velocity change. */
  hit(dx, dz, strength) {
    const l = Math.hypot(dx, dz) || 1;
    this.animator.impulse(dx / l, dz / l, strength);
    this.animator.lastHit.fresh = true;
  }

  /** Seconds until this foot (1 = right, −1 = left) next plants — dribble touches are timed to it. */
  footDue(foot) { return this.animator.footDue(foot); }

  /** Make a foot reach a point (the ball) around now: lead = seconds before contact, hold after. */
  reachFor(foot, x, y, z, lead = 0, hold = 0.14) {
    this.animator.reach = { foot: foot > 0 ? 1 : 0, x, y, z, age: -lead, hold };
  }

  /** Visual-only; dt is scaled sim time (freezes during aim, slows in slow-mo). */
  updateAnimation(dt, hasBall) {
    const an = this.anim;
    an.time += dt;
    if (an.action) {
      an.t += dt;
      if (this.stayDown && an.action === 'fall') an.t = Math.min(an.t, an.dur * 0.5);
      if (an.t >= an.dur) {
        if (an.hold) an.t = an.dur;            // freeze on the last frame (e.g. kneeling after a knee slide)
        else if (an.loop) an.t = 0;
        else an.action = null;
      }
    }
    this._animDt = dt;
    // defenders closing a man down sit in a ready stance when they stop
    this.animator.ready = this.role === 'def' && (this.aiLabel === 'chase' || this.aiLabel === 'mark' || this.aiLabel === 'tackle');
    this.animator.update(dt, hasBall);
    this.spinYaw = this.animator.spinYaw;
  }

  /** Apply pose + transform to the mesh (with interpolation). */
  render(alpha, time) {
    const r = this.parts.root;
    const A = this.animator;
    r.position.lerpVectors(this.prevPos, this.pos, alpha);
    r.rotation.y = lerpAngle(this.prevHeading, this.heading, alpha) + (this.spinYaw || 0) + A.visYaw;
    A.apply(A.pose, this.parts, this.heightScale);
    if (this.visible) A.solveIK(this.parts, this.heightScale, this._animDt || 0);
    const mu = this.material && this.material.userData.u && this.material.userData.u.uMove;
    if (mu) mu.value += (Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 8) - mu.value) * 0.15;
    const U = this.material && this.material.userData.u;
    if (U && U.uLag) {
      // fabric inertia: a spring chasing the opposite of the body's acceleration, billowing back at speed
      const a = A.accS, sp = Math.hypot(this.vel.x, this.vel.z), dt = Math.min(0.05, this._animDt || 0.016);
      const tx = Math.max(-0.11, Math.min(0.11, -a.y * 0.009));
      const tz = Math.max(-0.14, Math.min(0.1, -a.x * 0.009 - sp * 0.009));
      const ty = Math.min(0.05, sp * 0.005);
      const L = this._lag || (this._lag = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
      const n = Math.ceil(dt / 0.008), h = dt / n;
      for (let i = 0; i < n; i++) for (const [k, t] of [['x', tx], ['y', ty], ['z', tz]]) {
        const v = 'v' + k;
        L[v] += ((t - L[k]) * 70 - L[v] * 10) * h;
        L[k] += L[v] * h;
        if (!Number.isFinite(L[k])) { L[k] = 0; L[v] = 0; }
        L[k] = Math.max(-0.3, Math.min(0.3, L[k]));
      }
      U.uLag.value.set(L.x, L.y, L.z);
      U.uDirt.value = this.dirt || 0;
    }
    if (this.ring) {
      const pulse = 0.85 + Math.sin(time * 4) * 0.12;
      this.ring.scale.setScalar(pulse);
      this.ring.material.opacity = 0;
    }
  }

  // ------------------------------------------------------------ replay support
  static get RECORD_SIZE() { return 4 + 3 + NREC * 4; }

  writeRecord(arr, o) {
    const r = this.parts.root;
    arr[o] = r.position.x; arr[o + 1] = r.position.y; arr[o + 2] = r.position.z; arr[o + 3] = r.rotation.y;
    const b = this.parts.body.position;
    arr[o + 4] = b.x; arr[o + 5] = b.y; arr[o + 6] = b.z;
    let k = o + 7;
    for (const j of this._rec) { const q = j.quaternion; arr[k++] = q.x; arr[k++] = q.y; arr[k++] = q.z; arr[k++] = q.w; }
  }

  readRecord(a, b, o, t) {
    const r = this.parts.root;
    r.position.set(a[o] + (b[o] - a[o]) * t, a[o + 1] + (b[o + 1] - a[o + 1]) * t, a[o + 2] + (b[o + 2] - a[o + 2]) * t);
    r.rotation.y = lerpAngle(a[o + 3], b[o + 3], t);
    this.parts.body.position.set(a[o + 4] + (b[o + 4] - a[o + 4]) * t, a[o + 5] + (b[o + 5] - a[o + 5]) * t, a[o + 6] + (b[o + 6] - a[o + 6]) * t);
    let k = o + 7;
    const qa = Player._qa || (Player._qa = new THREE.Quaternion()), qb = Player._qb || (Player._qb = new THREE.Quaternion());
    for (const j of this._rec) {
      qa.set(a[k], a[k + 1], a[k + 2], a[k + 3]); qb.set(b[k], b[k + 1], b[k + 2], b[k + 3]);
      j.quaternion.slerpQuaternions(qa, qb, t);
      k += 4;
    }
  }
}
