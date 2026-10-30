// SHOOTING (FC-mobile style, real time — no freeze).
// Hold SHOOT: longer = more power and a little more height. On release the
// shot is auto-aimed at the corner away from the keeper, with generous
// assistance so it's forgiving. Swipe off the button while releasing:
//   down  → driven: low, very fast, stays on the ground
//   up    → chip: power is worked out for you, dropped over the keeper
//   right → finesse: harder than normal, bends a lot into the far corner
//   left  → fake shot: wind up and don't strike it — defenders and keeper bite
import * as THREE from 'three';
import { CONFIG, clamp, lerp } from '../config.js';
import { Ball } from '../entities/Ball.js';

const DEG = Math.PI / 180;

export class Shooting {
  constructor(game) {
    this.game = game;
    this.aim = null;
    this.flight = null;
    this._s = {};
    this.lastLaunch = null;
  }

  // ------------------------------------------------------------ availability
  goalAngleDeg(pos) {
    const gx = CONFIG.pitch.length / 2, hw = CONFIG.pitch.goalWidth / 2;
    if (pos.x >= gx) return 0;
    const a1 = Math.atan2(-hw - pos.z, gx - pos.x);
    const a2 = Math.atan2(hw - pos.z, gx - pos.x);
    return Math.abs(a2 - a1) / DEG;
  }

  canShoot(p) {
    const ball = this.game.ball;
    return ball.owner === p && ball.pos.y < 0.6 && !ball.frozen;
  }

  /** In range for a realistic strike (SHOOT button glows). */
  inRange(p) {
    const ball = this.game.ball;
    const d = Math.hypot(CONFIG.pitch.length / 2 - ball.pos.x, ball.pos.z);
    return this.canShoot(p) && d <= CONFIG.shot.rangeMax && this.goalAngleDeg(ball.pos) >= CONFIG.shot.minGoalAngleDeg;
  }

  chargeFrom(held) { return clamp(held / CONFIG.shot.chargeTime, 0, 1); }

  // kept for older call sites (the slingshot aim mode is gone)
  endAim() { this.aim = null; }

  _pressureOn(p) {
    const R = CONFIG.shot.pressureRadius;
    let s = 0;
    for (const o of this.game.opponentsOf(p)) {
      if (o.isKeeper) continue;
      const d = Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z);
      if (d < R) s += 1 - d / R;
    }
    return clamp(s, 0, 1.5);
  }

  /** Pick the side of the goal away from the keeper (far post when he's central). */
  _side(start) {
    const kz = this.game.keeperPlayer.pos.z;
    if (Math.abs(kz) > 0.35) return kz > 0 ? -1 : 1;
    if (Math.abs(start.z) > 1) return start.z > 0 ? -1 : 1;
    return this.game.rng.chance(0.5) ? 1 : -1;
  }

  // ------------------------------------------------------------ the strike
  // Releasing SHOOT starts the kick: the clip's backswing is time-warped so the
  // boot meets the ball after a short windup, and the ball leaves on that frame.
  // Free kicks and penalties get a real run-up first. update() fires the shot.

  /** Shot animation variant (decided at the start of the kick). */
  _variant(shooter, kind, dist, pressure) {
    const g = this.game;
    const yaw = Math.atan2(CONFIG.pitch.length / 2 - shooter.pos.x, -shooter.pos.z);
    const turn = Math.abs(((yaw - shooter.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    let variant = kind === 'normal' ? 'laces' : kind;
    if (kind === 'normal' && dist < 8 && g.rng.chance(0.4)) variant = 'placed';
    const offBalance = pressure > 0.8 || turn > 1.3 || (shooter.speed > 6.5 && g.rng.chance(0.35));
    if (offBalance && kind !== 'chip') variant = 'offbalance';
    return { variant, offBalance };
  }

  /** Free-kick pass: run up to the ball, then play the pass (its own kick clip). */
  runUpThen(shooter, then) {
    return this._startStrike(shooter, 'pass', then, true, false);
  }

  _startStrike(shooter, kind, fire, setPiece = false, kickAnim = true) {
    const g = this.game, ball = g.ball, S = CONFIG.shot;
    const dist = Math.hypot(CONFIG.pitch.length / 2 - ball.pos.x, ball.pos.z);
    const { variant, offBalance } = this._variant(shooter, kind, dist, setPiece ? 0 : this._pressureOn(shooter));
    const t = setPiece ? S.runUpTime * (kickAnim ? 1 : 0.8) : S.strikeWindup;
    const kickLeg = setPiece ? 1 : (g.rng.chance(0.82) ? 1 : -1);
    if (kickAnim) shooter.playAction('shoot', t + (variant === 'offbalance' ? 0.7 : 0.55), { kickLeg, variant, contactAt: t, setPiece });
    this.strike = { shooter, t, T: t, fire, variant, offBalance, kickLeg, setPiece, kickAnim, from: shooter.pos.clone() };
    if (setPiece) {
      // run up from behind the ball; it can't be touched meanwhile
      ball.frozen = true;
      const gx = CONFIG.pitch.length / 2;
      const l = Math.hypot(gx - ball.pos.x, ball.pos.z) || 1;
      const ux = (gx - ball.pos.x) / l, uz = -ball.pos.z / l;
      const back = kickAnim ? 0.32 : 0.5;
      this.strike.to = new THREE.Vector3(ball.pos.x - ux * back + uz * 0.16, 0, ball.pos.z - uz * back - ux * 0.16);
      this.strike.heading = Math.atan2(ux, uz);
    }
    return 'windup';
  }

  /** Fixed step: plays out a strike in progress, fires on the contact frame. */
  update(dt) {
    const k = this.strike;
    if (!k) return;
    const g = this.game, ball = g.ball, p = k.shooter;
    k.t -= dt;
    if (k.setPiece) {
      const T = k.T, f = Math.min(1, 1 - k.t / T);
      p.pos.lerpVectors(k.from, k.to, f);
      p.vel.subVectors(k.to, k.from).multiplyScalar(1 / T);
      p.heading = p.prevHeading = k.heading;
      p.steer(0, 0, 0);
    } else if (ball.owner !== p) { this.strike = null; return; }
    if (k.t > 0) return;
    this.strike = null;
    if (k.setPiece) { ball.frozen = false; ball.owner = p; }
    if (k.kickAnim) p.reachFor(k.kickLeg, ball.pos.x, ball.pos.y, ball.pos.z, 0, 0.1);
    else p.vel.set(0, 0, 0);
    const r = k.fire();
    if (r === true && g.onShotFired) g.onShotFired();
  }

  /** Release of the SHOOT button. kind: normal | driven | chip | finesse | fake */
  shoot(shooter, kind, charge) {
    if (!this.canShoot(shooter) || this.strike) return false;
    if (kind === 'fake') return this.fakeShot(shooter);
    return this._startStrike(shooter, kind, () => (this.canShoot(shooter) ? this._shootNow(shooter, kind, charge) : false));
  }

  _shootNow(shooter, kind, charge) {
    const g = this.game, ball = g.ball, S = CONFIG.shot, P = CONFIG.pitch;
    const gx = P.length / 2, hw = P.goalWidth / 2;
    const start = ball.pos.clone();
    start.y = Math.max(start.y, CONFIG.ball.radius);
    const dist = Math.hypot(gx - start.x, start.z);
    const side = this._side(start);
    const st = shooter.stats;
    const maxSp = CONFIG.statMap.maxShotSpeed(st.shotPower) * S.powerCap;

    // assistance: pull the charge toward the right power for this distance
    const ideal = clamp(0.35 + dist / 45, 0.45, 0.85);
    const eff = lerp(charge, ideal, S.assist);
    // forgiving error — grows with distance and pressure, shrinks with finishing/composure
    const pressure = this._pressureOn(shooter);
    const skill = 1.25 - (st.finishing * 0.6 + st.composure * 0.4) / 100;
    const sigma = (S.errBase + Math.max(0, dist - 11) * S.errPerMetre + pressure * S.errPressure) * skill;
    const rng = g.rng;

    let T, speed, curve = 0, launch;
    if (kind === 'chip') {
      T = new THREE.Vector3(gx, 2.05, side * (hw - 1.2) + rng.gauss() * sigma * 0.4);
      launch = this.solveChip(start, T);
    } else {
      if (kind === 'driven') {
        T = new THREE.Vector3(gx, 0.18, side * (hw - 0.75) + rng.gauss() * sigma);
        speed = lerp(maxSp * 0.82, maxSp * 1.05, charge);
      } else if (kind === 'finesse') {
        T = new THREE.Vector3(gx, 0.85 + eff * 0.55 + rng.gauss() * sigma * 0.4, side * (hw - 0.6) + rng.gauss() * sigma * 0.7);
        speed = lerp(maxSp * 0.8, maxSp * 0.98, eff);
        curve = side * S.finesseCurve;
      } else {
        T = new THREE.Vector3(gx, 0.35 + eff * 1.45 + rng.gauss() * sigma * 0.6, side * (hw - 0.8 + (1 - eff) * 0.15) + rng.gauss() * sigma);
        speed = lerp(S.minSpeed, maxSp, Math.pow(eff, 0.8));
        curve = side * 0.35;
        // a properly overhit shot (held right to the end from distance) can still fly
        if (charge > 0.97 && dist > 16 && rng.chance(0.25)) T.y += 0.9;
      }
      T.y = Math.max(CONFIG.ball.radius, T.y);
      launch = this.solve(start, T, speed, curve);
    }
    return this.fire(shooter, launch, { kind, power: kind === 'chip' ? 0.4 : eff, pressure, dist });
  }

  /**
   * Penalty taken off the timing circle. size: 0 = tiny & green (perfect) … 1 = huge & red.
   *  * green  → buried in the corner, the keeper can't get there
   *  * yellow → decent penalty, the keeper has a chance
   *  * red    → skied or dragged wide
   */
  penalty(shooter, size, side, aimY) {
    return this._startStrike(shooter, 'driven', () => this._penaltyNow(shooter, size, side, aimY), true);
  }

  _penaltyNow(shooter, size, side, aimY) {
    const g = this.game, ball = g.ball, P = CONFIG.pitch, S = CONFIG.shot;
    const gx = P.length / 2, hw = P.goalWidth / 2;
    const start = ball.pos.clone(); start.y = Math.max(start.y, CONFIG.ball.radius);
    const maxSp = CONFIG.statMap.maxShotSpeed(shooter.stats.shotPower) * S.powerCap;
    let T, quality;
    if (size < S.penGreen) {
      quality = 'perfect';
      T = new THREE.Vector3(gx, aimY, side * (hw - 0.45));
    } else if (size < S.penYellow) {
      quality = 'ok';
      const e = (size - S.penGreen) / (S.penYellow - S.penGreen);
      T = new THREE.Vector3(gx, aimY * (1 - e * 0.3), side * (hw - 0.6 - e * 1.4));
    } else {
      quality = 'miss';
      T = g.rng.chance(0.5)
        ? new THREE.Vector3(gx, P.goalHeight + 0.6 + g.rng.range(0, 1.2), side * (hw - 1) + g.rng.range(-1, 1))
        : new THREE.Vector3(gx, g.rng.range(0.3, 1.4), side * (hw + 0.5 + g.rng.range(0, 1.4)));
    }
    const launch = this.solve(start, T, quality === 'miss' ? maxSp * 0.95 : maxSp * 0.88, 0);
    launch.result.forceBeat = quality === 'perfect';
    g.hud.flash(quality === 'perfect' ? 'PERFECT!' : quality === 'ok' ? 'GOOD CONTACT' : 'POOR CONTACT', quality === 'miss' ? 'bad' : 'good');
    return this.fire(shooter, launch, { kind: 'driven', power: 0.9, pressure: 0, dist: 11 });
  }

  /**
   * Free kick from the aim line + timed power bar.
   * power in the green zone → curls over the wall and dips under the bar;
   * too little → into the wall; too much → over the bar.
   */
  freeKick(shooter, aimZ, power) {
    return this._startStrike(shooter, 'finesse', () => this._freeKickNow(shooter, aimZ, power), true);
  }

  _freeKickNow(shooter, aimZ, power) {
    const g = this.game, ball = g.ball, P = CONFIG.pitch, F = CONFIG.freeKick;
    const gx = P.length / 2, hw = P.goalWidth / 2;
    const start = ball.pos.clone(); start.y = Math.max(start.y, CONFIG.ball.radius);
    const maxSp = CONFIG.statMap.maxShotSpeed(shooter.stats.shotPower) * CONFIG.shot.powerCap;
    const sweet = power >= F.zoneLo && power <= F.zoneHi;
    const mid = (F.zoneLo + F.zoneHi) / 2;
    const q = sweet ? 1 - Math.abs(power - mid) / ((F.zoneHi - F.zoneLo) / 2) : 0; // 1 = dead centre of the zone
    let y, speed, z = aimZ;
    if (sweet) {
      y = 1.45 + q * 0.6;
      speed = maxSp * (0.78 + q * 0.1);
      z += g.rng.gauss() * (1 - q) * 0.4;
    } else if (power < F.zoneLo) {
      y = 0.35 + power * 1.6; speed = maxSp * (0.6 + power * 0.3);
      z += g.rng.gauss() * 0.4;
    } else {
      y = P.goalHeight + 0.3 + (power - F.zoneHi) * 6; speed = maxSp * 0.92;
      z += g.rng.gauss() * 0.5;
    }
    z = clamp(z, -hw - 2, hw + 2);
    // bend it back toward the middle of the goal (round the wall)
    const curve = (z >= 0 ? 1 : -1) * F.curve;
    const T = new THREE.Vector3(gx, y, z);
    const launch = this.solve(start, T, speed, curve);
    g.hud.flash(sweet ? (q > 0.6 ? 'PERFECT STRIKE!' : 'GOOD STRIKE') : power < F.zoneLo ? 'TOO SOFT' : 'TOO MUCH', sweet ? 'good' : 'bad');
    const ok = this.fire(shooter, launch, { kind: 'finesse', power: 0.8, pressure: 0, dist: 20 });
    if (ok && sweet && this.flight) for (const d of g.defenders) this.flight.blocked.add(d); // clears the wall
    return ok;
  }

  /** Chip: find a lob that clears the keeper and drops under the bar. */
  solveChip(start, T) {
    const yaw = Math.atan2(T.z - start.z, T.x - start.x);
    const kx = this.game.keeperPlayer.pos.x;
    let best = null;
    for (const elev of [0.62, 0.72, 0.82, 0.92]) {
      let lo = 4, hi = 30, res = null, v = 0;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        const [vx, vy, vz] = this._vel(yaw, elev, mid);
        const r = this.simulate(start, vx, vy, vz, 0, true);
        // landed before the goal line → too soft
        let bounced = false;
        for (let j = 5; j < r.path.length; j++) if (r.path[j].y <= CONFIG.ball.radius + 0.02) { bounced = true; break; }
        if (!r.cross || bounced) { lo = mid; continue; }
        if (r.vyAt > 0 || r.cross.y > T.y) hi = mid; else lo = mid;
      }
      v = (lo + hi) / 2;
      const [vx, vy, vz] = this._vel(yaw, elev, v);
      res = this.simulate(start, vx, vy, vz, 0, true);
      if (!res.cross) continue;
      // height when passing the keeper
      let hk = 0;
      for (const pt of res.path) if (pt.x >= kx - 0.3) { hk = pt.y; break; }
      const cand = { vx, vy, vz, curve: 0, speed: v, result: res, hk };
      if (!best || (best.hk < 2.6 && hk > best.hk)) best = cand;
      if (hk > 2.7) break;
    }
    Object.assign(best.result, this.classify(best.result));
    return best;
  }

  /** Swipe left: shape to shoot, don't. Nearby defenders and the keeper bite. */
  fakeShot(shooter) {
    const g = this.game, ball = g.ball, S = CONFIG.shot;
    shooter.playAction('fakeshot', 0.6, { kickLeg: 1, side: g.rng.sign() });
    g.audio.anticipate();
    g.hud.flash('FAKE SHOT', 'good');
    let fooled = 0;
    for (const d of g.defenders) {
      if (d.stumble > 0) continue;
      const dd = Math.hypot(d.pos.x - shooter.pos.x, d.pos.z - shooter.pos.z);
      if (dd > S.fakeRadius) continue;
      if (g.rng.next() < S.fakeDefenderChance) {
        d.stumble = 1.0; d.ai.tackling = null; d.ai.onBall = 0;
        d.tackleCooldown = Math.max(d.tackleCooldown, 1.6);
        d.playAction(g.rng.chance(0.5) ? 'block' : 'tackle', 0.8, { side: g.rng.sign() });
        g.events.emit('beatDefender', { by: shooter, defender: d, skill: 'fakeshot' });
        fooled++;
      }
    }
    const dist = Math.hypot(CONFIG.pitch.length / 2 - ball.pos.x, ball.pos.z);
    if (dist < S.fakeKeeperRange && g.rng.next() < S.fakeKeeperChance) {
      g.keeper.fool(g.rng.sign());
      fooled++;
    }
    if (fooled) g.audio.skillCheer();
    return 'fake';
  }

  // ------------------------------------------------------------ prediction
  /** Simulate a launch with the live integrator. */
  simulate(start, vx, vy, vz, curve, record = false) {
    const s = this._s;
    s.px = start.x; s.py = Math.max(start.y, CONFIG.ball.radius); s.pz = start.z;
    s.vx = vx; s.vy = vy; s.vz = vz; s.curve = curve;
    // mirror Ball.kick(): a lofted kick lifts the ball off the turf
    if (vy > 0.5 && s.py < CONFIG.ball.radius + 0.02) s.py = CONFIG.ball.radius + 0.01;
    const dt = 1 / (CONFIG.sim.hz * CONFIG.sim.ballSubSteps);
    const gx = CONFIG.pitch.length / 2;
    const maxSteps = Math.ceil(CONFIG.shot.predictMaxTime / dt);
    const path = record ? [] : null;
    let t = 0;
    for (let i = 0; i < maxSteps; i++) {
      const px = s.px, py = s.py, pz = s.pz;
      Ball.integrate(s, dt);
      t += dt;
      if (record) path.push({ x: s.px, y: s.py, z: s.pz, t });
      if (s.px >= gx) {
        const f = (gx - px) / (s.px - px || 1e-6);
        const cross = { y: py + (s.py - py) * f, z: pz + (s.pz - pz) * f, t: t - dt + dt * f };
        const vxAt = s.vx;
        return { cross, path, end: new THREE.Vector3(gx, cross.y, cross.z), speedAt: Math.hypot(vxAt, s.vy, s.vz), vyAt: s.vy };
      }
      if (s.vx * s.vx + s.vz * s.vz < 0.05 && s.py <= CONFIG.ball.radius + 0.01) break;
    }
    return { cross: null, path, end: new THREE.Vector3(s.px, 0.05, s.pz), speedAt: 0 };
  }

  classify(res) {
    const P = CONFIG.pitch, r = CONFIG.ball.radius;
    const hw = P.goalWidth / 2 - r, H = P.goalHeight - r;
    if (!res.cross) return { onTarget: false, missDistance: 99 };
    const z = Math.abs(res.cross.z), y = res.cross.y;
    const onTarget = z < hw && y < H;
    const out = Math.hypot(Math.max(0, z - hw), Math.max(0, y - H));
    const edge = Math.min(Math.abs(hw - z), Math.abs(H - y));
    return { onTarget, missDistance: onTarget ? 0 : out, edgeDistance: edge };
  }

  _vel(yaw, elev, speed) {
    const ce = Math.cos(elev);
    return [Math.cos(yaw) * ce * speed, Math.sin(elev) * speed, Math.sin(yaw) * ce * speed];
  }

  /** Find yaw/elevation that sends the ball through target T at the given speed. */
  solve(start, T, speed, curve) {
    let yaw = Math.atan2(T.z - start.z, T.x - start.x);
    const horiz = Math.hypot(T.x - start.x, T.z - start.z);
    const heightAt = (elev, y) => {
      const [vx, vy, vz] = this._vel(y, elev, speed);
      const r = this.simulate(start, vx, vy, vz, curve);
      return r.cross ? r.cross : null;
    };
    let elev = 0.05;
    let bestE = 0, bestH = -1;
    const e0 = -0.06;
    for (let iter = 0; iter < 4; iter++) {
      if (iter < 2) {
        // coarse scan for the highest reachable crossing (low-arc branch)
        bestE = 0; bestH = -1;
        const N = 12, e1 = 0.62;
        for (let i = 0; i <= N; i++) {
          const e = e0 + ((e1 - e0) * i) / N;
          const c = heightAt(e, yaw);
          const h = c ? c.y : -1;
          if (h > bestH) { bestH = h; bestE = e; }
        }
      }
      if (T.y >= bestH) {
        elev = bestE;
      } else {
        let lo = e0, hi = bestE;
        for (let i = 0; i < 14; i++) {
          const mid = (lo + hi) / 2;
          const c = heightAt(mid, yaw);
          if ((c ? c.y : -1) < T.y) lo = mid; else hi = mid;
        }
        elev = (lo + hi) / 2;
      }
      const c = heightAt(elev, yaw);
      if (!c) break;
      const errZ = T.z - c.z;
      if (Math.abs(errZ) < 0.02) break;
      yaw += Math.atan2(errZ, horiz);
    }
    const [vx, vy, vz] = this._vel(yaw, elev, speed);
    const result = this.simulate(start, vx, vy, vz, curve, true);
    Object.assign(result, this.classify(result));
    return { vx, vy, vz, curve, speed, result };
  }

  // ------------------------------------------------------------ release & flight
  fire(shooter, L, { kind, power, pressure, dist }) {
    const g = this.game, ball = g.ball;
    // face the shot, and pick an animation variant that suits the situation
    const yaw = Math.atan2(L.vx, L.vz);
    shooter.heading = shooter.prevHeading = yaw;
    // the kick animation started with the strike (see _startStrike); the ball leaves on its contact frame
    const offBalance = shooter.anim.action === 'shoot' && shooter.anim.variant === 'offbalance';
    void dist;
    if (offBalance) shooter.stumble = Math.max(shooter.stumble, 0.35);

    ball.kick(L.vx, L.vy, L.vz, { curve: L.curve, type: 'shot', by: shooter, ignoreTime: 0.4, time: g.simTime });
    ball.owner = null;
    g.audio.kick(kind === 'chip' ? 0.35 : 0.45 + power * 0.55, kind === 'driven' ? 'driven' : 'shot');
    g.effects.puff(ball.pos.x, ball.pos.z, 1 + power);
    if (power > 0.7 || kind === 'driven') g.camRig.addShake(CONFIG.juice.shotShake * (1 + power));
    const info = { ...L.result, speed: L.speed, power, kind };
    const kp = g.keeper.onShot(L.result.path, info, shooter);
    const edgeClose = info.onTarget ? info.edgeDistance < CONFIG.shot.closeCallMargin * 0.6 : info.missDistance < CONFIG.shot.closeCallMargin;
    const keeperClose = kp && kp.prob > 0.2 && kp.prob < 0.8;
    this.flight = {
      info, keeper: kp, t: 0, origin: ball.pos.clone(),
      closeCall: !!(edgeClose || keeperClose), slow: false,
      blocked: new Set(), postHit: false, shooter,
    };
    this.lastLaunch = { power, speed: L.speed, onTarget: info.onTarget, kind };
    g.events.emit('shot', { shooter, info, power });
    return true;
  }

  /** Fixed-step monitoring during SHOT_FLIGHT. */
  flightUpdate(dt) {
    const f = this.flight;
    if (!f) return;
    const g = this.game, ball = g.ball;
    f.t += dt;
    const gx = CONFIG.pitch.length / 2;
    // slow-mo for the final metres of a close call
    if (f.closeCall && !f.slow && ball.pos.x > gx - CONFIG.shot.slowMoDistance && ball.lastKick?.type === 'shot') {
      f.slow = true;
      g.setTimeScale(CONFIG.shot.slowMoSpeed, 0.12);
    }
    if (f.slow && (ball.pos.x > gx + 0.4 || ball.lastKick?.type !== 'shot' || f.t > 3)) {
      f.slow = false;
      f.closeCall = false;
      g.setTimeScale(1, 0.5);
    }
    // blocks by outfield defenders in the path
    if (ball.lastKick && ball.lastKick.type === 'shot' && ball.pos.y < 2.0) {
      for (const d of g.defenders) {
        if (f.blocked.has(d) || !ball.canTouch(d)) continue;
        const dx = ball.pos.x - d.pos.x, dz = ball.pos.z - d.pos.z;
        if (dx * dx + dz * dz < CONFIG.shot.blockRadius * CONFIG.shot.blockRadius) {
          f.blocked.add(d);
          if (g.rng.next() < CONFIG.shot.blockChance) {
            const v = ball.vel;
            ball.kick(-v.x * 0.25 + g.rng.range(-2, 2), Math.abs(v.y) * 0.4 + g.rng.range(0.5, 3), v.z * 0.3 + g.rng.range(-5, 5),
              { type: 'block', by: d, ignoreTime: 0.5, time: g.simTime });
            g.audio.kick(0.5);
            g.events.emit('blocked', { by: d });
          }
        }
      }
    }
  }

  cancelStrike() {
    if (this.strike && this.strike.setPiece) this.game.ball.frozen = false;
    this.strike = null;
  }

  clearFlight() {
    if (this.flight && this.flight.slow) this.game.setTimeScale(1, 0.2);
    this.flight = null;
  }
}
