// Goalkeeper controller (wraps a shared Player). Positions on the ball–goal
// line, narrows the angle, reacts to shots after a delay and resolves the
// save probabilistically (catch / parry / tip over / beaten).
import * as THREE from 'three';
import { CONFIG, clamp } from '../config.js';
import { smoothstep, dist2D } from '../core/MathUtil.js';

export class Keeper {
  constructor(game, player) {
    this.game = game;
    this.p = player;
    this.state = 'set';
    this.plan = null;
    this.t = 0;
  }

  get goalX() { return CONFIG.pitch.length / 2; }

  reset() {
    const p = this.p;
    p.place(this.goalX - CONFIG.keeper.lineOffset, 0, -Math.PI / 2);
    this.state = 'set';
    this.plan = null;
    this.t = 0;
  }

  /** Lateral unit axis in world space for the keeper's local +x. */
  _localX() {
    const h = this.p.heading;
    return { x: Math.cos(h), z: -Math.sin(h) };
  }

  rating() { return CONFIG.keeper.rating; }

  /** Bought a fake shot: dives the wrong way, then has to get up. */
  fool(side) {
    if (this.state !== 'set') return;
    this.state = 'fooled';
    this.t = 0;
    this.foolSide = side;
    this.p.playAction('dive', 1.0, { side, roll: 1.2, lift: 0.18 });
  }

  update(dt) {
    const g = this.game, ball = g.ball, p = this.p, K = CONFIG.keeper;
    this.t += dt;

    if (this.state === 'fooled') {
      p.steer(0, 0, 0);
      p.vel.set(0, 0, 0);
      if (this.t < 0.45) p.pos.z += this.foolSide * 3.2 * dt;
      if (this.t > 1.05) { this.state = 'down'; this.t = 0; }
      return;
    }

    if (this.state === 'holding') {
      p.steer(0, 0, 0);
      ball.pos.set(p.pos.x - 0.45, 1.05, p.pos.z);
      ball.vel.set(0, 0, 0);
      return;
    }

    if (this.state === 'dive') {
      const pl = this.plan;
      const tt = this.t;
      if (tt < pl.reaction) {
        p.steer(0, 0, 0);
      } else {
        if (!pl.started) {
          pl.started = true;
          p.playAction('dive', Math.max(0.55, pl.tI - pl.reaction + 0.55), {
            side: pl.side, roll: pl.roll, lift: pl.lift,
          });
        }
        // move the root laterally toward the dive spot
        const remaining = Math.max(0.05, pl.tI - tt);
        const dz = pl.rootZ - p.pos.z, dx = pl.rootX - p.pos.x;
        const d = Math.hypot(dx, dz);
        const v = Math.min(d / remaining, K.diveSpeed(this.rating()) * 1.6);
        if (d > 0.02) { p.pos.x += (dx / d) * v * dt; p.pos.z += (dz / d) * v * dt; }
        p.vel.set(0, 0, 0);
      }
      // contact
      if (pl.save && !pl.done && ball.lastKick && ball.lastKick.type === 'shot') {
        const reached = ball.pos.x >= pl.ix - 0.25 || Math.hypot(ball.pos.x - pl.ix, ball.pos.y - pl.iy, ball.pos.z - pl.iz) < 0.45;
        if (reached && tt >= pl.reaction) this._applySave(pl);
      }
      if (tt > pl.tI + 1.0) { this.state = 'down'; this.t = 0; }
      return;
    }

    if (this.state === 'down') {
      p.steer(0, 0, 0);
      if (this.t > 0.7) this.state = 'set';
      this._tryClaim(dt);
      return;
    }

    // ---- positioning: on the ball–goal line, stepping out to narrow the angle
    const gx = this.goalX;
    const bx = ball.pos.x, bz = ball.pos.z;
    const dxg = bx - gx, dzg = bz;
    const dBall = Math.hypot(dxg, dzg) || 1;
    let adv = K.lineOffset + (K.maxAdvance - K.lineOffset) * smoothstep(30, 9, dBall);
    adv = Math.min(adv, Math.max(K.lineOffset, dBall - 2.2));
    let tx = gx + (dxg / dBall) * adv;
    let tz = (dzg / dBall) * adv;
    tz = clamp(tz, -CONFIG.pitch.goalWidth / 2 + 0.3, CONFIG.pitch.goalWidth / 2 - 0.3);
    tx = Math.min(tx, gx - 0.3);

    // rush a 1v1 dribbler whose touch is heavy
    const owner = ball.owner;
    if (owner && owner.team === 'home' && dBall < 13 && Math.abs(bz) < 12) {
      const dKB = dist2D(p.pos, ball.pos);
      if (dKB < 6) { tx = ball.pos.x; tz = ball.pos.z; }
    }
    p.moveTo(tx, tz, K.moveSpeed, 1.2);
    p.faceTowards(bx, bz);
    this._tryClaim(dt);
  }

  _tryClaim(dt) {
    const g = this.game, ball = g.ball, p = this.p, K = CONFIG.keeper;
    if (!ball.canTouch(p) || ball.inGoal) return;
    const d = dist2D(p.pos, ball.pos);
    const inBox = ball.pos.x > this.goalX - CONFIG.pitch.penaltyDepth &&
      Math.abs(ball.pos.z) < CONFIG.pitch.penaltyWidth / 2;
    if (!inBox || ball.pos.y > K.jumpReach) return;
    if (!ball.owner) {
      if (d < K.claimRadius && ball.speed < K.claimMaxSpeed) this.hold();
      return;
    }
    if (ball.owner.team === 'home') {
      // smother: ball loose from the dribbler's feet
      const fp = ball.owner.footPoint(this._tmp || (this._tmp = new THREE.Vector3()));
      const gap = Math.hypot(ball.pos.x - fp.x, ball.pos.z - fp.z);
      const rate = (gap > 0.45 ? 4.5 : 1.4) * (this.rating() / 70);
      if (d < 1.3 && Math.random() < dt * rate) {
        this.hold();
        g.events.emit('keeperSmother');
      }
    }
  }

  hold() {
    const ball = this.game.ball;
    const fromShot = ball.lastKick && (ball.lastKick.type === 'shot' || ball.lastKick.type === 'save');
    ball.owner = null;
    ball.pass = null;
    ball.frozen = true;
    ball.vel.set(0, 0, 0);
    this.state = 'holding';
    this.p.playAction('catch', 0.6);
    this.game.events.emit('keeperHold', { fromShot });
  }

  /**
   * Called at shot release with the predicted path (array of {x,y,z,t}) and
   * prediction info. Decides the outcome now; the dive plays it out.
   */
  onShot(path, info, shooter) {
    const K = CONFIG.keeper, p = this.p;
    const kx = p.pos.x;
    // intercept point: first sample at/after the keeper's plane
    let I = null;
    for (let i = 0; i < path.length; i++) {
      if (path[i].x >= kx - 0.1) { I = path[i]; break; }
    }
    if (!I) { this.plan = null; return { save: false, prob: 0 }; }
    const lx = this._localX();
    const lateral = (I.z - p.pos.z) * lx.z + (I.x - p.pos.x) * lx.x;
    const dist = Math.abs(lateral);
    const speed = info.speed;
    const rating = this.rating();
    const reaction = K.reaction(rating);
    const diveSpeed = K.diveSpeed(rating);
    const onTarget = info.onTarget;
    const nearMiss = !onTarget && info.missDistance < 0.7;

    let prob = 0;
    if (onTarget) {
      const timeNeeded = reaction + Math.max(0, dist - K.standReach) / diveSpeed;
      const slack = I.t - timeNeeded;
      let pReach = clamp(K.reachBase + slack * K.reachSlope, 0, 1);
      if (dist > K.maxReach || I.y > K.jumpReach) pReach *= 0.1;
      prob = pReach * 0.95;
      prob -= K.speedPenalty * Math.max(0, speed - 18);
      const az = Math.abs(I.z);
      if (I.y > 1.75 && az > 2.4) prob -= K.cornerPenalty;
      else if (I.y < 0.5 && az > 2.6) prob -= K.lowCornerPenalty;
      if (dist < K.standReach) prob += K.centralBonus * (1 - dist / K.standReach);
      prob += CONFIG.statMap.finishingSaveMod(shooter.stats.finishing);
      prob += (rating - 70) * 0.006;
      if (info.kind === 'finesse') prob -= 0.12;            // bending away from him
      if (info.kind === 'chip' && I.y > 1.7) prob *= 0.3;  // dropping over his head
      if (this.state === 'fooled' || (this.state === 'down' && this.t < 0.5)) prob *= 0.15; // on the floor after a fake
      prob *= K.difficulty;
      prob = clamp(prob, 0.03, 0.97);
    }
    const save = onTarget && Math.random() < prob;

    let type = 'beaten';
    if (save) {
      if (dist < 1.25 && I.y < 1.9 && speed < K.catchMaxSpeed) type = 'catch';
      else if (I.y > 2.05) type = 'tip';
      else type = Math.random() < 0.25 && speed < 20 ? 'catch' : 'parry';
    }

    const side = lateral >= 0 ? 1 : -1;
    const needsDive = dist > K.standReach * 0.8 || I.y > 1.9;
    const body = save ? Math.min(dist, 1.15) : Math.min(dist, 1.15) + 0.4 + Math.random() * 0.5;
    // root destination (hands reach ~1.1 m along the dive)
    let rootLat = needsDive ? lateral - side * body : lateral * 0.6;
    if (!save && !needsDive) rootLat = lateral - side * 0.9; // wrong-footed
    const willMove = onTarget || nearMiss;
    this.plan = {
      save, type, prob, tI: I.t, reaction, side,
      ix: I.x, iy: I.y, iz: I.z,
      rootX: p.pos.x + lx.x * (willMove ? rootLat : 0),
      rootZ: p.pos.z + lx.z * (willMove ? rootLat : 0),
      roll: needsDive ? clamp(dist / 1.8, 0.35, 1.4) : 0.15,
      lift: clamp(I.y - 0.5, 0, 1.6) * 0.55,
      done: false, started: false,
    };
    if (willMove) { this.state = 'dive'; this.t = 0; }
    return { save, type, prob };
  }

  _applySave(pl) {
    const g = this.game, ball = g.ball;
    pl.done = true;
    g.events.emit('save', { type: pl.type });
    if (pl.type === 'catch') {
      this.hold();
      return;
    }
    const vIn = ball.vel.clone();
    if (pl.type === 'tip') {
      ball.kick(vIn.x * 0.35, Math.max(4.5, Math.abs(vIn.y) + 3.5), vIn.z * 0.5 + pl.side * 1.2,
        { type: 'save', by: this.p, ignoreTime: 0.8 });
    } else {
      // parry out to the side — loose ball, the moment can continue
      const sideDir = Math.abs(pl.iz) > 0.4 ? Math.sign(pl.iz) : pl.side;
      const out = 4.5 + Math.random() * 4.5;
      ball.kick(-Math.abs(vIn.x) * 0.25 - 2.5, 1.2 + Math.random() * 2.2, sideDir * out,
        { type: 'save', by: this.p, ignoreTime: 0.9 });
    }
  }
}
