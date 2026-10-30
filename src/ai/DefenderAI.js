// Defender AI: hold shape, press the carrier (one presser + optional cover),
// mark runners goal-side, intercept passes, tackle with cooldowns, recover.
import * as THREE from 'three';
import { CONFIG, clamp } from '../config.js';
import { dist2D, pointSegDist2D } from '../core/MathUtil.js';

const _fp = new THREE.Vector3();

export class DefenderAI {
  constructor(game) {
    this.game = game;
    this.assignT = 0;
    this.presser = null;
  }

  reset() {
    this.assignT = 0;
    this.presser = null;
    for (const d of this.game.defenders) {
      d.ai.state = 'hold';
      d.ai.mark = null;
      d.ai.tackling = null;
    }
  }

  goal() { return { x: CONFIG.pitch.length / 2, z: 0 }; }

  carrier() {
    const ball = this.game.ball;
    if (ball.owner && ball.owner.team === 'home') return ball.owner;
    return null;
  }

  assign() {
    const g = this.game, ball = g.ball, D = CONFIG.defender;
    const defs = g.defenders.filter((d) => !d.ai.tackling);
    for (const d of defs) { d.ai.state = 'hold'; d.ai.mark = null; d.ai.point = null; }
    let free = defs.slice();
    const take = (d) => { free = free.filter((x) => x !== d); };

    // intercept an in-flight pass
    if (ball.pass && !ball.owner) {
      let best = null, bestMargin = Infinity, bestPt = null;
      const v = ball.vel;
      const sp = Math.hypot(v.x, v.z) || 0.1;
      // only the stretch between the ball and the receiver can be cut out
      const recv = ball.pass.to;
      let end = { x: ball.pos.x + v.x * 1.6, z: ball.pos.z + v.z * 1.6 };
      if (recv) {
        const along = ((recv.pos.x - ball.pos.x) * v.x + (recv.pos.z - ball.pos.z) * v.z) / sp;
        const reach = Math.max(0, along - 1.2);
        end = { x: ball.pos.x + (v.x / sp) * reach, z: ball.pos.z + (v.z / sp) * reach };
      }
      for (const d of free) {
        if (d.stumble > 0) continue;
        const { d: dd, t } = pointSegDist2D(d.pos, ball.pos, end);
        const px = ball.pos.x + (end.x - ball.pos.x) * t, pz = ball.pos.z + (end.z - ball.pos.z) * t;
        const tb = Math.hypot(px - ball.pos.x, pz - ball.pos.z) / sp;
        const td = d.attrs.reaction + Math.max(0, dd - CONFIG.defender.interceptReach) / d.attrs.sprintSpeed;
        const margin = td - tb;
        if (margin < 0 && margin < bestMargin) { bestMargin = margin; best = d; bestPt = { x: px, z: pz }; }
      }
      if (best) { best.ai.state = 'intercept'; best.ai.point = bestPt; take(best); }
    }

    // loose ball → nearest chases
    if (!ball.owner && !ball.pass && !ball.frozen) {
      let best = null, bd = Infinity;
      for (const d of free) {
        const dd = dist2D(d.pos, ball.pos);
        if (dd < bd && d.stumble <= 0) { bd = dd; best = d; }
      }
      if (best && bd < 22) { best.ai.state = 'chase'; take(best); }
    }

    // pressing the carrier (or the intended receiver)
    const target = this.carrier() || (ball.pass && ball.pass.to) || null;
    const receiving = !this.carrier() && ball.pass && ball.pass.to;
    if (target) {
      let best = null, bd = Infinity;
      for (const d of free) {
        let dd = dist2D(d.pos, target.pos);
        if (d === this.presser) dd -= 1.5; // hysteresis
        if (d.stumble > 0) dd += 6;
        if (dd < bd) { bd = dd; best = d; }
      }
      if (best) {
        best.ai.state = receiving ? 'mark' : 'press';
        best.ai.mark = target; take(best); this.presser = best;
      }
      // cover defender when the ball is close to goal
      const G = this.goal();
      if (Math.hypot(G.x - target.pos.x, target.pos.z) < D.coverWhenClose && free.length > 2) {
        let cb = null, cd = Infinity;
        for (const d of free) {
          const dd = dist2D(d.pos, target.pos);
          if (dd < cd) { cd = dd; cb = d; }
        }
        if (cb) { cb.ai.state = 'cover'; cb.ai.mark = target; take(cb); }
      }
    }

    // mark the most dangerous attackers (closest to goal first)
    const attackers = g.homePlayers().filter((a) => a !== target)
      .sort((a, b) => b.pos.x - a.pos.x);
    for (const a of attackers) {
      if (!free.length) break;
      let best = null, bd = Infinity;
      for (const d of free) {
        const dd = dist2D(d.pos, a.pos);
        if (dd < bd) { bd = dd; best = d; }
      }
      if (best && bd < 16) { best.ai.state = 'mark'; best.ai.mark = a; take(best); }
    }
  }

  update(dt) {
    const g = this.game, ball = g.ball;
    this.assignT -= dt;
    if (this.assignT <= 0) { this.assign(); this.assignT = CONFIG.defender.reassignInterval; }
    const carrier = this.carrier();
    for (const d of g.defenders) {
      d.sprinting = false;
      d.aiLabel = d.ai.state;
      if (d.ai.tackling) { this._tackleUpdate(d, dt); continue; }
      if (d.stumble > 0) {
        d.aiLabel = 'recover';
        d.steer(d.vel.x, d.vel.z, 1);
        continue;
      }
      switch (d.ai.state) {
        case 'press': this._press(d, d.ai.mark, dt); break;
        case 'cover': this._cover(d, d.ai.mark); break;
        case 'mark': this._mark(d, d.ai.mark); break;
        case 'intercept':
          if (!ball.pass) { d.ai.state = 'hold'; break; }
          d.sprinting = true;
          d.moveTo(d.ai.point.x, d.ai.point.z, d.attrs.sprintSpeed, 0.4);
          break;
        case 'chase':
          d.sprinting = true;
          d.moveTo(ball.pos.x + ball.vel.x * 0.25, ball.pos.z + ball.vel.z * 0.25, d.attrs.sprintSpeed, 0.3);
          break;
        default: this._hold(d); break;
      }
      if (carrier) this._poke(d, carrier, dt);
    }
  }

  _press(d, c, dt) {
    if (!c) { this._hold(d); return; }
    const D = CONFIG.defender, G = this.goal();
    const gx = G.x - c.pos.x, gz = G.z - c.pos.z;
    const gl = Math.hypot(gx, gz) || 1;
    const tx = c.pos.x + (gx / gl) * D.pressDistance + c.vel.x * 0.25;
    const tz = c.pos.z + (gz / gl) * D.pressDistance + c.vel.z * 0.25;
    const dist = dist2D(d.pos, c.pos);
    if (dist > D.jockeyDistance + 1) {
      d.sprinting = true;
      d.moveTo(tx, tz, d.attrs.sprintSpeed, 1);
    } else {
      // jockey: match the attacker, stay goal-side
      d.moveTo(tx, tz, Math.max(c.speed * 1.08 + 1.2, d.jogSpeed), 0.8);
      d.faceTowards(c.pos.x, c.pos.z);
    }
    const ball = this.game.ball;
    if (ball.owner === c && dist < D.tackleRange && d.tackleCooldown <= 0) {
      const eager = D.tackleEagerness * (0.6 + d.rating / 100);
      if (this.game.rng.next() < eager * dt) this._startTackle(d, c);
    }
  }

  _cover(d, c) {
    if (!c) { this._hold(d); return; }
    const G = this.goal();
    const tx = c.pos.x + (G.x - c.pos.x) * 0.35;
    const tz = c.pos.z + (G.z - c.pos.z) * 0.35;
    d.moveTo(tx, tz, d.runSpeed, 1.2);
    d.faceTowards(c.pos.x, c.pos.z);
  }

  _mark(d, a) {
    if (!a) { this._hold(d); return; }
    const D = CONFIG.defender, G = this.goal(), ball = this.game.ball;
    const gx = G.x - a.pos.x, gz = G.z - a.pos.z;
    const gl = Math.hypot(gx, gz) || 1;
    const tx = a.pos.x + (gx / gl) * D.markDistance + (ball.pos.x - a.pos.x) * 0.08;
    const tz = a.pos.z + (gz / gl) * D.markDistance + (ball.pos.z - a.pos.z) * 0.12;
    const far = dist2D(d.pos, { x: tx, z: tz }) > 5;
    d.sprinting = far;
    d.moveTo(tx, tz, far ? d.attrs.sprintSpeed : d.runSpeed, 1.2);
    d.faceTowards(ball.pos.x, ball.pos.z);
  }

  _hold(d) {
    const D = CONFIG.defender, ball = this.game.ball;
    const t = clamp(ball.pos.x / 45, 0, 1);
    const lineX = D.lineDepthMin + (D.lineDepthMax - D.lineDepthMin) * t;
    const slot = d.ai.slot || { row: 0, z: 0 };
    let x = lineX - slot.row * 9;
    x = Math.max(x, Math.min(ball.pos.x + 3, CONFIG.pitch.length / 2 - 2));
    const z = clamp(slot.z * 0.78 + ball.pos.z * 0.35, -CONFIG.pitch.width / 2 + 3, CONFIG.pitch.width / 2 - 3);
    d.moveTo(x, z, d.runSpeed, 2);
    d.faceTowards(ball.pos.x, ball.pos.z);
  }

  _startTackle(d, c) {
    d.ai.tackling = { t: 0, target: c, resolved: false };
    d.playAction('tackle', 0.55);
    d.tackleCooldown = CONFIG.defender.tackleCooldown;
  }

  _tackleUpdate(d, dt) {
    const g = this.game, ball = g.ball, D = CONFIG.defender;
    const tk = d.ai.tackling;
    tk.t += dt;
    d.aiLabel = 'tackle';
    d.moveTo(ball.pos.x, ball.pos.z, d.attrs.sprintSpeed * 1.05, 0.1);
    if (!tk.resolved && tk.t >= D.tackleWindup) {
      tk.resolved = true;
      const c = tk.target;
      const dBall = dist2D(d.pos, ball.pos);
      const bodyFirst = dist2D(d.pos, c.pos) < dBall - D.foulBodyMargin;
      if (ball.owner !== c || dBall > D.tackleRange + 0.3 || ball.pos.y > 0.5) {
        this._fail(d, c, false);
      } else if (c.team === 'home' && g.rng.next() < (bodyFirst ? D.foulFromBehind : D.foulMistimed)) {
        // caught the man before the ball → foul, free kick
        c.playAction('fall', 1.0, { side: g.rng.sign() });
        c.stumble = 0.4;
        g.audio.kick(0.3);
        g.events.emit('foul', { by: d, victim: c });
      } else {
        c.footPoint(_fp);
        const gap = Math.hypot(ball.pos.x - _fp.x, ball.pos.z - _fp.z);
        let p = CONFIG.teamMap.tackleSkill(d.rating) - c.attrs.tackleResist;
        p += clamp(gap - 0.45, 0, 1) * 0.5;
        if (c.sprinting) p += 0.08;
        p = clamp(p * D.tackleSuccessMult, 0.03, 0.6);
        if (g.rng.next() < p) this._win(d, c);
        else this._fail(d, c, true);
      }
    }
    if (tk.t >= 0.55) d.ai.tackling = null;
  }

  _win(d, c) {
    const g = this.game, ball = g.ball;
    c.stumble = 0.5;
    c.playAction(g.rng.chance(0.4) ? 'fall' : 'stumble', g.rng.chance(0.4) ? 1.1 : 0.6, { side: g.rng.sign() });
    g.audio.kick(0.35);
    if (g.rng.chance(0.6)) {
      ball.lastKick = { type: 'tackle', by: d, time: g.simTime };
      g.possession.gain(d);
    } else {
      // poked loose
      const dx = ball.pos.x - c.pos.x, dz = ball.pos.z - c.pos.z;
      const l = Math.hypot(dx, dz) || 1;
      const sp = g.rng.range(4, 8);
      ball.kick((dx / l) * sp + g.rng.range(-2, 2), 0, (dz / l) * sp + g.rng.range(-2, 2),
        { type: 'tackle', by: d, ignoreTime: 0.25, time: g.simTime });
      ball.ignore.set(c, 0.45);
    }
    g.events.emit('tackleWon', { by: d, victim: c });
  }

  _fail(d, c, close) {
    const g = this.game;
    d.stumble = CONFIG.defender.stumbleTime * (close ? 1 : 0.7);
    d.playAction(close ? 'fall' : 'stumble', close ? 1.1 : 0.7, { side: g.rng.sign() });
    if (close) g.events.emit('beatDefender', { by: c, defender: d });
  }

  _poke(d, c, dt) {
    if (d.ai.tackling || d.stumble > 0) return;
    const g = this.game, ball = g.ball, D = CONFIG.defender;
    c.footPoint(_fp);
    const gap = Math.hypot(ball.pos.x - _fp.x, ball.pos.z - _fp.z);
    if (gap < D.pokeDistance) return;
    if (dist2D(d.pos, ball.pos) > 1.0 || !ball.canTouch(d)) return;
    if (g.rng.next() < D.pokeChance * dt * (0.5 + d.rating / 100)) {
      if (g.rng.chance(0.5)) {
        ball.lastKick = { type: 'tackle', by: d, time: g.simTime };
        g.possession.gain(d);
      } else {
        const dx = ball.pos.x - d.pos.x, dz = ball.pos.z - d.pos.z;
        const l = Math.hypot(dx, dz) || 1;
        ball.kick((dx / l) * 5, 0, (dz / l) * 5, { type: 'tackle', by: d, ignoreTime: 0.3, time: g.simTime });
      }
      d.playAction('pass', 0.35);
      g.events.emit('tackleWon', { by: d, victim: c, poke: true });
    }
  }
}
