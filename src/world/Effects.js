// Visual juice: confetti burst, pass-target marker, grass puffs.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    // ---- confetti (one instanced mesh)
    const n = CONFIG.juice.confettiCount;
    const geo = new THREE.PlaneGeometry(0.14, 0.08);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.confetti = new THREE.InstancedMesh(geo, mat, n);
    this.confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.confetti.frustumCulled = false;
    this.confetti.visible = false;
    const palette = ['#ffe14d', '#ffffff', '#2c6cf0', '#7cf5ff', '#ff6b6b', '#38e86a'];
    const col = new THREE.Color();
    this.parts = [];
    for (let i = 0; i < n; i++) {
      col.set(palette[i % palette.length]);
      this.confetti.setColorAt(i, col);
      this.parts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 });
    }
    scene.add(this.confetti);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);

    // ---- pass marker: ring + chevron under the chosen receiver
    const mk = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32), new THREE.MeshBasicMaterial({
      color: CONFIG.colors.passMarker, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    mk.add(ring);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 4), new THREE.MeshBasicMaterial({ color: CONFIG.colors.passMarker }));
    cone.rotation.x = Math.PI;
    cone.position.y = 2.45;
    mk.add(cone);
    mk.visible = false;
    scene.add(mk);
    this.marker = { g: mk, ring, cone, t: 0, target: null };

    // ---- puffs (small pooled sprites)
    const pc = document.createElement('canvas');
    pc.width = pc.height = 32;
    const pg = pc.getContext('2d');
    const grd = pg.createRadialGradient(16, 16, 1, 16, 16, 15);
    grd.addColorStop(0, 'rgba(220,240,200,0.7)');
    grd.addColorStop(1, 'rgba(220,240,200,0)');
    pg.fillStyle = grd; pg.fillRect(0, 0, 32, 32);
    const pm = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(pc), transparent: true, depthWrite: false });
    this.puffs = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(pm.clone());
      s.visible = false;
      scene.add(s);
      this.puffs.push({ s, life: 0, v: new THREE.Vector3() });
    }
  }

  /** Turf / spray kicked up by a strike, a slide or a hard plant. wet = water spray instead. */
  turf(x, z, dx = 0, dz = 0, amount = 1, wet = false) {
    if (!this.bits) this._initBits();
    const n = Math.round(6 + 10 * amount);
    for (let k = 0; k < n; k++) {
      const b = this.bitPool[this.bitNext = (this.bitNext + 1) % this.bitPool.length];
      b.p.set(x + (Math.random() - 0.5) * 0.25, 0.04, z + (Math.random() - 0.5) * 0.25);
      const sp = (1.2 + Math.random() * 2.5) * (0.6 + amount * 0.6);
      b.v.set(dx * sp + (Math.random() - 0.5) * 1.6, 1.5 + Math.random() * 2.6 * (0.5 + amount * 0.5), dz * sp + (Math.random() - 0.5) * 1.6);
      b.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      b.life = 0.6 + Math.random() * 0.6;
      b.size = wet ? 0.025 + Math.random() * 0.02 : 0.03 + Math.random() * 0.05;
      const c = wet ? [0.75, 0.8, 0.86] : Math.random() < 0.7 ? [0.09 + Math.random() * 0.05, 0.22 + Math.random() * 0.08, 0.05] : [0.2, 0.15, 0.08];
      this.bits.setColorAt(this.bitPool.indexOf(b), this._c.setRGB(...c));
    }
    this.bits.instanceColor.needsUpdate = true;
    this.bitsOn = 2;
  }

  _initBits() {
    const N = 120;
    const g = new THREE.PlaneGeometry(1, 1);
    this.bits = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 }), N);
    this.bits.frustumCulled = false;
    this._c = new THREE.Color();
    for (let i = 0; i < N; i++) this.bits.setColorAt(i, this._c.setRGB(0.1, 0.25, 0.06));
    this.bitPool = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), life: 0, size: 0.04 }));
    this.bitNext = 0;
    this.scene.add(this.bits);
  }

  /** A breath of vapour in front of a player's face (cold nights / snow). */
  breath(x, y, z, hx, hz) {
    if (!this.breaths) {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(16, 16, 1, 16, 16, 15);
      grd.addColorStop(0, 'rgba(235,240,248,0.55)'); grd.addColorStop(1, 'rgba(235,240,248,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
      const tex = new THREE.CanvasTexture(c);
      this.breaths = Array.from({ length: 40 }, () => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        sp.visible = false; this.scene.add(sp);
        return { s: sp, life: 0, v: new THREE.Vector3() };
      });
      this.breathNext = 0;
    }
    const b = this.breaths[this.breathNext = (this.breathNext + 1) % this.breaths.length];
    b.life = 1.1;
    b.s.visible = true;
    b.s.position.set(x + hx * 0.16, y, z + hz * 0.16);
    b.s.scale.setScalar(0.12);
    b.v.set(hx * 0.5, 0.12, hz * 0.5);
  }

  burstConfetti(at) {
    this.confetti.visible = true;
    for (const c of this.parts) {
      c.p.set(at.x + (Math.random() - 0.5) * 6, 0.3 + Math.random() * 1.5, at.z + (Math.random() - 0.5) * 6);
      c.v.set((Math.random() - 0.5) * 7, 6 + Math.random() * 8, (Math.random() - 0.5) * 7);
      c.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      c.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      c.life = 3 + Math.random() * 2;
    }
    this.confettiOn = true;
  }

  puff(x, z, size = 1) {
    const p = this.puffs.find((q) => q.life <= 0);
    if (!p) return;
    p.life = 0.5;
    p.s.visible = true;
    p.s.position.set(x, 0.15, z);
    p.s.scale.setScalar(0.4 * size);
    p.s.material.opacity = 0.8;
    p.v.set((Math.random() - 0.5) * 0.6, 0.8, (Math.random() - 0.5) * 0.6);
  }

  showMarker(player) {
    this.marker.target = player;
    this.marker.t = CONFIG.pass.markerTime;
    this.marker.g.visible = true;
  }

  hideMarker() { this.marker.target = null; this.marker.g.visible = false; }

  update(dt, time) {
    // confetti
    if (this.confettiOn) {
      let alive = 0;
      for (let i = 0; i < this.parts.length; i++) {
        const c = this.parts[i];
        if (c.life > 0) {
          c.life -= dt;
          alive++;
          c.v.y -= 6 * dt;
          c.v.multiplyScalar(1 - 1.6 * dt);
          c.v.x += Math.sin(time * 3 + i) * 2 * dt;
          c.p.addScaledVector(c.v, dt);
          if (c.p.y < 0.02) { c.p.y = 0.02; c.v.set(0, 0, 0); }
          c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; c.r.z += c.w.z * dt;
        }
        this._q.setFromEuler(c.r);
        this._s.setScalar(c.life > 0 ? 1 : 0);
        this._m.compose(c.p, this._q, this._s);
        this.confetti.setMatrixAt(i, this._m);
      }
      this.confetti.instanceMatrix.needsUpdate = true;
      if (!alive) { this.confettiOn = false; this.confetti.visible = false; }
    }
    // marker
    const m = this.marker;
    if (m.g.visible && m.target) {
      m.t -= dt;
      m.g.position.set(m.target.parts.root.position.x, 0, m.target.parts.root.position.z);
      const s = 1 + Math.sin(time * 12) * 0.1;
      m.ring.scale.setScalar(s);
      m.cone.position.y = 2.45 + Math.sin(time * 8) * 0.08;
      if (m.t <= 0) this.hideMarker();
    }
    // turf bits
    if (this.bitsOn > 0) {
      this.bitsOn -= dt;
      for (let i = 0; i < this.bitPool.length; i++) {
        const b = this.bitPool[i];
        if (b.life > 0) {
          b.life -= dt;
          b.v.y -= 9.8 * dt;
          b.v.multiplyScalar(1 - 1.2 * dt);
          b.p.addScaledVector(b.v, dt);
          if (b.p.y < 0.01) { b.p.y = 0.01; b.v.set(0, 0, 0); }
          b.r.x += 9 * dt; b.r.z += 7 * dt;
        }
        this._q.setFromEuler(b.r);
        this._s.setScalar(b.life > 0 ? b.size : 0);
        this._m.compose(b.p, this._q, this._s);
        this.bits.setMatrixAt(i, this._m);
      }
      this.bits.instanceMatrix.needsUpdate = true;
    }
    // breath
    if (this.breaths) for (const b of this.breaths) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.s.position.addScaledVector(b.v, dt);
      b.v.multiplyScalar(1 - 1.5 * dt);
      b.s.scale.setScalar(0.12 + (1.1 - b.life) * 0.35);
      b.s.material.opacity = Math.max(0, Math.min(1, b.life / 0.6)) * 0.5;
      if (b.life <= 0) b.s.visible = false;
    }
    // puffs
    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.multiplyScalar(1 + dt * 2.5);
      p.s.material.opacity = Math.max(0, p.life / 0.5) * 0.8;
      if (p.life <= 0) p.s.visible = false;
    }
  }

  clear() {
    this.hideMarker();
    for (const c of this.parts) c.life = 0;
    this.confettiOn = false;
    this.confetti.visible = false;
  }
}
