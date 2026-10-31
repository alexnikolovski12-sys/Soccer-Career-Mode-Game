// Match weather: clear, rain or snow. Falling particles live in a box that
// follows the camera; rain darkens the light and wets the grass, snow dusts
// the pitch white (the lines stay cleared) and brings the fog in.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const BOX = { x: 70, y: 24, z: 70 };

function flakeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,.75)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

/** Patchy snow cover: mostly white, thinner where players run (the middle and the goalmouths). */
function snowTexture(spanX, spanZ) {
  const W = 512, H = Math.round((512 * spanZ) / spanX);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H), d = img.data;
  // value noise, a few octaves
  const rnd = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = rnd(xi, yi), b = rnd(xi + 1, yi), cc = rnd(xi, yi + 1), dd = rnd(xi + 1, yi + 1);
    return a + (b - a) * u + (cc - a) * v + (a - b - cc + dd) * u * v;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let n = 0, amp = 0.55, f = 0.06;
      for (let o = 0; o < 4; o++) { n += noise(x * f, y * f) * amp; amp *= 0.5; f *= 2.1; }
      // worn areas: centre strip and goalmouths
      const wx = (x / W - 0.5) * spanX, wz = (y / H - 0.5) * spanZ;
      const L = CONFIG.pitch.length / 2;
      const wear = Math.max(Math.exp(-(wz * wz) / 140) * 0.35, Math.exp(-((Math.abs(wx) - L + 6) ** 2 + wz * wz) / 60) * 0.6);
      const a = Math.max(0, Math.min(1, 0.8 + (n - 0.5) * 1.1 - wear));
      const i = (y * W + x) * 4;
      d[i] = 236; d[i + 1] = 242; d[i + 2] = 250; d[i + 3] = a * 235;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Weather {
  constructor(scene, pitch) {
    this.scene = scene;
    this.pitch = pitch;
    this.kind = 'clear';
    this.group = new THREE.Group();
    this.group.frustumCulled = false;
    scene.add(this.group);
    this.base = null;
    this.density = 1;
  }

  _remember() {
    if (this.base) return;
    const p = this.pitch;
    this.base = {
      hemi: p.hemi ? p.hemi.intensity : 1, sun: p.sun.intensity, fog: this.scene.fog.color.clone(),
      near: this.scene.fog.near, far: this.scene.fog.far, grass: p.grassMat.color.clone(),
      sky: p.skyMesh ? p.skyMesh.material.color.clone() : null,
    };
  }

  /** 'clear' | 'rain' | 'snow'. density 0..1 scales the particle count (quality). */
  set(kind, density = this.density) {
    this._remember();
    this.kind = kind;
    this.density = density;
    const p = this.pitch, B = this.base, fog = this.scene.fog;
    // reset to the clear-night look
    if (p.hemi) p.hemi.intensity = B.hemi;
    p.sun.intensity = B.sun;
    fog.color.copy(B.fog); fog.near = B.near; fog.far = B.far;
    p.grassMat.color.copy(B.grass);
    if (p.skyMesh && B.sky) p.skyMesh.material.color.copy(B.sky);
    if (this.snowCover) this.snowCover.visible = false;
    this._clearParticles();
    if (kind === 'rain') {
      if (p.hemi) p.hemi.intensity = B.hemi * 0.8;
      p.sun.intensity = B.sun * 0.65;
      fog.color.set('#2a3340'); fog.near = 60; fog.far = 220;
      p.grassMat.color.setRGB(0.82, 0.88, 0.86);          // darker, wet
      if (p.skyMesh) p.skyMesh.material.color.setRGB(0.6, 0.62, 0.66);
      this._rain(Math.round(1800 * density + 400));
    } else if (kind === 'snow') {
      if (p.hemi) p.hemi.intensity = B.hemi * 1.05;
      p.sun.intensity = B.sun * 0.7;
      fog.color.set('#9aa7b8'); fog.near = 45; fog.far = 190;
      p.grassMat.color.setRGB(0.95, 1.0, 0.98);
      if (p.skyMesh) p.skyMesh.material.color.setRGB(1.25, 1.25, 1.3);
      this._snowCover();
      this.snowCover.visible = true;
      this._snow(Math.round(2200 * density + 500));
    }
  }

  _clearParticles() {
    if (this.points) { this.group.remove(this.points); this.points.geometry.dispose(); this.points.material.dispose(); this.points = null; }
  }

  _seed(n) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = (Math.random() - 0.5) * BOX.x;
      a[i * 3 + 1] = Math.random() * BOX.y;
      a[i * 3 + 2] = (Math.random() - 0.5) * BOX.z;
    }
    return a;
  }

  _rain(n) {
    this.drops = this._seed(n);
    this.n = n;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    const mat = new THREE.LineBasicMaterial({ color: '#b9c8dc', transparent: true, opacity: 0.38, depthWrite: false });
    this.points = new THREE.LineSegments(geo, mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  _snow(n) {
    this.drops = this._seed(n);
    this.n = n;
    this.phase = new Float32Array(n).map(() => Math.random() * 6.28);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.2, map: this.flake || (this.flake = flakeTexture()), transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  _snowCover() {
    if (this.snowCover) return;
    const g = this.pitch.grass.geometry.parameters;
    const mat = new THREE.MeshLambertMaterial({ map: snowTexture(g.width, g.height), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(g.width, g.height), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.003;
    m.receiveShadow = true;
    m.renderOrder = 0.5;
    this.pitch.group.add(m);
    this.snowCover = m;
  }

  /** Move the particles; they wrap around the camera so there's always weather in view. */
  update(dt, camPos, time) {
    if (!this.points || this.kind === 'clear') return;
    const d = this.drops, n = this.n, hx = BOX.x / 2, hz = BOX.z / 2;
    const cx = camPos.x, cz = camPos.z;
    const pos = this.points.geometry.attributes.position.array;
    const wrap = (v, c, h) => { let r = v - c; r = ((r + h) % (2 * h) + 2 * h) % (2 * h) - h; return c + r; };
    if (this.kind === 'rain') {
      const vy = -24, vx = 2.5, vz = 1.2, len = 0.045;
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        let x = d[k] + vx * dt, y = d[k + 1] + vy * dt, z = d[k + 2] + vz * dt;
        if (y < 0) y += BOX.y;
        x = wrap(x, cx, hx); z = wrap(z, cz, hz);
        d[k] = x; d[k + 1] = y; d[k + 2] = z;
        const o = i * 6;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
        pos[o + 3] = x - vx * len; pos[o + 4] = y - vy * len; pos[o + 5] = z - vz * len;
      }
    } else {
      const ph = this.phase;
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        const s = Math.sin(time * 0.9 + ph[i]);
        let x = d[k] + (0.5 + s * 0.6) * dt, y = d[k + 1] - (1.1 + (i % 7) * 0.08) * dt, z = d[k + 2] + Math.cos(time * 0.7 + ph[i]) * 0.5 * dt;
        if (y < 0) y += BOX.y;
        x = wrap(x, cx, hx); z = wrap(z, cz, hz);
        d[k] = x; d[k + 1] = y; d[k + 2] = z;
        pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

export const WEATHER_NAMES = { clear: 'Clear', rain: 'Rain', snow: 'Snow' };
