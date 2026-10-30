// Automatic skill moves: when an opponent closes in on your team's ball
// carrier, the carrier sometimes pulls off a skill (stepovers most often,
// rainbow flicks very rarely). A successful skill sends the defender the
// wrong way so they stumble and you get past.
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

export class Skills {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.cooldown = 0;
  }

  reset() { this.active = null; this.cooldown = 0.8; }

  update(dt) {
    const g = this.game, ball = g.ball, S = CONFIG.skills;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.active) { this._run(dt); return; }
    const o = ball.owner;
    if (!o || o.team !== 'home' || o.isKeeper || this.cooldown > 0) return;
    if (ball.pos.y > 0.3 || o.speed < S.minSpeed || o.stumble > 0) return;
    if (!g.sm.is('PLAYING')) return;

    // a defender closing in, roughly in front of us
    const fx = Math.sin(o.heading), fz = Math.cos(o.heading);
    let target = null, best = S.triggerRange;
    for (const d of g.defenders) {
      if (d.stumble > 0) continue;
      const dx = d.pos.x - o.pos.x, dz = d.pos.z - o.pos.z;
      const dl = Math.hypot(dx, dz);
      if (dl > best || dl < 0.3) continue;
      if ((dx * fx + dz * fz) / dl < S.frontDot) continue;
      best = dl; target = d;
    }
    if (!target) return;
    const flair = 0.6 + o.stats.dribbling / 200; // 0.85..1.1
    if (g.rng.next() > S.chancePerSecond * flair * dt) return;
    this._start(o, target);
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

  _start(o, d) {
    const g = this.game, ball = g.ball;
    const key = this._pick(Math.hypot(d.pos.x - o.pos.x, d.pos.z - o.pos.z));
    const sk = SKILLS[key];
    // go away from the side the defender is leaning to
    const fx = Math.sin(o.heading), fz = Math.cos(o.heading);
    const px = fz, pz = -fx; // perpendicular (right)
    const side = ((d.pos.x - o.pos.x) * px + (d.pos.z - o.pos.z) * pz) > 0 ? -1 : 1;
    this.active = { key, sk, o, d, t: 0, side, px, pz, fx, fz, resolved: false };
    o.playAction(sk.anim, sk.dur, { side, kickLeg: side, spinAmt: (sk.spin || 0) * side });
    if (sk.kick) {
      // flicks / nutmegs: knock it past or over the defender, then run onto it
      ball.kick(o.vel.x + fx * sk.kick.fwd, sk.kick.up, o.vel.z + fz * sk.kick.fwd,
        { type: 'touch', by: o, ignoreTime: 0, time: g.simTime });
      ball.owner = o;
      ball.ignore.set(d, 1.0);
    }
    if (o.isUser) { g.hud.flash(sk.label, 'good'); g.audio.touch(); g.audio.anticipate(); }
  }

  _run(dt) {
    const g = this.game, ball = g.ball, a = this.active;
    const { o, d, sk } = a;
    a.t += dt;
    const k = a.t / sk.dur;
    // carrier lost it (pass, shot, tackle) → cancel the move
    if (ball.owner !== o) { this.active = null; return; }
    // sideways burst through the middle of the move
    if (sk.shift > 0 && k > 0.3 && k < 0.85) {
      const v = (sk.shift / (0.55 * sk.dur)) * dt;
      o.pos.x += a.px * a.side * v;
      o.pos.z += a.pz * a.side * v;
    }
    // halfway through: did the defender buy it?
    if (!a.resolved && k >= 0.5) {
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
      this.active = null;
      this.cooldown = CONFIG.skills.cooldown;
    }
  }
}
