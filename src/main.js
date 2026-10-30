// Bootstrap, fixed-timestep game loop and the game state machine.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Loop } from './core/Loop.js';
import { StateMachine, STATES } from './core/StateMachine.js';
import { Input } from './core/Input.js';
import { Audio } from './core/Audio.js';
import { Quality } from './core/Quality.js';
import { makeRng, dist2D } from './core/MathUtil.js';
import { Pitch } from './world/Pitch.js';
import { CameraRig } from './world/Camera.js';
import { Effects } from './world/Effects.js';
import { Player } from './entities/Player.js';
import { Ball } from './entities/Ball.js';
import { Keeper } from './entities/Keeper.js';
import { TeammateAI } from './ai/TeammateAI.js';
import { DefenderAI } from './ai/DefenderAI.js';
import { Possession } from './gameplay/Possession.js';
import { Passing } from './gameplay/Passing.js';
import { Shooting } from './gameplay/Shooting.js';
import { Skills } from './gameplay/Skills.js';
import { MomentManager, SCENARIOS } from './gameplay/MomentManager.js';
import { Replay } from './gameplay/Replay.js';
import { HUD } from './ui/HUD.js';
import { ShotOverlay } from './ui/ShotOverlay.js';
import { DebugPanel } from './debug/DebugPanel.js';
import { USER_PLAYER, TEAMS, randomLook, statsFromRating } from './data/playerStats.js';

class Events {
  constructor() { this.map = {}; }
  on(name, fn) { (this.map[name] || (this.map[name] = [])).push(fn); }
  emit(name, data = {}) { const l = this.map[name]; if (l) for (const fn of l) fn(data); }
}

const easeInOut = (t) => t * t * (3 - 2 * t);

class Game {
  constructor() {
    this.host = document.getElementById('game');
    this.uiRoot = document.getElementById('ui');
    this.layer = document.getElementById('touch-layer');
    this.config = CONFIG; // handy for console tuning: game.config.shot.wobbleScale = 0
    this.events = new Events();
    this.rng = makeRng(1);
    this.simTime = 0;
    this.realTime = 0;
    this.lastPasser = null;

    // ---- renderer
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.host.appendChild(r.domElement);
    this.renderer = r;
    this.scene = new THREE.Scene();

    this.camRig = new CameraRig();
    this.pitch = new Pitch(this.scene);
    this.effects = new Effects(this.scene);
    this.ball = new Ball(this.scene);

    // ---- players (pools; each moment activates a subset)
    const rng = makeRng(20240611);
    this.user = new Player(this.scene, {
      id: 'user', team: 'home', role: 'user', name: USER_PLAYER.shortName,
      look: USER_PLAYER.look, stats: USER_PLAYER.stats, rating: TEAMS.home.rating,
    });
    this.career = this.user; // your career player — control returns to him every moment
    const mateNames = ['OKAFOR', 'LINDQVIST', 'MORAES', 'HALE'];
    this.teammatePool = [7, 10, 11, 8].map((n, i) => new Player(this.scene, {
      id: `mate${i}`, team: 'home', role: 'mate', rating: TEAMS.home.rating, name: mateNames[i],
      look: randomLook(rng, TEAMS.home.kit, n), stats: statsFromRating(TEAMS.home.rating, rng),
    }));
    this.defenderPool = [2, 5, 4, 3, 6, 8].map((n, i) => new Player(this.scene, {
      id: `def${i}`, team: 'away', role: 'def', rating: TEAMS.away.rating,
      look: randomLook(rng, TEAMS.away.kit, n), stats: statsFromRating(TEAMS.away.rating, rng),
    }));
    this.keeperPlayer = new Player(this.scene, {
      id: 'gk', team: 'away', role: 'gk', rating: CONFIG.keeper.rating,
      look: { ...randomLook(rng, TEAMS.away.keeperKit, 1), height: 1.9 }, stats: statsFromRating(CONFIG.keeper.rating, rng),
    });
    this.keeper = new Keeper(this, this.keeperPlayer);
    this.teammates = [];
    this.defenders = [];
    this.players = [];

    // ---- systems
    this.audio = new Audio();
    this.possession = new Possession(this);
    this.passing = new Passing(this);
    this.shooting = new Shooting(this);
    this.skills = new Skills(this);
    this.setPiece = null;
    this.teammateAI = new TeammateAI(this);
    this.defenderAI = new DefenderAI(this);
    this.replay = new Replay(this);
    this.input = new Input(this.layer, this.uiRoot);
    this.input.anyInteraction = () => this.audio.unlock();
    this.overlay = new ShotOverlay(this.uiRoot, this.scene);
    this.hud = new HUD(this.uiRoot, this.input, {
      pause: () => (this.sm.is(STATES.PAUSED) ? this.resume() : this.pause()),
      resume: () => this.resume(),
      mute: () => { this.audio.setMuted(!this.audio.muted); this.hud.setMuted(this.audio.muted); },
      debug: () => this.debug.toggle(),
      cancelShot: () => { if (this.sm.is(STATES.SHOT_AIM)) this.sm.change(STATES.PLAYING); },
      next: () => this.nextMoment(),
      retry: () => this.retryMoment(),
    });
    this.hud.setMuted(this.audio.muted);
    this.moments = new MomentManager(this);
    this.quality = new Quality((lvl) => this.applyQuality(lvl));
    this.debug = new DebugPanel(this, this.uiRoot);

    this.ts = null;
    this._buildStates();
    this._wireEvents();
    this.loop = new Loop({
      hz: CONFIG.sim.hz,
      maxSteps: CONFIG.sim.maxStepsPerFrame,
      update: (dt) => this.sm.update(dt),
      render: (alpha, realDt, scaledDt) => this.frame(alpha, realDt, scaledDt),
    });

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    window.addEventListener('orientationchange', () => setTimeout(this._resize, 250));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this._resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.pause(); this.audio.suspend(); } else if (!this.sm.is(STATES.PAUSED)) this.audio.resume();
    });
    window.addEventListener('pagehide', () => this.pause());
    this.layer.addEventListener('pointerdown', () => {
      if (this.sm.is(STATES.RESULT) && this.resultPhase === 'replay') this._endReplay();
    });

    this.applyQuality(this.quality.current);
    this._resize();
    this.sm.change(STATES.LOADING);
    this.loop.start();
  }

  // ------------------------------------------------------------ world helpers
  homePlayers() { return [this.user, ...this.teammates]; }
  awayPlayers() { return [...this.defenders, this.keeperPlayer]; }
  teammatesOf(p) { return (p.team === 'home' ? this.homePlayers() : this.awayPlayers()).filter((q) => q !== p); }
  opponentsOf(p) { return p.team === 'home' ? this.awayPlayers() : this.homePlayers(); }

  /** Rough offside line: last outfield defender, never behind the ball or halfway. */
  offsideLine() {
    let x = 0;
    for (const d of this.defenders) x = Math.max(x, d.pos.x);
    return Math.max(x, this.ball.pos.x, 0);
  }

  /** Control goes back to the career player at the start of every moment. */
  resetControl() {
    if (this.user === this.career) return;
    this.user.setControlled(false);
    this.career.setControlled(true);
    this.user = this.career;
    this.teammates = this.teammates.filter((p) => p !== this.career);
  }

  /** Switch control to a home player (called when they receive the ball). */
  switchControl(p, quiet = false) {
    const old = this.user;
    if (!p || p === old || p.team !== 'home' || p.isKeeper) return;
    const i = this.teammates.indexOf(p);
    if (i < 0) return;
    const ai = p.ai || {};
    old.setControlled(false);
    p.setControlled(true);
    // the player you leave behind takes over the role of the one you switched to
    old.ai = {
      role: ai.role || 'support', lane: ai.lane ?? old.pos.z, side: ai.side || (Math.sign(old.pos.z) || 1),
      target: new THREE.Vector3(old.pos.x, 0, old.pos.z), retarget: 0, holdT: 0, decideAt: null,
      userCalled: false, receiving: false,
    };
    p.sprinting = false;
    this.teammates[i] = old;
    this.user = p;
    this.players = [this.user, ...this.teammates, ...this.defenders, this.keeperPlayer];
    this.lastPasser = null;
    if (!quiet) this.hud.flash(p.name || 'SWITCH', 'neutral');
  }

  /** Whenever a home outfield player has the ball, you are that player. */
  syncControl(quiet = true) {
    const o = this.ball.owner;
    if (o && o !== this.user && o.team === 'home' && !o.isKeeper && this.teammates.includes(o)) this.switchControl(o, quiet);
  }

  /** Move a player without wiping their AI assignment (place() resets it). */
  _reposition(p, x, z, heading) {
    const ai = p.ai;
    p.place(x, z, heading);
    p.ai = ai;
    p.ai.tackling = null; p.ai.onBall = 0;
  }

  /** A defender went through the man: stop play, then set up a free kick (or penalty). */
  onFoul({ by, victim }) {
    if (!this.sm.is(STATES.PLAYING) || this.setPiece) return;
    const m = this.moments.current;
    if (!m || m.ending) return;
    const L = CONFIG.pitch.length / 2, P = CONFIG.pitch;
    const x = this.ball.pos.x, z = this.ball.pos.z;
    const penalty = x > L - P.penaltyDepth && Math.abs(z) < P.penaltyWidth / 2;
    this.setPiece = { phase: 'down', t: CONFIG.setPiece.downTime, penalty, victim, spot: { x, z } };
    this.skills.reset();
    this.passing.reset();
    by.stumble = 0;
    this.hud.showBig(penalty ? 'PENALTY!' : 'FOUL — FREE KICK', 'good');
    this.audio.whistle(false);
    this.audio.boo();
    this.camRig.addShake(0.08);
    m.timer = Math.max(m.timer, CONFIG.setPiece.timerTopUp);
    this.moments.addRating(penalty ? 'Won a penalty' : 'Won a free kick', penalty ? 0.3 : 0.1);
  }

  _setUpFreeKick() {
    const sp = this.setPiece, S = CONFIG.setPiece, L = CONFIG.pitch.length / 2, P = CONFIG.pitch, W = CONFIG.pitch.width / 2;
    const ball = this.ball;
    if (sp.victim.team === 'home' && !sp.victim.isKeeper) this.switchControl(sp.victim, true);
    const u = this.user;
    let x = sp.penalty ? L - 11 : Math.min(sp.spot.x, L - 1.5);
    let z = sp.penalty ? 0 : Math.max(-W + 1, Math.min(W - 1, sp.spot.z));
    const dGoal = Math.hypot(L - x, z) || 1;
    const ux = (L - x) / dGoal, uz = -z / dGoal;     // ball → goal centre
    const heading = Math.atan2(ux, uz);
    ball.reset(x, z);
    ball.owner = u; ball.lastTouch = u; ball.pass = null;
    ball.lastKick = { type: 'control', by: u, time: this.simTime };
    this._reposition(u, x - ux * 0.6, z - uz * 0.6, heading);
    u.stumble = 0;

    const boxEdge = L - P.penaltyDepth - 1.5;
    const wall = !sp.penalty && dGoal < S.wallMaxRange ? Math.min(dGoal < 22 ? 4 : 3, this.defenders.length) : 0;
    this.defenders.forEach((d, i) => {
      d.stumble = 0; d.tackleCooldown = 1.2;
      if (sp.penalty) {
        if (d.pos.x > boxEdge || Math.hypot(d.pos.x - x, d.pos.z - z) < S.wallDistance)
          this._reposition(d, boxEdge - 1 - (i % 2) * 2, (i - this.defenders.length / 2) * 3, -Math.PI / 2);
      } else if (i < wall) {
        const off = (i - (wall - 1) / 2) * 0.72;
        this._reposition(d, x + ux * S.wallDistance - uz * off, z + uz * S.wallDistance + ux * off, heading + Math.PI);
      } else {
        const dx = d.pos.x - x, dz = d.pos.z - z, dl = Math.hypot(dx, dz) || 1;
        if (dl < S.wallDistance) this._reposition(d, x + (dx / dl) * (S.wallDistance + 0.5), z + (dz / dl) * (S.wallDistance + 0.5), heading + Math.PI);
      }
    });
    for (const t of this.teammates) {
      const dl = Math.hypot(t.pos.x - x, t.pos.z - z);
      if (sp.penalty && t.pos.x > boxEdge) this._reposition(t, boxEdge - 2, t.pos.z * 0.5, Math.PI / 2);
      else if (dl < 2.5) this._reposition(t, t.pos.x - 3, t.pos.z + (t.pos.z > z ? 3 : -3), Math.PI / 2);
    }
    this.keeper.reset();
    for (const p of this.players) p.savePrev();
    ball.savePrev();
    this.camRig.snap();
    sp.phase = 'set';
    sp.t = S.setupTime;
    sp.shoot = this.shooting.inRange(u);
    this.hud.hideBig();
    this.hud.flash(sp.penalty ? 'PENALTY — HOLD SHOOT' : sp.shoot ? 'FREE KICK — HOLD SHOOT' : 'FREE KICK', 'good');
  }

  _setPieceUpdate(dt) {
    const sp = this.setPiece;
    for (const p of this.players) p.savePrev();
    this.ball.savePrev();
    sp.t -= dt;
    if (sp.t > 0) return;
    if (sp.phase === 'down') { this._setUpFreeKick(); return; }
    sp.phase = 'ready'; // everyone holds until you take it
  }

  /** Free kick set: play restarts the moment you touch the stick or a button. */
  _setPieceReady() {
    const inp = this.input, mv = inp.poll();
    const go = mv.mag > 0.3 || inp.gestures.pass || inp.gestures.through || inp.gestures.shoot;
    if (go) { this.setPiece = null; return true; }
    for (const p of this.players) p.savePrev();
    this.ball.savePrev();
    return false;
  }

  /**
   * Jinking: quick changes of direction with a defender closing in can
   * wrong-foot him — he's delayed and stumbles, and you're through.
   */
  _juke(u, wx, wz, mag, dt) {
    const J = CONFIG.juke;
    const st = this._jk || (this._jk = { dir: null, cuts: [], t: 0 });
    st.t += dt;
    if (this.ball.owner !== u || !this.sm.is(STATES.PLAYING)) { st.dir = null; st.cuts.length = 0; return; }
    if (mag < 0.35) return; // flicking through the centre of the stick doesn't reset anything
    const l = Math.hypot(wx, wz) || 1;
    const dx = wx / l, dz = wz / l;
    if (!st.dir) { st.dir = { x: dx, z: dz }; return; }
    const dot = dx * st.dir.x + dz * st.dir.z;
    if (dot < Math.cos(J.cutAngle)) {
      st.cuts.push({ t: st.t, sharp: dot < Math.cos(J.sharpAngle) });
      st.dir.x = dx; st.dir.z = dz;
    } else {
      // follow gentle curves so only real cuts count
      const k = Math.min(1, dt * 5);
      st.dir.x += (dx - st.dir.x) * k; st.dir.z += (dz - st.dir.z) * k;
      const n = Math.hypot(st.dir.x, st.dir.z) || 1; st.dir.x /= n; st.dir.z /= n;
    }
    st.cuts = st.cuts.filter((c) => st.t - c.t < J.window);
    const n = st.cuts.length;
    if (!(n >= 2 || st.cuts.some((c) => c.sharp))) return;
    let beat = 0;
    for (const d of this.defenders) {
      if (d.stumble > 0 || (d.ai.jukeCd || 0) > this.simTime) continue;
      const dd = Math.hypot(d.pos.x - u.pos.x, d.pos.z - u.pos.z);
      if (dd > J.range) continue;
      let p = J.base + (u.stats.dribbling + u.stats.ballControl - 2 * d.rating) / 300 + (n >= 3 ? 0.12 : 0);
      if (this.rng.next() < Math.min(0.9, Math.max(0.15, p))) {
        d.stumble = J.stumble; d.ai.tackling = null; d.ai.onBall = 0;
        d.tackleCooldown = Math.max(d.tackleCooldown, J.stumble + 0.5);
        d.vel.multiplyScalar(0.3);
        d.playAction('stumble', 0.8, { side: this.rng.sign() });
        d.ai.jukeCd = this.simTime + 2.5;
        this.events.emit('beatDefender', { by: u, defender: d, skill: 'juke' });
        beat++;
      } else d.ai.jukeCd = this.simTime + 1.0;
    }
    if (beat) this.hud.flash(beat > 1 ? 'SKINNED THEM!' : 'FAKED HIM!', 'good');
    st.cuts.length = 0;
  }

  activate(nMates, nDefs) {
    this.teammatePool.forEach((p, i) => p.setVisible(i < nMates));
    this.defenderPool.forEach((p, i) => p.setVisible(i < nDefs));
    this.teammates = this.teammatePool.slice(0, nMates);
    for (const p of this.teammates) p.setControlled(false);
    this.defenders = this.defenderPool.slice(0, nDefs);
    this.players = [this.user, ...this.teammates, ...this.defenders, this.keeperPlayer];
  }

  resetWorld() {
    this.effects.clear();
    this.passing.reset();
    this.shooting.clearFlight();
    if (this.shooting.aim) this.shooting.endAim();
    this.overlay.clear();
    this.ball.events.length = 0;
    this.keeper.reset();
    this.lastPasser = null;
    this.setPiece = null;
    this.skills.reset();
    this.resetControl();
    this.replay.stop();
    this.hud.setReplay(false);
    this.hud.hideBig();
    this.ts = null;
    this.loop.timeScale = 1;
    this.user.stamina = Math.min(1, this.user.stamina + 0.6);
  }

  afterSpawn() {
    this.syncControl(true);
    this.teammateAI.reset();
    this.defenderAI.reset();
    this.replay.reset(this.players);
    for (const p of this.players) { p.savePrev(); p.anim.action = null; }
    this.ball.savePrev();
    this.camRig.setMode('follow');
    this.camRig.zoom = 1.7;
    this.camRig._yaw = 0;
    this.camRig.snap();
  }

  /** Action buttons + joystick visibility (joystick stays usable during shot flight). */
  setControls(buttons, joystick = buttons) {
    this.hud.setControlsVisible(buttons);
    this.input.joystick.setVisible(joystick);
  }

  setTimeScale(to, dur) {
    if (dur <= 0) { this.loop.timeScale = to; this.ts = null; return; }
    this.ts = { from: this.loop.timeScale, to, t: 0, dur };
  }

  // ------------------------------------------------------------ quality
  applyQuality(lvl) {
    const r = this.renderer;
    const changed = r.shadowMap.enabled !== lvl.shadows;
    r.shadowMap.enabled = lvl.shadows;
    this.pitch.sun.castShadow = lvl.shadows;
    for (const p of [this.career, ...this.teammatePool, ...this.defenderPool, this.keeperPlayer]) p.setShadows(lvl.shadows);
    this.ball.mesh.castShadow = lvl.shadows;
    this.pitch.setCrowdQuality(lvl.crowd === 'full');
    if (changed) this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    this._resize();
  }

  _resize() {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    const lvl = this.quality ? this.quality.current : CONFIG.quality.levels[CONFIG.quality.startLevel];
    const pr = Math.min(window.devicePixelRatio || 1, CONFIG.quality.maxPixelRatio) * lvl.resScale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.camRig.resize(w, h);
    this.overlay.resize();
    this.input.joystick.resize();
    this.hud.updateRotateHint();
    document.documentElement.classList.toggle('portrait', h > w);
  }

  // ------------------------------------------------------------ events
  _wireEvents() {
    const ev = this.events;
    ev.on('tackleWon', ({ victim }) => {
      if (victim === this.user) this.camRig.addShake(0.12);
      if (victim && victim.team === 'home') this.audio.groan(0.8);   // home fans: "awww"
    });
    ev.on('save', ({ type }) => {
      this.audio.ooh();
      this.camRig.addShake(0.1);
      if (type === 'parry') this.audio.kick(0.6);
    });
    ev.on('pass', ({ from }) => { if (from === this.user) this.effects.puff(this.ball.pos.x, this.ball.pos.z); });
    // FC-style switching: whichever of your teammates gets the ball, you now control them
    ev.on('gain', ({ player }) => { if (player.team === 'home' && !player.isKeeper) this.switchControl(player); });
    ev.on('foul', (e) => this.onFoul(e));
    ev.on('beatDefender', ({ by, skill }) => {
      if (by === this.user && !skill) this.hud.flash('SKILLED!', 'good');
      if (by && by.team === 'home') this.audio.skillCheer();
    });
  }

  // ------------------------------------------------------------ simulation
  simulate(dt, mode = 'play') {
    const ball = this.ball;
    for (const p of this.players) p.savePrev();
    ball.savePrev();
    ball.events.length = 0;

    if (mode === 'play') {
      this.syncControl(false);
      this.userControl(dt);
      this.skills.update(dt);
      this.teammateAI.update(dt);
      this.defenderAI.update(dt);
      this.keeper.update(dt);
      this.passing.update(dt);
    } else {
      this._resultControl(dt);
      this.keeper.update(dt);
    }
    for (const p of this.players) p.integrate(dt, ball.owner === p);
    this.possession.separate();
    const L = CONFIG.pitch.length / 2 + 2, W = CONFIG.pitch.width / 2 + 2;
    for (const p of this.players) {
      p.pos.x = Math.max(-L, Math.min(L, p.pos.x));
      p.pos.z = Math.max(-W, Math.min(W, p.pos.z));
    }
    ball.update(dt);
    if (mode === 'play') { this.possession.update(dt); this.syncControl(false); }
    for (const e of ball.events) {
      if (e.type === 'net') {
        this.pitch.nets[Math.sign(e.x) || 1].hit(e.x, e.y, e.z, e.v);
        if (e.v > 4) this.audio.net();
      }
    }
    if (mode === 'play' && this.sm.is(STATES.SHOT_FLIGHT)) this.shooting.flightUpdate(dt);
    this.moments.update(dt);
    this.simTime += dt;
  }

  userControl(dt) {
    const u = this.user, ball = this.ball, D = CONFIG.dribble, M = CONFIG.statMap;
    const mv = this.input.poll();
    const f = this.camRig.forward, rt = this.camRig.right;
    let wx = f.x * mv.y + rt.x * mv.x;
    let wz = f.z * mv.y + rt.z * mv.x;
    const mag = mv.mag;
    // hold SPRINT to sprint — no stamina limit, no cooldown
    u.sprinting = !!this.input.held.sprint && mag > 0.2;
    let speed = 0;
    if (mag > 0) {
      if (u.sprinting) speed = u.attrs.sprintSpeed * CONFIG.player.sprintBoost;
      else if (mag < D.jogTilt) speed = u.jogSpeed * (0.35 + 0.65 * (mag / D.jogTilt));
      else speed = u.jogSpeed + (u.runSpeed - u.jogSpeed) * ((mag - D.jogTilt) / (1 - D.jogTilt));
    }
    // stamina
    u.stamina = Math.min(1, u.stamina + M.staminaRecover * dt);
    this._juke(u, wx, wz, mag, dt);

    // assists when the stick is idle
    if (mag < 0.05) {
      if (ball.owner === u && dist2D(u.pos, ball.pos) > u.attrs.reach * 1.6 && D.autoChaseWhenIdle) {
        wx = ball.pos.x - u.pos.x; wz = ball.pos.z - u.pos.z; speed = u.jogSpeed;
      } else if (ball.pass && ball.pass.to === u) {
        // come to meet the pass: get on its line, a couple of metres toward the ball
        const v = ball.vel, sp = Math.hypot(v.x, v.z) || 1;
        const along = ((u.pos.x - ball.pos.x) * v.x + (u.pos.z - ball.pos.z) * v.z) / sp;
        const t = Math.max(0, along - CONFIG.pass.meetDistance);
        const tx = ball.pos.x + (v.x / sp) * t, tz = ball.pos.z + (v.z / sp) * t;
        wx = tx - u.pos.x; wz = tz - u.pos.z;
        speed = Math.hypot(wx, wz) > 0.3 ? u.runSpeed : 0;
        if (speed === 0) u.faceTowards(ball.pos.x, ball.pos.z);
      } else if (!ball.owner && !ball.pass && !ball.frozen && dist2D(u.pos, ball.pos) < 4) {
        wx = ball.pos.x - u.pos.x; wz = ball.pos.z - u.pos.z; speed = u.runSpeed;
      }
    }
    u.steer(wx, wz, speed);

    const inp = this.input;
    if (!this.sm.is(STATES.PLAYING)) { inp.consumeGesture('pass'); inp.consumeGesture('through'); inp.consumeGesture('shoot'); return; }
    const pg = inp.consumeGesture('pass'), tg = inp.consumeGesture('through'), sg = inp.consumeGesture('shoot');
    let dx = wx, dz = wz;
    if (mag < 0.2) { dx = Math.sin(u.heading); dz = Math.cos(u.heading); }
    if (ball.owner === u && !this.passing.pending) {
      if (sg) {
        // SHOOT: hold for power; swipe down = driven, up = chip, right = finesse, left = fake
        const kind = { tap: 'normal', down: 'driven', up: 'chip', right: 'finesse', left: 'fake' }[sg.dir] || 'normal';
        const r = this.shooting.shoot(u, kind, this.shooting.chargeFrom(sg.held));
        if (r === true) this.sm.change(STATES.SHOT_FLIGHT);
      } else if (tg) {
        this.passing.requestUserPass(u, dx, dz, 'through');
      } else if (pg) {
        // tap = ground pass; swipe up/down off the button = lofted pass / cross
        this.passing.requestUserPass(u, dx, dz, pg.dir === 'up' || pg.dir === 'down' ? 'lofted' : 'ground');
      }
    } else if ((pg || tg) && this.teammateAI.callForBall()) {
      u.playAction('point', 0.6);
      this.hud.flash('CALLING FOR IT', 'neutral');
    }
    inp.consume('confirm');
  }

  _resultControl(dt) {
    const u = this.user, ball = this.ball;
    const goal = this.resultOutcome === 'GOAL';
    const t = this.sm.time;
    const cel = this.celebration;
    for (const p of this.players) {
      if (p.isKeeper) continue;
      if (goal && p === u && cel) { this._celebrate(u, cel, t, dt); continue; }
      if (goal && p.team === 'home' && t > 0.4) {
        // teammates chase after the scorer, then jump around him
        const ang = (this.teammates.indexOf(p) + 1) * 1.3;
        const tx = u.pos.x - Math.cos(ang) * 1.8 - 1.2, tz = u.pos.z + Math.sin(ang) * 1.8;
        const d = p.moveTo(tx, tz, p.attrs.sprintSpeed, 2);
        p.faceTowards(u.pos.x, u.pos.z);
        if (d < 2.6 && p.anim.action !== 'teamjump') p.playAction('teamjump', 0.9, { loop: true, offset: ang });
        else if (d > 4 && p.anim.action !== 'armsup' && p.anim.action !== 'teamjump') p.playAction('armsup', 9, {});
        continue;
      }
      if (goal && p.team === 'away') { p.steer(0, 0, 0); continue; }
      p.steer(0, 0, 0);
      if (!goal && p !== u) p.faceTowards(ball.pos.x, ball.pos.z);
    }
  }

  /** Scorer's celebration: run to the fans, then the move. */
  _celebrate(u, cel, t, dt) {
    const L = CONFIG.pitch.length / 2, W = CONFIG.pitch.width / 2;
    if (!cel.target) {
      const side = u.pos.z >= 0 ? 1 : -1;
      cel.target = { x: L - 9, z: side * (W - 4) };
    }
    if (cel.phase === 'run') {
      const d = u.moveTo(cel.target.x, cel.target.z, u.attrs.sprintSpeed, 1);
      if (cel.type === 'airplane' && u.anim.action !== 'airplane') u.playAction('airplane', 9, { loop: true });
      if (d < (cel.type === 'kneeslide' ? 6.5 : 1.5) || t > 2.0) {
        cel.phase = 'move';
        const hx = Math.sin(u.heading), hz = Math.cos(u.heading);
        if (cel.type === 'kneeslide') {
          cel.slide = { x: hx, z: hz, v: Math.max(5.5, u.speed) };
          u.playAction('kneeslide', 2.6, { hold: true });
        } else if (cel.type === 'jumpfist') u.playAction('jumpfist', 9, { loop: true });
        else if (cel.type === 'spinjump') u.playAction('spinjump', 1.4, { hold: true, side: this.rng.sign() });
        else if (cel.type === 'pointsky') u.playAction('pointsky', 9, { loop: true });
        else u.playAction('celebrate', 2.4, { loop: true });
        u.faceTowards(0, u.pos.z * 0.3); // turn to the fans / your teammates
      }
      return;
    }
    if (cel.slide) {
      // knee slide: glide along the grass, slowing down
      const s = cel.slide;
      u.steer(0, 0, 0); u.vel.set(0, 0, 0);
      u.pos.x += s.x * s.v * dt; u.pos.z += s.z * s.v * dt;
      s.v *= Math.exp(-1.5 * dt);
      if (s.v < 0.2) cel.slide = null;
      return;
    }
    if (cel.type === 'airplane') {
      // keep wheeling away, arms out
      cel.a = (cel.a || 0) + dt * 0.9;
      u.moveTo(cel.target.x - 4 + Math.cos(cel.a) * 5, cel.target.z * 0.85 + Math.sin(cel.a) * 5, u.runSpeed, 1);
      return;
    }
    u.steer(0, 0, 0);
  }

  // ------------------------------------------------------------ flow
  nextMoment() {
    if (this.sm.is(STATES.PAUSED)) this.sm.pop();
    this.hud.hideResult();
    this.moments.setup();
    this.sm.change(STATES.INTRO);
  }

  retryMoment() {
    this.hud.hideResult();
    this.moments.setup({ retry: true });
    this.sm.change(STATES.INTRO);
  }

  backToPlay() {
    if (this.sm.is(STATES.SHOT_FLIGHT)) this.sm.change(STATES.PLAYING);
  }

  onMomentEnding(outcome) {
    this.resultOutcome = outcome;
    this.pendingResult = null;
    if (this.sm.is(STATES.PAUSED)) this.sm.pop();
    if (this.sm.is(STATES.SHOT_AIM)) this.shooting.endAim();
    this.sm.change(STATES.RESULT, { outcome });
  }

  onMomentFinished(result) { this.pendingResult = result; }

  pause() {
    if (!this.sm.is(STATES.PLAYING, STATES.SHOT_FLIGHT, STATES.INTRO, STATES.SHOT_AIM)) return;
    this.sm.push(STATES.PAUSED);
  }

  resume() { if (this.sm.is(STATES.PAUSED)) this.sm.pop(); }

  _endReplay() {
    this.replay.stop();
    this.hud.setReplay(false);
    this.resultPhase = 'card';
    this.camRig.setMode('celebrate', { target: this.user.pos, angle: 0.6 });
    this.camRig.snap();
    this._showCard();
  }

  _showCard() {
    if (!this.pendingResult) return;
    this.resultPhase = 'card';
    this.hud.hideBig();
    this.hud.showResult(this.pendingResult, this.moments.match, this.moments.matchRating);
  }

  // ------------------------------------------------------------ states
  _buildStates() {
    const S = STATES;
    const sm = (this.sm = new StateMachine());
    const g = this;

    sm.add(S.LOADING, {
      enter() {
        g.moments.setup();
        g.setControls(false);
        const ready = () => g.hud.ready(() => {
          g.audio.unlock();
          g.audio.setCrowd(0.2);
          g.sm.change(S.INTRO);
        });
        const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]).then(ready);
      },
    });

    sm.add(S.INTRO, {
      enter() {
        const m = g.moments.current;
        const sc = SCENARIOS[m.scenario];
        const match = g.moments.match;
        g.setControls(false);
        g.hud.hideResult();
        g.hud.showIntro(`${m.minute}' · ${TEAMS.home.short} ${match.homeGoals}–${match.awayGoals} ${TEAMS.away.short} · Moment ${m.number}`,
          sc.name.toUpperCase(), `${sc.tag} — Attack!`);
        g.input.enabled = false;
        g.input.releaseAll();
        g.camRig.setMode('intro');
      },
      frame() {
        if (sm.time > CONFIG.moment.introTime) sm.change(S.PLAYING);
      },
      exit() {
        g.hud.hideIntro();
      },
    });

    sm.add(S.PLAYING, {
      enter(_, prev) {
        g.input.enabled = true;
        g.input.clearPresses();
        g.setControls(true);
        g.camRig.setMode('follow');
        if (prev === S.INTRO) g.audio.whistle(false);
      },
      update(dt) {
        if (g.setPiece) {
          if (g.setPiece.phase !== 'ready') { g._setPieceUpdate(dt); return; }
          if (!g._setPieceReady()) return;
        }
        g.simulate(dt);
      },
      frame() {
        const has = g.ball.owner === g.user;
        g.hud.setShotCharge(has ? g.shooting.chargeFrom(g.input.chargeTime('shoot')) : 0);
        if (g.setPiece && g.setPiece.phase !== 'ready') {
          g.input.consumeGesture('pass'); g.input.consumeGesture('through'); g.input.consumeGesture('shoot');
          g.hud.setShootAvailable(false); return;
        }
        g.hud.setShootAvailable(g.shooting.inRange(g.user));
        const mateHas = g.ball.owner && g.ball.owner.team === 'home' && !g.ball.owner.isUser;
        g.hud.setPassLabel(mateHas ? 'CALL' : 'PASS');
      },
    });

    sm.add(S.SHOT_FLIGHT, {
      enter() {
        g.setTimeScale(1, CONFIG.shot.unfreezeTime);
        g.camRig.setMode('flight', { origin: g.shooting.flight ? g.shooting.flight.origin : g.ball.pos.clone() });
        g.setControls(false, true);
        g.hud.setShotCharge(0);
      },
      update(dt) {
        g.simulate(dt);
        const k = g.ball.lastKick;
        // after a parry, hand control back so the rebound can be attacked
        if (sm.is(S.SHOT_FLIGHT) && k && k.type === 'save' && sm.time > 1.0) g.backToPlay();
        if (sm.is(S.SHOT_FLIGHT) && sm.time > 5) g.backToPlay();
      },
      exit() {
        g.shooting.clearFlight();
        g.setTimeScale(1, 0.15);
      },
    });

    sm.add(S.RESULT, {
      enter({ outcome }) {
        g.input.enabled = false;
        g.input.releaseAll();
        g.setControls(false);
        g.hud.setShootAvailable(false);
        g.resultPhase = 'live';
        g.goalSimTime = g.simTime;
        if (!g.ts || g.loop.timeScale < 0.99) g.setTimeScale(1, 0.25);
        const info = { GOAL: 'good', SAVED: 'neutral', POST: 'neutral', BLOCKED: 'neutral' };
        const titles = { GOAL: 'GOAL!', SAVED: 'SAVED', OFF_TARGET: 'OFF TARGET', POST: 'HIT THE POST', BLOCKED: 'BLOCKED', TACKLED: 'TACKLED', INTERCEPTED: 'INTERCEPTED', TIME_UP: 'TIME UP', OUT: 'OUT OF PLAY' };
        g.hud.showBig(titles[outcome] || outcome, info[outcome] || 'bad');
        g.celebration = null;
        if (outcome === 'GOAL') {
          const types = ['kneeslide', 'kneeslide', 'airplane', 'jumpfist', 'spinjump', 'pointsky'];
          g.celebration = { type: types[Math.floor(Math.random() * types.length)], phase: 'run' };
          g.audio.roar();
          g.audio.net();
          g.camRig.addShake(CONFIG.juice.goalShake);
          g.effects.burstConfetti({ x: CONFIG.pitch.length / 2 - 4, z: g.ball.pos.z });
          g.camRig.setMode('goalview', { z: g.ball.pos.z });
          g.audio.setCrowd(1);
        } else {
          if (outcome === 'SAVED' || outcome === 'POST') g.audio.ooh();
          else if (outcome === 'OFF_TARGET' || outcome === 'BLOCKED' || outcome === 'TACKLED' || outcome === 'INTERCEPTED') g.audio.groan();
          g.audio.whistle(outcome === 'TIME_UP' || outcome === 'TACKLED' || outcome === 'INTERCEPTED' || outcome === 'OUT');
        }
      },
      update(dt) { g.simulate(dt, 'result'); },
      frame(realDt) {
        const goal = g.resultOutcome === 'GOAL';
        if (g.resultPhase === 'live') {
          if (goal && sm.time > 1.3 && g.camRig.mode === 'goalview') g.camRig.setMode('celebrate', { target: g.user.pos });
          if (goal && sm.time > CONFIG.juice.celebrateTime && g.pendingResult) {
            const J = CONFIG.juice;
            if (g.replay.start(g.goalSimTime - J.replaySeconds, g.goalSimTime + J.replayTail, J.replaySpeed)) {
              g.resultPhase = 'replay';
              g.hud.hideBig();
              g.hud.setReplay(true);
              g.camRig.setMode('replay', { side: g.ball.pos.z > 0 ? -1 : 1 });
              g.replay.update(0);
              g.camRig.snap();
            } else g._showCard();
          } else if (!goal && sm.time > 1.4 && g.pendingResult) {
            g._showCard();
          }
        } else if (g.resultPhase === 'replay') {
          g.camRig.opts.ballPos = g.replay.ballPos;
          if (!g.replay.update(realDt)) g._endReplay();
        }
      },
      exit() {
        g.replay.stop();
        g.hud.setReplay(false);
        g.hud.hideBig();
        g.audio.setCrowd(0.25);
      },
    });

    sm.add(S.PAUSED, {
      enter() {
        g._pausedScale = g.loop.timeScale;
        g._pausedTs = g.ts;
        g.ts = null;
        g.loop.timeScale = 0;
        g.hud.setPaused(true);
        g.input.releaseAll();
        g.audio.suspend();
      },
      exit() {
        g.loop.timeScale = g._pausedScale;
        g.ts = g._pausedTs;
        g.hud.setPaused(false);
        g.audio.resume();
      },
    });
  }

  // ------------------------------------------------------------ per frame
  frame(alpha, realDt, scaledDt) {
    this.realTime += realDt;
    if (this.ts) {
      const t = this.ts;
      t.t += realDt;
      const k = Math.min(1, t.t / t.dur);
      this.loop.timeScale = t.from + (t.to - t.from) * easeInOut(k);
      if (k >= 1) this.ts = null;
    }
    this.sm.frame(realDt);
    if (this.input.consume('pause')) { if (this.sm.is(STATES.PAUSED)) this.resume(); else this.pause(); }
    if (this.sm.is(STATES.RESULT) && this.resultPhase === 'card') {
      if (this.input.consume('confirm')) this.nextMoment();
      else if (this.input.consume('retry')) this.retryMoment();
    }

    const replaying = this.replay.playing;
    const paused = this.sm.is(STATES.PAUSED);
    if (!replaying) {
      if (!paused) for (const p of this.players) p.updateAnimation(scaledDt, this.ball.owner === p);
      for (const p of this.players) p.render(alpha, this.realTime);
      this.ball.render(alpha);
    }
    this.pitch.update(paused ? 0 : scaledDt);
    this.effects.update(paused ? 0 : realDt, this.realTime);
    this.camRig.update(realDt, this);
    this.pitch.focusShadows(this.camRig.look.x, this.camRig.look.z);
    this.hud.update(this);
    this.debug.update();
    this.quality.tick(realDt, this.sm.is(STATES.PLAYING, STATES.SHOT_FLIGHT));

    this._crowdT = (this._crowdT || 0) - realDt;
    if (this._crowdT <= 0 && this.sm.is(STATES.PLAYING, STATES.SHOT_FLIGHT, STATES.SHOT_AIM)) {
      this._crowdT = 0.3;
      const x = this.ball.pos.x;
      this.audio.setCrowd(Math.max(0, Math.min(1, (x - 5) / 40)));
    }

    this.renderer.render(this.scene, this.camRig.camera);
    if (!replaying && this.sm.is(STATES.PLAYING, STATES.SHOT_FLIGHT, STATES.SHOT_AIM, STATES.RESULT)) {
      this.replay.record(this.simTime);
    }
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  try {
    window.game = new Game();
  } catch (err) {
    console.error(err);
    const e = document.getElementById('boot-error');
    if (e) { e.style.display = 'block'; e.textContent = `Could not start: ${err.message}`; }
  }
});

export { Game, Ball };
