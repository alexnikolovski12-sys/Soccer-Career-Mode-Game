// Pass target selection (angle > distance > lane safety), leading the
// receiver, stat-driven accuracy and ground-pass speed solving.
import * as THREE from 'three';
import { CONFIG, clamp } from '../config.js';
import { Ball } from '../entities/Ball.js';
import { pointSegDist2D } from '../core/MathUtil.js';

export class Passing {
  constructor(game) {
    this.game = game;
    this.pending = null;
    this.kickLeg = 1;
    this._speedCache = new Map();
  }

  reset() { this.pending = null; }

  /** 0..1 pressure from opponents near a player. */
  pressureOn(p) {
    const r = CONFIG.pass.pressureRadius;
    let s = 0;
    for (const o of this.game.opponentsOf(p)) {
      if (o.isKeeper) continue;
      const d = Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z);
      if (d < r) s += 1 - d / r;
    }
    return clamp(s, 0, 1);
  }

  /** Smallest distance of any opponent to the lane from → to (only those between). */
  laneClearance(from, to, team) {
    let min = 99;
    let blocker = null;
    for (const o of this.game.players) {
      if (o.team === team) continue;
      const { d, t } = pointSegDist2D(o.pos, from, to);
      if (t <= 0.02 || t >= 0.98) continue;
      // defenders further along the lane have more time to react → effectively closer
      const eff = d - t * 0.4;
      if (eff < min) { min = eff; blocker = o; }
    }
    return { clear: Math.max(0, min), blocker };
  }

  /** Predict where the receiver will be when the ball arrives. */
  leadPoint(passer, t, out = new THREE.Vector3()) {
    const ball = this.game.ball;
    const P = CONFIG.pass;
    let vx = t.vel.x, vz = t.vel.z;
    // runners on the last line get a through ball into space
    if (t.ai && t.ai.role === 'runner' && !t.isUser) {
      const line = this.game.offsideLine();
      if (t.pos.x > line - 3) {
        const sp = t.runSpeed;
        const gx = CONFIG.pitch.length / 2 - 6;
        const dx = gx - t.pos.x, dz = -t.pos.z * 0.4;
        const l = Math.hypot(dx, dz) || 1;
        vx = (dx / l) * sp * P.throughBallLead; vz = (dz / l) * sp * P.throughBallLead;
      }
    }
    out.copy(t.pos);
    for (let i = 0; i < 3; i++) {
      const d = Math.hypot(out.x - ball.pos.x, out.z - ball.pos.z);
      const time = d / 13 + 0.15;
      out.set(t.pos.x + vx * time * P.leadFactor, 0, t.pos.z + vz * time * P.leadFactor);
    }
    const L = CONFIG.pitch.length / 2 - 1.2, W = CONFIG.pitch.width / 2 - 1.2;
    out.x = clamp(out.x, -L, L); out.z = clamp(out.z, -W, W);
    return out;
  }

  /** Choose the best receiver for `passer` in direction (dx, dz). */
  selectTarget(passer, dx, dz, exclude = null) {
    const g = this.game;
    const P = CONFIG.pass, M = CONFIG.statMap;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    const cone = M.visionCone(passer.stats.vision);
    const range = M.visionRange(passer.stats.vision);
    const laneAware = M.visionLaneAwareness(passer.stats.vision);
    let best = null, bestScore = -Infinity;
    const lead = new THREE.Vector3();
    for (const t of g.teammatesOf(passer)) {
      if (t === exclude || t.isKeeper) continue;
      const tx = t.pos.x - passer.pos.x, tz = t.pos.z - passer.pos.z;
      const d = Math.hypot(tx, tz);
      // every pass goes to somebody: nobody is ruled out, angle and distance just cost score
      if (d < 2.5 || d > 55) continue;
      const ang = Math.acos(clamp((tx * dx + tz * dz) / d, -1, 1));
      this.leadPoint(passer, t, lead);
      const lane = this.laneClearance(passer.pos, lead, passer.team).clear;
      let score = 3;
      score -= P.angleWeight * (ang / cone);
      score -= P.distWeight * Math.abs(d - P.idealDist) / P.idealDist;
      if (ang > P.maxAngle) score -= 2 * (ang - P.maxAngle);
      if (d > range) score -= (d - range) / 8;
      score -= P.laneWeight * laneAware * Math.max(0, (P.laneClear - lane) / P.laneClear);
      if (lane < 1) score -= 1.2 * laneAware; // a body right in the lane = near-certain interception
      score += ((lead.x - passer.pos.x) / 20) * 0.35;
      if (t.signal) score += 0.25;
      if (t.isUser) score += 0.3;
      if (score > bestScore) { bestScore = score; best = t; }
    }
    return best ? { target: best, score: bestScore } : null;
  }

  /** Ground pass initial speed so it arrives at ~arriveSpeed after `dist`. */
  solveGroundSpeed(dist, arrive) {
    const key = Math.round(dist * 4) * 100 + Math.round(arrive * 4);
    const cached = this._speedCache.get(key);
    if (cached) return cached;
    const dt = 1 / 60;
    const s = {};
    const arriveAt = (v0) => {
      s.px = 0; s.py = CONFIG.ball.radius; s.pz = 0; s.vx = v0; s.vy = 0; s.vz = 0; s.curve = 0;
      for (let i = 0; i < 600; i++) {
        Ball.integrate(s, dt);
        if (s.px >= dist) return s.vx;
        if (s.vx <= 0.01) return -1;
      }
      return -1;
    };
    let lo = 1, hi = 45;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (arriveAt(mid) < arrive) lo = mid; else hi = mid;
    }
    this._speedCache.set(key, hi);
    return hi;
  }

  /**
   * Pick an animation variant that fits the pass: lofted, through, driven,
   * outside-of-the-boot, back-heel, off-balance or a plain side-foot.
   */
  pickVariant(passer, kind, tx, tz) {
    const rng = this.game.rng;
    if (kind === 'lofted') return rng.chance(0.25) ? 'chipped' : 'lofted';
    const dx = tx - passer.pos.x, dz = tz - passer.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const fx = Math.sin(passer.heading), fz = Math.cos(passer.heading);
    const ang = Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1));
    if (this.pressureOn(passer) > 0.75 && rng.chance(0.6)) return 'offbalance';
    if (ang > 2.3 && d < 14 && rng.chance(0.55)) return 'backheel';
    if (ang > 0.8 && rng.chance(0.5)) return 'outside';
    if (kind === 'through') return rng.chance(0.4) ? 'outside' : 'driven';
    if (d > 22) return 'driven';
    if (d < 8 && rng.chance(0.25)) return 'flick';
    return rng.chance(0.15) ? 'outside' : 'side';
  }

  /** Where a through ball goes: in front of the runner, toward the goal we attack. */
  throughPoint(passer, t, out = new THREE.Vector3()) {
    const gx = CONFIG.pitch.length / 2;
    const dx = gx - 5 - t.pos.x, dz = -t.pos.z * 0.45;
    const l = Math.hypot(dx, dz) || 1;
    // more space in front → lead it further
    let space = 99;
    for (const o of this.game.opponentsOf(t)) {
      if (o.isKeeper) continue;
      const ahead = (o.pos.x - t.pos.x) * (dx / l) + (o.pos.z - t.pos.z) * (dz / l);
      if (ahead > 0) space = Math.min(space, Math.hypot(o.pos.x - t.pos.x, o.pos.z - t.pos.z));
    }
    const lead = clamp(Math.min(space * 0.8, CONFIG.pass.throughMax), CONFIG.pass.throughMin, CONFIG.pass.throughMax);
    out.set(t.pos.x + (dx / l) * lead, 0, t.pos.z + (dz / l) * lead);
    const L = gx - 2.5, W = CONFIG.pitch.width / 2 - 1.5;
    out.x = clamp(out.x, -L, L); out.z = clamp(out.z, -W, W);
    return out;
  }

  /** User pressed PASS / THROUGH. kind: ground | lofted | through */
  requestUserPass(user, dirX, dirZ, kind = 'ground') {
    if (this.pending) return;
    let sel = this.selectTarget(user, dirX, dirZ);
    if (kind === 'through') {
      // prefer a teammate ahead of us for a through ball
      const fwd = this.selectTarget(user, dirX * 0.4 + 1, dirZ * 0.4);
      if (fwd && fwd.target.pos.x > user.pos.x - 2) sel = fwd;
    }
    const kickLeg = (this.kickLeg = -this.kickLeg);
    let aim;
    if (sel) {
      aim = kind === 'through' ? this.throughPoint(user, sel.target) : this.leadPoint(user, sel.target);
      this.game.effects.showMarker(sel.target);
    } else {
      const l = Math.hypot(dirX, dirZ) || 1;
      const far = kind === 'ground' ? CONFIG.pass.spaceDistance : CONFIG.pass.spaceDistance * 1.6;
      aim = new THREE.Vector3(user.pos.x + (dirX / l) * far, 0, user.pos.z + (dirZ / l) * far);
    }
    const variant = this.pickVariant(user, kind, aim.x, aim.z);
    const dur = variant === 'lofted' || variant === 'chipped' ? 0.6 : variant === 'backheel' || variant === 'flick' ? 0.4 : 0.5;
    user.playAction('pass', dur, { kickLeg, variant });
    this.pending = { passer: user, target: sel ? sel.target : null, aim: sel ? null : aim, t: CONFIG.pass.windup, kind };
  }

  /** AI pass (teammate). */
  requestAIPass(passer, target, kind = 'ground') {
    if (this.pending) return;
    const kickLeg = (this.kickLeg = -this.kickLeg);
    const variant = this.pickVariant(passer, kind, target.pos.x, target.pos.z);
    passer.playAction('pass', 0.5, { kickLeg, variant });
    this.pending = { passer, target, t: CONFIG.pass.windup * 0.8, kind };
    if (target.isUser) this.game.effects.showMarker(target);
  }

  /** Initial velocity for a lofted pass that lands on `aim`. */
  solveLoft(start, aim, elev) {
    const r = CONFIG.ball.radius;
    const dx = aim.x - start.x, dz = aim.z - start.z;
    const d = Math.hypot(dx, dz) || 0.1;
    const ux = dx / d, uz = dz / d, ce = Math.cos(elev), se = Math.sin(elev);
    const dt = 1 / 120;
    const land = (v) => {
      const s = { px: start.x, py: r + 0.01, pz: start.z, vx: ux * v * ce, vy: v * se, vz: uz * v * ce, curve: 0 };
      for (let i = 0; i < 600; i++) {
        Ball.integrate(s, dt);
        if (i > 4 && s.py <= r + 1e-3) break;
      }
      return Math.hypot(s.px - start.x, s.pz - start.z);
    };
    let lo = 3, hi = 40;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (land(mid) < d) lo = mid; else hi = mid;
    }
    const v = (lo + hi) / 2;
    return [ux * v * ce, v * se, uz * v * ce];
  }

  update(dt) {
    const pd = this.pending;
    if (!pd) return;
    pd.t -= dt;
    if (pd.t > 0) return;
    this.pending = null;
    const g = this.game, ball = g.ball;
    // still in control?
    if (ball.owner !== pd.passer) {
      const d = Math.hypot(ball.pos.x - pd.passer.pos.x, ball.pos.z - pd.passer.pos.z);
      if (ball.owner || d > 1.6) return;
    }
    const kind = pd.kind || 'ground';
    const aim = pd.target
      ? (kind === 'through' ? this.throughPoint(pd.passer, pd.target) : this.leadPoint(pd.passer, pd.target))
      : pd.aim;
    this.execute(pd.passer, pd.target, aim, kind);
  }

  execute(passer, target, aim, kind = 'ground') {
    const g = this.game, ball = g.ball;
    const P = CONFIG.pass, M = CONFIG.statMap;
    const dx = aim.x - ball.pos.x, dz = aim.z - ball.pos.z;
    if (kind === 'lofted') {
      // cross / lofted ball: lands on the receiver's run
      const dist = Math.hypot(dx, dz) || 0.1;
      const err = M.passError(passer.stats.passing) * 0.8 + this.pressureOn(passer) * 0.03;
      const ax = aim.x + g.rng.gauss() * err * dist, az = aim.z + g.rng.gauss() * err * dist;
      const elev = dist < 14 ? 0.82 : dist < 28 ? 0.62 : 0.5;
      let [vx, vy, vz] = this.solveLoft(ball.pos, { x: ax, z: az }, elev);
      if (target) {
        // don't drop it further from the receiver than he can sprint before it lands
        const tf = (2 * vy) / CONFIG.ball.gravity;
        const reach = target.attrs.sprintSpeed * tf * 0.7;
        const rx = ax - target.pos.x, rz = az - target.pos.z, rd = Math.hypot(rx, rz);
        if (rd > reach) {
          const k = reach / rd;
          [vx, vy, vz] = this.solveLoft(ball.pos, { x: target.pos.x + rx * k, z: target.pos.z + rz * k }, elev);
          aim = { x: target.pos.x + rx * k, z: target.pos.z + rz * k };
        } else aim = { x: ax, z: az };
      } else aim = { x: ax, z: az };
      ball.kick(vx, vy, vz, { type: 'pass', by: passer, ignoreTime: 0.35, time: g.simTime });
      ball.pass = { from: passer, to: target, aim: new THREE.Vector3(aim.x, 0, aim.z), t0: g.simTime, kind };
      if (target) target.ai.receiving = true;
      if (target && passer.isUser) g.switchControl(target, true); // you're straight onto the receiver
      g.audio.kick(0.55, 'pass');
      g.effects.puff(ball.pos.x, ball.pos.z, 0.8);
      g.events.emit('pass', { from: passer, to: target, aim, speed: Math.hypot(vx, vy, vz), kind });
      return;
    }
    const dist = Math.hypot(dx, dz) || 0.1;
    // pace scales with distance: arrives at a firm, controllable speed every time
    const arrive = kind === 'through' ? P.arriveSpeed * 1.15 : P.arriveSpeed;
    let v0 = this.solveGroundSpeed(dist, arrive) * M.passSpeedFactor(passer.stats.passing);
    v0 = clamp(v0, P.minSpeed, P.maxSpeed);
    const pressure = this.pressureOn(passer);
    const sigma = M.passError(passer.stats.passing) + pressure * M.passPressureError(passer.stats.composure);
    const err = g.rng.gauss() * sigma;
    const c = Math.cos(err), s = Math.sin(err);
    const ux = dx / dist, uz = dz / dist;
    const fx = ux * c - uz * s, fz = ux * s + uz * c;
    ball.kick(fx * v0, 0, fz * v0, { type: 'pass', by: passer, ignoreTime: 0.3, time: g.simTime });
    ball.pass = { from: passer, to: target, aim: aim.clone(), t0: g.simTime, kind };
    if (target) target.ai.receiving = true;
    if (target && passer.isUser) g.switchControl(target, true); // you're straight onto the receiver
    g.audio.kick(v0 / 30, 'pass');
    g.effects.puff(ball.pos.x, ball.pos.z, 0.8);
    g.events.emit('pass', { from: passer, to: target, aim, speed: v0 });
  }
}
