// A full 90-minute match (played in a few real minutes): clock and halves,
// goals at both ends, the ball going out (throw-in / corner / goal kick),
// offside, the opposition's free kicks and penalties, kick-offs, stats.
// Home always attacks +x; away attacks −x.
import * as THREE from 'three';
import { CONFIG, clamp } from '../config.js';
import { dist2D } from '../core/MathUtil.js';

export class Match {
  constructor(game) {
    this.game = game;
    this.reset();
    this._wire();
  }

  reset(opts = {}) {
    this.halfSeconds = opts.halfSeconds || CONFIG.match.halfSeconds;
    this.added = null; this._spT = null;
    this.clock = 0;            // game seconds in this half (0 … 45 × 60)
    this.half = 1;
    this.homeGoals = 0; this.awayGoals = 0;
    this.goals = [];           // { team, name, minute, own }
    this.stats = { home: { shots: 0, onTarget: 0, poss: 0, passes: 0, fouls: 0 }, away: { shots: 0, onTarget: 0, poss: 0, passes: 0, fouls: 0 } };
    this.cards = {};
    this.sentOff = new Set();
    this.restart = null;
    this.kickoffTeam = 'home';
    this.ended = false;
    this.lastShooter = null;
    this.userRating = 6.0;
  }

  get minute() {
    const m = Math.floor(this.clock / 60) + (this.half === 2 ? 45 : 0);
    return Math.min(m, this.half === 1 ? 45 : 90);
  }
  get clockText() {
    const base = this.half === 2 ? 45 : 0;
    const m = Math.floor(this.clock / 60), s = Math.floor(this.clock % 60);
    if (m >= 45) return `${base + 45}+${m - 44}'`;
    return `${String(base + m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  /** Game seconds per real second. */
  get rate() { return (45 * 60) / this.halfSeconds; }

  // ------------------------------------------------------------ events
  _wire() {
    const g = this.game, ev = g.events;
    ev.on('shot', ({ shooter, info }) => {
      const st = this.stats[shooter.team];
      st.shots++; if (info.onTarget) st.onTarget++;
      this.lastShooter = shooter;
      if (shooter.isUser) this.userRating += info.onTarget ? 0.15 : 0.03;
    });
    ev.on('pass', ({ from, to }) => {
      if (!from) return;
      this.stats[from.team].passes++;
      // offside: receiver beyond the second-last defender, ahead of the ball, in their half
      const ball = g.ball;
      if (to && ball.pass && !this.restart) {
        const s = to.team === 'home' ? 1 : -1;
        const line = g.offsideLine(to.team, true);
        const ahead = s * to.pos.x > s * line + 0.4 && s * to.pos.x > s * ball.pos.x && s * to.pos.x > 0;
        if (ahead) ball.pass.offside = to;
      }
    });
    ev.on('gain', ({ player, pass }) => {
      if (pass && pass.offside === player && !this.restart) this.offside(player);
      if (player.isUser && pass && pass.from && pass.from.team === 'away') this.userRating += 0.06;
    });
    ev.on('tackleWon', ({ by }) => { if (by && by.isUser) this.userRating += 0.12; });
    ev.on('beatDefender', ({ by }) => { if (by && by.isUser) this.userRating += 0.04; });
  }

  // ------------------------------------------------------------ per step
  update(dt) {
    const g = this.game, ball = g.ball;
    if (this.ended) return;
    this.clock += dt * this.rate;
    const own = ball.owner ? ball.owner.team : null;
    if (own) this.stats[own].poss += dt;

    if (this.restart) { this._restartStep(dt); return; }

    for (const e of ball.events) {
      if (e.type === 'goal') { this._goal(e.side > 0 ? 'home' : 'away'); return; }
      if (e.type === 'post') { g.audio.post(); g.audio.ooh(); g.camRig.addShake(0.15); }
    }
    if (ball.inGoal) return;
    // out of play
    const L = CONFIG.pitch.length / 2, W = CONFIG.pitch.width / 2, r = CONFIG.ball.radius;
    if (!ball.frozen && Math.abs(ball.pos.z) > W + r) {
      const last = ball.lastTouch ? ball.lastTouch.team : 'away';
      this.startRestart('throw', last === 'home' ? 'away' : 'home', clamp(ball.pos.x, -L + 1, L - 1), Math.sign(ball.pos.z) * W);
      return;
    }
    if (!ball.frozen && Math.abs(ball.pos.x) > L + r) {
      const end = Math.sign(ball.pos.x);            // +1: the goal home attack
      const defending = end > 0 ? 'away' : 'home';
      const last = ball.lastTouch ? ball.lastTouch.team : null;
      if (last === defending) this.startRestart('corner', defending === 'away' ? 'home' : 'away', end * (L - 0.6), Math.sign(ball.pos.z || 1) * (W - 0.6));
      else this.startRestart('goalkick', defending, end * (L - 5.5), Math.sign(ball.pos.z || 1) * 3.5);
      if (g.ball.lastKick && g.ball.lastKick.type === 'shot') g.audio.groan(0.5);
      return;
    }
    // end of the half: added time, then wait for a quiet moment — and never mid-chance:
    // a shot, a penalty or a free kick that's on its way always gets to finish
    if (this.clock >= 45 * 60) {
      if (this.added == null) {
        this.added = 1 + Math.floor(Math.random() * 3) + (this.goals.length > 2 ? 1 : 0);
        g.hud.flash(`+${this.added} MIN ADDED TIME`, 'neutral');
      }
      if (this.clock >= (45 + this.added) * 60) {
        const lk = ball.lastKick;
        const live = ball.speed > 3 && ((lk && (lk.type === 'shot' || lk.setPiece)) || Math.abs(ball.pos.x) > L - 30);
        const sinceSP = this._spT != null ? this.clock - this._spT : 1e9;
        const danger = live || sinceSP < 3 * this.rate || g.keeper.state === 'holding' || g.homeKeeper.state === 'holding'
          || (Math.abs(ball.pos.x) > L - 25 && (ball.owner || ball.pass));
        if (!danger || (this.clock >= (45 + this.added + 2) * 60 && !live && sinceSP > 5 * this.rate)) this._endHalf();
      }
    }
  }

  _goal(team) {
    const g = this.game, ball = g.ball;
    const scorer = (ball.lastKick && ball.lastKick.by) || ball.lastTouch || null;
    const own = scorer && scorer.team !== team;
    if (team === 'home') this.homeGoals++; else this.awayGoals++;
    this.goals.push({ team, name: scorer ? scorer.name : '', minute: Math.max(1, this.minute), own });
    if (scorer && scorer.isUser && !own) this.userRating += 1.1;
    if (team === 'away') this.userRating -= 0.25;
    this.kickoffTeam = team === 'home' ? 'away' : 'home';
    g.onGoal(team, own ? null : scorer);
  }

  _endHalf() {
    const g = this.game;
    if (this.half === 1) {
      this.half = 2;
      this.clock = 0;
      this.added = null; this._spT = null;
      this.kickoffTeam = 'away';
      g.onHalfTime();
    } else {
      this.ended = true;
      g.onFullTime();
    }
  }

  offside(p) {
    const g = this.game;
    g.hud.flash(`OFFSIDE — ${p.name || ''}`.trim(), 'neutral');
    this.startRestart('freekick', p.team === 'home' ? 'away' : 'home', p.pos.x, p.pos.z, { quiet: true });
  }

  // ------------------------------------------------------------ restarts
  /**
   * Stop play and restart: throw | corner | goalkick | freekick | penalty | kickoff.
   * Your team's restarts are taken by you (PASS / THROUGH, or it goes on its own);
   * the opposition's are taken by the AI.
   */
  startRestart(type, team, x, z, opts = {}) {
    const g = this.game, ball = g.ball;
    if (this.restart) return;
    // training (no outfield opposition): every restart is yours; an "away corner" becomes your goal kick
    if (g.matchOpts && g.matchOpts.training && team === 'away' && type !== 'goalkick' && type !== 'kickoff') {
      const L = CONFIG.pitch.length / 2;
      if (type === 'corner' || type === 'penalty') { type = 'goalkick'; x = -(L - 5.5); z = Math.sign(z || 1) * 3.5; }
      team = 'home';
    }
    if (g.matchOpts && g.matchOpts.training && type === 'kickoff') team = 'home';
    g.passing.reset();
    g.shooting.cancelStrike();
    g.skills.reset();
    if (g.ballCam) g._endBallCam();
    this.restart = { type, team, x, z, phase: 'dead', t: type === 'kickoff' ? 0.1 : 0.9, taker: null, auto: 0 };
    if (!opts.quiet) {
      const label = { throw: 'THROW-IN', corner: 'CORNER', goalkick: 'GOAL KICK', freekick: 'FREE KICK', penalty: 'PENALTY' }[type];
      if (label) g.hud.flash(label, team === 'home' ? 'good' : 'neutral');
    }
    if (type !== 'kickoff') g.audio.whistle(false);
  }

  _restartStep(dt) {
    const g = this.game, ball = g.ball, R = this.restart;
    R.t -= dt;
    if (R.phase === 'dead') {
      // play has stopped: the ball rolls dead, players drift back into shape
      ball.vel.multiplyScalar(Math.exp(-3 * dt));
      if (R.t > 0) return;
      this._placeRestart();
      R.phase = 'ready';
      R.t = R.team === 'home' && !g.autoplay ? 5 : (R.type === 'penalty' ? 1.6 : 1.1 + g.rng.next() * 0.6);
      return;
    }
    if (R.phase === 'ready') {
      // taker stays on the ball; opponents keep their distance
      const tk = R.taker;
      if (tk) { tk.steer(0, 0, 0); tk.vel.set(0, 0, 0); tk.pos.set(R.standX, 0, R.standZ); tk.faceTowards(R.faceX, R.faceZ); }
      const keepOff = R.type === 'throw' ? 3 : R.type === 'penalty' ? 0 : 9.15;
      for (const p of g.players) {
        if (p.team === R.team || p.isKeeper || keepOff <= 0) continue;
        const d = Math.hypot(p.pos.x - R.x, p.pos.z - R.z);
        if (d < keepOff) { const k = keepOff / (d || 1); p.pos.x = R.x + (p.pos.x - R.x) * k; p.pos.z = R.z + (p.pos.z - R.z) * k; }
      }
      if (R.type === 'penalty') this._penaltyKeepOut();
      ball.pos.set(R.x, R.type === 'throw' ? 2.0 : CONFIG.ball.radius, R.z);
      ball.vel.set(0, 0, 0);
      if (R.t <= 0) this.takeRestart();
    }
  }

  _penaltyKeepOut() {
    const g = this.game, R = this.restart, L = CONFIG.pitch.length / 2, P = CONFIG.pitch;
    const s = R.x > 0 ? 1 : -1;
    for (const p of g.players) {
      if (p.isKeeper || p === R.taker) continue;
      if (s * p.pos.x > L - P.penaltyDepth - 1 && Math.abs(p.pos.z) < P.penaltyWidth / 2 + 1) p.pos.x = s * (L - P.penaltyDepth - 1.5);
    }
  }

  _placeRestart() {
    const g = this.game, ball = g.ball, R = this.restart, L = CONFIG.pitch.length / 2;
    ball.reset(R.x, R.z);
    ball.inGoal = false;
    ball.frozen = true;
    ball.owner = null; ball.pass = null;
    const team = R.team, s = team === 'home' ? 1 : -1;
    let taker;
    if (R.type === 'goalkick') taker = team === 'home' ? g.homeKeeperPlayer : g.keeperPlayer;
    else {
      const cand = (team === 'home' ? [g.user, ...g.teammates] : g.defenders).filter((p) => p.visible && !p.sentOff);
      taker = cand.reduce((b, p) => (dist2D(p.pos, ball.pos) < dist2D(b.pos, ball.pos) ? p : b), cand[0]);
      if (R.type === 'penalty' && team === 'away') taker = cand.reduce((b, p) => (p.stats.finishing > b.stats.finishing ? p : b), cand[0]);
    }
    R.taker = taker;
    if (team === 'home' && !taker.isKeeper) g.switchControl(taker, true);
    // where he stands: behind the ball, facing into the pitch / at goal
    let fx = R.x + s * 12, fz = R.z * 0.3;
    if (R.type === 'throw') { fx = R.x + s * 4; fz = 0; }
    if (R.type === 'corner') { fx = s * (L - 8); fz = 0; }
    if (R.type === 'penalty') { fx = s * L; fz = 0; }
    if (R.type === 'kickoff') {
      // face the teammate he'll knock it to (alongside him on the halfway line), not his own goal
      const mates = (team === 'home' ? [g.user, ...g.teammates] : g.defenders).filter((p) => p !== taker && p.visible && !p.sentOff);
      const m = mates.reduce((b, p) => (!b || Math.hypot(p.pos.x - R.x, p.pos.z - R.z) < Math.hypot(b.pos.x - R.x, b.pos.z - R.z) ? p : b), null);
      R.kickMate = m;
      fx = m ? m.pos.x : R.x; fz = m ? m.pos.z : 6;
    }
    const dx = fx - R.x, dz = fz - R.z, dl = Math.hypot(dx, dz) || 1;
    const back = R.type === 'throw' ? 0.05 : 0.7;
    R.standX = R.x - (dx / dl) * back; R.standZ = R.z - (dz / dl) * back;
    if (R.type === 'throw') R.standZ = R.z + Math.sign(R.z) * 0.35;
    R.faceX = fx; R.faceZ = fz;
    taker.place(R.standX, R.standZ, Math.atan2(dx, dz));
    taker.ai.state = 'restart';
    if (R.type === 'throw') taker.playAction('armsup', 30, { hold: true });
    if (R.type === 'penalty') {
      const k = s > 0 ? g.keeper : g.homeKeeper;
      k.reset();
    }
    for (const p of g.players) p.savePrev();
    ball.savePrev();
    if (team === 'home' && R.type !== 'kickoff') g.hud.flash(R.type === 'penalty' ? '' : 'PASS TO TAKE IT', 'neutral');
  }

  /** Take it: called by the AI when its time's up, or by your PASS / THROUGH button. */
  takeRestart(kind = null, dir = null) {
    const g = this.game, ball = g.ball, R = this.restart;
    if (!R || R.phase !== 'ready') return false;
    const tk = R.taker, s = R.team === 'home' ? 1 : -1;
    this.restart = null;
    if (R.type === 'penalty' || R.type === 'freekick' || R.type === 'corner') this._spT = this.clock;
    ball.frozen = false;
    if (tk.anim.action === 'armsup') tk.anim.action = null;
    const mates = g.teammatesOf(tk).filter((p) => !p.isKeeper && p.visible && !p.sentOff);
    const L = CONFIG.pitch.length / 2;
    if (R.type === 'penalty' && R.team === 'away') {
      ball.owner = tk;
      g.shooting.aiShoot(tk);
      return true;
    }
    if (R.type === 'throw') {
      // pick a teammate (in your stick direction for your throw-ins) and throw it to him
      const dx = dir ? dir.x : s, dz = dir ? dir.z : -Math.sign(R.z);
      const sel = g.passing.selectTarget(tk, dx, dz, null, 12);
      const t = sel ? sel.target : mates[0];
      this._throw(tk, t);
      return true;
    }
    ball.owner = tk;
    ball.lastTouch = tk;
    if (R.type === 'goalkick') {
      const longBall = g.rng.chance(0.55);
      const pool = mates.filter((p) => (longBall ? s * p.pos.x > -5 : s * p.pos.x < -L * 0.4));
      const t = (pool.length ? pool : mates)[Math.floor(g.rng.next() * (pool.length || mates.length))];
      g.passing.requestAIPass(tk, t, longBall ? 'lofted' : 'ground');
      return true;
    }
    if (R.type === 'corner') {
      const box = mates.filter((p) => s * p.pos.x > L - 18 && Math.abs(p.pos.z) < 12);
      const t = box.length ? box.reduce((b, p) => (p.stats.heading ?? p.rating) > (b.stats.heading ?? b.rating) ? p : b, box[0]) : mates[0];
      if (tk.isUser && kind === 'ground') g.passing.requestUserPass(tk, dir ? dir.x : -s, dir ? dir.z : -Math.sign(R.z), 'ground');
      else {
        g.passing.requestAIPass(tk, t, 'lofted');
      }
      return true;
    }
    // free kick / kick-off: pass it on (your free kicks in range go through the set-piece flow instead)
    if (tk.isUser && dir) g.passing.requestUserPass(tk, dir.x, dir.z, kind || 'ground');
    else {
      if (R.type === 'freekick' && g.shooting.aiCanShoot(tk) && Math.hypot(s * L - R.x, R.z) < 24 && g.rng.chance(0.6)) { g.shooting.aiShoot(tk); return true; }
      if (R.type === 'kickoff' && R.kickMate) { g.passing.requestAIPass(tk, R.kickMate); return true; }
      const dx = R.type === 'kickoff' ? -s : s, sel = g.passing.selectTarget(tk, dx, 0);
      g.passing.requestAIPass(tk, sel ? sel.target : mates[0]);
    }
    return true;
  }

  _throw(tk, t) {
    const g = this.game, ball = g.ball;
    const aim = g.passing.leadPoint(tk, t, new THREE.Vector3());
    const dx = aim.x - ball.pos.x, dz = aim.z - ball.pos.z, d = Math.hypot(dx, dz) || 1;
    const T = clamp(d / 11, 0.55, 1.5), G = CONFIG.ball.gravity;
    const vy = (CONFIG.ball.radius - ball.pos.y + 0.5 * G * T * T) / T;
    ball.kick((dx / T) * 1.08, vy, (dz / T) * 1.08, { type: 'pass', by: tk, ignoreTime: 0.5, time: g.simTime });
    ball.pass = { from: tk, to: t, aim: aim.clone(), t0: g.simTime, kind: 'lofted' };
    t.ai.receiving = true;
    tk.playAction('pass', 0.4, { variant: 'chipped' });
    g.events.emit('pass', { from: tk, to: t, aim, speed: d / T, kind: 'throw' });
  }

  // ------------------------------------------------------------ kick-off
  /** Both teams in their own half in formation, the kicking team on the centre spot. */
  placeKickoff() {
    const g = this.game, ball = g.ball, L = CONFIG.pitch.length / 2, W = CONFIG.pitch.width / 2;
    ball.reset(0, 0);
    ball.inGoal = false;
    const kick = this.kickoffTeam;
    for (const [team, list] of [['home', [g.user, ...g.teammates]], ['away', g.defenders]]) {
      const s = team === 'home' ? 1 : -1;
      for (const p of list) {
        if (!p.visible || p.sentOff) continue;
        const sl = p.slot || { fx: -0.3, fz: 0 };
        let x = s * Math.min(-1.5, (sl.fx * 0.55 - 0.08) * L);
        let z = s * sl.fz * W * 0.85;
        if (Math.hypot(x, z) < 10) { const k = 10 / (Math.hypot(x, z) || 1); x *= k; z *= k; if (s * x > -1) x = -s * 1.5; }
        p.place(x, z, s > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    }
    g.keeper.reset(); g.homeKeeper.reset();
    // the two up front for the kicking team stand on the ball
    const s = kick === 'home' ? 1 : -1;
    const fw = (kick === 'home' ? [g.user, ...g.teammates] : g.defenders).filter((p) => p.visible && !p.sentOff)
      .sort((a, b) => s * (b.slot?.fx ?? 0) - s * (a.slot?.fx ?? 0));
    if (fw[0]) fw[0].place(-s * 0.7, 0.3, s > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (fw[1]) fw[1].place(-s * 1.2, 5, Math.atan2(s * 1.2, -5));   // alongside, facing the ball
    if (kick === 'home' && fw[0]) g.switchControl(fw[0], true);
    for (const p of g.players) p.savePrev();
    ball.savePrev();
    this.restart = null;
    this.startRestart('kickoff', kick, 0, 0, { quiet: true });
  }

  // ------------------------------------------------------------ result
  result() {
    const st = this.stats, tot = st.home.poss + st.away.poss || 1;
    return {
      gf: this.homeGoals, ga: this.awayGoals, goals: this.goals.slice(),
      possession: Math.round((st.home.poss / tot) * 100),
      shots: [st.home.shots, st.away.shots], onTarget: [st.home.onTarget, st.away.onTarget],
      rating: clamp(+this.userRating.toFixed(1), 3, 10),
    };
  }
}
