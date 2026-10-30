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
  switchControl(p) {
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
    this.hud.flash(p.name || 'SWITCH', 'neutral');
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
    this.resetControl();
    this.replay.stop();
    this.hud.setReplay(false);
    this.hud.hideBig();
    this.ts = null;
    this.loop.timeScale = 1;
    this.user.stamina = Math.min(1, this.user.stamina + 0.6);
  }

  afterSpawn() {
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
    });
    ev.on('beatDefender', ({ by }) => { if (by === this.user) this.hud.flash('SKILLED!', 'good'); });
    ev.on('save', ({ type }) => {
      this.audio.ooh();
      this.camRig.addShake(0.1);
      if (type === 'parry') this.audio.kick(0.6);
    });
    ev.on('pass', ({ from }) => { if (from === this.user) this.effects.puff(this.ball.pos.x, this.ball.pos.z); });
    // FC-style switching: whichever of your teammates gets the ball, you now control them
    ev.on('gain', ({ player }) => { if (player.team === 'home' && !player.isKeeper) this.switchControl(player); });
  }

  // ------------------------------------------------------------ simulation
  simulate(dt, mode = 'play') {
    const ball = this.ball;
    for (const p of this.players) p.savePrev();
    ball.savePrev();
    ball.events.length = 0;

    if (mode === 'play') {
      this.userControl(dt);
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
    if (mode === 'play') this.possession.update(dt);
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
    const wantsSprint = !!this.input.held.sprint && mag > 0.2;
    u.sprinting = wantsSprint && u.stamina > 0.02;
    let speed = 0;
    if (mag > 0) {
      if (u.sprinting) speed = u.attrs.sprintSpeed;
      else if (mag < D.jogTilt) speed = u.jogSpeed * (0.35 + 0.65 * (mag / D.jogTilt));
      else speed = u.jogSpeed + (u.runSpeed - u.jogSpeed) * ((mag - D.jogTilt) / (1 - D.jogTilt));
    }
    // stamina
    if (u.sprinting && u.speed > 3) u.stamina = Math.max(0, u.stamina - M.staminaDrain(u.stats.stamina) * dt);
    else u.stamina = Math.min(1, u.stamina + M.staminaRecover * dt);

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

    if (!this.sm.is(STATES.PLAYING)) { this.input.consume('pass'); this.input.consume('shoot'); return; }
    if (this.input.consume('pass')) {
      if (ball.owner === u) {
        let dx = wx, dz = wz;
        if (mag < 0.2) { dx = Math.sin(u.heading); dz = Math.cos(u.heading); }
        this.passing.requestUserPass(u, dx, dz);
      } else if (this.teammateAI.callForBall()) {
        u.playAction('point', 0.6);
        this.hud.flash('CALLING FOR IT', 'neutral');
      }
    }
    if (this.input.consume('shoot') && this.shooting.canShoot(u) && !this.passing.pending) {
      this.sm.change(STATES.SHOT_AIM);
    }
    this.input.consume('confirm');
  }

  _resultControl() {
    const u = this.user, ball = this.ball;
    const goal = this.resultOutcome === 'GOAL';
    for (const p of this.players) {
      if (p.isKeeper) continue;
      if (goal && p === u) {
        const L = CONFIG.pitch.length / 2, W = CONFIG.pitch.width / 2;
        const side = u.pos.z >= 0 ? 1 : -1;
        if (this.sm.time < 1.6) u.moveTo(L - 5, side * (W - 5), u.runSpeed, 3);
        else { u.steer(0, 0, 0); if (u.anim.action !== 'celebrate') u.playAction('celebrate', 2.4, { loop: true }); }
        continue;
      }
      if (goal && p.team === 'home' && this.sm.time > 0.5) {
        p.moveTo(u.pos.x - 2, u.pos.z + (p.pos.z > u.pos.z ? 2 : -2), p.runSpeed, 3);
        continue;
      }
      p.steer(0, 0, 0);
      if (!goal && p !== u) p.faceTowards(ball.pos.x, ball.pos.z);
    }
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
      update(dt) { g.simulate(dt); },
      frame() {
        g.hud.setShootAvailable(g.shooting.canShoot(g.user));
        const mateHas = g.ball.owner && g.ball.owner.team === 'home' && !g.ball.owner.isUser;
        g.hud.setPassLabel(mateHas ? 'CALL' : 'PASS');
      },
    });

    sm.add(S.SHOT_AIM, {
      enter() {
        g.setTimeScale(0, CONFIG.shot.freezeTime);
        g.shooting.beginAim(g.user);
        g.input.setAimMode({
          down: (x, y) => g.shooting.pointerDown(x, y),
          move: (x, y) => g.shooting.pointerMove(x, y),
          up: (x, y) => {
            if (g.shooting.pointerUp(x, y) === 'fire' && g.shooting.fire()) sm.change(S.SHOT_FLIGHT);
          },
        });
        g.hud.setAim(true);
        g.setControls(false);
        g.host.classList.add('frozen');
        g.camRig.setMode('shot');
        g.user.setGhost(CONFIG.camera.shot.ghost);
        g.audio.whoosh();
      },
      update(dt) { g.simulate(dt); },
      frame(realDt) {
        g.shooting.updateAim(realDt);
        if (g.input.consume('cancel')) sm.change(S.PLAYING);
      },
      exit(next) {
        g.input.setAimMode(null);
        g.user.setGhost(1);
        g.hud.setAim(false);
        g.host.classList.remove('frozen');
        if (next !== S.SHOT_FLIGHT) {
          g.shooting.endAim();
          g.setTimeScale(1, CONFIG.shot.unfreezeTime);
        }
      },
    });

    sm.add(S.SHOT_FLIGHT, {
      enter() {
        g.setTimeScale(1, CONFIG.shot.unfreezeTime);
        g.camRig.setMode('flight', { origin: g.shooting.flight ? g.shooting.flight.origin : g.ball.pos.clone() });
        g.setControls(false, true);
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
        if (outcome === 'GOAL') {
          g.audio.roar();
          g.audio.net();
          g.camRig.addShake(CONFIG.juice.goalShake);
          g.effects.burstConfetti({ x: CONFIG.pitch.length / 2 - 4, z: g.ball.pos.z });
          g.camRig.setMode('goalview', { z: g.ball.pos.z });
          g.audio.setCrowd(1);
        } else {
          if (outcome === 'SAVED' || outcome === 'POST') g.audio.ooh();
          else if (outcome === 'OFF_TARGET' || outcome === 'BLOCKED') g.audio.groan();
          g.audio.whistle(outcome === 'TIME_UP' || outcome === 'TACKLED' || outcome === 'INTERCEPTED' || outcome === 'OUT');
        }
      },
      update(dt) { g.simulate(dt, 'result'); },
      frame(realDt) {
        const goal = g.resultOutcome === 'GOAL';
        if (g.resultPhase === 'live') {
          if (goal && sm.time > 1.3 && g.camRig.mode === 'goalview') g.camRig.setMode('celebrate', { target: g.user.pos });
          if (goal && sm.time > 2.4 && g.pendingResult) {
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
