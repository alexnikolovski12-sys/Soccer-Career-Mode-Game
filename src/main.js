// Bootstrap, fixed-timestep game loop and the game state machine.
// Breakaway — full 11-a-side matches (Ultimate Team). Home attacks +x (left → right).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Loop } from './core/Loop.js';
import { StateMachine, STATES } from './core/StateMachine.js';
import { Input } from './core/Input.js';
import { Audio } from './core/Audio.js';
import { Quality } from './core/Quality.js';
import { makeRng, dist2D } from './core/MathUtil.js';
import { Weather } from './world/Weather.js';
import { Look, TIMES } from './world/Look.js';
import { FloodShadows } from './world/FloodShadows.js';
import { Post } from './world/Post.js';
import { Pitch } from './world/Pitch.js';
import { CameraRig } from './world/Camera.js';
import { Effects } from './world/Effects.js';
import { Player } from './entities/Player.js';
import { HUMAN_FX } from './entities/HumanBody.js';
import { Ball } from './entities/Ball.js';
import { Keeper } from './entities/Keeper.js';
import { TeamAI, FORMATIONS } from './ai/TeamAI.js';
import { Possession } from './gameplay/Possession.js';
import { Passing } from './gameplay/Passing.js';
import { Shooting } from './gameplay/Shooting.js';
import { Skills } from './gameplay/Skills.js';
import { Match } from './gameplay/Match.js';
import { Replay } from './gameplay/Replay.js';
import { HUD } from './ui/HUD.js';
import { ShotOverlay } from './ui/ShotOverlay.js';
import { DebugPanel } from './debug/DebugPanel.js';
import { UltimateTeam } from './ut/UltimateTeam.js';
import { TEAMS, randomLook, statsFromRating } from './data/playerStats.js';

class Events {
  constructor() { this.map = {}; }
  on(name, fn) { (this.map[name] || (this.map[name] = [])).push(fn); }
  emit(name, data = {}) { const l = this.map[name]; if (l) for (const fn of l) fn(data); }
}

const easeInOut = (t) => t * t * (3 - 2 * t);
const CELEBRATIONS = ['kneeslide', 'kneeslide', 'bellyslide', 'airplane', 'jumpfist', 'spinjump', 'pointsky', 'cuptheear',
  'shush', 'armscrossed', 'salute', 'calmdown', 'heart', 'badgepoint', 'robot', 'backflip'];

class Game {
  constructor() {
    this.host = document.getElementById('game');
    this.uiRoot = document.getElementById('ui');
    this.layer = document.getElementById('touch-layer');
    this.config = CONFIG; // handy for console tuning: game.config.shot.wobbleScale = 0
    this.events = new Events();
    this.rng = makeRng((Math.random() * 2 ** 31) | 0);
    this.simTime = 0;
    this.realTime = 0;
    this.lastPasser = null;

    // ---- renderer
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.host.appendChild(r.domElement);
    this.renderer = r;
    this.scene = new THREE.Scene();

    this.camRig = new CameraRig();
    this.pitch = new Pitch(this.scene);
    this.weather = new Weather(this.scene, this.pitch);
    this.look = new Look(r, this.scene, this.pitch);
    this.floodShadows = new FloodShadows(this.scene, 26);
    this.post = new Post(r);
    this.setLook('night', 'clear');
    this.effects = new Effects(this.scene);
    this.ball = new Ball(this.scene);
    // free kick aim line (ball → goal) and its target ring
    {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
      this.aimLine = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.6, gapSize: 0.35, transparent: true, opacity: 0.95, depthTest: false }));
      this.aimLine.renderOrder = 20; this.aimLine.visible = false;
      this.aimRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, side: THREE.DoubleSide }));
      this.aimRing.rotation.y = Math.PI / 2; this.aimRing.renderOrder = 21; this.aimRing.visible = false;
      this.scene.add(this.aimLine, this.aimRing);
    }

    // ---- two full squads (index 0 = keeper). The squads' looks/stats are set per match.
    const rng = makeRng(20240611);
    const mk = (id, team, role, n, kit) => new Player(this.scene, {
      id, team, role, rating: 70, name: '', look: { ...randomLook(rng, kit, n), height: role === 'gk' ? 1.9 : rng.range(1.74, 1.9) },
      stats: statsFromRating(70, rng),
    });
    this.homeSquad = [mk('h0', 'home', 'gk', 1, TEAMS.home.kit)];
    this.awaySquad = [mk('a0', 'away', 'gk', 1, TEAMS.away.keeperKit)];
    for (let i = 1; i < 11; i++) {
      this.homeSquad.push(mk(`h${i}`, 'home', 'mate', i + 1, TEAMS.home.kit));
      this.awaySquad.push(mk(`a${i}`, 'away', 'def', i + 1, TEAMS.away.kit));
    }
    this.homeKeeperPlayer = this.homeSquad[0];
    this.keeperPlayer = this.awaySquad[0];
    this.keeper = new Keeper(this, this.keeperPlayer, 1);         // guards +x (you attack it)
    this.homeKeeper = new Keeper(this, this.homeKeeperPlayer, -1); // your keeper, guards −x
    this.user = this.homeSquad[10];
    this.user.setControlled(true);
    // referee: all black, follows play; shows cards after fouls
    this.ref = new Player(this.scene, {
      id: 'ref', team: 'ref', role: 'ref', rating: 72, name: 'REF',
      look: { kitColour: '#151515', shortsColour: '#151515', socksColour: '#151515', skinTone: '#c68a5e', hairColour: '#1a1310', bootColour: '#0e0e0e', height: 1.82, number: -1, accent: '#2a2a2a', sponsor: -1 },
      stats: statsFromRating(72, rng),
    });
    this.ref.place(0, -18, Math.PI / 2);
    this.cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.15), new THREE.MeshBasicMaterial({ color: 0xffd400, side: THREE.DoubleSide }));
    this.cardMesh.visible = false;
    this.scene.add(this.cardMesh);
    // the subs bench, only used to mob the scorer after a big late goal
    const bib = { kitColour: '#ff7a1a', shortsColour: '#1b2a4a', socksColour: '#f2f4f8', accent: '#1b2a4a' };
    this.extraPool = [12, 14, 15, 17, 18, 20].map((n, i) => {
      const p = new Player(this.scene, { id: `x${i}`, team: 'home', role: 'mate', rating: 70, look: randomLook(rng, bib, n), stats: statsFromRating(70, rng) });
      p.setVisible(false);
      p.isSub = true;
      return p;
    });
    this.extras = [];
    this._rebuildLists();

    // ---- systems
    this.audio = new Audio();
    this.possession = new Possession(this);
    this.passing = new Passing(this);
    this.shooting = new Shooting(this);
    this.skills = new Skills(this);
    this.setPiece = null;
    this.homeAI = new TeamAI(this, 'home');
    this.awayAI = new TeamAI(this, 'away');
    this.teammateAI = this.homeAI; // older call sites
    this.replay = new Replay(this);
    this.input = new Input(this.layer, this.uiRoot);
    this.input.anyInteraction = () => this.audio.unlock();
    this.overlay = new ShotOverlay(this.uiRoot, this.scene);
    this.hud = new HUD(this.uiRoot, this.input, {
      pause: () => (this.sm.is(STATES.PAUSED) ? this.resume() : this.pause()),
      resume: () => this.resume(),
      quit: () => this.quitMatch(),
      mute: () => { this.audio.setMuted(!this.audio.muted); this.hud.setMuted(this.audio.muted); },
      debug: () => this.debug.toggle(),
      cancelShot: () => {},
      next: () => this.continueMatch(),
      fkAction: (a) => { if (this.setPiece && this.setPiece.fk) this.setPiece.fkAction = a; },
      retry: () => {},
    });
    this.hud.setMuted(this.audio.muted);
    this.match = new Match(this);
    this.moments = this.match;       // older call sites (rating hooks)
    this.quality = new Quality((lvl) => this.applyQuality(lvl));
    this.debug = new DebugPanel(this, this.uiRoot);
    this.ut = new UltimateTeam(document.getElementById('app'), this);

    this.ts = null;
    // your strike leaves the boot on its contact frame → shot camera
    this.onShotFired = (p) => { if (this.sm.is(STATES.PLAYING) && (!p || p.team === 'home')) this.sm.change(STATES.SHOT_FLIGHT); };
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
      if (this.sm.is(STATES.GOAL) && this.goalPhase === 'replay') this._endReplay();
    });

    this.applyQuality(this.quality.current);
    this._resize();
    this.sm.change(STATES.LOADING);
    this.loop.start();
  }

  // ------------------------------------------------------------ world helpers
  _rebuildLists() {
    const u = this.user;
    this.teammates = this.homeSquad.slice(1).filter((p) => p !== u && p.visible && !p.sentOff);
    this.defenders = this.awaySquad.slice(1).filter((p) => p.visible && !p.sentOff);
    this.players = [u, ...this.teammates, this.homeKeeperPlayer, ...this.defenders, this.keeperPlayer];
  }
  homePlayers() { return [this.user, ...this.teammates, this.homeKeeperPlayer]; }
  awayPlayers() { return [...this.defenders, this.keeperPlayer]; }
  teammatesOf(p) { return (p.team === 'home' ? this.homePlayers() : this.awayPlayers()).filter((q) => q !== p); }
  opponentsOf(p) { return p.team === 'home' ? this.awayPlayers() : this.homePlayers(); }
  keeperOf(team) { return team === 'home' ? this.homeKeeper : this.keeper; }

  /**
   * Offside line for `team` attacking: the second-last opponent (the last
   * outfield player), never behind the ball or the halfway line.
   */
  offsideLine(team = 'home', strict = false) {
    const ball = this.ball.pos;
    if (team === 'home') {
      let x = 0;
      for (const d of this.defenders) x = Math.max(x, d.pos.x);
      return strict ? Math.max(x, ball.x, 0) : Math.max(x, ball.x, 0);
    }
    let x = 0;
    for (const d of [this.user, ...this.teammates]) x = Math.min(x, d.pos.x);
    return Math.min(x, ball.x, 0);
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
    this.players = [this.user, ...this.teammates, this.homeKeeperPlayer, ...this.defenders, this.keeperPlayer];
    this.lastPasser = null;
    if (!quiet) this.hud.flash(p.name || 'SWITCH', 'neutral');
  }

  /**
   * After a pass you control nobody: the camera follows the ball and the
   * receiver goes to meet it on his own. You take over once he's got it.
   */
  startBallCam(target) {
    this.switchControl(target, true);       // the passer goes back to AI
    this.ballCam = { to: target, t: 0 };
    target.setMarkerVisible(false);
  }

  _endBallCam() {
    if (!this.ballCam) return;
    this.ballCam = null;
    if (this.user) this.user.setMarkerVisible(true);
  }

  /**
   * A cross to a teammate in the box: as it drops he attacks it in the air —
   * volley, side volley or bicycle kick depending on height and angle — and
   * buries it in the corner.
   */
  _crossFinish(dt) {
    const ball = this.ball, ps = ball.pass, F = this.finishing;
    if (F) {
      F.t += dt;
      const r = F.r;
      r.steer(0, 0, 0);
      if (F.t >= F.at && !F.done) {
        F.done = true;
        const P = CONFIG.pitch, gx = P.length / 2, hw = P.goalWidth / 2;
        const kz = this.keeperPlayer.pos.z, bz = ball.pos.z;
        // from a tight angle always go far post; otherwise away from the keeper
        let side = Math.abs(bz) > 4 ? -Math.sign(bz) : Math.abs(kz) > 0.3 ? (kz > 0 ? -1 : 1) : (this.rng.chance(0.5) ? 1 : -1);
        ball.frozen = false;
        const maxSp = CONFIG.statMap.maxShotSpeed(r.stats.shotPower) * 1.0;
        // try a few safe spots well inside the posts/bar until the path is clean
        let launch = null;
        const tries = [[side, hw - 1.0, 0.6 + this.rng.next() * 0.9], [side, hw - 1.4, 0.9], [-side, hw - 1.2, 0.8], [0, 0, 1.0]];
        for (const [sd, zz, yy] of tries) {
          const T = new THREE.Vector3(gx, yy, sd * zz);
          const L = this.shooting.solve(ball.pos.clone(), T, maxSp * 0.92, 0);
          const res = L.result;
          if (res.onTarget && res.edgeDistance > 0.35 && this._pathClearOfPosts(res.path)) { launch = L; break; }
          launch = launch || L;
        }
        launch.result.forceBeat = true;
        const h = r.heading;
        if (this.shooting.fire(r, launch, { kind: 'volley', power: 1, pressure: 0, dist: 12 }) === true) {
          r.heading = r.prevHeading = h;  // keep the acrobatic body shape (fire() turns him to the shot)
          for (const d of this.defenders) this.shooting.flight.blocked.add(d);
          this.camRig.addShake(0.35);
          this.audio.kick(1, 'driven');
          this.finishing = null;
          this.sm.change(STATES.SHOT_FLIGHT);
          this.setTimeScale(1, 0.7);
        }
      }
      return;
    }
    if (!ps || !ps.finish || ball.owner || !ps.to) return;
    const r = ps.to;
    const hd = Math.hypot(ball.pos.x - r.pos.x, ball.pos.z - r.pos.z);
    const dropping = ball.vel.y < 0 && ball.pos.y < 2.5 && ball.pos.y > 0.3;
    if (!(dropping && hd < 2.6) && !(ball.pos.y <= 0.3 && hd < 3.0)) return;
    // pick the finish from the ball's height and the angle it arrives at
    const gx = CONFIG.pitch.length / 2;
    const toGoal = Math.atan2(gx - r.pos.x, 0 - r.pos.z);
    const from = Math.atan2(-ball.vel.x, -ball.vel.z);           // direction the ball is coming from
    const ang = Math.abs(Math.atan2(Math.sin(from - toGoal), Math.cos(from - toGoal)));
    // decide once per cross whether he goes overhead; otherwise wait for it to drop a bit
    if (ps.overhead == null) ps.overhead = this.rng.chance(0.35);
    if (ball.pos.y > 1.5 && !ps.overhead && hd > 0.8) return;
    let type;
    if (ball.pos.y > 1.5) type = 'bicycle';
    else if (ball.pos.y > 0.75 && ang > 0.8) type = 'sidevolley';
    else type = 'volley';
    // body shape: facing goal for a volley, side-on for a side volley, back to goal for a bicycle
    const sgn = Math.sign(Math.sin(from - toGoal)) || 1;
    const heading = type === 'bicycle' ? toGoal + Math.PI : type === 'sidevolley' ? toGoal - sgn * 1.2 : toGoal;
    this.switchControl(r, true);
    this._endBallCam();
    r.place(ball.pos.x - Math.sin(heading) * 0.55, ball.pos.z - Math.cos(heading) * 0.55, heading);
    r.savePrev();
    const dur = type === 'bicycle' ? 1.3 : 0.8;
    r.playAction(type, dur, { kickLeg: 1 });
    ball.vel.set(0, 0, 0);
    ball.frozen = true;                      // hangs for the strike
    this.finishing = { r, t: 0, at: dur * 0.4, type, done: false };
    this.setTimeScale(0.3, 0.08);            // slow-mo on the contact
    this.hud.flash(type === 'bicycle' ? 'BICYCLE KICK!' : type === 'sidevolley' ? 'SIDE VOLLEY!' : 'VOLLEY!', 'good');
    this.audio.anticipate();
  }

  /** Does a predicted shot path stay clear of the posts and crossbar? */
  _pathClearOfPosts(path) {
    if (!path) return true;
    const P = CONFIG.pitch, gx = P.length / 2, hw = P.goalWidth / 2, H = P.goalHeight;
    for (const pt of path) {
      if (pt.x < gx - 3 || pt.x > gx + 0.3) continue;
      for (const pz of [-hw, hw]) if (Math.hypot(pt.x - gx, pt.z - pz) < 0.45 && pt.y < H + 0.2) return false;
      if (Math.abs(pt.x - gx) < 0.4 && Math.abs(pt.y - H) < 0.35 && Math.abs(pt.z) < hw + 0.2) return false;
    }
    return true;
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

  /**
   * A foul. On you (or a teammate): the referee's card, then your free kick /
   * penalty (set-piece flow). By your team: the opposition's free kick or penalty.
   */
  onFoul({ by, victim }) {
    if (!this.sm.is(STATES.PLAYING) || this.setPiece || this.match.restart) return;
    const L = CONFIG.pitch.length / 2, P = CONFIG.pitch;
    const x = this.ball.pos.x, z = this.ball.pos.z;
    this.match.stats[by.team].fouls++;
    if (victim.team === 'away') {
      // you gave it away: their free kick (or a penalty in your box)
      const pen = x < -L + P.penaltyDepth && Math.abs(z) < P.penaltyWidth / 2;
      victim.stayDown = false;
      const card = this.rng.next() < 0.18 ? 'Y' : null;
      if (card) { this.hud.showBig('YELLOW CARD', 'neutral', 1.4); this.match.cards[by.id] = 'Y'; }
      if (by.isUser) this.match.userRating -= pen ? 0.5 : 0.1;
      this.audio.whistle(false);
      if (pen) { this.hud.showBig('PENALTY', 'bad', 1.4); this.match.startRestart('penalty', 'away', -L + 11, 0, { quiet: true }); }
      else this.match.startRestart('freekick', 'away', x, z);
      return;
    }
    const penalty = x > L - P.penaltyDepth && Math.abs(z) < P.penaltyWidth / 2;
    // the referee's decision: mostly yellow, sometimes straight red (more likely from behind), 2nd yellow = red
    const cards = this.match.cards;
    const behind = (by.pos.x - victim.pos.x) * Math.sin(victim.heading) + (by.pos.z - victim.pos.z) * Math.cos(victim.heading) < 0;
    let card = this.rng.next() < (behind ? 0.16 : 0.05) ? 'R' : this.rng.next() < 0.45 ? 'Y' : null;
    if (card === 'Y' && cards[by.id] === 'Y') card = 'R2';
    victim.stayDown = true;
    this.setPiece = { phase: 'down', t: CONFIG.setPiece.downTime, penalty, victim, offender: by, card, spot: { x, z } };
    this.skills.reset();
    this.passing.reset();
    by.stumble = 0;
    this.hud.showBig(penalty ? 'PENALTY!' : 'FOUL — FREE KICK', 'good');
    this.hud.setButtonMode('none');
    this.input.joystick.setVisible(false);
    this.audio.whistle(false);
    this.audio.boo();
    this.camRig.addShake(0.08);
  }

  _setUpFreeKick() {
    const sp = this.setPiece, S = CONFIG.setPiece, L = CONFIG.pitch.length / 2, P = CONFIG.pitch, W = CONFIG.pitch.width / 2;
    const ball = this.ball;
    // penalties: your best finisher; free kicks: whoever was fouled
    if (sp.penalty) {
      const best = [this.user, ...this.teammates].reduce((b, p) => (p.stats.finishing > b.stats.finishing ? p : b), this.user);
      this.switchControl(best, true);
    } else if (sp.victim.team === 'home' && !sp.victim.isKeeper) this.switchControl(sp.victim, true);
    const u = this.user;
    let x = sp.penalty ? L - 11 : Math.min(sp.spot.x, L - 1.5);
    let z = sp.penalty ? 0 : Math.max(-W + 1, Math.min(W - 1, sp.spot.z));
    const dGoal = Math.hypot(L - x, z) || 1;
    const ux = (L - x) / dGoal, uz = -z / dGoal;     // ball → goal centre
    const heading = Math.atan2(ux, uz);
    ball.reset(x, z);
    ball.owner = u; ball.lastTouch = u; ball.pass = null;
    ball.lastKick = { type: 'control', by: u, time: this.simTime };
    // stand back and a little to the left of the ball: the taker runs up (see Shooting._startStrike)
    const ru = CONFIG.shot.runUpDistance;
    this._reposition(u, x - ux * ru + uz * 0.5, z - uz * ru - ux * 0.5, heading);
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
    this.hud.flash(sp.penalty ? 'PENALTY — TIME IT!' : sp.shoot ? 'FREE KICK — HOLD SHOOT' : 'FREE KICK', 'good');
  }

  /** Move some players during a stoppage (savePrev already done). */
  _stepPlayers(dt, list) {
    for (const p of list) p.integrate(dt, false);
  }

  /** The referee jogs over to the foul, then shows the card. */
  _refToFoul(dt) {
    const sp = this.setPiece, r = this.ref, o = sp.offender;
    r.savePrev();
    const tx = o.pos.x + (sp.victim.pos.x - o.pos.x) * 0.5 - 2.2, tz = o.pos.z + (o.pos.z > r.pos.z ? -2.2 : 2.2);
    const d = r.moveTo(tx, tz, r.runSpeed * 0.9, 1.2);
    r.faceTowards(o.pos.x, o.pos.z);
    r.integrate(dt, false);
    // the offender stands there waiting, facing the ref
    o.steer(0, 0, 0); o.faceTowards(r.pos.x, r.pos.z);
    if (!sp.card && (d < 0.6 || sp.t <= 0)) { sp.phase = 'card'; sp.t = 0.3; sp.cardT = 0; r.steer(0, 0, 0); return; }
    if (d < 0.6 || sp.t <= 0) {
      sp.phase = 'card'; sp.t = 2.2; sp.cardT = 0;
      r.steer(0, 0, 0);
      r.playAction('card', 2.0, { kickLeg: 1 });
      const red = sp.card !== 'Y';
      this.cardMesh.material.color.set(red ? 0xe0161f : 0xffd400);
      const num = o.look.number;
      this.hud.showBig(red ? 'RED CARD' : 'YELLOW CARD', red ? 'bad' : 'neutral', 1.8);
      this.hud.flash(`${o.name || TEAMS.away.short + ' #' + num}${sp.card === 'R2' ? ' — SECOND YELLOW' : ''}${red ? ' — SENT OFF!' : ' — BOOKED'}`, red ? 'good' : 'neutral');
      this.audio.whistle(false);
      this.audio.boo();
      if (red) this.audio.cheer(0.9);
      this.match.cards[o.id] = red ? 'R' : 'Y';
      this.camRig.setMode('celebrate', { target: r.pos, angle: 0.5 });
    }
  }

  _cardPhase(dt) {
    const sp = this.setPiece, r = this.ref;
    sp.cardT += dt;
    r.savePrev(); r.steer(0, 0, 0); r.faceTowards(sp.offender.pos.x, sp.offender.pos.z); r.integrate(dt, false);
    this.cardMesh.visible = !!sp.card && sp.cardT > 0.25 && sp.cardT < 2.0;
    // a red card: he trudges off toward the touchline while it's shown
    if (sp.card && sp.card !== 'Y' && sp.cardT > 0.9) {
      const o = sp.offender, W = CONFIG.pitch.width / 2;
      o.savePrev();
      o.moveTo(o.pos.x, Math.sign(o.pos.z || 1) * (W + 3), o.jogSpeed * 0.7, 1);
      o.integrate(dt, false);
    }
  }

  /** Sent off: gone now and for the rest of the match. */
  _sendOff(d) {
    this.match.sentOff.add(d.id);
    d.sentOff = true;
    d.setVisible(false);
    d.pos.set(0, 0, 80);
    this._rebuildLists();
  }

  /** Card held up in the referee's raised right hand. */
  _cardFrame() {
    if (!this.cardMesh.visible) return;
    const r = this.ref, h = r.heading;
    // right side of the body, at full arm stretch
    this.cardMesh.position.set(r.pos.x - Math.cos(h) * 0.2, 2.42, r.pos.z + Math.sin(h) * 0.2);
    this.cardMesh.lookAt(this.camRig.camera.position);
  }

  /** The referee keeps up with play from a sensible distance, out of the way. */
  _refFollow(dt) {
    const r = this.ref, b = this.ball.pos;
    r.savePrev();
    const W = CONFIG.pitch.width / 2;
    const side = b.z > 0 ? -1 : 1;
    const tx = b.x - 9, tz = Math.max(-W + 3, Math.min(W - 3, b.z + side * 9));
    const d = Math.hypot(tx - r.pos.x, tz - r.pos.z);
    r.moveTo(tx, tz, d > 10 ? r.runSpeed : d > 4 ? r.jogSpeed : r.jogSpeed * 0.5, 3);
    r.faceTowards(b.x, b.z);
    r.integrate(dt, false);
  }

  /** Play's stopped: everyone not involved eases to a standstill (no running on the spot). */
  _settle(dt, skip = null) {
    const sp = this.setPiece;
    for (const p of this.players) {
      if (p === skip || (sp && p === sp.offender && sp.card && sp.card !== 'Y' && sp.phase === 'card')) continue;
      if (sp && p === sp.offender && sp.phase === 'ref') { p.integrate(dt, false); continue; }
      p.steer(0, 0, 0);
      p.integrate(dt, false);
    }
  }

  _setPieceUpdate(dt) {
    const sp = this.setPiece;
    for (const p of this.players) p.savePrev();
    this.ball.savePrev();
    this._settle(dt);
    sp.t -= dt;
    if (sp.phase === 'ref') { this._refToFoul(dt); return; }
    if (sp.phase === 'card') { this._cardPhase(dt); if (sp.t > 0) return; }
    if (sp.phase === 'getup') { this._stepPlayers(dt, []); if (sp.t > 0) return; }
    if (sp.t > 0) return;
    if (sp.phase === 'down') { sp.phase = 'ref'; sp.t = 4; return; }
    if (sp.phase === 'card') {
      // the fouled player gets up, then it's the free kick / penalty
      sp.phase = 'getup'; sp.t = 1.5;
      sp.victim.stayDown = false;
      this.cardMesh.visible = false;
      if (sp.card && sp.card !== 'Y') this._sendOff(sp.offender);
      this.camRig.setMode('broadcast');
      return;
    }
    if (sp.phase === 'getup') { this._setUpFreeKick(); return; }
    sp.phase = 'ready'; // everyone holds until you take it
    if (!sp.penalty) {
      sp.fk = 'choose';
      this.hud.setButtonMode('none');
      this.hud.fkStage('choose', 'FREE KICK — PASS OR SHOOT?');
    } else this.hud.setButtonMode('shoot');
    this.input.joystick.setVisible(false); // no dribbling at a set piece
    if (sp.penalty) {
      sp.side = this.rng.chance(0.5) ? 1 : -1;
      sp.aimY = this.rng.chance(0.5) ? 0.45 : 1.75;
      sp.meterT = 0;
      sp.meterSize = 1;
    }
  }

  /** Penalty circle: drawn on the corner you're aiming at, shrinking red → green, then again. */
  _penaltyMeterFrame(realDt) {
    const sp = this.setPiece;
    if (!sp || !sp.penalty || sp.phase !== 'ready') { this.hud.setPenaltyMeter(false); return; }
    sp.meterT += realDt;
    const c = CONFIG.shot.penCycle;
    sp.meterSize = 1 - (sp.meterT % c) / c;
    const P = CONFIG.pitch;
    const v = new THREE.Vector3(P.length / 2, sp.aimY, sp.side * (P.goalWidth / 2 - 0.6)).project(this.camRig.camera);
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const u = Math.max(0.82, Math.min(1.2, Math.min(w, h) * 0.0025));
    this.hud.setPenaltyMeter(v.z < 1, (v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h, sp.meterSize, u);
  }

  /** Free kick set: play restarts the moment you touch the stick or a button. */
  _setPieceReady() {
    const inp = this.input, mv = inp.poll();
    if (this.setPiece.penalty) {
      // penalty: only the SHOOT button takes it — timed off the shrinking circle
      inp.consumeGesture('pass'); inp.consumeGesture('through');
      const sg = inp.consumeGesture('shoot');
      for (const p of this.players) p.savePrev();
      this.ball.savePrev();
      this._settle(1 / CONFIG.sim.hz, this.user);
      if (!sg) return false;
      const sp = this.setPiece;
      this.setPiece = null;
      this.match._spT = this.match.clock;
      this.hud.setPenaltyMeter(false);
      this.hud.setButtonMode('all');
      this.input.joystick.setVisible(true);
      if (this.shooting.penalty(this.user, sp.meterSize ?? 1, sp.side, sp.aimY) === true) this.sm.change(STATES.SHOT_FLIGHT);
      return false;
    }
    // free kick: no dribbling — choose PASS or SHOOT, then aim line + power bar
    inp.consumeGesture('pass'); inp.consumeGesture('through'); inp.consumeGesture('shoot');
    void mv;
    const sp = this.setPiece, a = sp.fkAction;
    sp.fkAction = null;
    for (const p of this.players) p.savePrev();
    this.ball.savePrev();
    this._settle(1 / CONFIG.sim.hz, this.user);
    if (!a) return false;
    const u = this.user, F = CONFIG.freeKick, P = CONFIG.pitch;
    if (sp.fk === 'choose' && a === 'pass') {
      this._endFreeKickUI();
      this.setPiece = null;
      const gx = P.length / 2;
      this.shooting.runUpThen(u, () => this.passing.requestUserPass(u, gx - u.pos.x, -u.pos.z * 0.5, 'ground'));
      return true;
    }
    if (sp.fk === 'choose' && a === 'shoot') {
      sp.fk = 'aim'; sp.fkT = 0;
      this.hud.fkStage('aim', 'TAP TO LOCK YOUR AIM');
      return false;
    }
    if (sp.fk === 'aim' && a === 'tap') {
      sp.fk = 'power'; sp.fkT = 0;
      this.hud.fkStage('power', 'TAP IN THE GREEN!');
      return false;
    }
    if (sp.fk === 'power' && a === 'tap') {
      const power = sp.fkPower ?? 0;
      this._endFreeKickUI();
      this.setPiece = null;
      this.match._spT = this.match.clock;
      if (this.shooting.freeKick(u, sp.aimZ ?? 0, power) === true) this.sm.change(STATES.SHOT_FLIGHT);
      return false;
    }
    return false;
  }

  _endFreeKickUI() {
    this.input.joystick.setVisible(true);
    this.hud.fkStage(null);
    this.hud.setButtonMode('all');
    this.aimLine.visible = false; this.aimRing.visible = false;
  }

  /** Per frame: sweep the aim line across the goal, run the power marker. */
  _freeKickFrame(realDt) {
    const sp = this.setPiece;
    if (!sp || !sp.fk || sp.fk === 'choose') { if (this.aimLine.visible && !(sp && sp.fk)) { this.aimLine.visible = false; this.aimRing.visible = false; } return; }
    const F = CONFIG.freeKick, P = CONFIG.pitch;
    const gx = P.length / 2, hw = P.goalWidth / 2;
    sp.fkT += realDt;
    if (sp.fk === 'aim') sp.aimZ = Math.sin((sp.fkT / F.aimPeriod) * Math.PI * 2) * (hw - 0.35);
    if (sp.fk === 'power') {
      const ph = (sp.fkT / F.powerPeriod) % 1;
      sp.fkPower = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      this.hud.fkPower(sp.fkPower, F.zoneLo, F.zoneHi);
    }
    const b = this.ball.pos, z = sp.aimZ ?? 0;
    const pos = this.aimLine.geometry.attributes.position;
    pos.setXYZ(0, b.x, 0.05, b.z); pos.setXYZ(1, gx, 1.2, z);
    pos.needsUpdate = true;
    this.aimLine.computeLineDistances();
    this.aimLine.visible = true;
    this.aimRing.position.set(gx - 0.05, 1.2, z);
    this.aimRing.visible = true;
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

    st.cuts.length = 0;
  }

  /**
   * Change of pace: going from slow / stopped to full speed (or slamming on
   * SPRINT) on the ball knocks it on and explodes away — a defender who was
   * jockeying close is caught flat-footed for a moment.
   */
  _burst(u, mag, dt) {
    const st = this._bs || (this._bs = { slowT: 0, cd: 0, sprintWas: false });
    st.cd = Math.max(0, st.cd - dt);
    const has = this.ball.owner === u && this.sm.is(STATES.PLAYING);
    const slow = u.speed < 3.2;
    if (slow) st.slowT = Math.min(1, st.slowT + dt); else st.slowT = Math.max(0, st.slowT - dt * 0.5);
    const sprintPress = u.sprinting && !st.sprintWas;
    st.sprintWas = u.sprinting;
    if (!has || st.cd > 0) return;
    if ((st.slowT > 0.25 && mag > 0.92) || (sprintPress && u.speed < 5)) {
      st.cd = 1.4; st.slowT = 0;
      u.cutBoost = 0.5;           // extra acceleration (Player.integrate)
      u.burstTouch = true;        // next touch knocks it on
      u.touchCooldown = 0;
      this.camRig.addShake(0.03);
      let caught = 0;
      for (const d of this.defenders) {
        const dd = Math.hypot(d.pos.x - u.pos.x, d.pos.z - u.pos.z);
        if (dd > 3.2 || d.stumble > 0) continue;
        const p = 0.45 + (u.stats.acceleration - d.rating) / 120;
        if (this.rng.next() < p) { d.stumble = 0.38; d.ai.tackling = null; d.tackleCooldown = Math.max(d.tackleCooldown, 0.8); caught++; }
      }
      if (caught) this.audio.skillCheer();
    }
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

  // ------------------------------------------------------------ look
  /** Time of day (night / dusk / day) × weather (clear / rain / snow). */
  setLook(time, weather) {
    this.look.set(time, weather);
    this.weather.set(weather, this.quality && this.quality.current && !this.quality.current.post ? 0.5 : 1);
    this.floodShadows.setStrength(this.look.flood);
    const night = this.look.flood > 0.5;
    this.post.setLook({ exposure: this.look.exposure, bloom: night ? 0.55 : 0.32, thresh: night ? 1.15 : 1.4, sat: time === 'day' ? 1.05 : 1.1, contrast: 0.12 });
    this.matchTime = time; this.matchWeather = weather;
    HUMAN_FX.wet.value = weather === 'rain' ? 1 : 0;
  }

  /** Draw the frame: through the post chain on the higher quality levels. */
  renderFrame(cam = this.camRig.camera) {
    if (this.post.enabled) this.post.render(this.scene, cam, this.realTime);
    else { this.renderer.setRenderTarget(null); this.renderer.render(this.scene, cam); }
  }

  // ------------------------------------------------------------ quality
  applyQuality(lvl) {
    const r = this.renderer;
    const changed = r.shadowMap.enabled !== lvl.shadows;
    r.shadowMap.enabled = lvl.shadows;
    this.pitch.sun.castShadow = lvl.shadows;
    for (const p of [...this.homeSquad, ...this.awaySquad, this.ref]) p.setShadows(lvl.shadows);
    this.ball.mesh.castShadow = lvl.shadows;
    this.pitch.setCrowdQuality(lvl.crowd === 'full');
    this.post.enabled = !!lvl.post;
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


  /** The opposition has it (or it's loose after they lost it): you're defending. */
  _defending() {
    const ball = this.ball;
    if (ball.owner) return ball.owner.team === 'away';
    if (ball.pass && ball.pass.from) return ball.pass.from.team === 'away';
    return false;
  }

  /**
   * Defending: SWITCH (pass button) to the best-placed player, TACKLE (shoot
   * button) when you're on him, hold PRESS (through button) to send a teammate
   * in as well. Close to the carrier you jockey — face him, stay goal-side.
   */
  _defendControl(u, pg, tg, sg, wx, wz, mag, dt) {
    const ball = this.ball, c = ball.owner && ball.owner.team === 'away' ? ball.owner : null;
    this.homeAI.pressHeld = !!this.input.held.through;
    if (pg) this._switchBest();
    if (sg && this.user === u && u.tackleCooldown <= 0 && !u.ai.tackling) {
      const target = c || (ball.pass && ball.pass.to) || null;
      if (target && dist2D(u.pos, target.pos) < 3.2) {
        this.homeAI.startTackle(u, target, dist2D(u.pos, target.pos) > 1.8 || u.speed > 5);
      } else {
        // lunge at the ball wherever it is
        u.playAction('tackle', 0.5, { variant: 'stand' });
        u.tackleCooldown = 0.6;
      }
    }
    if (u.ai.tackling) {
      // committed: carried along by the lunge
      const t = u.ai.tackling.target;
      u.steer(t.pos.x - u.pos.x, t.pos.z - u.pos.z, u.attrs.sprintSpeed * 1.05);
      this.homeAI.tackleStep(u, dt);
    }
    // jockey: near the carrier and not sprinting, keep facing him
    if (c && !u.sprinting && dist2D(u.pos, c.pos) < 5.5) { u.faceTowards(c.pos.x, c.pos.z); u.jockey = true; }
    // auto-switch when you're out of the play and someone's much better placed
    this._autoSwitchT = (this._autoSwitchT || 0) - dt;
    // (standing still: from 10 m; while you're steering him: only when he's really out of it)
    if (this._autoSwitchT <= 0 && !u.ai.tackling && dist2D(u.pos, ball.pos) > (mag < 0.3 ? 10 : 16)) { this._switchBest(true); this._autoSwitchT = 1.2; }
  }

  /** Switch to the home outfielder best placed to get to the ball (goal-side preferred). */
  _switchBest(quiet = false) {
    const ball = this.ball, u = this.user;
    const tgt = ball.owner || (ball.pass && ball.pass.to) || null;
    const bx = tgt ? tgt.pos.x : ball.pos.x, bz = tgt ? tgt.pos.z : ball.pos.z;
    let best = null, bs = Infinity;
    for (const p of this.teammates) {
      if (p.stumble > 0.3 || p.ai.tackling) continue;
      let s = Math.hypot(p.pos.x - bx, p.pos.z - bz);
      if (p.pos.x < bx) s -= 2.5;                 // goal-side (your goal is at −x)
      if (s < bs) { bs = s; best = p; }
    }
    if (!best) return;
    const cur = Math.hypot(u.pos.x - bx, u.pos.z - bz) - (u.pos.x < bx ? 2.5 : 0);
    if (quiet && bs > cur - 6) return;
    if (best) { this.switchControl(best, true); this.effects.showMarker(best); }
  }

  /** A keeper has held it long enough: roll / throw / kick it to a teammate. */
  keeperDistribute(k) {
    if (this.match.restart || this.setPiece) return;
    const p = k.p, ball = this.ball, s = k.s > 0 ? -1 : 1; // direction his team attacks
    const mates = this.teammatesOf(p).filter((q) => !q.isKeeper && q.visible && !q.sentOff);
    if (!mates.length) return;
    k.release();
    ball.owner = p; ball.lastTouch = p;
    ball.pos.set(p.pos.x + s * 0.6, CONFIG.ball.radius, p.pos.z);
    const long = this.rng.chance(0.4);
    const pool = mates.filter((q) => (long ? s * q.pos.x > -10 : s * q.pos.x < -12));
    const list = pool.length ? pool : mates;
    // open players first
    list.sort((a, b) => this._openness(b) - this._openness(a));
    const t = list[Math.min(list.length - 1, Math.floor(this.rng.next() * 2))];
    if (long) { this.passing.requestAIPass(p, t, 'lofted'); return; }
    // short: overarm throw out to a defender
    ball.pos.set(p.pos.x + s * 0.3, 2.0, p.pos.z);
    this.match._throw(p, t);
    p.playAction('gkthrow', 0.7);
  }

  _openness(p) {
    let n = 99;
    for (const o of this.opponentsOf(p)) if (!o.isKeeper) n = Math.min(n, dist2D(o.pos, p.pos));
    return n;
  }

  // ------------------------------------------------------------ events
  _wireEvents() {
    const ev = this.events;
    ev.on('tackleWon', ({ victim, by }) => {
      if (victim === this.user) this.camRig.addShake(0.12);
      if (by) this.effects.turf(by.pos.x, by.pos.z, Math.sin(by.heading), Math.cos(by.heading), by.anim && by.anim.variant === 'slide' ? 1.2 : 0.4, this.matchWeather === 'rain');
      if (victim && victim.team === 'home') this.audio.groan(0.8);
      if (by && by.team === 'home') this.audio.cheer(0.5);
    });
    ev.on('save', ({ type }) => {
      this.audio.ooh();
      this.camRig.addShake(0.1);
      if (type === 'parry') this.audio.kick(0.6);
    });
    ev.on('pass', ({ from, speed }) => {
      this.lastPasser = from;
      if (from === this.user) this.effects.puff(this.ball.pos.x, this.ball.pos.z);
      if (speed > 18 || this.matchWeather === 'rain') this.effects.turf(this.ball.pos.x, this.ball.pos.z, 0, 0, speed > 18 ? 0.5 : 0.3, this.matchWeather === 'rain');
    });
    ev.on('shot', ({ shooter, power }) => {
      const b = this.ball.pos, h = shooter ? shooter.heading : 0;
      this.effects.turf(b.x, b.z, Math.sin(h) * 0.6, Math.cos(h) * 0.6, 0.6 + (power || 0.6) * 0.6, this.matchWeather === 'rain');
    });
    // FC-style switching: whichever of your teammates gets the ball, you now control them
    ev.on('gain', ({ player }) => {
      player.ai.holdT = 0; player.ai.decideAt = null; player.ai.carry = null;
      if (player.team === 'home' && !player.isKeeper) { this._endBallCam(); this.switchControl(player, true); }
      // they've won it: hand you whoever's best placed to get it back
      else if (player.team === 'away' && !this.autoplay && this.sm.is(STATES.PLAYING)) { this._autoSwitchT = 1.2; this._switchBest(true); }
      if (this.sm.is(STATES.SHOT_FLIGHT)) this.backToPlay();
    });
    ev.on('keeperHold', () => { if (this.sm.is(STATES.SHOT_FLIGHT)) this.backToPlay(); });
    ev.on('foul', (e) => this.onFoul(e));
    ev.on('beatDefender', ({ by }) => { if (by && by.team === 'home') this.audio.skillCheer(); });
  }

  backToPlay() { if (this.sm.is(STATES.SHOT_FLIGHT)) this.sm.change(STATES.PLAYING); }

  // ------------------------------------------------------------ simulation
  simulate(dt, mode = 'play') {
    const ball = this.ball;
    for (const p of this.players) { p.savePrev(); p.jockey = false; }
    ball.savePrev();
    ball.events.length = 0;

    if (mode === 'play') {
      this.syncControl(false);
      this._crossFinish(dt);
      if (this.ballCam) {
        this.ballCam.t += dt;
        const ps = this.ball.pass;
        if (this.ball.owner || !ps || ps.to !== this.ballCam.to || this.ballCam.t > 4) this._endBallCam();
      }
      if (!this.autoplay) this.userControl(dt);
      else if (this.match.restart && this.match.restart.taker === this.user && this.match.restart.phase === 'ready') this.user.steer(0, 0, 0);
      this.skills.update(dt);
      this.homeAI.update(dt);
      this.awayAI.update(dt);
      this.keeper.update(dt);
      this.homeKeeper.update(dt);
      this.shooting.update(dt);
      this.passing.update(dt);
    } else {
      this._goalControl(dt);
      this.keeper.update(dt);
      this.homeKeeper.update(dt);
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
    if (mode === 'play') this._refFollow(dt); else { this.ref.savePrev(); this.ref.steer(0, 0, 0); this.ref.integrate(dt, false); }
    for (const e of ball.events) {
      if (e.type === 'net') {
        this.pitch.nets[Math.sign(e.x) || 1].hit(e.x, e.y, e.z, e.v);
        if (e.v > 4) this.audio.net();
      }
    }
    if (mode === 'play' && this.shooting.flight) this.shooting.flightUpdate(dt);
    if (mode === 'play') this.match.update(dt);
    this.simTime += dt;
  }

  userControl(dt) {
    const u = this.user, ball = this.ball, D = CONFIG.dribble, M = CONFIG.statMap;
    if (this.finishing) { u.steer(0, 0, 0); this.input.consumeGesture('pass'); this.input.consumeGesture('through'); this.input.consumeGesture('shoot'); return; }
    const mv = this.input.poll();
    if (this.ballCam || this.finishing) {
      // nobody under your control while the pass travels: the receiver goes to meet it
      mv.x = 0; mv.y = 0; mv.mag = 0;
      this.input.consumeGesture('pass'); this.input.consumeGesture('through'); this.input.consumeGesture('shoot');
    }
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
    this._burst(u, mag, dt);

    // you're on the receiver as soon as a pass is played: get to it
    if (ball.pass && ball.pass.to === u && mag < 0.6) {
      if (ball.pass.kind && ball.pass.kind !== 'ground') {
        this.homeAI.receive(u);
        speed = u.moveSpeed; wx = u.moveDir.x; wz = u.moveDir.z;
      } else {
        const v = ball.vel, sp = Math.hypot(v.x, v.z) || 1;
        const along = ((u.pos.x - ball.pos.x) * v.x + (u.pos.z - ball.pos.z) * v.z) / sp;
        const t = Math.max(0, along - CONFIG.pass.meetDistance);
        const tx = ball.pos.x + (v.x / sp) * t, tz = ball.pos.z + (v.z / sp) * t;
        wx = tx - u.pos.x; wz = tz - u.pos.z;
        speed = Math.hypot(wx, wz) > 0.3 ? u.runSpeed : 0;
        if (speed === 0) u.faceTowards(ball.pos.x, ball.pos.z);
      }
    } else if (mag < 0.05) {
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
    // dribbling: the stick says where you WANT to take it; if the ball's run away
    // from your feet he bends his run to get back on it (and the next touch then
    // takes it your way) — the ball never comes back on its own
    u.wantDir = null;
    if (ball.owner === u && mag > 0.05 && speed > 0 && !this.shooting.strike) {
      const wl = Math.hypot(wx, wz) || 1;
      u.wantDir = { x: wx / wl, z: wz / wl };
      const lead = 0.25, px = ball.pos.x + ball.vel.x * lead - u.pos.x, pz = ball.pos.z + ball.vel.z * lead - u.pos.z;
      const pd = Math.hypot(px, pz), bd = dist2D(u.pos, ball.pos);
      const w = Math.max(0, Math.min(0.9, (bd - 0.85) / 1.1));
      if (w > 0 && pd > 0.01) { wx = (wx / wl) * (1 - w) + (px / pd) * w; wz = (wz / wl) * (1 - w) + (pz / pd) * w; }
    }
    const strike = this.shooting.strike;
    if (strike && strike.shooter === u) {
      // mid-strike: plant and hit it (a set piece run-up is driven by Shooting)
      if (strike.setPiece) speed = 0; else speed = Math.min(speed, u.speed * 0.55);
    }
    u.steer(wx, wz, speed);

    const inp = this.input;
    if (!this.sm.is(STATES.PLAYING)) { inp.consumeGesture('pass'); inp.consumeGesture('through'); inp.consumeGesture('shoot'); return; }
    const pg = inp.consumeGesture('pass'), tg = inp.consumeGesture('through'), sg = inp.consumeGesture('shoot');
    // your team's restart: PASS / THROUGH takes it in the stick direction
    const R = this.match.restart;
    if (R && R.team === 'home' && R.phase === 'ready' && R.taker === u) {
      u.steer(0, 0, 0);
      if (pg || tg) {
        const l = Math.hypot(wx, wz);
        const dir = l > 0.2 ? { x: wx / l, z: wz / l } : null;
        this.match.takeRestart(tg ? 'through' : (pg.dir === 'up' || pg.dir === 'down') ? 'lofted' : 'ground', dir);
      }
      return;
    }
    if (R) return;
    if (this._defending()) { this._defendControl(u, pg, tg, sg, wx, wz, mag, dt); return; }
    this.homeAI.pressHeld = false;
    let dx = wx, dz = wz;
    if (mag < 0.2) { dx = Math.sin(u.heading); dz = Math.cos(u.heading); }
    const kg = inp.consumeGesture('skill');
    if (kg && ball.owner === u && !this.passing.pending && !this.shooting.strike) this.skills.perform(u, kg.dir);
    if (ball.owner === u && !this.passing.pending && !this.shooting.strike) {
      if (sg) {
        // SHOOT: hold for power; swipe down = driven, up = chip, right = finesse, left = fake
        const kind = { tap: 'normal', down: 'driven', up: 'chip', right: 'finesse', left: 'fake' }[sg.dir] || 'normal';
        const r = this.shooting.shoot(u, kind, this.shooting.chargeFrom(sg.held));
        if (r === true) this.sm.change(STATES.SHOT_FLIGHT);
      } else if (tg) {
        this.passing.requestUserPass(u, dx, dz, 'through');
      } else if (pg) {
        // hold PASS and let go: a pass to feet (however long you held it). Swipe UP as you
        // let go: a high, long ball — the longer the hold, the further it goes — onto a teammate
        const lofted = pg.dir === 'up';
        const power = Math.min(1, 0.3 + (pg.held || 0) * 0.7);
        this.passing.requestUserPass(u, dx, dz, lofted ? 'lofted' : 'ground', power);
      }
    } else if (pg && ball.owner !== u) {
      // not on the ball (loose ball / teammate): switch to whoever's best placed
      this._switchBest();
    }
    inp.consume('confirm');
  }


  /** After a goal: the scorer celebrates, his teammates chase him, the others trudge. */
  _goalControl(dt) {
    this._updateExtras(dt);
    const t = this.sm.time, cel = this.celebration, sc = this.scorer;
    const team = this.goalTeam;
    for (const p of this.players) {
      // the side that conceded: heads down, hands on heads and hips, a couple sit down on the grass
      if (p.team !== team) {
        p.steer(0, 0, 0);
        if (t > 0.5 + (p.sadDelay ?? (p.sadDelay = Math.random() * 1.2)) && !p.sad) {
          const r = Math.random();
          p.sad = p.isKeeper ? (r < 0.5 ? 'sitdown' : 'crouchsad') : r < 0.3 ? 'dejected' : r < 0.62 ? 'hipshands' : r < 0.82 ? 'crouchsad' : 'sitdown';
          p.playAction(p.sad, 30, { hold: true });
        }
        continue;
      }
      if (p.isKeeper) { p.steer(0, 0, 0); continue; }
      if (cel && p === sc) {
        if (team === 'home') this._celebrate(p, cel, t, dt);
        else {
          // their scorer wheels away to the corner, arms up
          if (!cel.target) cel.target = { x: -CONFIG.pitch.length / 2 + 9, z: (p.pos.z >= 0 ? 1 : -1) * (CONFIG.pitch.width / 2 - 4) };
          const d = p.moveTo(cel.target.x, cel.target.z, p.attrs.sprintSpeed, 1);
          if (d < 2 && p.anim.action !== 'jumpfist') p.playAction('jumpfist', 9, { loop: true });
          else if (d >= 2 && p.anim.action !== 'armsup') p.playAction('armsup', 9, {});
        }
        continue;
      }
      if (sc && p.team === team && t > 0.4) {
        const ang = (this.players.indexOf(p) + 1) * 1.3;
        const tx = sc.pos.x - Math.cos(ang) * 1.8 * (team === 'home' ? 1 : -1), tz = sc.pos.z + Math.sin(ang) * 1.8;
        const d = p.moveTo(tx, tz, p.attrs.sprintSpeed, 2);
        p.faceTowards(sc.pos.x, sc.pos.z);
        if (d < 2.6 && p.anim.action !== 'teamjump') p.playAction('teamjump', 0.9, { loop: true, offset: ang });
        else if (d > 4 && p.anim.action !== 'armsup' && p.anim.action !== 'teamjump') p.playAction('armsup', 9, {});
        continue;
      }
      p.steer(0, 0, 0);
    }
  }

  /** Whole squad and the subs bench pour on to mob the scorer. */
  _startBigCelebration() {
    const u = this.user, W = CONFIG.pitch.width / 2;
    const side = u.pos.z >= 0 ? 1 : -1;
    this.extras = this.extraPool.slice();
    this.extras.forEach((p, i) => {
      // teammates from further up the pitch; subs off the bench on the touchline
      // subs were warming up down the touchline; the rest of the XI come from behind the play
      const x = u.pos.x - 14 - i * 2.5;
      const z = side * (W + 2);
      p.place(x, z, Math.PI / 2);
      p.setVisible(true);
      p.savePrev();
      p.celebDelay = p.isSub ? 0.4 + Math.random() * 0.6 : Math.random() * 0.5;
      p.playAction('armsup', 30, {});
    });
    this.audio.roar();
    this.audio.cheer(1.5);
    this.camRig.addShake(0.35);
  }

  _updateExtras(dt) {
    if (!this.extras.length) return;
    const u = this.scorer || this.user, t = this.sm.time;
    this.extras.forEach((p, i) => {
      p.savePrev();
      if (t < p.celebDelay) { p.steer(0, 0, 0); } else {
        const ang = i * 0.9 + 0.4, rr = 2.2 + (i % 3) * 0.9;
        const tx = u.pos.x - Math.cos(ang) * rr, tz = u.pos.z + Math.sin(ang) * rr;
        p.sprinting = true;
        const d = p.moveTo(tx, tz, p.attrs.sprintSpeed * 1.05, 2.5);
        p.faceTowards(u.pos.x, u.pos.z);
        if (d < 2.4 && p.anim.action !== 'teamjump') {
          p.playAction('teamjump', 0.9, { loop: true, offset: i });
          if (!this._pileShake) { this._pileShake = true; this.camRig.addShake(0.2); }
        }
      }
      p.integrate(dt, false);
    });
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
      const sliding = cel.type === 'kneeslide' || cel.type === 'bellyslide';
      if (d < (sliding ? 6.5 : 1.5) || t > 2.0) {
        cel.phase = 'move';
        const hx = Math.sin(u.heading), hz = Math.cos(u.heading);
        if (sliding) {
          cel.slide = { x: hx, z: hz, v: Math.max(5.5, u.speed) };
          u.playAction(cel.type, 2.6, { hold: true });
        } else if (cel.type === 'backflip') u.playAction('backflip', 1.15, {});
        else if (['cuptheear', 'shush', 'armscrossed', 'salute', 'calmdown', 'heart', 'badgepoint', 'robot'].includes(cel.type)) u.playAction(cel.type, 9, { loop: true });
        else if (cel.type === 'jumpfist') u.playAction('jumpfist', 9, { loop: true });
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
    if (cel.type === 'backflip' && u.anim.action !== 'backflip' && !cel.landed) { cel.landed = true; u.playAction('armsup', 9, { loop: true }); this.camRig.addShake(0.12); }
    if (cel.type === 'airplane') {
      // keep wheeling away, arms out
      cel.a = (cel.a || 0) + dt * 0.9;
      u.moveTo(cel.target.x - 4 + Math.cos(cel.a) * 5, cel.target.z * 0.85 + Math.sin(cel.a) * 5, u.runSpeed, 1);
      return;
    }
    u.steer(0, 0, 0);
  }

  // ------------------------------------------------------------ match flow
  /**
   * Start a match. home / away: { name, short, rating, kit, keeperKit, formation,
   * players: [11 × { name, pos, rating, stats, look }] } — index 0 is the keeper.
   */
  startMatch(home, away, opts = {}) {
    this._setupSide('home', home, this.homeSquad);
    this._setupSide('away', away, this.awaySquad);
    Object.assign(TEAMS.home, { name: home.name, short: home.short, rating: home.rating, kit: home.kit });
    Object.assign(TEAMS.away, { name: away.name, short: away.short, rating: away.rating, kit: away.kit });
    this.hud.setTeams(TEAMS.home, TEAMS.away);
    this.match.reset(opts);
    this.matchOpts = opts;
    this.setPiece = null;
    for (const p of [...this.homeSquad, ...this.awaySquad]) { p.sentOff = false; p.setVisible(true); p.stayDown = false; }
    // training: just you, your team and their keeper
    if (opts.training) for (const p of this.awaySquad.slice(1)) { p.sentOff = true; p.setVisible(false); p.pos.set(0, 0, 80); }
    // you start on the striker
    if (this.user !== this.homeSquad[10]) { this.user.setControlled(false); this.user = this.homeSquad[10]; this.user.setControlled(true); }
    for (const p of this.homeSquad) if (p !== this.user) p.setControlled(false);
    this._rebuildLists();
    this.homeAI.reset(); this.awayAI.reset();
    this.replay.reset([...this.players, this.ref, ...this.extraPool]);
    this.audio.unlock();
    this.audio.setMatchAudio(true);
    this.audio.setCrowd(0.3);
    this.ut.close();
    // weather: mostly clear, sometimes rain, now and then snow
    const wk = opts.weather || (opts.training ? 'clear' : (() => { const r = this.rng.next(); return r < 0.58 ? 'clear' : r < 0.84 ? 'rain' : 'snow'; })());
    const tk = opts.time || (opts.training ? 'day' : (() => { const r = this.rng.next(); return r < 0.5 ? 'night' : r < 0.72 ? 'dusk' : 'day'; })());
    this.setLook(tk, wk);
    this.cold = wk === 'snow' || (tk === 'night' && this.rng.chance(0.35)) || (wk === 'rain' && tk !== 'day' && this.rng.chance(0.5));
    if (this.pitch.crowd) this.pitch.crowd.setColours(home.kit.kitColour, away.kit.kitColour);
    this.match.kickoffTeam = opts.training || this.rng.chance(0.5) ? 'home' : 'away';
    this.sm.change(STATES.KICKOFF, { banner: opts.training ? 'TRAINING' : wk === 'rain' ? 'KICK OFF · RAIN' : wk === 'snow' ? 'KICK OFF · SNOW' : 'KICK OFF' });
  }

  _setupSide(team, side, squad) {
    const F = FORMATIONS[side.formation] || FORMATIONS['4-3-3'];
    const used = new Set();
    squad.forEach((p, i) => {
      const d = side.players[i] || side.players[side.players.length - 1];
      const [fx, fz, pos] = F[i];
      p.slot = { fx, fz, pos };
      p.name = (d.name || '').toUpperCase();
      p.rating = d.rating || side.rating;
      p.setStats(d.stats || statsFromRating(p.rating, this.rng));
      const kit = i === 0 ? side.keeperKit : side.kit;
      let num = d.number || i + 1;
      while (used.has(num)) num++;
      used.add(num);
      p.setKit({ ...kit });
      p.setAppearance({ skin: d.look?.skin, hairColour: d.look?.hairColour, boots: d.look?.boots || '#111111', number: num,
        sleeves: d.look?.sleeves || 'short', hairStyle: d.look?.hairStyle, facial: d.look?.facial, face: d.look?.face });
      p.setHeight && p.setHeight(d.look?.height || (i === 0 ? 1.9 : 1.82));
      p.ai = {};
    });
  }

  onGoal(team, scorer) {
    if (this.pitch.crowd) this.pitch.crowd.cheer(team === 'home' ? 7 : 3);
    this.goalTeam = team;
    this.scorer = scorer && !scorer.isKeeper ? scorer : (team === 'home' ? this.user : this.defenders[0]);
    if (team === 'home' && this.scorer.team === 'home' && this.scorer !== this.user) this.switchControl(this.scorer, true);
    if (this.sm.is(STATES.PAUSED)) this.sm.pop();
    this.sm.change(STATES.GOAL);
  }

  onHalfTime() { this.sm.change(STATES.HALFTIME); }
  onFullTime() { this.sm.change(STATES.FULLTIME); }

  /** Result card button: carry on after half time / leave after full time. */
  continueMatch() {
    if (this.sm.is(STATES.HALFTIME)) { this.hud.hideResult(); this.sm.change(STATES.KICKOFF, { banner: 'SECOND HALF' }); return; }
    if (this.sm.is(STATES.FULLTIME)) { this.hud.hideResult(); this._toMenu(); }
  }

  quitMatch() {
    if (this.sm.is(STATES.PAUSED)) this.sm.pop();
    if (this.sm.is(STATES.MENU)) return;
    this.match.ended = true;
    this.hud.hideResult();
    this._toMenu(true);
  }

  _toMenu(abandoned = false) {
    const res = this.match.result();
    if (abandoned) res.abandoned = true;
    this.sm.change(STATES.MENU);
    this.ut.onMatchEnd(res, this.matchOpts);
  }

  _clearPlay() {
    this.effects.clear();
    this.hud.setPenaltyMeter(false);
    this.hud.fkStage(null);
    this.hud.setButtonMode('all');
    this.aimLine.visible = false; this.aimRing.visible = false;
    this.passing.reset();
    this.shooting.cancelStrike();
    this.shooting.clearFlight();
    this.overlay.clear();
    this.ball.events.length = 0;
    this.ballCam = null;
    this.finishing = null;
    this.ball.frozen = false;
    this.cardMesh.visible = false;
    for (const p of this.players) { p.stayDown = false; p.anim.action = null; p.ai.tackling = null; p.sad = null; p.sadDelay = null; }
    for (const p of this.extras) p.setVisible(false);
    this.extras = [];
    this.setPiece = null;
    this.skills.reset();
    this.replay.stop();
    this.hud.setReplay(false);
    this.ts = null;
    this.loop.timeScale = 1;
  }

  pause() {
    if (!this.sm.is(STATES.PLAYING, STATES.SHOT_FLIGHT, STATES.KICKOFF, STATES.GOAL)) return;
    this.sm.push(STATES.PAUSED);
  }

  resume() { if (this.sm.is(STATES.PAUSED)) this.sm.pop(); }

  _endReplay() {
    this.replay.stop();
    this.hud.setReplay(false);
    this.goalPhase = 'done';
    for (const p of this.extras) p.setVisible(false);
    this.extras = [];
    this.sm.change(STATES.KICKOFF, { banner: null });
  }

  // ------------------------------------------------------------ states
  _buildStates() {
    const S = STATES;
    const sm = (this.sm = new StateMachine());
    const g = this;

    sm.add(S.LOADING, {
      enter() {
        g.setControls(false);
        const ready = () => { g.hud.startEl.classList.add('hide'); g.sm.change(S.MENU); };
        const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]).then(ready);
      },
    });

    // Ultimate Team screens on top; the stadium sits idle behind them
    sm.add(S.MENU, {
      enter() {
        g._clearPlay();
        g.setControls(false);
        g.input.enabled = false;
        g.input.releaseAll();
        g.hud.hideResult();
        g.hud.setMatchHud(false);
        g.camRig.setMode('intro');
        g.audio.setMatchAudio(false);
        g.ut.open();
      },
    });

    sm.add(S.KICKOFF, {
      enter(data = {}) {
        g._clearPlay();
        g.setControls(false);
        g.input.enabled = false;
        g.input.releaseAll();
        g.hud.setMatchHud(true);
        g.match.placeKickoff();
        g.homeAI.reset(); g.awayAI.reset();
        g.camRig.setMode('broadcast');
        g.camRig.snap();
        if (data.banner) g.hud.showBig(data.banner, 'neutral', 1.2);
      },
      update(dt) {
        for (const p of g.players) { p.savePrev(); p.steer(0, 0, 0); p.integrate(dt, false); }
        g.ball.savePrev();
      },
      frame() { if (sm.time > 1.4) sm.change(S.PLAYING); },
    });

    sm.add(S.PLAYING, {
      enter(_, prev) {
        g.input.enabled = true;
        g.input.clearPresses();
        g.setControls(true);
        g.camRig.setMode('broadcast');
        if (prev === S.KICKOFF) g.audio.whistle(false);
      },
      update(dt) {
        if (g.setPiece) {
          if (g.setPiece.phase !== 'ready') { g._setPieceUpdate(dt); return; }
          if (g.autoplay) {
            // demo / test: take it straight away
            const sp = g.setPiece;
            if (sp.penalty) { if (sp.meterSize < 0.35) g.input.gestures.shoot = { dir: 'tap', held: 0, dy: 0 }; } else sp.fkAction = 'pass';
          }
          if (!g._setPieceReady()) return;
        }
        g.simulate(dt);
      },
      frame(realDt) {
        // free kicks and penalties: over the taker's shoulder, looking at goal
        {
          const sp = g.setPiece, R = g.match.restart;
          const own = sp && sp.phase === 'ready';
          const theirs = R && R.taker && (R.type === 'penalty' || R.type === 'freekick');
          if ((own || theirs) && g.camRig.mode !== 'setpiece') { g.camRig.setMode('setpiece', { end: own ? 1 : R.team === 'home' ? 1 : -1 }); }
          else if (!own && !theirs && g.camRig.mode === 'setpiece') g.camRig.setMode('broadcast');
        }
        const has = g.ball.owner === g.user;
        const pen = g.setPiece && g.setPiece.penalty;
        g.hud.setShotCharge(has && !pen ? g.shooting.chargeFrom(g.input.chargeTime('shoot')) : 0);
        g._penaltyMeterFrame(realDt || 1 / 60);
        g._freeKickFrame(realDt || 1 / 60);
        g.hud.setPassCharge(0);
        // power bar under your player while PASS / SHOOT is held; the camera leans in on a shot
        {
          const u = g.user, sh = g.input.chargeTime('shoot'), ps = g.input.chargeTime('pass');
          const on = g.ball.owner === u && (sh > 0.06 || ps > 0.06) && !(g.setPiece && g.setPiece.phase !== 'ready');
          if (on) {
            const v = new THREE.Vector3(u.parts.root.position.x, -0.15, u.parts.root.position.z).project(g.camRig.camera);
            const w = g.host.clientWidth, hh = g.host.clientHeight;
            const val = sh > 0.06 ? g.shooting.chargeFrom(sh) : Math.min(1, 0.3 + ps * 0.7);
            g.hud.setPowerBar(true, (v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * hh + 6, val, sh > 0.06 ? 'SHOT' : 'PASS · swipe up to lob');
          } else g.hud.setPowerBar(false);
          const target = g.ball.owner === u && sh > 0.06 ? g.shooting.chargeFrom(sh) : 0;
          g.camRig.chargeZoom += (target - g.camRig.chargeZoom) * Math.min(1, (realDt || 0.016) * 6);
        }
        if (g.setPiece && g.setPiece.phase !== 'ready') {
          g.input.consumeGesture('pass'); g.input.consumeGesture('through'); g.input.consumeGesture('shoot');
          g.hud.setShootAvailable(false); return;
        }
        const def = g._defending();
        g.hud.setDefending(def);
        g.hud.setShootAvailable(!def && g.shooting.inRange(g.user));
        const R = g.match.restart;
        g.hud.setPassLabel(def ? 'SWITCH' : R && R.team === 'home' ? (R.type === 'throw' ? 'THROW' : R.type === 'corner' ? 'CROSS' : 'PASS') : g.ball.owner === g.user ? 'PASS' : 'SWITCH');
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
        g.hud.setPowerBar(false);
        g.camRig.chargeZoom = 0;
        g.simulate(dt);
        const k = g.ball.lastKick;
        if (sm.is(S.SHOT_FLIGHT) && k && (k.type === 'save' || k.type === 'block') && sm.time > 0.6) g.backToPlay();
        if (sm.is(S.SHOT_FLIGHT) && (sm.time > 3.5 || g.match.restart)) g.backToPlay();
      },
      exit() {
        g.shooting.clearFlight();
        g.setTimeScale(1, 0.15);
      },
    });

    sm.add(S.GOAL, {
      enter() {
        g.input.enabled = false;
        g.input.releaseAll();
        g.setControls(false);
        g.hud.setShootAvailable(false);
        g.goalPhase = 'live';
        g.goalSimTime = g.simTime;
        if (!g.ts || g.loop.timeScale < 0.99) g.setTimeScale(1, 0.25);
        const home = g.goalTeam === 'home';
        g.hud.showBig(home ? 'GOAL!' : `${TEAMS.away.short} SCORE`, home ? 'good' : 'bad', 1.6);
        g.celebration = { type: CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)], phase: 'run' };
        g._pileShake = false;
        const m = g.match;
        if (home) {
          const late = m.minute >= 80 && (m.homeGoals === m.awayGoals || m.homeGoals === m.awayGoals + 1);
          if (late) {
            g.celebration.big = true;
            g.celebration.type = Math.random() < 0.6 ? 'kneeslide' : 'jumpfist';
            g._startBigCelebration();
            g.hud.flash(m.homeGoals === m.awayGoals ? 'LATE EQUALISER!' : 'LATE WINNER!', 'good');
          } else g.hud.flash(`${g.scorer ? g.scorer.name : ''} ${m.minute}'`.trim(), 'good');
          g.audio.roar();
          g.audio.setCrowd(1);
          g.effects.burstConfetti({ x: CONFIG.pitch.length / 2 - 4, z: g.ball.pos.z });
        } else {
          g.audio.groan(1);
          g.hud.flash(`${g.scorer ? g.scorer.name : ''} ${m.minute}'`.trim(), 'bad');
        }
        g.audio.net();
        g.camRig.addShake(CONFIG.juice.goalShake * (home ? 1 : 0.5));
        g.camRig.setMode('goalview', { z: g.ball.pos.z, end: home ? 1 : -1 });
      },
      update(dt) { g.simulate(dt, 'result'); },
      frame(realDt) {
        const home = g.goalTeam === 'home';
        if (g.goalPhase === 'live') {
          if (sm.time > 1.3 && g.camRig.mode === 'goalview') g.camRig.setMode('celebrate', { target: g.scorer ? g.scorer.pos : g.user.pos });
          const hold = CONFIG.juice.celebrateTime * (g.celebration && g.celebration.big ? 1.5 : home ? 1 : 0.6);
          if (sm.time > hold) {
            const J = CONFIG.juice;
            if (g.replay.start(g.goalSimTime - J.replaySeconds, g.simTime, J.replaySpeed, g.goalSimTime + J.replayTail)) {
              g.goalPhase = 'replay';
              g.hud.hideBig();
              g.hud.setReplay(true);
              g.camRig.setMode('replay', { side: g.ball.pos.z > 0 ? -1 : 1, end: home ? 1 : -1 });
              g.replay.update(0);
              g.camRig.snap();
            } else g._endReplay();
          }
        } else if (g.goalPhase === 'replay') {
          const J2 = CONFIG.juice;
          g.camRig.opts.ballPos = g.replay.ballPos;
          if (!g.replay.update(realDt)) g._endReplay();
          else {
            const show = g.replay.t >= g.goalSimTime;
            for (const p of g.extras) p.parts.root.visible = show;
            if (g.replay.t > g.goalSimTime + J2.replayTail && g.camRig.mode === 'replay' && g.scorer) g.camRig.setMode('celebrate', { target: g.scorer.parts.root.position, angle: 0.6 });
          }
        }
      },
      exit() {
        g.replay.stop();
        g.hud.setReplay(false);
        g.hud.hideBig();
        g.audio.setCrowd(0.3);
      },
    });

    sm.add(S.HALFTIME, {
      enter() {
        g.setControls(false);
        g.input.enabled = false;
        g.audio.whistle(true);
        g.camRig.setMode('intro');
        g.hud.showMatchCard('HALF TIME', g.match, 'Second Half');
      },
      update(dt) { for (const p of g.players) { p.savePrev(); p.steer(0, 0, 0); p.integrate(dt, false); } },
    });

    sm.add(S.FULLTIME, {
      enter() {
        g.setControls(false);
        g.input.enabled = false;
        g.audio.whistle(true);
        const m = g.match;
        if (m.homeGoals > m.awayGoals) g.audio.cheer(1.2); else if (m.homeGoals < m.awayGoals) g.audio.groan(1);
        g.camRig.setMode('intro');
        g.hud.showMatchCard('FULL TIME', m, 'Continue');
      },
      update(dt) { for (const p of g.players) { p.savePrev(); p.steer(0, 0, 0); p.integrate(dt, false); } },
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
    if (this.sm.is(STATES.HALFTIME, STATES.FULLTIME) && this.input.consume('confirm')) this.continueMatch();

    const replaying = this.replay.playing;
    const paused = this.sm.is(STATES.PAUSED);
    const menu = this.sm.is(STATES.MENU, STATES.LOADING);
    if (!replaying && !menu) {
      if (!paused) for (const p of this.players) p.updateAnimation(scaledDt, this.ball.owner === p);
      for (const p of this.players) p.render(alpha, this.realTime);
      for (const p of this.extras) { if (!paused) p.updateAnimation(scaledDt, false); p.render(alpha, this.realTime); }
      if (!paused) this.ref.updateAnimation(scaledDt, false);
      this.ref.render(alpha, this.realTime);
      this._cardFrame();
      this.ball.render(alpha);
    }
    if (menu) return;   // the menus cover the screen: don't spend the GPU on the stadium
    this.pitch.update(paused ? 0 : scaledDt);
    this.effects.update(paused ? 0 : realDt, this.realTime);
    this.camRig.update(realDt, this);
    this.weather.update(paused ? 0 : realDt, this.camRig.pos, this.realTime || 0, this.camRig.look);
    this.pitch.updateStadium(paused ? 0 : realDt, this.realTime, this.camRig.camera.position);
    HUMAN_FX.time.value = this.realTime % 1000;
    if (this.cold && !paused && this.sm.is(STATES.PLAYING, STATES.SHOT_FLIGHT, STATES.GOAL, STATES.KICKOFF)) {
      for (const p of this.players) {
        if (!p.visible) continue;
        p._breathT = (p._breathT ?? Math.random() * 2) - realDt;
        if (p._breathT <= 0) {
          const sp = Math.hypot(p.vel.x, p.vel.z);
          p._breathT = sp > 5 ? 0.45 + Math.random() * 0.3 : 1.3 + Math.random() * 1.6;   // panting when sprinting
          const hd = p.parts.head;
          hd.getWorldPosition(this._bv || (this._bv = new THREE.Vector3()));
          this.effects.breath(this._bv.x, this._bv.y - 0.02, this._bv.z, Math.sin(p.heading), Math.cos(p.heading));
        }
      }
    }
    this.floodShadows.update(this.players);
    this.pitch.focusShadows(this.camRig.look.x, this.camRig.look.z);
    this.hud.update(this);
    this.debug.update();
    this.quality.tick(realDt, this.sm.is(STATES.PLAYING, STATES.SHOT_FLIGHT));

    this.audio.tick(realDt, this.sm.is(STATES.PLAYING, STATES.SHOT_FLIGHT));
    // crowd lifts as either side gets near goal
    this._crowdT = (this._crowdT || 0) - realDt;
    if (this._crowdT <= 0 && this.sm.is(STATES.PLAYING, STATES.SHOT_FLIGHT)) {
      this._crowdT = 0.3;
      const x = Math.abs(this.ball.pos.x);
      this.audio.setCrowd(Math.max(0.15, Math.min(1, (x - 15) / 35)));
      if (this.pitch.crowd) this.pitch.crowd.setExcitement(Math.max(0, Math.min(1, (x - 25) / 25)));
    }

    this.renderFrame(this.camRig.camera);
    if (!replaying && this.sm.is(STATES.PLAYING, STATES.SHOT_FLIGHT, STATES.GOAL)) {
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
