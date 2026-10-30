// Shared player class for every footballer (user, teammates, defenders, keeper).
// Appearance comes only from `look`, so the primitive body can later be swapped
// for a skinned model with face morphs/hair without touching gameplay code.
import * as THREE from 'three';
import { CONFIG, clamp } from '../config.js';
import { dampT, lerpAngle, angleDiff, headingOf, wrapAngle } from '../core/MathUtil.js';
import { Animator } from '../anim/Animator.js';

// joints recorded for the goal replay (after IK), in order
const REC_JOINTS = (P) => [P.body, P.torso, P.head, P.legL.hip, P.legL.knee, P.legL.ankle, P.legR.hip, P.legR.knee,
  P.legR.ankle, P.armL.sh, P.armL.el, P.armR.sh, P.armR.el];
const NREC = 13;

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

// hair / facial hair pieces for career customisation
const HG = {};
function HAIR_GEO() {
  if (HG.cap) return HG;
  HG.cap = new THREE.SphereGeometry(0.122, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  HG.buzz = new THREE.SphereGeometry(0.118, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  HG.long = new THREE.CylinderGeometry(0.105, 0.115, 0.2, 10, 1, true, Math.PI * 0.6, Math.PI * 0.8);
  HG.afro = new THREE.SphereGeometry(0.165, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
  HG.mohawk = new THREE.BoxGeometry(0.035, 0.07, 0.22);
  HG.bun = new THREE.SphereGeometry(0.05, 10, 8);
  HG.curl = new THREE.SphereGeometry(0.048, 8, 6);
  HG.quiff = new THREE.BoxGeometry(0.15, 0.05, 0.09);
  HG.beard = new THREE.SphereGeometry(0.119, 12, 8, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.52, Math.PI * 0.4);
  HG.tache = new THREE.BoxGeometry(0.06, 0.014, 0.018);
  HG.goatee = new THREE.BoxGeometry(0.04, 0.045, 0.03);
  return HG;
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
    this._mats = { kit, shorts, socks, skin, hair, boot };
    this._forearms = []; this._boots = [];
    this._ownMat = {};
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
    this._head = head;
    this._hairMeshes = [hairMesh];
    // number on the back
    const num = new THREE.Mesh(G.numPlane, new THREE.MeshBasicMaterial({
      map: numberTexture(L.number ?? 0, contrastText(L.kitColour)), transparent: true,
    }));
    this._numMesh = num;
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
      this._forearms.push(add(el, G.foreArm, skin, 0, -0.13, 0));
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
      const ankle = new THREE.Group();
      ankle.position.y = -0.39;
      knee.add(ankle);
      this._boots.push(add(ankle, G.boot, boot, 0, -0.04, 0.05));
      return { hip, knee, ankle };
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
    this._rec = REC_JOINTS(this.parts);

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
    // upside-down red triangle over whoever you control
    this.label = Player._sprite(markerTex('triangle'), 0.06, 0.054);
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

  /** Recolour one material slot (kit / shorts / socks / skin / hair) for this player only. */
  _setMat(key, colour) {
    if (!colour) return;
    const cur = this._mats[key];
    if (this._privateMats || this._ownMat[key]) { cur.color.set(colour); return; }
    // shared material: give this player his own copy first
    const nm = new THREE.MeshLambertMaterial({ color: colour });
    for (const mesh of this.meshes) if (mesh.material === cur) mesh.material = nm;
    this._mats[key] = nm;
    this._ownMat[key] = true;
  }

  /** Change kit (career matches use each club's colours). */
  setKit(k) {
    this._setMat('kit', k.kitColour);
    this._setMat('shorts', k.shortsColour);
    this._setMat('socks', k.socksColour || k.kitColour);
    this.look = { ...this.look, ...k };
  }

  setSkinHair(skin, hair) { this._setMat('skin', skin); this._setMat('hair', hair); }

  /** Shirt number on the back. */
  setNumber(n) {
    this.look = { ...this.look, number: n };
    this._numMesh.material.map = numberTexture(n, contrastText(this.look.kitColour || '#ffffff'));
    this._numMesh.material.needsUpdate = true;
  }

  /**
   * Career customisation: hair style + colour, facial hair, skin, long/short
   * sleeves, boot colour, shirt number.
   */
  setAppearance(a) {
    if (a.skin) this._setMat('skin', a.skin);
    if (a.hairColour) this._setMat('hair', a.hairColour);
    if (a.boots) this._setMat('boot', a.boots);
    if (a.number != null) this.setNumber(a.number);
    // sleeves: long = the forearms are shirt
    if (a.sleeves) for (const m of this._forearms) m.material = a.sleeves === 'long' ? this._mats.kit : this._mats.skin;
    if (a.hairStyle !== undefined || a.facial !== undefined) this._rebuildHair(a.hairStyle ?? this._hairStyle ?? 'short', a.facial ?? this._facial ?? 'none');
  }

  _rebuildHair(style, facial) {
    this._hairStyle = style; this._facial = facial;
    const head = this._head, hm = this._mats.hair;
    for (const m of this._hairMeshes) { head.remove(m); const i = this.meshes.indexOf(m); if (i >= 0) this.meshes.splice(i, 1); }
    this._hairMeshes = [];
    const add = (g, x, y, z, rx = 0, mat = hm) => {
      const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true;
      head.add(m); this.meshes.push(m); this._hairMeshes.push(m); return m;
    };
    const H = HAIR_GEO();
    switch (style) {
      case 'bald': break;
      case 'buzz': add(H.buzz, 0, 0.008, -0.006, -0.25); break;
      case 'long': add(H.cap, 0, 0.012, -0.008, -0.25); add(H.long, 0, -0.07, -0.05); break;
      case 'afro': add(H.afro, 0, 0.04, -0.015); break;
      case 'mohawk': add(H.mohawk, 0, 0.1, -0.01, -0.15); break;
      case 'bun': add(H.cap, 0, 0.012, -0.008, -0.25); add(H.bun, 0, 0.08, -0.1); break;
      case 'curly': for (const [x, y, z] of [[0, 0.1, 0.02], [0.06, 0.08, -0.02], [-0.06, 0.08, -0.02], [0, 0.09, -0.07], [0.07, 0.03, -0.06], [-0.07, 0.03, -0.06], [0.04, 0.1, 0.06], [-0.04, 0.1, 0.06]]) add(H.curl, x, y, z); break;
      case 'quiff': add(H.cap, 0, 0.012, -0.008, -0.25); add(H.quiff, 0, 0.1, 0.06, 0.4); break;
      default: add(H.cap, 0, 0.012, -0.008, -0.25);
    }
    if (facial === 'beard') add(H.beard, 0, -0.01, 0.012);
    else if (facial === 'stubble') { const sm = this._stubbleMat || (this._stubbleMat = new THREE.MeshLambertMaterial({ color: hm.color, transparent: true, opacity: 0.45 })); sm.color.copy(hm.color); add(H.beard, 0, -0.008, 0.008, 0, sm); }
    else if (facial === 'moustache') add(H.tache, 0, -0.035, 0.108);
    else if (facial === 'goatee') add(H.goatee, 0, -0.085, 0.085);
  }



  /** Show/hide the controlled-player markers without changing who's controlled. */
  setMarkerVisible(on) {
    if (!this.ring) return;
    this.ring.visible = on; this.label.visible = on;
    this.badge.visible = on && !!this.isCareer;
  }

  /** Hand control to / take control from this player. */
  setControlled(on) {
    if (on && !this._privateMats) return;
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
      let diff = angleDiff(curDir, want);
      // QUICK CUT: a sharp flick of the stick on the ball = plant the foot and
      // snap most of the way to the new direction, then burst away
      if (this.isUser && hasBall && this.cutCd <= 0 && curSpeed > 1.5 && Math.abs(diff) > P.cutAngle && this.stumble <= 0) {
        const snap = diff * P.cutSnap;
        curDir = wrapAngle(curDir + snap);
        diff -= snap;
        speed = curSpeed * P.cutKeepSpeed;
        this.cutBoost = P.cutBurstTime;
        this.cutCd = P.cutCooldown;
        this.heading = wrapAngle(this.heading + snap * 0.8);
        this.playAction('turn', 0.32, { variant: 'cut', side: Math.sign(snap) || 1, kickLeg: Math.sign(snap) > 0 ? -1 : 1 });
        this.justCut = true;
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
    const jockey = this.role === 'def' && this.faceTarget && !hasBall && speed < CONFIG.player.jockeyMaxSpeed;
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
    if (this.ring) {
      const pulse = 0.85 + Math.sin(time * 4) * 0.12;
      this.ring.scale.setScalar(pulse);
      this.ring.material.opacity = 0.55 + Math.sin(time * 4) * 0.2;
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
