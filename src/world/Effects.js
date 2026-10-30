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
