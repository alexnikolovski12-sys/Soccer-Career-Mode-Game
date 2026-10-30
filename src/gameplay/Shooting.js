// THE SLINGSHOT SHOT.
// Freeze → pull back anywhere → arrow points opposite the drag → release.
//  * horizontal pull  → aim across the goal
//  * vertical pull    → height (pull DOWN = more loft, small vertical = driven low)
//  * pull length      → power (green / yellow / red)
// The aim point (+ smooth wobble) is solved into a launch velocity with the
// exact same integrator the live ball uses, so the white circle is honest.
import * as THREE from 'three';
import { CONFIG, clamp, lerp } from '../config.js';
import { Ball } from '../entities/Ball.js';
import { SmoothNoise } from '../core/MathUtil.js';

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
    if (ball.owner !== p || ball.pos.y > 0.6 || ball.frozen) return false;
    const gx = CONFIG.pitch.length / 2;
    const d = Math.hypot(gx - ball.pos.x, ball.pos.z);
    return d <= CONFIG.shot.rangeMax && this.goalAngleDeg(ball.pos) >= CONFIG.shot.minGoalAngleDeg;
  }

  // ------------------------------------------------------------ aim lifecycle
  beginAim(shooter) {
    const rng = this.game.rng;
    this.aim = {
      shooter,
      active: false, inCancel: true,
      start: { x: 0, y: 0 }, cur: { x: 0, y: 0 },
      power: 0, time: 0,
      n1: new SmoothNoise(rng), n2: new SmoothNoise(rng),
      launch: null, pred: null, wobbleAmp: 0,
      target: new THREE.Vector3(),
    };
    this._pressure = this._pressureOn(shooter);
    this._setUpStance(shooter);
  }

  /** Step the shooter into a run-up stance beside the ball (masked by the camera move). */
  _setUpStance(p) {
    const S = CONFIG.shot, b = this.game.ball.pos;
    const gx = CONFIG.pitch.length / 2;
    const dx = gx - b.x, dz = -b.z;
    const l = Math.hypot(dx, dz) || 1;
    const fx = dx / l, fz = dz / l;
    const lx = fz, lz = -fx; // left of the shot direction
    p.pos.set(b.x - fx * S.runUpBack + lx * S.runUpSide, 0, b.z - fz * S.runUpBack + lz * S.runUpSide);
    p.prevPos.copy(p.pos);
    p.vel.set(0, 0, 0);
    p.heading = p.prevHeading = Math.atan2(fx, fz);
    p.anim.action = null;
  }

  endAim() {
    this.aim = null;
    this.game.overlay.clear();
  }

  metrics() {
    const m = Math.min(window.innerWidth, window.innerHeight);
    const S = CONFIG.shot;
    return {
      maxPull: Math.max(S.maxPullMinPx, S.maxPullFrac * m),
      cancelR: Math.max(S.cancelRadiusPx, S.cancelRadiusFrac * m),
    };
  }

  pointerDown(x, y) {
    const a = this.aim;
    if (!a) return;
    a.active = true;
    a.start.x = x; a.start.y = y;
    a.cur.x = x; a.cur.y = y;
    a.inCancel = true;
  }

  pointerMove(x, y) {
    const a = this.aim;
    if (!a || !a.active) return;
    a.cur.x = x; a.cur.y = y;
  }

  /** Returns 'fire' if the shot should be released, otherwise null (still aiming). */
  pointerUp(x, y) {
    const a = this.aim;
    if (!a || !a.active) return null;
    a.cur.x = x; a.cur.y = y;
    this._computePull();
    a.active = false;
    if (a.inCancel || !a.launch) {
      this.game.overlay.clear();
      return null;
    }
    return 'fire';
  }

  _computePull() {
    const a = this.aim;
    const S = CONFIG.shot;
    const { maxPull, cancelR } = this.metrics();
    const dx = a.cur.x - a.start.x, dy = a.cur.y - a.start.y;
    const L = Math.hypot(dx, dy);
    a.inCancel = L < cancelR;
    a.power = clamp(L / maxPull, 0, 1);
    const px = clamp(-dx / maxPull, -1.25, 1.25);
    const py = clamp(dy / maxPull, -0.2, 1.15);
    a.lateralN = px;
    // camera-relative: screen right should map to the goal side on screen right
    const rightSign = this.game.camRig.right.z >= 0 ? 1 : -1;
    a.aimZ = px * S.lateralGain * rightSign;
    a.aimY = S.groundHeight + Math.max(0, py - S.heightDeadZone) * S.heightGain;
    a.dx = dx; a.dy = dy; a.L = L; a.maxPull = maxPull;
  }

  _pressureOn(p) {
    const R = CONFIG.shot.wobblePressureRadius;
    let s = 0;
    for (const o of this.game.opponentsOf(p)) {
      if (o.isKeeper) continue;
      const d = Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z);
      if (d < R) s += 1 - d / R;
    }
    return clamp(s, 0, 1.5);
  }

  wobbleAmplitude(power) {
    const S = CONFIG.shot, M = CONFIG.statMap;
    const p = this.aim.shooter;
    const st = p.stats;
    const base = M.finishingWobble(st.finishing);
    const pressure = this._pressure * S.wobblePressure * M.composureMult(st.composure);
    const stam = p.stamina < M.lowStaminaThreshold
      ? M.lowStaminaWobble * (1 - p.stamina / M.lowStaminaThreshold) : 0;
    const red = power > S.yellowMax ? ((power - S.yellowMax) / (1 - S.yellowMax)) * S.wobbleRedZone : 0;
    const ball = this.game.ball;
    const dist = Math.hypot(CONFIG.pitch.length / 2 - ball.pos.x, ball.pos.z);
    const distW = Math.max(0, dist - 12) * S.wobbleDistance;
    return (base + pressure + stam + red + distW) * S.wobbleScale;
  }

  shotSpeed(power) {
    const S = CONFIG.shot;
    const max = CONFIG.statMap.maxShotSpeed(this.aim.shooter.stats.shotPower) * S.powerCap;
    return lerp(S.minSpeed, Math.max(S.minSpeed + 1, max), Math.pow(power, S.powerCurve));
  }

  /** Per-frame while frozen (real dt). */
  updateAim(realDt) {
    const a = this.aim;
    if (!a) return;
    a.time += realDt * CONFIG.shot.wobbleSpeed;
    const ov = this.game.overlay;
    if (!a.active) { ov.drawIdle(a); return; }
    this._computePull();
    if (a.inCancel) {
      a.launch = null;
      ov.drawCancel(a, this.metrics());
      ov.setTarget(null);
      return;
    }
    const amp = this.wobbleAmplitude(a.power);
    a.wobbleAmp = amp;
    const wz = amp * a.n1.sample(a.time * 1.4);
    const wy = amp * 0.7 * a.n2.sample(a.time * 1.4 + 3.1);
    const gx = CONFIG.pitch.length / 2;
    a.target.set(gx, Math.max(CONFIG.ball.radius, a.aimY + wy), a.aimZ + wz);
    const speed = this.shotSpeed(a.power);
    const curve = clamp(a.aimZ / CONFIG.shot.lateralGain, -1, 1) * CONFIG.shot.curvePerLateral;
    const sol = this.solve(this.game.ball.pos, a.target, speed, curve);
    a.launch = sol;
    a.pred = sol.result;
    ov.drawArrow(a, this.metrics(), this.game.camRig.camera, this.game.ball.mesh.position);
    if (sol.result.cross) {
      const c = sol.result.cross;
      ov.setTarget(new THREE.Vector3(gx, c.y, c.z), sol.result.onTarget, this.game.camRig.camera);
    } else {
      ov.setTarget(sol.result.end, false, this.game.camRig.camera);
    }
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
        return { cross, path, end: new THREE.Vector3(gx, cross.y, cross.z), speedAt: Math.hypot(vxAt, s.vy, s.vz) };
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
  fire() {
    const a = this.aim;
    if (!a || !a.launch) return false;
    const g = this.game, ball = g.ball;
    const L = a.launch;
    const shooter = a.shooter;
    shooter.playAction('shoot', 0.6, { kickLeg: 1 });
    ball.kick(L.vx, L.vy, L.vz, { curve: L.curve, type: 'shot', by: shooter, ignoreTime: 0.4, time: g.simTime });
    ball.owner = null;
    g.audio.kick(0.4 + a.power * 0.6);
    g.effects.puff(ball.pos.x, ball.pos.z, 1 + a.power);
    if (a.power > CONFIG.shot.yellowMax) g.camRig.addShake(CONFIG.juice.shotShake * (1 + a.power));
    const info = { ...L.result, speed: L.speed, power: a.power };
    const kp = g.keeper.onShot(L.result.path, info, shooter);
    const edgeClose = info.onTarget ? info.edgeDistance < CONFIG.shot.closeCallMargin * 0.6 : info.missDistance < CONFIG.shot.closeCallMargin;
    const keeperClose = kp && kp.prob > 0.2 && kp.prob < 0.8;
    this.flight = {
      info, keeper: kp, t: 0, origin: ball.pos.clone(),
      closeCall: !!(edgeClose || keeperClose), slow: false,
      blocked: new Set(), postHit: false, shooter,
    };
    this.lastLaunch = { power: a.power, speed: L.speed, onTarget: info.onTarget };
    g.events.emit('shot', { shooter, info, power: a.power });
    this.endAim();
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

  clearFlight() {
    if (this.flight && this.flight.slow) this.game.setTimeScale(1, 0.2);
    this.flight = null;
  }
}
