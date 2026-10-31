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
      const a = Math.max(0, Math.min(1, 0.6 + (n - 0.5) * 1.5 - wear * 1.2));
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
    // (lights, fog, sky and the wet / snowy turf are handled by Look)
    this.kind = kind;
    this.density = density;
    if (this.snowCover) this.snowCover.visible = false;
    if (this.spl) this.spl.visible = false;
    this._clearParticles();
    if (kind === 'rain') this._rain(Math.round(1300 * density + 300));
    else if (kind === 'snow') {
      // (the snow on the pitch is drawn by the turf shader as patches)
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
    const mat = new THREE.LineBasicMaterial({ color: '#c9d6e6', transparent: true, opacity: 0.2, depthWrite: false });
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

  /** Rain splashes: little rings popping on the grass around the play. */
  _splashes(dt, f) {
    if (!this.spl) {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d');
      g.strokeStyle = 'rgba(220,230,245,0.9)'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(16, 16, 12, 0, 7); g.stroke();
      const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.5 });
      const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
      this.spl = new THREE.InstancedMesh(geo, mat, 90);
      this.spl.frustumCulled = false;
      this.splT = new Float32Array(90).map(() => Math.random() * 0.4);
      this.splP = new Float32Array(180);
      this.group.add(this.spl);
      this._m4 = new THREE.Matrix4(); this._sc = new THREE.Vector3(); this._ps = new THREE.Vector3(); this._qq = new THREE.Quaternion();
    }
    this.spl.visible = true;
    for (let i = 0; i < 90; i++) {
      this.splT[i] -= dt;
      if (this.splT[i] <= 0) {
        this.splT[i] = 0.35 + Math.random() * 0.25;
        this.splP[i * 2] = f.x + (Math.random() - 0.5) * 50; this.splP[i * 2 + 1] = f.z + (Math.random() - 0.5) * 34;
      }
      const k = 1 - this.splT[i] / 0.6;
      this._ps.set(this.splP[i * 2], 0.02, this.splP[i * 2 + 1]);
      this._sc.setScalar(0.05 + k * 0.22);
      this._m4.compose(this._ps, this._qq, this._sc);
      this.spl.setMatrixAt(i, this._m4);
    }
    this.spl.instanceMatrix.needsUpdate = true;
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
  update(dt, camPos, time, focus) {
    if (!this.points || this.kind === 'clear') return;
    if (this.kind === 'rain' && focus) this._splashes(dt, focus);
    const d = this.drops, n = this.n, hx = BOX.x / 2, hz = BOX.z / 2;
    const cx = camPos.x, cz = camPos.z;
    const pos = this.points.geometry.attributes.position.array;
    const wrap = (v, c, h) => { let r = v - c; r = ((r + h) % (2 * h) + 2 * h) % (2 * h) - h; return c + r; };
    if (this.kind === 'rain') {
      const vy = -24, vx = 2.5, vz = 1.2, len = 0.028;
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
