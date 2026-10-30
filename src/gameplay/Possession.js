// Ball control: dribble touches (ball is pushed ahead, never glued), traps,
// receiving passes / loose balls with a stat-driven first touch, and
// soft player–player separation.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { dist2D } from '../core/MathUtil.js';

const _fp = new THREE.Vector3();

export class Possession {
  constructor(game) {
    this.game = game;
    this.kickLeg = 1;
  }

  update(dt) {
    const g = this.game, ball = g.ball;
    if (ball.frozen || g.setPiece) return;
    if (ball.owner) {
      const o = ball.owner;
      // the ball only leaves the possession circle when it's kicked (pass/shot,
      // which clears the owner), lifted, or an opponent wins it
      if (ball.pos.y > 1.6 || dist2D(o.pos, ball.pos) > CONFIG.dribble.loseDistance) {
        ball.owner = null;
        g.events.emit('loose', { player: o });
      } else {
        this.dribble(o, dt);
        if (this.contest(o, dt)) return;
      }
    }
    if (!ball.owner && !ball.inGoal) this.checkReceive();
  }

  /**
   * Possession circle: the ball rides just ahead of the carrier's feet and
   * follows every turn. It can't run away from you.
   */
  dribble(o, dt) {
    const g = this.game, ball = g.ball, D = CONFIG.dribble;
    if (g.sm.is('SHOT_AIM')) return; // shooter steps beside the ball for the run-up
    const sk = g.skills && g.skills.active;
    if (sk && sk.o === o && sk.sk.kick) return; // nutmeg / flick: ball's been knocked on, run onto it
    if (ball.pos.y > 0.5) return;
    const off = D.carryOffset + Math.min(o.speed, 8) * D.carrySpeedOffset;
    const tx = o.pos.x + Math.sin(o.heading) * off;
    const tz = o.pos.z + Math.cos(o.heading) * off;
    const k = 1 - Math.exp(-D.carryStiffness * dt);
    ball.pos.x += (tx - ball.pos.x) * k;
    ball.pos.z += (tz - ball.pos.z) * k;
    ball.vel.x = o.vel.x; ball.vel.z = o.vel.z;
    if (ball.vel.y > 0) ball.vel.y = 0;
    ball.curve = 0;
    // occasional touch animation + sound so it still looks like dribbling
    if (o.speed > 1 && o.touchCooldown <= 0) {
      o.touchCooldown = Math.max(0.28, 1.1 / (o.speed + 1));
      this.kickLeg = -this.kickLeg;
      if (!o.anim.action || o.anim.action === 'touch') o.playAction('touch', 0.2, { kickLeg: this.kickLeg });
      if (o.isUser) g.audio.touch();
    }
  }

  /**
   * An opponent who gets to the ball and stays on it wins possession.
   * (Defenders also have their lunging tackles in DefenderAI.)
   */
  contest(o, dt) {
    const g = this.game, ball = g.ball, D = CONFIG.dribble;
    if (ball.pos.y > 0.5) return false; // flicked over them
    let winner = null;
    for (const d of g.opponentsOf(o)) {
      if (d.isKeeper || d.stumble > 0 || !d.visible || !ball.canTouch(d)) { if (d.ai) d.ai.onBall = 0; continue; }
      if (dist2D(d.pos, ball.pos) < D.stealReach) {
        d.ai.onBall = (d.ai.onBall || 0) + dt;
        if (d.ai.onBall > D.stealTime) winner = d;
      } else d.ai.onBall = 0;
    }
    if (!winner) return false;
    winner.ai.onBall = 0;
    // came through the back of you to get it → foul
    const F = CONFIG.defender;
    const bodyFirst = dist2D(winner.pos, o.pos) < dist2D(winner.pos, ball.pos) - F.foulBodyMargin;
    if (o.team === 'home' && bodyFirst && g.rng.next() < F.foulFromBehind) {
      winner.playAction('tackle', 0.55);
      o.playAction('fall', 1.0, { side: g.rng.sign() });
      g.events.emit('foul', { by: winner, victim: o });
      return true;
    }
    o.stumble = 0.4;
    o.playAction('stumble', 0.6, { side: g.rng.sign() });
    ball.lastKick = { type: 'tackle', by: winner, time: g.simTime };
    this.gain(winner);
    g.events.emit('tackleWon', { by: winner, victim: o });
    return true;
  }

  checkReceive() {
    const g = this.game, ball = g.ball, D = CONFIG.dribble;
    if (ball.pos.y > D.receiveMaxHeight) return;
    // a struck shot can't be "received" — blocks/saves resolve it instead
    if (ball.lastKick && ball.lastKick.type === 'shot' && ball.speed > 7) return;
    let best = null, bestD = Infinity;
    for (const p of g.players) {
      if (p.isKeeper || !ball.canTouch(p) || p.stumble > 0.25) continue;
      if (p.anim.action === 'fall') continue;
      const d = dist2D(p.pos, ball.pos);
      const r = D.receiveReach + p.attrs.reach * 0.25;
      if (d < r && d < bestD) { best = p; bestD = d; }
    }
    if (!best) return;
    if (best.team === 'away' && ball.pass && ball.speed > 6) {
      // interception attempt — a crisp pass zipped past a defender often beats him
      const skill = CONFIG.teamMap.interceptSkill(best.rating);
      const p = Math.min(0.9, skill * (0.55 + 0.45 * Math.max(0, 1 - ball.speed / 24)));
      if (g.rng.next() > p) { ball.ignore.set(best, 0.4); return; }
    }
    this.gain(best);
  }

  gain(p) {
    const g = this.game, ball = g.ball;
    const from = ball.lastTouch;
    const kick = ball.lastKick;
    const pass = ball.pass;
    ball.owner = p;
    ball.pass = null;
    ball.lastTouch = p;
    // first touch: cushion into stride, imperfect at low control / high pace
    const q = p.attrs.firstTouch;
    const inc = ball.vel.clone();
    const incSpeed = Math.hypot(inc.x, inc.z);
    let tx = 0, tz = 0;
    if (p.isUser && p.moveSpeed > 0.4) {
      // take it in stride in the stick direction
      const sp = Math.max(p.speed, p.moveSpeed * 0.6) * 1.1 + 0.8;
      tx = p.moveDir.x * sp; tz = p.moveDir.z * sp;
    } else if (!p.isUser) {
      // AI: cushion it a yard into the direction they'll play (toward the attacking goal)
      const gx = p.team === 'home' ? CONFIG.pitch.length / 2 : -CONFIG.pitch.length / 2;
      const dx = gx - p.pos.x, dz = -p.pos.z * 0.5;
      const l = Math.hypot(dx, dz) || 1;
      const sp = Math.min(p.speed, 3) + 1.2;
      tx = (dx / l) * sp; tz = (dz / l) * sp;
    } else {
      tx = inc.x * 0.08; tz = inc.z * 0.08;
    }
    const err = (1 - q) * incSpeed * 0.18;
    ball.vel.set(
      inc.x * (1 - q) * 0.45 + tx * q + g.rng.gauss() * err,
      Math.min(ball.vel.y, 0),
      inc.z * (1 - q) * 0.45 + tz * q + g.rng.gauss() * err,
    );
    // settle it straight into the possession circle
    const k = p.isUser ? 0.25 : 0.35;
    ball.vel.x *= k; ball.vel.z *= k;
    ball.curve = 0;
    ball.lastKick = { type: 'control', by: p, time: g.simTime };
    p.touchCooldown = 0.18;
    if (p.isUser) g.audio.touch();
    g.events.emit('gain', { player: p, from, kick, pass });
  }

  /** Soft separation so bodies don't overlap. */
  separate() {
    const ps = this.game.players;
    const R = CONFIG.player.separation;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < R * R && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (R - d) * 0.5;
          const nx = dx / d, nz = dz / d;
          a.pos.x -= nx * push; a.pos.z -= nz * push;
          b.pos.x += nx * push; b.pos.z += nz * push;
        }
      }
    }
  }
}
