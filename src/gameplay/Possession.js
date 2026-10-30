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
    if (ball.frozen) return;
    if (ball.owner) {
      const o = ball.owner;
      const d = dist2D(o.pos, ball.pos);
      if (d > CONFIG.dribble.loseDistance || ball.pos.y > 1.6) {
        ball.owner = null;
        g.events.emit('loose', { player: o });
      } else {
        this.dribble(o, dt);
      }
    }
    if (!ball.owner && !ball.inGoal) this.checkReceive();
  }

  dribble(o, dt) {
    const g = this.game, ball = g.ball;
    const A = o.attrs, D = CONFIG.dribble;
    o.footPoint(_fp);
    const bx = ball.pos.x - _fp.x, bz = ball.pos.z - _fp.z;
    const dFoot = Math.hypot(bx, bz);
    const reach = A.reach;
    const moving = o.moveSpeed > 0.4;

    if (moving) {
      if (o.touchCooldown > 0 || ball.pos.y > 0.5) return;
      const mx = o.moveDir.x, mz = o.moveDir.z;
      const gvx = ball.vel.x, gvz = ball.vel.z;
      const bs = Math.hypot(gvx, gvz);
      const along = gvx * mx + gvz * mz;
      const ballDirOff = bs > 0.3 ? Math.acos(Math.max(-1, Math.min(1, along / bs))) : Math.PI;
      const redirect = ballDirOff > D.redirectAngle;
      const touchable = dFoot < reach || (redirect && dFoot < reach * D.redirectReachMult);
      const needTouch = along < o.speed * 1.05 + 0.35 || redirect;
      if (!touchable || !needTouch) return;
      const spd = Math.max(o.speed, o.moveSpeed * 0.55);
      const mult = A.touchMult + (o.sprinting ? A.sprintTouch : 0);
      const v = spd * mult + D.touchBase;
      const err = g.rng.gauss() * A.touchError * (o.sprinting ? 1.5 : 1) * (redirect ? 1.4 : 1);
      const c = Math.cos(err), s = Math.sin(err);
      const dx = mx * c - mz * s, dz = mx * s + mz * c;
      ball.kick(dx * v, 0, dz * v, { type: 'touch', by: o, ignoreTime: 0, time: g.simTime });
      ball.owner = o;
      o.touchCooldown = D.touchCooldown;
      this.kickLeg = -this.kickLeg;
      if (!o.anim.action || o.anim.action === 'touch') o.playAction('touch', 0.2, { kickLeg: this.kickLeg });
      if (o.isUser) g.audio.touch();
      // a sharp redirect costs momentum
      if (redirect) { o.vel.multiplyScalar(0.82); }
    } else if (!g.sm.is('SHOT_AIM')) {
      // stopped: trap the ball under the sole and keep it at the foot
      if (dFoot < reach * 1.8 && ball.pos.y < 0.5) {
        const k = Math.exp(-D.trapDamping * dt);
        ball.vel.x *= k; ball.vel.z *= k;
        const pull = Math.min(1, 5 * dt);
        ball.pos.x += (_fp.x - ball.pos.x) * pull;
        ball.pos.z += (_fp.z - ball.pos.z) * pull;
      }
    }
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
