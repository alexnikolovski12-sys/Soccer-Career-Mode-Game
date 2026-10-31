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
      // The ball never leaves the possession circle on its own: only a pass,
      // shot, tackle — or a flick skill lifting it over someone — moves it on.
      const sk = g.skills && g.skills.active;
      const flicked = sk && sk.o === o && sk.sk.kick;
      if (!flicked && ball.pos.y > 1.6) {
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
   * Real dribbling. The ball is a free, rolling ball between touches:
   *  * the player takes a touch when he's caught up with it, timed to the foot
   *    that's swinging forward in his stride (so touches alternate naturally,
   *    with runs on his stronger foot)
   *  * touch weight varies: soft taps in traffic, normal touches, longer ones,
   *    and knock-ons into space when sprinting or bursting
   *  * changing direction needs a proper touch: inside cut, outside cut, or a
   *    drag-back for big turns — the player brakes and plants for it
   *  * stopping: he traps it under the sole
   * A soft leash means it can still never get away from him.
   */
  dribble(o, dt) {
    const g = this.game, ball = g.ball, D = CONFIG.dribble;
    const sk = g.skills && g.skills.active;
    if (sk && sk.o === o && sk.sk.kick) { this._leash(o, D.circleMax * 2.2); return; }
    if (ball.pos.y > 0.5) return;
    const st = o.drib || (o.drib = { side: 1, pref: Math.random() < 0.75 ? 1 : -1, last: 0 });
    const moving = o.moveSpeed > 0.35;
    let dx, dz;
    if (moving && o.wantDir) { dx = o.wantDir.x; dz = o.wantDir.z; }
    else if (moving) { dx = o.moveDir.x; dz = o.moveDir.z; } else { dx = Math.sin(o.heading); dz = Math.cos(o.heading); }
    const hx = Math.sin(o.heading), hz = Math.cos(o.heading);
    const rx = -hz, rz = hx; // the player's right
    // the ball runs a little further ahead when sprinting
    const carry = D.footOffset + (o.sprinting ? D.sprintCarryExtra : 0);
    // which foot is about to land in the stride (from the running animation):
    // a stride touch is taken with that foot, just before it plants
    const dueR = o.footDue(1), dueL = o.footDue(-1);
    const strideFoot = dueR < dueL ? 1 : -1;
    const footDue = Math.min(dueR, dueL) < D.touchWindow || o.speed < 1.2;
    const fx = o.pos.x + hx * carry + rx * st.side * 0.11;
    const fz = o.pos.z + hz * carry + rz * st.side * 0.11;
    const footD = Math.hypot(ball.pos.x - fx, ball.pos.z - fz);
    const bx = ball.pos.x - o.pos.x, bz = ball.pos.z - o.pos.z;
    const bd = Math.hypot(bx, bz);
    const bvx = ball.vel.x, bvz = ball.vel.z, bs = Math.hypot(bvx, bvz);

    if (!moving) {
      // trap it: kill the roll and draw it under the sole
      const k = Math.exp(-D.trapDamping * dt);
      ball.vel.x *= k; ball.vel.z *= k;
      const pull = Math.min(1, 4 * dt);
      ball.pos.x += (fx - ball.pos.x) * pull;
      ball.pos.z += (fz - ball.pos.z) * pull;
      if (bs > 2 && o.touchCooldown <= 0 && footD < D.touchReach) {
        o.touchCooldown = 0.4;
        o.playAction('touch', 0.3, { kickLeg: st.side, variant: 'sole' });
        if (o.isUser) g.audio.touch();
      }
      this._leash(o, D.circleMax);
      return;
    }

    const along = bvx * dx + bvz * dz;                       // ball speed in the direction we want to go
    const ahead = bx * dx + bz * dz;                         // how far in front of us it is
    const offAng = bs > 0.4 ? Math.acos(Math.max(-1, Math.min(1, along / bs))) : Math.PI;
    // angle between where he's facing and where he wants to go = how big a turn this is
    const turnAng = Math.acos(Math.max(-1, Math.min(1, hx * dx + hz * dz)));
    // turning back at pace: stop it dead under the sole first, then turn with it
    const crossT = hx * dz - hz * dx;
    if (!st.stop && o.speed > 3.0 && turnAng > 1.75 && o.touchCooldown <= 0.2 && bd < carry + 0.9) {
      const side = crossT >= 0 ? 1 : -1;
      st.stop = { t: 0, dur: 0.4 };
      st.side = -side;
      o.vel.multiplyScalar(0.2);
      o.playAction('turn', 0.44, { variant: 'dragback', side, kickLeg: st.side });
      o.touchCooldown = 0.45;
      if (o.isUser) { g.audio.touch(); g.camRig.addShake(0.02); }
    }
    if (st.stop) {
      st.stop.t += dt;
      // ball held under his foot while he turns round onto it
      const want = Math.atan2(dx, dz);
      let dh = want - o.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      o.heading += dh * Math.min(1, dt * 9);
      const kx = Math.sin(o.heading), kz = Math.cos(o.heading);
      const k = Math.min(1, dt * 14);
      ball.pos.x += (o.pos.x + kx * 0.38 - ball.pos.x) * k; ball.pos.z += (o.pos.z + kz * 0.38 - ball.pos.z) * k;
      ball.vel.set(o.vel.x, 0, o.vel.z);
      if (st.stop.t >= st.stop.dur) { st.stop = null; ball.vel.set(dx * (o.speed + 0.6), 0, dz * (o.speed + 0.6)); }
      return;
    }
    const reach = D.touchReach + (turnAng > 0.8 ? 0.25 : 0);
    const caughtUp = ahead < D.touchAhead + o.speed * 0.06 + (o.sprinting ? D.sprintCarryExtra : 0) || along < o.speed * 0.92;
    const wrongWay = offAng > D.redirectAngle;
    // stride touches wait for the foot to come through (turns/cuts go at once; never wait too long)
    // (and never let him run over it: if it's getting under his feet, play it now)
    st.wait = caughtUp && !wrongWay && !footDue ? (st.wait || 0) + dt : 0;
    const timed = wrongWay || turnAng > 0.75 || footDue || st.wait > 0.15 || ahead < carry * 0.85;
    const under = ahead < carry * 0.85 && bd < D.circleMax;
    if (o.touchCooldown <= 0 && (footD < reach || under) && (caughtUp || wrongWay) && timed) {
      let space = 99;
      for (const d of g.opponentsOf(o)) if (!d.isKeeper) space = Math.min(space, dist2D(d.pos, o.pos));
      const cross = hx * dz - hz * dx;                       // + = turning left
      const errA = g.rng.gauss() * o.attrs.touchError * 0.5;
      let v, cd, anim;
      if (turnAng > 2.2) {
        // DRAG-BACK: sole on top, roll it back the way you came, spin
        st.side = cross >= 0 ? -1 : 1;
        v = 1.4 + o.speed * 0.15; cd = 0.38;
        o.vel.multiplyScalar(0.25);
        anim = ['turn', 0.42, { variant: 'dragback', side: cross >= 0 ? 1 : -1, kickLeg: st.side }];
        if (o.isUser) g.camRig.addShake(0.025);
      } else if (turnAng > 0.75) {
        // CUT: inside of the foot across the body, or the outside to go the other way
        const inside = g.rng.chance(0.55);
        st.side = inside ? (cross >= 0 ? -1 : 1) : (cross >= 0 ? 1 : -1);
        v = o.speed * 0.85 + 0.7; cd = 0.3;
        o.vel.multiplyScalar(0.62);
        anim = ['turn', 0.32, { variant: inside ? 'inside' : 'outside', side: cross >= 0 ? 1 : -1, kickLeg: st.side }];
        if (o.isUser) g.camRig.addShake(0.018);
      } else {
        // stride touch: off the foot that's coming through
        st.side = strideFoot;
        const r = g.rng.next();
        // close control: soft / normal / slightly longer — even at a sprint it stays at his feet
        let push = r < 0.4 ? 0.18 : r < 0.85 ? 0.35 : 0.5;
        if (space < 2.2) push = Math.min(push, 0.22);           // tight in traffic
        if (o.sprinting) push = space < 1.6 ? 0.3 : 0.4 + g.rng.next() * 0.25;
        if (o.burstTouch) { push = 0.75; o.burstTouch = false; }
        v = o.speed + push; cd = Math.max(0.2, 0.9 / (o.speed + 1.5));
        const r2 = g.rng.next();
        anim = ['touch', 0.24, { kickLeg: st.side, variant: r2 < 0.6 ? 'inside' : r2 < 0.85 ? 'outside' : 'laces' }];
      }
      const c = Math.cos(errA), s2 = Math.sin(errA);
      const ux = dx * c - dz * s2, uz = dx * s2 + dz * c;
      ball.vel.x = ux * v; ball.vel.z = uz * v;
      if (ball.vel.y > 0) ball.vel.y = 0;
      ball.curve = 0;
      ball.lastKick = { type: 'dribble', by: o, time: g.simTime };
      o.touchCooldown = cd;
      if (!o.anim.action || o.anim.action === 'touch' || anim[0] === 'turn') o.playAction(anim[0], anim[1], anim[2]);
      // the touching foot meets the ball (foot IK)
      o.reachFor(st.side, ball.pos.x - ux * 0.12, 0.08, ball.pos.z - uz * 0.12, 0, 0.12);
      if (o.isUser) g.audio.touch();
    }
    // never overrun it: a ball that has slipped under his feet is worked back
    // out in front (as the next stride would), so it sits ~carry ahead
    if (ahead < carry * 0.75 && bd < D.circleMax && ball.pos.y < 0.3) {
      const k = Math.min(1, dt * 7);
      const tx = o.pos.x + dx * carry, tz = o.pos.z + dz * carry;
      ball.pos.x += (tx - ball.pos.x) * k; ball.pos.z += (tz - ball.pos.z) * k;
      const lag = o.speed - (ball.vel.x * dx + ball.vel.z * dz);
      if (lag > 0) { ball.vel.x += dx * lag * k; ball.vel.z += dz * lag * k; }
    }
    // the ball never leaves his circle: one that's run on is drawn back in front
    // of him (rolling at his pace) and it can't get further than an arm's length
    const maxD = carry + 0.45;
    if (bd > maxD && ball.pos.y < 0.4) {
      const k = Math.min(1, dt * 6);
      const tx = o.pos.x + dx * carry, tz = o.pos.z + dz * carry;
      ball.pos.x += (tx - ball.pos.x) * k; ball.pos.z += (tz - ball.pos.z) * k;
      ball.vel.x += (dx * o.speed - ball.vel.x) * k; ball.vel.z += (dz * o.speed - ball.vel.z) * k;
    }
    this._leash(o, carry + 0.75);
  }

  /** Hard limit: the ball can never be further than `max` from the carrier. */
  _leash(o, max) {
    const ball = this.game.ball;
    const dx = ball.pos.x - o.pos.x, dz = ball.pos.z - o.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > max) { ball.pos.x = o.pos.x + (dx / d) * max; ball.pos.z = o.pos.z + (dz / d) * max; }
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
    if (bodyFirst && g.rng.next() < F.foulFromBehind * (o.team === 'home' ? 1 : 0.6)) {
      winner.playAction('tackle', 0.55);
      o.hit(o.pos.x - winner.pos.x, o.pos.z - winner.pos.z, 2 + winner.speed * 0.5);
      o.playAction('fall', 1.0, { side: g.rng.sign() });
      g.events.emit('foul', { by: winner, victim: o });
      return true;
    }
    o.stumble = 0.4;
    o.hit(o.pos.x - winner.pos.x, o.pos.z - winner.pos.z, 1 + winner.speed * 0.3);
    o.playAction('stumble', 0.6, { side: g.rng.sign() });
    ball.lastKick = { type: 'tackle', by: winner, time: g.simTime };
    this.gain(winner);
    g.events.emit('tackleWon', { by: winner, victim: o });
    return true;
  }

  checkReceive() {
    const g = this.game, ball = g.ball, D = CONFIG.dribble;
    // the intended receiver of a lofted ball can take it on the chest
    const loftTo = ball.pass && ball.pass.to ? ball.pass.to : null;
    if (ball.pos.y > (loftTo ? 1.75 : D.receiveMaxHeight)) return;
    // a struck shot can't be "received" — blocks/saves resolve it instead
    if (ball.lastKick && ball.lastKick.type === 'shot' && ball.speed > 7) return;
    let best = null, bestD = Infinity;
    for (const p of g.players) {
      if (p.isKeeper || !ball.canTouch(p) || p.stumble > 0.25) continue;
      if (p.anim.action === 'fall') continue;
      // a cross being met first time in the box: he volleys it rather than controlling it
      if (ball.pass && ball.pass.finish && ball.pass.to === p && ball.pos.y > 0.3) continue;
      // your passes are guided past opponents (the assist); the AI's can be cut out
      const d = dist2D(p.pos, ball.pos);
      if (loftTo && p !== loftTo && ball.pos.y > D.receiveMaxHeight) continue;
      // the intended receiver gets a big, forgiving reach so passes almost always arrive
      const intended = ball.pass && ball.pass.to === p;
      const r = D.receiveReach + p.attrs.reach * 0.25 + (p === loftTo ? 0.7 : 0) + (intended ? D.receiverBonus : 0);
      if (d < r && d < bestD) { best = p; bestD = d; }
    }
    if (!best) return;
    if (ball.pass && ball.pass.to && best.team !== ball.pass.to.team) {
      // interception attempt — a crisp pass zipped past a defender often beats him
      const fromUser = ball.pass.from && ball.pass.from.team === 'home';
      const skill = CONFIG.teamMap.interceptSkill(best.rating) * (fromUser ? 0.45 : 1) * (best.isUser ? 1.25 : 1);
      const p = Math.min(0.9, skill * (0.55 + 0.45 * Math.max(0, 1 - ball.speed / 24)));
      if (ball.speed > 4 && g.rng.next() > p) { ball.ignore.set(best, 0.4); return; }
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
    // receiving animation: chest / thigh for a dropping ball, cushion on the floor,
    // and a heavy, off-balance touch when a fast ball meets poor control
    const h = ball.pos.y;
    const variant = h > 0.95 ? 'chest' : h > 0.45 ? 'thigh' : (incSpeed > 13 && q < 0.75 && g.rng.chance(0.5)) ? 'heavy' : 'cushion';
    if (!p.isKeeper) p.playAction('control', variant === 'chest' ? 0.5 : 0.35, { kickLeg: g.rng.sign(), variant, side: g.rng.sign() });
    if (p.isUser) g.audio.touch();
    g.events.emit('gain', { player: p, from, kick, pass });
  }

  /**
   * Bodies are capsules: overlaps are pushed apart (the heavier, stronger
   * player gives less ground) and a real coming-together — shoulder to
   * shoulder at speed — exchanges momentum and staggers both of them.
   */
  separate() {
    const ps = this.game.players;
    const R = CONFIG.player.separation, B = CONFIG.player.bump;
    const t = this.game.simTime;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < R * R && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const nx = dx / d, nz = dz / d;
          const ia = 1 / a.mass, ib = 1 / b.mass, is = ia + ib;
          const push = R - d;
          a.pos.x -= nx * push * (ia / is); a.pos.z -= nz * push * (ia / is);
          b.pos.x += nx * push * (ib / is); b.pos.z += nz * push * (ib / is);
          // closing speed along the line between them
          const vn = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
          if (vn < -B.minSpeed && (a.bumpT || 0) < t && (b.bumpT || 0) < t) {
            const J = (-(1 + B.restitution) * vn) / is * B.transfer;
            a.vel.x -= nx * J * ia; a.vel.z -= nz * J * ia;
            b.vel.x += nx * J * ib; b.vel.z += nz * J * ib;
            a.hit(-nx, -nz, J * ia * B.react);
            b.hit(nx, nz, J * ib * B.react);
            a.bumpT = b.bumpT = t + B.cooldown;
          }
        }
      }
    }
  }
}
