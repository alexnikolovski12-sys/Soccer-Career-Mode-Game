// MomentManager: builds a randomised attacking moment, runs the timer, decides
// when/how it ends, and scores its match-rating contribution. Designed so a
// future MatchManager can chain moments (see `match` + `MomentResult`).
import { CONFIG, clamp } from '../config.js';
import { makeRng } from '../core/MathUtil.js';

export const SCENARIOS = {
  counter: { name: 'Counter Attack', tag: 'Space ahead — drive at them!' },
  buildup: { name: 'Build-Up', tag: 'Packed defence — pass and move' },
  wing: { name: 'Wing Play', tag: 'Beat your man or find the box' },
  edge: { name: 'Edge of the Box', tag: 'Ball incoming — be ready' },
  oneOnOne: { name: 'One-on-One', tag: 'Through on goal!' },
};

export const OUTCOMES = {
  GOAL: { title: 'GOAL!', kind: 'good' },
  SAVED: { title: 'SAVED', kind: 'neutral' },
  OFF_TARGET: { title: 'OFF TARGET', kind: 'bad' },
  POST: { title: 'HIT THE POST', kind: 'neutral' },
  BLOCKED: { title: 'BLOCKED', kind: 'neutral' },
  TACKLED: { title: 'TACKLED', kind: 'bad' },
  INTERCEPTED: { title: 'INTERCEPTED', kind: 'bad' },
  TIME_UP: { title: 'TIME UP', kind: 'bad' },
  OUT: { title: 'OUT OF PLAY', kind: 'bad' },
};

export class MomentManager {
  constructor(game) {
    this.game = game;
    this.match = {
      minute: 0, homeGoals: 0, awayGoals: 0, shots: 0, goals: 0,
      moments: [], // { scenario, outcome, rating }
    };
    this.momentNo = 0;
    this.current = null;
    this.forced = null;
    this._wire();
  }

  get matchRating() {
    const R = CONFIG.rating;
    const sum = this.match.moments.reduce((a, m) => a + m.rating, 0);
    return clamp(R.base + sum, R.min, R.max);
  }

  // ------------------------------------------------------------ events → rating / endings
  _wire() {
    const g = this.game;
    const ev = g.events;
    const R = CONFIG.rating;
    ev.on('gain', ({ player, from, kick, pass }) => {
      const m = this.current;
      if (!m || m.ending) return;
      if (player.team === 'away') {
        const userLost = (pass && pass.from === g.user) || from === g.user || (kick && kick.by === g.user);
        if (kick && (kick.type === 'shot' || kick.type === 'block')) { this.end('BLOCKED'); return; }
        if (kick && kick.type === 'save') { this.end('SAVED'); return; }
        const outcome = kick && kick.type === 'pass' ? 'INTERCEPTED' : 'TACKLED';
        this.addRating(userLost ? 'Lost possession' : 'Team lost the ball', userLost ? R.turnover : R.teammateTurnover);
        this.end(outcome);
        return;
      }
      if (pass && pass.from === g.user && player !== g.user) {
        m.completedPasses++;
        if (m.completedPasses <= 3) this.addRating('Completed pass', R.completedPass);
        const inBox = player.pos.x > CONFIG.pitch.length / 2 - CONFIG.pitch.penaltyDepth &&
          Math.abs(player.pos.z) < CONFIG.pitch.penaltyWidth / 2;
        const brokeLine = player.pos.x > m.lineAtPass - 0.5 && player.pos.x > g.user.pos.x + 4;
        if ((inBox || brokeLine) && !m.keyPass) { m.keyPass = true; this.addRating('Key pass', R.keyPass); }
      }
      // rebound regained after a save/block: back to open play
      if (g.sm.is('SHOT_FLIGHT') && kick && (kick.type === 'save' || kick.type === 'block' || kick.type === 'shot')) {
        g.backToPlay();
      }
    });
    ev.on('pass', ({ from }) => {
      if (this.current) this.current.lineAtPass = g.offsideLine();
      g.lastPasser = from;
    });
    ev.on('shot', () => {
      this.match.shots++;
      if (this.current) this.current.shots++;
    });
    ev.on('save', ({ type }) => {
      const m = this.current;
      if (!m) return;
      if (!m.onTargetCounted) { m.onTargetCounted = true; this.addRating('Shot on target', R.onTarget); }
      m.saved = true;
      if (type === 'parry') g.hud.flash('SAVED — REBOUND!', 'neutral');
    });
    ev.on('keeperHold', ({ fromShot }) => {
      if (!this.current || this.current.ending) return;
      if (fromShot) this.end('SAVED', 0.9);
      else {
        this.addRating('Keeper claimed it', R.teammateTurnover);
        this.end('SAVED', 0.6);
      }
    });
    ev.on('keeperSmother', () => {
      if (this.current) this.addRating('Keeper smothered it', R.turnover * 0.5);
    });
    ev.on('blocked', () => { if (this.current && !this.current.ending) this.end('BLOCKED', 0.9); });
    ev.on('beatDefender', ({ by }) => {
      const m = this.current;
      if (m && by === g.user && m.beaten < 3) { m.beaten++; this.addRating('Beat a defender', R.beatDefender); }
    });
  }

  addRating(label, value) {
    if (!this.current) return;
    this.current.items.push({ label, value });
  }

  // ------------------------------------------------------------ setup
  /** Prepare a moment. retry=true replays the last seed/scenario. */
  setup({ retry = false, scenario = null } = {}) {
    const g = this.game;
    let seed, key;
    if (retry && this.current) {
      seed = this.current.seed; key = this.current.scenario;
      if (this.current.recorded) this._unrecord(this.current);
    } else {
      seed = (Math.random() * 2 ** 32) >>> 0;
      const r0 = makeRng(seed);
      key = scenario || this.forced || r0.weighted(CONFIG.moment.scenarioWeights);
      // avoid repeating the same scenario twice in a row (variety)
      if (!scenario && !this.forced && this.current && key === this.current.scenario) {
        key = r0.weighted(CONFIG.moment.scenarioWeights);
      }
      this.momentNo++;
      this.match.minute = this.match.minute === 0
        ? CONFIG.moment.startMinute + r0.int(0, 6)
        : this.match.minute + r0.int(7, 13);
      if (this.match.minute > 90) this.match.minute = 90 + r0.int(1, 4);
    }
    const rng = makeRng(seed);
    g.rng = makeRng(seed ^ 0x9e3779b9);
    this._postTimer = null;
    this.current = {
      seed, scenario: key, rngSeed: seed, minute: this.match.minute,
      timer: CONFIG.moment.duration, items: [], shots: 0, completedPasses: 0, beaten: 0,
      keyPass: false, onTargetCounted: false, saved: false, ending: null, recorded: false,
      lineAtPass: 0, number: this.momentNo, postHit: false,
    };
    g.resetWorld();
    this._spawn(key, rng);
    g.afterSpawn();
    return this.current;
  }

  _spawn(key, rng) {
    const g = this.game;
    const L = CONFIG.pitch.length / 2, W = CONFIG.pitch.width / 2;
    const user = g.user;
    const mates = [], defs = [];
    let userBall = true;
    let userVel = 0;
    let passer = null;

    const place = (list, x, z, role) => list.push({ x, z, role });

    if (key === 'counter') {
      const ux = rng.range(0, 12), uz = rng.range(-10, 10);
      user.place(ux, uz, Math.PI / 2);
      userVel = user.runSpeed * 0.9;
      place(mates, ux + rng.range(4, 9), clamp(uz + rng.range(10, 16), -W + 4, W - 4), 'runner');
      place(mates, ux + rng.range(3, 8), clamp(uz - rng.range(10, 16), -W + 4, W - 4), 'wide');
      if (rng.chance(0.6)) place(mates, ux - rng.range(4, 8), uz + rng.range(-6, 6), 'support');
      place(defs, rng.range(33, 38), rng.range(-9, -3), 0);
      place(defs, rng.range(33, 38), rng.range(3, 9), 0);
      place(defs, ux - rng.range(3, 6), uz + rng.range(-4, 4), 1); // chasing back
      if (rng.chance(0.5)) place(defs, rng.range(26, 31), rng.range(-14, 14), 1);
    } else if (key === 'buildup') {
      const ux = rng.range(6, 16), uz = rng.range(-12, 12);
      user.place(ux, uz, Math.PI / 2);
      place(mates, rng.range(28, 32), rng.range(-6, 6), 'runner');
      place(mates, ux + rng.range(4, 10), -Math.sign(uz || 1) * rng.range(22, 28), 'wide');
      place(mates, ux + rng.range(-2, 4), uz + Math.sign(uz || 1) * -rng.range(8, 12), 'support');
      if (rng.chance(0.6)) place(mates, ux - rng.range(5, 9), uz + rng.range(-5, 5), 'support');
      const back = rng.range(34, 38);
      for (const z of [-13, -4.5, 4.5, 13]) place(defs, back + rng.range(-1.2, 1.2), z + rng.range(-1.5, 1.5), 0);
      place(defs, ux + rng.range(9, 13), uz * 0.5 + rng.range(-5, 5), 1);
      if (rng.chance(0.7)) place(defs, rng.range(24, 29), -uz * 0.4 + rng.range(-6, 6), 1);
    } else if (key === 'wing') {
      const side = rng.sign();
      const ux = rng.range(18, 30), uz = side * rng.range(26, 30.5);
      user.place(ux, uz, Math.PI / 2);
      userVel = user.jogSpeed;
      place(mates, rng.range(36, 40), side * rng.range(-4, 3), 'runner');
      place(mates, ux - rng.range(5, 9), side * rng.range(14, 20), 'support');
      place(mates, rng.range(30, 34), -side * rng.range(6, 14), 'wide');
      place(defs, ux + rng.range(3, 6), uz - side * rng.range(1, 3), 0); // full-back
      place(defs, rng.range(42, 45), side * rng.range(2, 6), 0);
      place(defs, rng.range(42, 45), -side * rng.range(2, 6), 0);
      place(defs, rng.range(32, 37), side * rng.range(8, 14), 1);
      if (rng.chance(0.6)) place(defs, rng.range(36, 40), -side * rng.range(10, 16), 1);
    } else if (key === 'edge') {
      const uz = rng.range(-6, 6), ux = rng.range(31, 34);
      user.place(ux, uz, Math.PI / 2);
      userBall = false;
      const pz = clamp(uz + rng.sign() * rng.range(9, 13), -W + 4, W - 4);
      place(mates, ux - rng.range(9, 12), pz, 'support');
      passer = 0;
      place(mates, rng.range(40, 43), -Math.sign(uz || 1) * rng.range(5, 9), 'runner');
      place(mates, ux - rng.range(2, 6), -Math.sign(pz) * rng.range(18, 24), 'wide');
      place(defs, ux + rng.range(3.5, 5), uz + rng.range(-1.5, 1.5), 0); // pressing
      place(defs, rng.range(43, 46), rng.range(-6, -1), 0);
      place(defs, rng.range(43, 46), rng.range(1, 6), 0);
      place(defs, rng.range(36, 40), -Math.sign(uz || 1) * rng.range(8, 12), 1);
      // trailing midfielder on the far side of the opening pass, not in its lane
      if (rng.chance(0.6)) place(defs, ux - rng.range(4, 7), uz - Math.sign(pz - uz) * rng.range(4, 7), 1);
    } else { // oneOnOne
      const ux = rng.range(17, 24), uz = rng.range(-5, 5);
      user.place(ux, uz, Math.PI / 2);
      userVel = user.runSpeed;
      place(defs, ux - rng.range(2.5, 4), uz + rng.range(-2, 2), 1); // chaser
      place(defs, ux - rng.range(14, 20), rng.range(-12, 12), 1);
      place(mates, ux - rng.range(8, 12), uz + rng.range(6, 10), 'support');
      place(mates, ux - rng.range(12, 18), uz - rng.range(6, 12), 'runner');
    }

    // ---- activate pools
    g.activate(mates.length, defs.length);
    mates.forEach((s, i) => {
      const m = g.teammates[i];
      m.place(clamp(s.x, -L + 3, L - 3), clamp(s.z, -W + 1.5, W - 1.5), Math.PI / 2);
      m.ai.role = s.role;
      m.ai.lane = s.z;
      m.ai.side = Math.sign(s.z) || 1;
    });
    defs.forEach((s, i) => {
      const d = g.defenders[i];
      d.place(clamp(s.x, -L + 3, L - 3), clamp(s.z, -W + 1.5, W - 1.5), -Math.PI / 2);
      d.ai.slot = { row: s.role, z: s.z };
    });

    // ---- ball
    const ball = g.ball;
    if (userBall) {
      const h = user.heading;
      ball.reset(user.pos.x + Math.sin(h) * 0.6, user.pos.z + Math.cos(h) * 0.6);
      ball.owner = user;
      ball.lastTouch = user;
      if (userVel > 0) {
        user.vel.set(Math.sin(h) * userVel, 0, Math.cos(h) * userVel);
        ball.vel.set(Math.sin(h) * userVel * 1.25, 0, Math.cos(h) * userVel * 1.25);
      }
    } else {
      const m = g.teammates[passer];
      ball.reset(m.pos.x + 0.6, m.pos.z);
      ball.owner = m;
      ball.lastTouch = m;
      m.heading = Math.atan2(user.pos.x - m.pos.x, user.pos.z - m.pos.z);
      m.ai.userCalled = true;
    }
  }

  // ------------------------------------------------------------ run
  get timeLeft() { return this.current ? this.current.timer : 0; }

  /** Fixed-step update while PLAYING or SHOT_FLIGHT. */
  update(dt) {
    const m = this.current;
    if (!m) return;
    const g = this.game, ball = g.ball;
    if (m.ending) {
      m.ending.t -= dt;
      if (m.ending.t <= 0) this._finish();
      return;
    }
    if (!g.sm.is('SHOT_FLIGHT')) m.timer -= dt;

    for (const e of ball.events) {
      if (e.type === 'goal' && e.side > 0) { this.end('GOAL', 0); return; }
      if (e.type === 'post') {
        g.audio.post();
        g.camRig.addShake(0.15);
        if (!m.postHit && ball.lastKick && ball.lastKick.type === 'shot') {
          m.postHit = true;
          this.addRating('Hit the woodwork', CONFIG.rating.post);
          this._postTimer = 1.4;
        }
      }
    }
    if (this._postTimer != null && !ball.inGoal) {
      this._postTimer -= dt;
      if (this._postTimer <= 0) { this._postTimer = null; this.end('POST', 0.1); return; }
    }

    // out of play
    const L = CONFIG.pitch.length / 2, W = CONFIG.pitch.width / 2, r = CONFIG.ball.radius;
    if (!ball.inGoal && (Math.abs(ball.pos.x) > L + r || Math.abs(ball.pos.z) > W + r)) {
      const k = ball.lastKick ? ball.lastKick.type : null;
      if (m.postHit) this.end('POST', 0.4);
      else if (k === 'shot') this.end('OFF_TARGET', 0.5);
      else if (k === 'save') this.end('SAVED', 0.5);
      else if (k === 'block') this.end('BLOCKED', 0.4);
      else {
        const userLast = ball.lastTouch === g.user;
        this.addRating('Ball out of play', userLast ? CONFIG.rating.turnover * 0.5 : CONFIG.rating.teammateTurnover);
        this.end('OUT', 0.4);
      }
      return;
    }
    if (m.timer <= 0 && !g.sm.is('SHOT_FLIGHT')) {
      this.addRating('Attack fizzled out', CONFIG.rating.timeUp);
      this.end('TIME_UP', 0);
    }
  }

  /** Begin ending: the sim keeps running for `delay` seconds, then RESULT. */
  end(outcome, delay = 0.4) {
    const m = this.current;
    if (!m || m.ending) return;
    const R = CONFIG.rating;
    if (outcome === 'GOAL') {
      if (!m.onTargetCounted) m.onTargetCounted = true;
      this.addRating('GOAL', R.goal);
      this.match.goals++;
      this.match.homeGoals++;
    } else if (outcome === 'OFF_TARGET') {
      this.addRating('Shot off target', R.offTarget);
    } else if (outcome === 'BLOCKED') {
      this.addRating('Shot blocked', R.blocked);
    }
    m.ending = { outcome, t: delay };
    this.game.onMomentEnding(outcome);
    if (delay <= 0) this._finish();
  }

  _finish() {
    const m = this.current;
    const outcome = m.ending.outcome;
    const rating = m.items.reduce((a, it) => a + it.value, 0);
    m.result = {
      outcome, ...OUTCOMES[outcome], rating, items: m.items.slice(),
      scenario: m.scenario, minute: m.minute, number: m.number,
    };
    this.match.moments.push({ scenario: m.scenario, outcome, rating });
    m.recorded = true;
    m.ending.t = Infinity;
    this.game.onMomentFinished(m.result);
  }

  _unrecord(m) {
    const last = this.match.moments.pop();
    if (!last) return;
    if (last.outcome === 'GOAL') { this.match.goals--; this.match.homeGoals--; }
    this.match.shots -= m.shots;
    m.recorded = false;
  }
}
