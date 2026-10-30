// Ball physics. Ball.integrate() is a PURE function used both by the live
// ball and by the shot predictor, so the target circle matches real flight.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const GOAL_X = () => CONFIG.pitch.length / 2;

function makeBallTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f7f4';
  g.fillRect(0, 0, 256, 128);
  // Original panel pattern: offset dark hexes + a coloured band
  g.fillStyle = '#1d2433';
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      const x = i * 44 + (j % 2) * 22 + 10, y = j * 44 + 20;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        g.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 9);
      }
      g.fill();
    }
  }
  g.fillStyle = '#ff7a1a';
  g.fillRect(0, 60, 256, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Ball {
  constructor(scene) {
    const r = CONFIG.ball.radius;
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 20, 14),
      new THREE.MeshLambertMaterial({ map: makeBallTexture() }),
    );
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // Blob shadow (always on; helps read ball height when shadows are off)
    const sc = document.createElement('canvas');
    sc.width = sc.height = 64;
    const sg = sc.getContext('2d');
    const grd = sg.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = grd; sg.fillRect(0, 0, 64, 64);
    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.6),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }),
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 1;
    scene.add(this.blob);

    this.pos = new THREE.Vector3(0, r, 0);
    this.prevPos = this.pos.clone();
    this.vel = new THREE.Vector3();
    this.curve = 0;               // sidespin (rad/s about +y) driving Magnus swerve
    this.visualSpin = new THREE.Vector3();
    this.owner = null;            // player in possession (dribbling)
    this.lastTouch = null;        // last player to touch the ball
    this.lastKick = null;         // { type: 'pass'|'shot'|'touch'|'tackle'|'save', by, time }
    this.pass = null;             // active pass { from, to, aim }
    this.ignore = new Map();      // player → seconds during which they can't touch it
    this.inGoal = false;
    this.frozen = false;          // held by keeper
    this.events = [];
  }

  reset(x, z) {
    this.pos.set(x, CONFIG.ball.radius, z);
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.curve = 0;
    this.visualSpin.set(0, 0, 0);
    this.owner = null; this.lastTouch = null; this.lastKick = null; this.pass = null;
    this.ignore.clear();
    this.inGoal = false; this.frozen = false;
    this.mesh.quaternion.identity();
  }

  savePrev() { this.prevPos.copy(this.pos); }

  get speed() { return this.vel.length(); }
  get groundSpeed() { return Math.hypot(this.vel.x, this.vel.z); }

  /** Kick: set new velocity. `by` is ignored as a toucher briefly. */
  kick(vx, vy, vz, { curve = 0, type = 'touch', by = null, time = 0, ignoreTime = 0.25 } = {}) {
    this.vel.set(vx, vy, vz);
    this.curve = curve;
    this.lastKick = { type, by, time };
    if (by) { this.lastTouch = by; if (ignoreTime > 0) this.ignore.set(by, ignoreTime); }
    if (type !== 'touch') this.owner = null;
    if (type !== 'pass') this.pass = null;
    if (vy > 0.5 && this.pos.y < CONFIG.ball.radius + 0.02) this.pos.y = CONFIG.ball.radius + 0.01;
    // visual spin: topspin roughly along travel, plus sidespin
    const h = Math.hypot(vx, vz) || 1;
    this.visualSpin.set(vz / h, curve * 0.3, -vx / h).multiplyScalar(h / CONFIG.ball.radius * 0.6);
    this.visualSpin.y = curve * 2;
    this.frozen = false;
  }

  canTouch(p) { return !this.ignore.has(p) && !this.frozen; }

  /**
   * Pure integration step shared with prediction.
   * s = { px, py, pz, vx, vy, vz, curve } — mutated in place. Returns true if it bounced.
   */
  static integrate(s, dt) {
    const B = CONFIG.ball;
    const r = B.radius;
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz);
    const airborne = s.py > r + 0.005 || s.vy > 0.05;
    let bounced = false;
    if (airborne) {
      // gravity + quadratic drag + Magnus (curve about +y → lateral accel)
      const k = B.airDrag * sp;
      let ax = -k * s.vx, ay = -B.gravity - k * s.vy, az = -k * s.vz;
      const m = B.magnus * s.curve;
      ax += m * s.vz;
      az += -m * s.vx;
      s.vx += ax * dt; s.vy += ay * dt; s.vz += az * dt;
      s.px += s.vx * dt; s.py += s.vy * dt; s.pz += s.vz * dt;
      if (s.py < r) {
        s.py = r;
        if (s.vy < -B.settleSpeed) {
          s.vy = -s.vy * B.restitution;
          s.vx *= B.bounceFriction; s.vz *= B.bounceFriction;
          s.curve *= 0.5;
          bounced = true;
        } else {
          s.vy = 0;
        }
      }
    } else {
      // rolling: constant + linear friction, curve fades fast on grass
      s.py = r; s.vy = 0;
      const h = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
      if (h > 1e-4) {
        const dec = (B.rollDecel + B.rollLinear * h) * dt;
        const nh = Math.max(0, h - dec);
        const f = nh / h;
        s.vx *= f; s.vz *= f;
        // a little swerve while rolling
        const m = B.magnus * s.curve * 0.4;
        s.vx += m * s.vz * dt; s.vz += -m * s.vx * dt;
      } else { s.vx = 0; s.vz = 0; }
      s.px += s.vx * dt; s.pz += s.vz * dt;
    }
    s.curve *= Math.max(0, 1 - B.curveDecay * dt);
    return bounced;
  }

  /** Collide state with the goal frame at +x (and mirrored at −x). Returns true if hit. */
  static collideFrame(s) {
    const P = CONFIG.pitch;
    const r = CONFIG.ball.radius;
    const R = P.postRadius;
    const gx = s.px > 0 ? P.length / 2 : -P.length / 2;
    if (Math.abs(s.px - gx) > r + R + 0.5) return false;
    const hw = P.goalWidth / 2 + R;
    const H = P.goalHeight + R;
    const segs = [
      [gx, 0, -hw, gx, H, -hw],
      [gx, 0, hw, gx, H, hw],
      [gx, H, -hw, gx, H, hw],
    ];
    let hit = false;
    for (const sg of segs) {
      const ax = sg[0], ay = sg[1], az = sg[2];
      const bx = sg[3] - ax, by = sg[4] - ay, bz = sg[5] - az;
      const l2 = bx * bx + by * by + bz * bz;
      let t = ((s.px - ax) * bx + (s.py - ay) * by + (s.pz - az) * bz) / l2;
      t = Math.max(0, Math.min(1, t));
      const qx = ax + bx * t, qy = ay + by * t, qz = az + bz * t;
      let nx = s.px - qx, ny = s.py - qy, nz = s.pz - qz;
      const d = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (d < r + R && d > 1e-6) {
        nx /= d; ny /= d; nz /= d;
        s.px = qx + nx * (r + R); s.py = qy + ny * (r + R); s.pz = qz + nz * (r + R);
        const vn = s.vx * nx + s.vy * ny + s.vz * nz;
        if (vn < 0) {
          const e = CONFIG.ball.postRestitution;
          s.vx -= (1 + e) * vn * nx; s.vy -= (1 + e) * vn * ny; s.vz -= (1 + e) * vn * nz;
          s.vx *= 0.92; s.vz *= 0.92;
          s.curve *= -0.3;
          hit = true;
        }
      }
    }
    return hit;
  }

  /** Inside-the-goal net behaviour (catches the ball). Returns impact speed if it hit the net. */
  static collideNet(s) {
    const P = CONFIG.pitch;
    const B = CONFIG.ball;
    const r = B.radius;
    const sign = s.px > 0 ? 1 : -1;
    const gx = sign * P.length / 2;
    const depth = (s.px - gx) * sign;
    if (depth <= 0) return 0;
    const hw = P.goalWidth / 2;
    if (Math.abs(s.pz) > hw + 0.3 || s.py > P.goalHeight + 0.3) return 0;
    let impact = 0;
    const back = P.goalDepth - r;
    if (depth > back) {
      impact = Math.max(impact, Math.abs(s.vx));
      s.px = gx + sign * back;
      s.vx = -s.vx * B.netRestitution;
      s.vy *= 0.6; s.vz *= 0.6;
    }
    if (Math.abs(s.pz) > hw - r) {
      impact = Math.max(impact, Math.abs(s.vz));
      s.pz = Math.sign(s.pz) * (hw - r);
      s.vz = -s.vz * B.netRestitution;
    }
    // top net slopes down from crossbar to ~1.9 m at the back
    const roof = P.goalHeight - (depth / P.goalDepth) * 0.5 - r;
    if (s.py > roof) {
      impact = Math.max(impact, Math.abs(s.vy));
      s.py = roof;
      if (s.vy > 0) s.vy = -s.vy * B.netRestitution;
    }
    return impact;
  }

  /** Live physics step (fixed dt). Pushes events into this.events. */
  update(dt) {
    for (const [p, t] of this.ignore) {
      const nt = t - dt;
      if (nt <= 0) this.ignore.delete(p); else this.ignore.set(p, nt);
    }
    if (this.frozen) return;
    const n = CONFIG.sim.ballSubSteps;
    const h = dt / n;
    const s = this._s || (this._s = {});
    s.px = this.pos.x; s.py = this.pos.y; s.pz = this.pos.z;
    s.vx = this.vel.x; s.vy = this.vel.y; s.vz = this.vel.z; s.curve = this.curve;
    const gx = CONFIG.pitch.length / 2;
    for (let i = 0; i < n; i++) {
      const wasX = s.px;
      const vyBefore = s.vy;
      if (Ball.integrate(s, h)) this.events.push({ type: 'bounce', v: Math.abs(vyBefore) });
      if (Ball.collideFrame(s)) this.events.push({ type: 'post', v: Math.hypot(s.vx, s.vy, s.vz) });
      // goal-line crossing (whole ball over the line, inside the frame)
      if (!this.inGoal && Math.abs(wasX) <= gx + CONFIG.ball.radius && Math.abs(s.px) > gx + CONFIG.ball.radius) {
        const P = CONFIG.pitch;
        if (Math.abs(s.pz) < P.goalWidth / 2 && s.py < P.goalHeight) {
          this.inGoal = true;
          this.events.push({ type: 'goal', side: Math.sign(s.px), z: s.pz, y: s.py });
        }
      }
      if (this.inGoal) {
        const imp = Ball.collideNet(s);
        if (imp > 2) this.events.push({ type: 'net', v: imp, x: s.px, y: s.py, z: s.pz });
        // net drag
        const f = Math.max(0, 1 - CONFIG.ball.netDrag * h * 0.25);
        s.vx *= f; s.vz *= f;
      }
    }
    this.pos.set(s.px, s.py, s.pz);
    this.vel.set(s.vx, s.vy, s.vz);
    this.curve = s.curve;

    // Visual spin: roll on ground, keep air spin otherwise
    if (this.pos.y <= CONFIG.ball.radius + 0.01) {
      const r = CONFIG.ball.radius;
      this.visualSpin.set(this.vel.z / r, this.curve * 0.5, -this.vel.x / r);
    } else {
      this.visualSpin.multiplyScalar(Math.max(0, 1 - 0.3 * dt));
    }
    const w = this.visualSpin.length();
    if (w > 1e-3) {
      const q = Ball._q || (Ball._q = new THREE.Quaternion());
      const ax = Ball._ax || (Ball._ax = new THREE.Vector3());
      ax.copy(this.visualSpin).divideScalar(w);
      q.setFromAxisAngle(ax, w * dt);
      this.mesh.quaternion.premultiply(q);
    }
  }

  render(alpha) {
    this.mesh.position.lerpVectors(this.prevPos, this.pos, alpha);
    const p = this.mesh.position;
    this.blob.position.set(p.x, 0.012, p.z);
    const hgt = Math.max(0, p.y - CONFIG.ball.radius);
    const s = 1 + hgt * 0.35;
    this.blob.scale.set(s, s, s);
    this.blob.material.opacity = Math.max(0.15, 1 - hgt * 0.25);
  }
}

export { GOAL_X };
