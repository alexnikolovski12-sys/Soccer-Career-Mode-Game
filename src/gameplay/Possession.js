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
   * Dribbling inside the possession circle. The ball isn't on rails:
   *  * each touch pushes it out in front, then the player catches up to it
   *  * touches come off the left or right foot (and sometimes switch feet),
   *    so the ball drifts from side to side
   *  * on a turn the ball is dragged round the outside of the body by the
   *    turning foot (inside hook, outside cut or a drag-back for big turns)
   * …but it is clamped so it can never escape the circle.
   */
  dribble(o, dt) {
    const g = this.game, ball = g.ball, D = CONFIG.dribble;
    const sk = g.skills && g.skills.active;
    if (sk && sk.o === o && sk.sk.kick) {
      // nutmeg / flick: ball's been knocked on; keep it on a leash and run onto it
      this._leash(o, D.circleMax * 2.2);
      return;
    }
    if (ball.pos.y > 0.5) return;
    const st = o.drib || (o.drib = { side: 1, push: 0, last: o.heading, turnT: 0 });
    // heading change this step → turning
    let dh = o.heading - st.last;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    st.last = o.heading;
    const turnRate = dh / Math.max(dt, 1e-3);
    st.turnT = Math.max(0, st.turnT - dt);

    const hx = Math.sin(o.heading), hz = Math.cos(o.heading);
    const rx = hz, rz = -hx; // right of the player
    if (o.justCut) {
      // quick cut: the ball goes with you off the outside of the boot
      o.justCut = false;
      st.turnT = 0.3;
      st.side = o.anim.kickLeg || st.side;
      st.push = 0.3;
      if (o.isUser) g.audio.touch();
    }
    // big change of direction: a proper turn — switch to the foot on the outside of it
    if (Math.abs(turnRate) > D.turnRateForCut && st.turnT <= 0 && o.speed > 0.6) {
      st.turnT = 0.45;
      st.side = turnRate > 0 ? -1 : 1;
      const big = Math.abs(turnRate) > D.turnRateForCut * 2.2;
      const r = g.rng.next();
      const variant = big ? (r < 0.5 ? 'dragback' : 'hook') : (r < 0.55 ? 'inside' : 'outside');
      o.playAction('turn', big ? 0.42 : 0.3, { variant, kickLeg: st.side, side: turnRate > 0 ? 1 : -1 });
      st.push = big ? 0.15 : 0.35;
      if (o.isUser) g.audio.touch();
    }

    // touch rhythm: a touch every few strides, pushing the ball out
    if (o.speed > 0.8 && o.touchCooldown <= 0 && st.turnT < 0.2) {
      const sprint = o.sprinting ? 1 : 0;
      o.touchCooldown = Math.max(0.24, (1.25 - sprint * 0.25) / (o.speed + 1.2));
      // sometimes switch feet, otherwise keep using the same one for a run of touches
      if (g.rng.chance(D.switchFootChance)) st.side = -st.side;
      // every touch is a bit different: soft taps, normal touches, and the odd
      // big knock-on when sprinting into space
      let space = 99;
      for (const d of g.opponentsOf(o)) if (!d.isKeeper) space = Math.min(space, dist2D(d.pos, o.pos));
      const r = g.rng.next();
      let mult = r < 0.25 ? 0.45 : r < 0.8 ? 1 : 1.5;
      if (o.sprinting && space > 7 && g.rng.chance(0.35)) mult = 2.6;     // knock it on and chase
      if (space < 2.5) mult = Math.min(mult, 0.6);                        // tight control in traffic
      st.push = (D.touchPush + Math.min(o.speed, 9) * D.touchPushPerSpeed) * mult;
      this.kickLeg = st.side;
      if (!o.anim.action || o.anim.action === 'touch') {
        const r = g.rng.next();
        o.playAction('touch', 0.22, { kickLeg: st.side, variant: r < 0.62 ? 'inside' : r < 0.86 ? 'outside' : 'sole' });
      }
      if (o.isUser) g.audio.touch();
    }
    st.push = Math.max(0, st.push - dt * (D.pushDecay + o.speed * 0.25));

    // where the ball wants to be: ahead of the stride, off the working foot
    const ahead = D.carryOffset + Math.min(o.speed, 8) * D.carrySpeedOffset + st.push;
    const lateral = st.side * D.footSpread * (0.6 + 0.4 * Math.min(1, o.speed / 4));
    // on a turn the ball lags round the outside of the body
    const lag = Math.max(-1, Math.min(1, -turnRate * 0.12));
    const tx = o.pos.x + hx * ahead + rx * (lateral + lag * 0.35);
    const tz = o.pos.z + hz * ahead + rz * (lateral + lag * 0.35);
    // softer while turning so the ball visibly swings round, firm otherwise
    const stiff = st.turnT > 0 ? D.carryStiffness * 0.45 : D.carryStiffness;
    const k = 1 - Math.exp(-stiff * dt);
    const px = ball.pos.x, pz = ball.pos.z;
    ball.pos.x += (tx - ball.pos.x) * k;
    ball.pos.z += (tz - ball.pos.z) * k;
    this._leash(o, D.circleMax + (st.push > 0.45 ? 0.35 : 0));
    // keep ball velocity consistent with how it moved (rolling visuals, physics)
    ball.vel.x = (ball.pos.x - px) / Math.max(dt, 1e-3);
    ball.vel.z = (ball.pos.z - pz) / Math.max(dt, 1e-3);
    if (ball.vel.y > 0) ball.vel.y = 0;
    ball.curve = 0;
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
    // the intended receiver of a lofted ball can take it on the chest
    const loftTo = ball.pass && ball.pass.kind === 'lofted' ? ball.pass.to : null;
    if (ball.pos.y > (loftTo ? 1.75 : D.receiveMaxHeight)) return;
    // a struck shot can't be "received" — blocks/saves resolve it instead
    if (ball.lastKick && ball.lastKick.type === 'shot' && ball.speed > 7) return;
    let best = null, bestD = Infinity;
    for (const p of g.players) {
      if (p.isKeeper || !ball.canTouch(p) || p.stumble > 0.25) continue;
      if (p.anim.action === 'fall') continue;
      // passes are safe: an opponent can't cut out a pass on its way to a teammate
      if (ball.pass && ball.pass.to && p.team !== ball.pass.to.team) continue;
      const d = dist2D(p.pos, ball.pos);
      if (loftTo && p !== loftTo && ball.pos.y > D.receiveMaxHeight) continue;
      // the intended receiver gets a big, forgiving reach so passes almost always arrive
      const intended = ball.pass && ball.pass.to === p;
      const r = D.receiveReach + p.attrs.reach * 0.25 + (p === loftTo ? 0.7 : 0) + (intended ? D.receiverBonus : 0);
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
    // receiving animation: chest / thigh for a dropping ball, cushion on the floor,
    // and a heavy, off-balance touch when a fast ball meets poor control
    const h = ball.pos.y;
    const variant = h > 0.95 ? 'chest' : h > 0.45 ? 'thigh' : (incSpeed > 13 && q < 0.75 && g.rng.chance(0.5)) ? 'heavy' : 'cushion';
    if (!p.isKeeper) p.playAction('control', variant === 'chest' ? 0.5 : 0.35, { kickLeg: g.rng.sign(), variant, side: g.rng.sign() });
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
