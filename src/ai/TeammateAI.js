// Teammate AI: runs in behind (staying onside), width, short support,
// receiving passes, and on-ball decisions that favour giving it back to the
// user when they're in a better spot (one-twos) or call for it.
import * as THREE from 'three';
import { CONFIG, clamp } from '../config.js';
import { dist2D } from '../core/MathUtil.js';

const _lead = new THREE.Vector3();

export class TeammateAI {
  constructor(game) {
    this.game = game;
  }

  reset() {
    for (const m of this.game.teammates) {
      m.ai.retarget = 0;
      m.ai.target = m.ai.target || new THREE.Vector3(m.pos.x, 0, m.pos.z);
      m.ai.target.set(m.pos.x, 0, m.pos.z);
      m.ai.holdT = 0;
      m.ai.decideAt = null;
      m.ai.userCalled = false;
      m.ai.receiving = false;
    }
  }

  /** User tapped PASS while a teammate has the ball. */
  callForBall() {
    const o = this.game.ball.owner;
    if (o && o.team === 'home' && !o.isUser) {
      o.ai.userCalled = true;
      return true;
    }
    return false;
  }

  nearestOpponentDist(p) {
    let best = 99;
    for (const d of this.game.defenders) {
      const dd = dist2D(d.pos, p.pos);
      if (dd < best) best = dd;
    }
    return best;
  }

  update(dt) {
    const g = this.game, ball = g.ball;
    const line = g.offsideLine();
    for (const m of g.teammates) {
      m.sprinting = false;
      m.signal = false;
      const ai = m.ai;
      if (ball.owner === m) { this._onBall(m, dt); continue; }
      ai.holdT = 0; ai.decideAt = null; ai.userCalled = false; ai.carry = null;
      if (ball.pass && ball.pass.to === m) { this._receive(m); m.aiLabel = 'receive'; continue; }
      ai.receiving = false;
      if (!ball.owner && !ball.pass && !ball.frozen && this._isChaser(m)) {
        m.aiLabel = 'chase';
        m.sprinting = true;
        m.moveTo(ball.pos.x + ball.vel.x * 0.25, ball.pos.z + ball.vel.z * 0.25, m.attrs.sprintSpeed, 0.3);
        continue;
      }
      this._offBall(m, dt, line);
    }
  }

  _isChaser(m) {
    const g = this.game, ball = g.ball;
    const dm = dist2D(m.pos, ball.pos);
    if (dm > 18) return false;
    if (dm > dist2D(g.user.pos, ball.pos) * 0.85) return false;
    for (const o of g.teammates) if (o !== m && dist2D(o.pos, ball.pos) < dm) return false;
    return true;
  }

  _receive(m) {
    const ball = this.game.ball;
    if (ball.pass && ball.pass.kind && ball.pass.kind !== 'ground' && ball.pass.aim) {
      // through ball / cross: sprint onto the spot it's played into
      const a = ball.pass.aim;
      m.sprinting = true;
      // get to the drop zone; once it's down, attack the ball itself
      const nearAim = Math.hypot(ball.pos.x - a.x, ball.pos.z - a.z) < 6;
      // once the ball's slowing or has reached the spot, go and get it wherever it is
      const slow = Math.hypot(ball.vel.x, ball.vel.z) < 7;
      const chase = ball.pass.kind === 'through' ? (nearAim || slow) : (nearAim && ball.pos.y < 0.9);
      if (chase) m.moveTo(ball.pos.x + ball.vel.x * 0.3, ball.pos.z + ball.vel.z * 0.3, m.attrs.sprintSpeed, 0.2);
      else m.moveTo(a.x, a.z, m.attrs.sprintSpeed, 0.4);
      m.faceTowards(ball.pos.x, ball.pos.z);
      return;
    }
    // run to the closest point on the ball's path ahead
    const v = ball.vel;
    const sp = Math.hypot(v.x, v.z) || 1;
    const ux = v.x / sp, uz = v.z / sp;
    const along = (m.pos.x - ball.pos.x) * ux + (m.pos.z - ball.pos.z) * uz;
    // runners keep going onto through balls; everyone else comes to meet the pass
    const t = Math.max(0, m.ai.role === 'runner' ? along : along - CONFIG.pass.meetDistance);
    const tx = ball.pos.x + ux * t, tz = ball.pos.z + uz * t;
    const d = Math.hypot(tx - m.pos.x, tz - m.pos.z);
    m.sprinting = d > 3;
    m.moveTo(tx, tz, d > 3 ? m.attrs.sprintSpeed : m.runSpeed, 0.6);
    m.faceTowards(ball.pos.x, ball.pos.z);
  }

  _offBall(m, dt, line) {
    const g = this.game, ball = g.ball, T = CONFIG.teammate;
    const ai = m.ai;
    const carrier = ball.owner || g.user;
    ai.retarget -= dt;
    if (ai.retarget <= 0) {
      ai.retarget = T.retargetInterval + g.rng.range(0, 0.25);
      this._pickTarget(m, carrier, line);
    }
    const d = dist2D(m.pos, ai.target);
    const run = d > 5;
    m.sprinting = d > 9;
    m.moveTo(ai.target.x, ai.target.z, m.sprinting ? m.attrs.sprintSpeed : run ? m.runSpeed : m.jogSpeed * 1.2, 2);
    if (d < 2) m.faceTowards(ball.pos.x, ball.pos.z);
    m.aiLabel = ai.role;

    // signal for the ball when open and the user has it
    if (ball.owner === g.user) {
      const open = this.nearestOpponentDist(m) > T.openDistance;
      const dc = dist2D(m.pos, g.user.pos);
      if (open && dc > 6 && dc < 32) {
        const lane = g.passing.laneClearance(g.user.pos, m.pos, 'home').clear;
        m.signal = lane > 2.2;
      }
    }
  }

  _pickTarget(m, carrier, line) {
    const g = this.game, T = CONFIG.teammate;
    const ai = m.ai;
    const W = CONFIG.pitch.width / 2, gx = CONFIG.pitch.length / 2;
    const cx = carrier.pos.x, cz = carrier.pos.z;
    const onside = line - T.onsideMargin;
    let x = cx, z = cz;
    if (ai.role === 'runner') {
      // shadow the last line, drifting into the gap between defenders
      x = Math.min(onside, cx + 24);
      let bestZ = ai.lane ?? 0, bestS = -Infinity;
      for (let k = -3; k <= 3; k++) {
        const cand = clamp((ai.lane ?? 0) + k * 2.5, -W + 6, W - 6);
        let near = 99;
        for (const d of g.defenders) near = Math.min(near, Math.hypot(d.pos.x - x, d.pos.z - cand));
        const s = Math.min(near, 6) - Math.abs(cand - (ai.lane ?? 0)) * 0.12;
        if (s > bestS) { bestS = s; bestZ = cand; }
      }
      z = bestZ;
    } else if (ai.role === 'wide') {
      const side = ai.side || (m.pos.z >= 0 ? 1 : -1);
      ai.side = side;
      z = side * (W - 4.5);
      x = Math.min(onside, cx + 6);
    } else {
      // support: sample spots around the carrier, prefer open + clear lane
      let best = null, bestS = -Infinity;
      const R = g.rng.range(T.supportRadiusMin, T.supportRadiusMax);
      for (let i = 0; i < 10; i++) {
        const a = -2.6 + (5.2 * i) / 9; // −150°..+150° around the attack direction
        const px = cx + Math.cos(a) * R, pz = cz + Math.sin(a) * R;
        if (Math.abs(pz) > W - 2 || px > onside || px > gx - 2) continue;
        let open = 99;
        for (const d of g.defenders) open = Math.min(open, Math.hypot(d.pos.x - px, d.pos.z - pz));
        let spacing = 99;
        for (const o of g.homePlayers()) {
          if (o === m) continue;
          spacing = Math.min(spacing, Math.hypot(o.pos.x - px, o.pos.z - pz));
        }
        const lane = g.passing.laneClearance(carrier.pos, { x: px, z: pz }, 'home').clear;
        const s = Math.min(open, 6) + Math.min(lane, 4) * 0.8 + Math.min(spacing, 8) * 0.3 - Math.abs(px - (cx - 1)) * 0.06;
        if (s > bestS) { bestS = s; best = { x: px, z: pz }; }
      }
      if (best) { x = best.x; z = best.z; } else { x = cx - 6; z = cz + (m.pos.z > cz ? 6 : -6); }
    }
    x = clamp(x, -gx + 2, Math.min(gx - 3, Math.max(onside, carrier.pos.x - 1)));
    z = clamp(z, -W + 1.5, W - 1.5);
    ai.target.set(x, 0, z);
  }

  _onBall(m, dt) {
    const g = this.game, T = CONFIG.teammate, ball = g.ball;
    const ai = m.ai;
    const user = g.user;
    m.aiLabel = 'on ball';
    ai.holdT += dt;
    if (ai.decideAt == null) {
      let delay = CONFIG.teamMap.decisionTime(m.rating) * g.rng.range(0.75, 1.25);
      // first-time return if the user just passed and is running into space
      if (ball.lastTouch === m && g.lastPasser === user && user.speed > 3) delay = T.oneTwoDelay + g.rng.range(0, 0.15);
      if (ai.userCalled) delay = Math.min(delay, 0.2);
      ai.decideAt = delay;
    }
    // dribble forward, away from the nearest defender
    let dx = CONFIG.pitch.length / 2 - m.pos.x, dz = -m.pos.z * 0.5;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    let near = null, nd = 99;
    for (const d of g.defenders) {
      const dd = dist2D(d.pos, m.pos);
      if (dd < nd) { nd = dd; near = d; }
    }
    if (near && nd < 5) {
      const ax = m.pos.x - near.pos.x, az = m.pos.z - near.pos.z;
      const al = Math.hypot(ax, az) || 1;
      dx += (ax / al) * (5 - nd) * 0.35; dz += (az / al) * (5 - nd) * 0.35;
    }
    // smooth the carry direction so the ball isn't left behind by sudden cuts
    if (!ai.carry) ai.carry = { x: dx, z: dz };
    const k = Math.min(1, dt * 2.5);
    ai.carry.x += (dx - ai.carry.x) * k; ai.carry.z += (dz - ai.carry.z) * k;
    m.steer(ai.carry.x, ai.carry.z, nd < 3 ? m.jogSpeed * 0.8 : m.runSpeed * 0.75);
    if (ai.userCalled && ai.decideAt > 0.2) ai.decideAt = Math.min(ai.decideAt, ai.holdT + 0.15);
    if (ai.holdT < ai.decideAt || g.passing.pending) return;

    // ---- decide
    const P = CONFIG.pass;
    g.passing.leadPoint(m, user, _lead);
    const userLane = g.passing.laneClearance(m.pos, _lead, 'home').clear;
    const userOpen = this.nearestOpponentDist(user);
    const progress = (user.pos.x - m.pos.x) / 15;
    const userScore = (Math.min(userLane / P.laneClear, 1) + progress * 0.6 + (userOpen > 3 ? 0.4 : 0)) * T.userPassBias;
    const pressured = nd < 1.8;
    const userDist = dist2D(m.pos, user.pos);

    if (ai.userCalled && userLane > T.callLaneTolerance && userDist < 40) {
      g.passing.requestAIPass(m, user);
      return;
    }
    if ((userScore > 1.5 || ai.holdT > T.maxHold || pressured) && userLane > 0.9 && userDist < 38) {
      g.passing.requestAIPass(m, user);
      return;
    }
    // otherwise keep it simple: another open teammate going forward
    const sel = g.passing.selectTarget(m, dx, dz, user);
    if (sel && sel.score > 2.2 && (pressured || sel.target.pos.x > m.pos.x + 3)) {
      g.passing.requestAIPass(m, sel.target);
      return;
    }
    if (ai.holdT > T.maxHold + 1.2 && userDist < 40) {
      g.passing.requestAIPass(m, user);
      return;
    }
    ai.decideAt = ai.holdT + 0.35;
  }
}
