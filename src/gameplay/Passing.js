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
      if (d < 3 || d > range) continue;
      const ang = Math.acos(clamp((tx * dx + tz * dz) / d, -1, 1));
      if (ang > P.maxAngle) continue;
      this.leadPoint(passer, t, lead);
      const lane = this.laneClearance(passer.pos, lead, passer.team).clear;
      let score = 3;
      score -= P.angleWeight * (ang / cone);
      score -= P.distWeight * Math.abs(d - P.idealDist) / P.idealDist;
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

  /** User pressed PASS with the ball. */
  requestUserPass(user, dirX, dirZ) {
    if (this.pending) return;
    const sel = this.selectTarget(user, dirX, dirZ);
    const kickLeg = (this.kickLeg = -this.kickLeg);
    user.playAction('pass', 0.42, { kickLeg });
    if (sel) {
      this.game.effects.showMarker(sel.target);
      this.pending = { passer: user, target: sel.target, t: CONFIG.pass.windup };
    } else {
      const l = Math.hypot(dirX, dirZ) || 1;
      const aim = new THREE.Vector3(
        user.pos.x + (dirX / l) * CONFIG.pass.spaceDistance, 0, user.pos.z + (dirZ / l) * CONFIG.pass.spaceDistance);
      this.pending = { passer: user, target: null, aim, t: CONFIG.pass.windup };
    }
  }

  /** AI pass (teammate). */
  requestAIPass(passer, target) {
    if (this.pending) return;
    const kickLeg = (this.kickLeg = -this.kickLeg);
    passer.playAction('pass', 0.42, { kickLeg });
    this.pending = { passer, target, t: CONFIG.pass.windup * 0.8 };
    if (target.isUser) this.game.effects.showMarker(target);
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
    const aim = pd.target ? this.leadPoint(pd.passer, pd.target) : pd.aim;
    this.execute(pd.passer, pd.target, aim);
  }

  execute(passer, target, aim) {
    const g = this.game, ball = g.ball;
    const P = CONFIG.pass, M = CONFIG.statMap;
    const dx = aim.x - ball.pos.x, dz = aim.z - ball.pos.z;
    const dist = Math.hypot(dx, dz) || 0.1;
    let v0 = this.solveGroundSpeed(dist, P.arriveSpeed) * M.passSpeedFactor(passer.stats.passing);
    v0 = clamp(v0, P.minSpeed, P.maxSpeed);
    const pressure = this.pressureOn(passer);
    const sigma = M.passError(passer.stats.passing) + pressure * M.passPressureError(passer.stats.composure);
    const err = g.rng.gauss() * sigma;
    const c = Math.cos(err), s = Math.sin(err);
    const ux = dx / dist, uz = dz / dist;
    const fx = ux * c - uz * s, fz = ux * s + uz * c;
    ball.kick(fx * v0, 0, fz * v0, { type: 'pass', by: passer, ignoreTime: 0.3, time: g.simTime });
    ball.pass = { from: passer, to: target, aim: aim.clone(), t0: g.simTime };
    if (target) target.ai.receiving = true;
    g.audio.kick(v0 / 30);
    g.effects.puff(ball.pos.x, ball.pos.z, 0.8);
    g.events.emit('pass', { from: passer, to: target, aim, speed: v0 });
  }
}
