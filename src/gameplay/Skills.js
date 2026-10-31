// Skill moves on the SPRINT & SKILL button: swipe up = rainbow flick, down =
// drag back, left = roulette, right = elastico. A skill done near a defender
// can send him the wrong way so he stumbles and you get past.
import { CONFIG } from '../config.js';
import { dist2D } from '../core/MathUtil.js';

// weight = how often it's picked; beat = base chance to send the defender the wrong way;
// shift = sideways metres the carrier moves; dur = seconds
export const SKILLS = {
  stepover:  { label: 'STEPOVER',       weight: 20, beat: 0.5,  shift: 0.7, dur: 0.55, anim: 'stepover' },
  feint:     { label: 'BODY FEINT',     weight: 15, beat: 0.45, shift: 0.6, dur: 0.45, anim: 'feint' },
  croqueta:  { label: 'LA CROQUETA',    weight: 9,  beat: 0.55, shift: 0.9, dur: 0.5,  anim: 'croqueta' },
  dragback:  { label: 'DRAG BACK',      weight: 8,  beat: 0.5,  shift: 0.8, dur: 0.55, anim: 'dragback' },
  fakeshot:  { label: 'FAKE SHOT',      weight: 8,  beat: 0.55, shift: 0.9, dur: 0.6,  anim: 'fakeshot' },
  cruyff:    { label: 'CRUYFF TURN',    weight: 7,  beat: 0.55, shift: 1.0, dur: 0.6,  anim: 'fakeshot', spin: Math.PI * 0.5 },
  roulette:  { label: 'ROULETTE',       weight: 6,  beat: 0.6,  shift: 1.1, dur: 0.75, anim: 'spin', spin: Math.PI * 2 },
  ballroll:  { label: 'BALL ROLL',      weight: 6,  beat: 0.5,  shift: 0.8, dur: 0.5,  anim: 'dragback' },
  mcgeady:   { label: 'MCGEADY SPIN',   weight: 5,  beat: 0.6,  shift: 1.0, dur: 0.6,  anim: 'spin', spin: Math.PI },
  elastico:  { label: 'ELASTICO',       weight: 5,  beat: 0.65, shift: 1.0, dur: 0.45, anim: 'elastico' },
  heelchop:  { label: 'HEEL CHOP',      weight: 4,  beat: 0.55, shift: 0.9, dur: 0.45, anim: 'feint' },
  nutmeg:    { label: 'NUTMEG!',        weight: 4,  beat: 0.75, shift: 0,   dur: 0.5,  anim: 'touch', kick: { fwd: 4.2, up: 0 }, close: 2.2 },
  berba:     { label: 'BERBA SPIN',     weight: 3,  beat: 0.6,  shift: 1.0, dur: 0.7,  anim: 'spin', spin: Math.PI * 1.5 },
  scoop:     { label: 'SCOOP TURN',     weight: 3,  beat: 0.6,  shift: 1.1, dur: 0.55, anim: 'spin', spin: Math.PI },
  heel2heel: { label: 'HEEL TO HEEL',   weight: 2,  beat: 0.65, shift: 0.5, dur: 0.5,  anim: 'flick', kick: { fwd: 2.0, up: 1.2 } },
  sombrero:  { label: 'SOMBRERO FLICK', weight: 2,  beat: 0.75, shift: 0,   dur: 0.7,  anim: 'flick', kick: { fwd: 2.2, up: 3.6 } },
  rainbow:   { label: 'RAINBOW FLICK',  weight: 2,  beat: 0.8,  shift: 0,   dur: 0.9,  anim: 'flick', kick: { fwd: 2.6, up: 5.0 } },
};

// The four on the SKILL button are fully scripted: ball path and body together.
// Ball keys: [k, forward, right(× side), height] in the frame the move started in.
// Player keys: [k, forward, right(× side)]; turn: total heading change (× side) and when.
const R = 0.11;
const SCRIPTED = {
  // roll it back with the sole, up the back of the standing leg, heel flick over the head
  rainbow: { dur: 1.05, anim: 'rainbowS', beat: 0.85, hold: 0.55, holdSpeed: 0.8,
    ball: [[0, 0.34, 0, R], [0.24, -0.1, 0.07, R], [0.4, -0.2, 0.06, 0.4], [0.47, -0.16, 0.04, 0.62]],
    flight: { from: 0.47, to: [2.7, 0, R], apex: 2.55 },
    player: [[0, 0, 0], [0.5, 0.15, 0], [1, 1.2, 0]] },
  // Marseille turn: step on it, spin back over it with the right sole, finish with the left
  roulette: { dur: 0.95, anim: 'rouletteS', beat: 0.65, hold: 0.95, holdSpeed: 0.6,
    ball: [[0, 0.32, 0, R], [0.14, 0.2, 0.02, R], [0.5, -0.02, 0.48, R], [0.86, 0.22, 0.96, R], [1, 0.4, 1.02, R]],
    player: [[0, 0, 0], [0.14, 0.04, 0], [0.9, 0.12, 0.92], [1, 0.16, 0.95]], turn: [Math.PI * 2, 0.13, 0.88] },
  // outside of the foot one way, snap it back inside the other, and go
  elastico: { dur: 0.62, anim: 'elasticoS', beat: 0.7, hold: 0.55, holdSpeed: 2.2,
    ball: [[0, 0.33, 0, R], [0.3, 0.38, 0.3, R], [0.56, 0.45, -0.32, R], [1, 1.25, -0.62, R]],
    player: [[0, 0, 0], [0.45, 0.3, 0.05], [1, 0.95, -0.55]] },
  // sole on top, drag it back and turn with it
  dragback: { dur: 0.8, anim: 'dragturnS', beat: 0.6, hold: 0.8, holdSpeed: 0.5,
    ball: [[0, 0.32, 0, R], [0.22, 0.18, 0, R], [0.62, -0.38, 0.08, R], [1, -0.66, 0.05, R]],
    player: [[0, 0, 0], [0.3, 0.02, 0], [1, -0.12, 0.05]], turn: [Math.PI, 0.25, 0.8] },
};

const sm = (t) => t * t * (3 - 2 * t);
function keyed(keys, k, n) {
  if (k <= keys[0][0]) return keys[0].slice(1, 1 + n);
  for (let i = 1; i < keys.length; i++) {
    if (k <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i], t = sm((k - a[0]) / (b[0] - a[0]));
      const o = []; for (let j = 1; j <= n; j++) o.push(a[j] + (b[j] - a[j]) * t);
      return o;
    }
  }
  return keys[keys.length - 1].slice(1, 1 + n);
}

export class Skills {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.cooldown = 0;
  }

  reset() { this.active = null; this.cooldown = 0.8; }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.active) this._run(dt);
  }

  /** You swiped the SPRINT & SKILL button. */
  perform(o, dir) {
    const g = this.game, ball = g.ball;
    if (this.active || this.cooldown > 0 || ball.owner !== o || ball.pos.y > 0.4 || o.stumble > 0) return false;
    const key = { up: 'rainbow', down: 'dragback', left: 'roulette', right: 'elastico' }[dir];
    if (!key) return false;
    // the defender it's aimed at: nearest opponent in front
    const fx = Math.sin(o.heading), fz = Math.cos(o.heading);
    let target = null, best = 5;
    for (const d of g.opponentsOf(o)) {
      if (d.isKeeper || d.stumble > 0) continue;
      const dx = d.pos.x - o.pos.x, dz = d.pos.z - o.pos.z, dl = Math.hypot(dx, dz);
      if (dl < best && (dx * fx + dz * fz) / (dl || 1) > -0.2) { best = dl; target = d; }
    }
    this._start(o, target, key);
    return true;
  }

  _pick(distToDefender) {
    const rng = this.game.rng;
    // a nutmeg needs the defender right on top of you
    const ok = Object.entries(SKILLS).filter(([, s]) => !s.close || distToDefender < s.close);
    const total = ok.reduce((a, [, s]) => a + s.weight, 0);
    let r = rng.next() * total;
    for (const [k, s] of ok) { r -= s.weight; if (r <= 0) return k; }
    return 'stepover';
  }

  _start(o, d, key) {
    const g = this.game, ball = g.ball;
    key = key || this._pick(d ? Math.hypot(d.pos.x - o.pos.x, d.pos.z - o.pos.z) : 9);
    const sk = SKILLS[key];
    // go away from the side the defender is leaning to
    const fx = Math.sin(o.heading), fz = Math.cos(o.heading);
    const px = fz, pz = -fx; // perpendicular (right)
    const side = d ? (((d.pos.x - o.pos.x) * px + (d.pos.z - o.pos.z) * pz) > 0 ? -1 : 1) : (g.rng.chance(0.5) ? 1 : -1);
    const sc = SCRIPTED[key];
    if (sc) {
      // scripted: the ball follows the move exactly, the body does the real technique
      const sk2 = { ...sk, dur: sc.dur, beat: sc.beat, shift: 0, kick: null };
      this.active = { key, sk: sk2, o, d, t: 0, side, px, pz, fx, fz, resolved: false, script: sc,
        x0: o.pos.x, z0: o.pos.z, h0: o.heading, last: ball.pos.clone() };
      o.playAction(sc.anim, sc.dur, { side, kickLeg: 1 });
      ball.frozen = true; ball.vel.set(0, 0, 0);
      if (o.isUser) { g.audio.touch(); if (key === 'rainbow') g.audio.anticipate(); }
      return;
    }
    this.active = { key, sk, o, d, t: 0, side, px, pz, fx, fz, resolved: false };
    o.playAction(sk.anim, sk.dur, { side, kickLeg: side, spinAmt: (sk.spin || 0) * side });
    if (sk.kick) {
      // flicks / nutmegs: knock it past or over the defender, then run onto it
      ball.kick(o.vel.x + fx * sk.kick.fwd, sk.kick.up, o.vel.z + fz * sk.kick.fwd,
        { type: 'touch', by: o, ignoreTime: 0, time: g.simTime });
      ball.owner = o;
      if (d) ball.ignore.set(d, 1.0);
    }
    if (key === 'dragback') { o.vel.multiplyScalar(0.3); ball.vel.set(-fx * 1.2, 0, -fz * 1.2); }
    if (o.isUser) { g.audio.touch(); if (sk.kick) g.audio.anticipate(); }
  }

  _run(dt) {
    const g = this.game, ball = g.ball, a = this.active;
    const { o, d, sk } = a;
    a.t += dt;
    const k = a.t / sk.dur;
    // carrier lost it (pass, shot, tackle) → cancel the move
    if (ball.owner !== o) { this.active = null; ball.frozen = false; o.skillHold = null; return; }
    if (a.script) this._script(a, Math.min(1, k), dt);
    // sideways burst through the middle of the move
    if (sk.shift > 0 && k > 0.3 && k < 0.85) {
      const v = (sk.shift / (0.55 * sk.dur)) * dt;
      o.pos.x += a.px * a.side * v;
      o.pos.z += a.pz * a.side * v;
    }
    // halfway through: did the defender buy it?
    if (!a.resolved && k >= 0.5 && d) {
      a.resolved = true;
      const S = CONFIG.skills;
      const skill = (o.stats.dribbling + o.stats.ballControl) / 2;
      let p = sk.beat * (0.55 + skill / 180) - (d.rating - 60) / 200;
      if (dist2D(d.pos, o.pos) > S.triggerRange + 1) p = 0;
      if (g.rng.next() < Math.min(0.92, Math.max(0.1, p))) {
        d.stumble = S.beatStumble;
        d.ai.tackling = null;
        d.ai.onBall = 0;
        d.tackleCooldown = Math.max(d.tackleCooldown, S.beatStumble + 0.6);
        d.playAction('stumble', 0.7, { side: -a.side });
        g.events.emit('beatDefender', { by: o, defender: d, skill: a.key });
      }
    }
    if (k >= 1) {
      if (a.script) {
        ball.frozen = false;
        o.skillHold = null;
        // carry on with it: rolling at his pace in the direction he's facing
        const sp = Math.max(1.2, Math.hypot(o.vel.x, o.vel.z));
        ball.vel.set(Math.sin(o.heading) * sp, 0, Math.cos(o.heading) * sp);
        ball.owner = o;
      }
      this.active = null;
      this.cooldown = CONFIG.skills.cooldown;
    }
  }

  /** Ball + body along the script for this frame. */
  _script(a, k, dt) {
    const g = this.game, ball = g.ball, o = a.o, sc = a.script, sd = a.side;
    const fx = a.fx, fz = a.fz, rx = a.pz, rz = -a.px;   // (right = (fz, -fx))
    const W = (f, r) => [a.x0 + fx * f + a.px * r * sd, a.z0 + fz * f + a.pz * r * sd];
    // ball
    let bf, br, by;
    if (sc.flight && k >= sc.flight.from) {
      const s0 = keyed(sc.ball, sc.flight.from, 3), t = (k - sc.flight.from) / (1 - sc.flight.from), T = sc.flight.to;
      bf = s0[0] + (T[0] - s0[0]) * t; br = s0[1] + (T[1] - s0[1]) * t;
      by = s0[2] + (T[2] - s0[2]) * t + 4 * (sc.flight.apex - Math.max(s0[2], T[2]) * 0.5) * t * (1 - t);
    } else [bf, br, by] = keyed(sc.ball, k, 3);
    const [bx, bz] = W(bf, br);
    ball.savePrev && ball.savePrev();
    a.last.copy(ball.pos);
    ball.pos.set(bx, by, bz);
    // velocity from the motion (so the ball spins / hands over smoothly)
    if (dt > 0) ball.vel.set((bx - a.last.x) / dt, (by - a.last.y) / dt, (bz - a.last.z) / dt);
    // player path (he's held to a walk while he's working the ball)
    if (k < sc.hold) {
      const [pf, pr] = keyed(sc.player, k, 2);
      const [px, pz] = W(pf, pr);
      o.pos.x += (px - o.pos.x) * Math.min(1, dt * 14);
      o.pos.z += (pz - o.pos.z) * Math.min(1, dt * 14);
      o.skillHold = sc.holdSpeed;
    } else o.skillHold = null;
    // body turn
    if (sc.turn) {
      const [amt, t0, t1] = sc.turn;
      const e = sm(Math.min(1, Math.max(0, (k - t0) / (t1 - t0))));
      const h = a.h0 - amt * sd * e;
      o.faceTowards(o.pos.x + Math.sin(h) * 5, o.pos.z + Math.cos(h) * 5);
      o.heading = h;
    } else o.faceTowards(o.pos.x + fx * 5, o.pos.z + fz * 5);
    void rx; void rz;
  }
}
