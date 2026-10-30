// Camera rig: follow cam (behind/above the user, toward goal), shot cam
// (behind the ball during aim), flight cam, replay cam, celebration cam.
// All motion is critically-damped smoothing on real (unscaled) time.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { dampT, clamp } from '../core/MathUtil.js';

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
    this.mode = 'follow';
    this.pos = new THREE.Vector3(-20, 10, 0);
    this.look = new THREE.Vector3(0, 0, 0);
    this.desiredPos = new THREE.Vector3();
    this.desiredLook = new THREE.Vector3();
    this.fov = 50;
    this.shake = 0;
    this.shakeT = 0;
    this.portrait = false;
    this.forward = new THREE.Vector3(1, 0, 0); // ground-projected camera forward (for joystick mapping)
    this.right = new THREE.Vector3(0, 0, 1);
    this.zoom = 1;
    this.snapNext = false;
    this._yaw = 0;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.portrait = h > w;
    this.camera.updateProjectionMatrix();
  }

  setMode(mode, opts = {}) {
    this.mode = mode;
    this.opts = opts;
  }

  addShake(a) { this.shake = Math.min(1, this.shake + a); }

  snap() { this.snapNext = true; }

  _settings() { return this.portrait ? CONFIG.camera.portrait : CONFIG.camera.landscape; }

  update(dt, game) {
    const C = CONFIG.camera;
    const S = this._settings();
    let posK = C.posDamping, lookK = C.lookDamping, fov = S.fov;
    const gx = CONFIG.pitch.length / 2;

    if (this.mode === 'follow' || this.mode === 'intro') {
      const u = game.user;
      const focus = this._focus || (this._focus = new THREE.Vector3());
      // follow the user but keep the ball in frame when a teammate has it
      focus.copy(u.pos);
      if (game.ball.owner && game.ball.owner !== u) focus.lerp(game.ball.pos, 0.35);
      focus.y = 0;
      // yaw: mostly down the pitch, biased toward the goal
      const toGoal = Math.atan2(0 - focus.z, gx - focus.x);
      const yaw = toGoal * S.goalBias; // how much the camera yaw tracks the goal direction
      this._yaw += (yaw - this._yaw) * dampT(2, dt);
      const fx = Math.cos(this._yaw), fz = Math.sin(this._yaw);
      // zoom out when crowded / fast
      let crowd = 0;
      for (const p of game.players) {
        if (p === u) continue;
        const d = Math.hypot(p.pos.x - u.pos.x, p.pos.z - u.pos.z);
        if (d < C.crowdRadius) crowd += 1 - d / C.crowdRadius;
      }
      const sp = u.speed / u.attrs.sprintSpeed;
      const targetZoom = 1 + clamp(crowd / 4, 0, 1) * C.crowdZoom + sp * C.speedZoom;
      this.zoom += (targetZoom - this.zoom) * dampT(1.5, dt);
      const dist = S.distance * C.distanceMult * this.zoom;
      const hgt = S.height * C.heightMult * this.zoom;
      const la = S.lookAhead;
      const vx = u.vel.x * 0.35, vz = u.vel.z * 0.35;
      this.desiredPos.set(focus.x - fx * dist + vx, hgt, focus.z - fz * dist + vz);
      this.desiredLook.set(focus.x + fx * la + vx * 1.2, S.lookHeight, focus.z + fz * la + vz * 1.2);
    } else if (this.mode === 'shot') {
      // Low camera behind the ball, framed so the ball sits near the bottom of the
      // screen and the goal mouth sits above centre (tightest FOV that fits both).
      const b = game.ball.pos;
      const sc = C.shot;
      const dx = gx - b.x, dz = 0 - b.z;
      const l = Math.hypot(dx, dz) || 1;
      const nx = dx / l, nz = dz / l;
      // slightly to the right; the (right-footed) shooter sets up on the left of the ball
      const sx = -nz * sc.side, sz = nx * sc.side;
      const cx = b.x - nx * sc.back + sx, cz = b.z - nz * sc.back + sz, cy = sc.height;
      this.desiredPos.set(cx, cy, cz);
      const yaw = Math.atan2(b.z * 0.12 - cz, gx - cx);
      const fx = Math.cos(yaw), fz = Math.sin(yaw);
      // vertical angles (below the horizon is positive) of the ball and goal centre
      const ballH = Math.max(0.3, (b.x - cx) * fx + (b.z - cz) * fz);
      const goalH = Math.max(1, (gx - cx) * fx + (0 - cz) * fz);
      const aBall = Math.atan2(cy - b.y, ballH);
      const aGoal = Math.atan2(cy - 1.2, goalH);
      let half = (aBall - aGoal) / (sc.ballNdc + sc.goalNdc);
      // in narrow (portrait) frames make sure the whole goal fits across
      const goalHalf = Math.atan((CONFIG.pitch.goalWidth / 2 + 1.5) / goalH);
      half = Math.max(half, Math.atan(Math.tan(goalHalf) / this.camera.aspect));
      half = clamp(half, (sc.minFov * Math.PI) / 360, (sc.maxFov * Math.PI) / 360);
      const centre = aGoal + sc.goalNdc * half;
      this.desiredLook.set(cx + fx * 10 * Math.cos(centre), cy - 10 * Math.sin(centre), cz + fz * 10 * Math.cos(centre));
      posK = sc.damping; lookK = sc.damping;
      fov = (half * 360) / Math.PI;
    } else if (this.mode === 'flight') {
      const b = game.ball.pos;
      const o = this.opts.origin || b;
      const dx = gx - o.x, dz = -o.z;
      const l = Math.hypot(dx, dz) || 1;
      const nx = dx / l, nz = dz / l;
      const back = this.portrait ? 6 : 4.5;
      this.desiredPos.set(b.x - nx * back, Math.max(1.6, b.y + 1.2), b.z - nz * back);
      // don't fly into the net
      this.desiredPos.x = Math.min(this.desiredPos.x, gx - 2.5);
      this.desiredLook.set(b.x + nx * 3, b.y * 0.6 + 0.6, b.z + nz * 3);
      posK = C.flight.damping; lookK = 10;
      fov = this.portrait ? 60 : 46;
    } else if (this.mode === 'celebrate') {
      const t = this.opts.target || game.user.pos;
      const ang = (this.opts.angle || 0) + game.realTime * 0.25;
      const r = this.portrait ? 9 : 7;
      this.desiredPos.set(t.x + Math.cos(ang) * r, 2.6, t.z + Math.sin(ang) * r);
      this.desiredLook.set(t.x, 1.1, t.z);
      posK = 2.5; lookK = 4;
      fov = this.portrait ? 58 : 45;
    } else if (this.mode === 'replay') {
      // broadcast-style side view tracking the ball, low and close
      const b = this.opts.ballPos || game.ball.mesh.position;
      const side = this.opts.side || 1;
      this.desiredPos.set(b.x - 7, 3.2, b.z + side * (this.portrait ? 16 : 12));
      this.desiredLook.set(b.x + 1.5, 1, b.z);
      posK = 3.5; lookK = 6;
      fov = this.portrait ? 55 : 40;
    } else if (this.mode === 'goalview') {
      // looking back from behind the net
      this.desiredPos.set(gx + 7, 3.4, (this.opts.z || 0) * 0.4 + 2);
      this.desiredLook.set(gx - 6, 1, (this.opts.z || 0) * 0.5);
      posK = 3; lookK = 5;
    }

    if (this.snapNext) {
      this.pos.copy(this.desiredPos);
      this.look.copy(this.desiredLook);
      this.snapNext = false;
    } else {
      this.pos.lerp(this.desiredPos, dampT(posK, dt));
      this.look.lerp(this.desiredLook, dampT(lookK, dt));
    }
    this.fov += (fov - this.fov) * dampT(5, dt);

    const cam = this.camera;
    cam.position.copy(this.pos);
    if (this.shake > 0.001) {
      this.shakeT += dt * 38;
      const a = this.shake * this.shake * 0.45;
      cam.position.x += Math.sin(this.shakeT * 1.1) * a;
      cam.position.y += Math.sin(this.shakeT * 1.7 + 1) * a * 0.7;
      cam.position.z += Math.sin(this.shakeT * 1.3 + 2) * a;
      this.shake = Math.max(0, this.shake - C.shakeDecay * dt * this.shake - 0.05 * dt);
    }
    cam.lookAt(this.look);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }

    // ground-projected basis for camera-relative joystick
    this.forward.set(this.look.x - this.pos.x, 0, this.look.z - this.pos.z);
    if (this.forward.lengthSq() < 1e-6) this.forward.set(1, 0, 0);
    this.forward.normalize();
    this.right.set(-this.forward.z, 0, this.forward.x);
  }
}
