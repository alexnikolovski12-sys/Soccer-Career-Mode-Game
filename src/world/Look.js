// Match "look": time of day × weather → sky, lights, fog, exposure and an
// image-based-lighting environment (PMREM) so kits, skin, the ball and a wet
// pitch pick up the stadium's light the way they would for real.
import * as THREE from 'three';
import { GRASS } from './Grass.js';

// Light positions are around a 105 × 68 pitch: the floodlights sit in the roof
// rims of the four stands (≈ 32 m up).
export const FLOODS = [[-40, 33, -58], [40, 33, -58], [-40, 33, 58], [40, 33, 58]];

const PRESETS = {
  night: {
    sky: ['#03060c', '#101a2c', '#2a3a55'], fog: ['#0b1220', 140, 360], exposure: 1.0,
    hemi: ['#a9bde0', '#2c4a22', 0.5],
    key: ['#f4f7ff', 2.3, [-12, 70, -30]],     // the sum of the floodlights: high, nearly overhead
    fill: ['#eef3ff', 1.15, [30, 40, 45]],
    env: 0.75, flood: 1, sun: 0, stand: 0.5, grass: [0.07, 0.19, 0.04],
  },
  dusk: {
    sky: ['#141b3a', '#5d4a6e', '#f08a4b'], fog: ['#3b3348', 150, 380], exposure: 1.02,
    hemi: ['#ffc9a0', '#2e4524', 0.55],
    key: ['#ffb27a', 2.2, [-90, 22, -35]],
    fill: ['#e9efff', 1.0, [25, 45, 40]],
    env: 0.8, flood: 0.7, sun: 1, stand: 0.6, grass: [0.075, 0.19, 0.04],
  },
  day: {
    sky: ['#2f66b8', '#7fa9dd', '#c9dcef'], fog: ['#a9c0da', 170, 460], exposure: 0.92,
    hemi: ['#cfe1ff', '#3d5a2c', 0.85],
    key: ['#fff1da', 3.3, [-45, 62, -32]],
    fill: ['#c8dcff', 0.35, [40, 30, 40]],
    env: 1.0, flood: 0, sun: 1, stand: 0.85, grass: [0.085, 0.205, 0.045],
  },
};

const C = (h) => new THREE.Color(h);

export class Look {
  constructor(renderer, scene, pitch) {
    this.renderer = renderer;
    this.scene = scene;
    this.pitch = pitch;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.time = 'night';
    this.weather = 'clear';
    this.envRT = null;
    this.flood = 1;
  }

  /** Build the little room the environment map is rendered from. */
  _envScene(L, wet) {
    const s = new THREE.Scene();
    // sky / stands / grass gradient on a big sphere
    const geo = new THREE.SphereGeometry(100, 48, 24);
    const pos = geo.attributes.position, cols = [];
    const top = C(L.sky[0]), mid = C(L.sky[1]), hor = C(L.sky[2]);
    const stand = C('#2a2f3a').multiplyScalar(L.stand), grass = new THREE.Color(...L.grass).multiplyScalar(wet ? 1.2 : 1.6);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 100;
      let c;
      if (y > 0.42) c = mid.clone().lerp(top, Math.min(1, (y - 0.42) / 0.5));
      else if (y > 0.3) c = hor.clone().lerp(mid, (y - 0.3) / 0.12);
      else if (y > 0.02) c = stand.clone().lerp(hor, Math.pow(Math.max(0, (y - 0.24) / 0.06), 2));   // the stands ring
      else c = grass.clone().lerp(stand, Math.max(0, (y + 0.06) / 0.08));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    // floodlight banks: bright panels up in the roof rims (they're what wet grass and shiny kits reflect)
    if (L.flood > 0) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.98, 0.92).multiplyScalar(26 * L.flood), side: THREE.DoubleSide });
      for (const sz of [-1, 1]) {
        for (let k = -3; k <= 3; k++) {
          const g = new THREE.PlaneGeometry(7, 1.8);
          const pnl = new THREE.Mesh(g, m);
          const ang = k * 0.17;
          pnl.position.set(Math.sin(ang) * 80 * -sz, 34, Math.cos(ang) * 80 * sz);
          pnl.lookAt(0, 0, 0);
          s.add(pnl);
        }
      }
    }
    if (L.sun > 0) {
      const d = new THREE.Vector3(...L.key[2]).normalize().multiplyScalar(90);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8), new THREE.MeshBasicMaterial({ color: C(L.key[0]).multiplyScalar(40 * L.sun) }));
      sun.position.copy(d);
      s.add(sun);
    }
    return s;
  }

  set(time = this.time, weather = this.weather) {
    this.time = time; this.weather = weather;
    const L = PRESETS[time] || PRESETS.night;
    const p = this.pitch, scene = this.scene;
    const rain = weather === 'rain', snow = weather === 'snow';
    const dim = rain ? 0.84 : snow ? 0.85 : 1;
    // sky dome
    if (p.skyMesh) {
      const g = p.skyMesh.geometry, pos = g.attributes.position;
      const top = C(L.sky[0]), mid = C(L.sky[1]), hor = C(L.sky[2]);
      if (rain || snow) { const grey = C(snow ? '#8a94a3' : '#3a4250'); top.lerp(grey, 0.6); mid.lerp(grey, 0.7); hor.lerp(grey, 0.75); }
      const col = g.attributes.color;
      for (let i = 0; i < pos.count; i++) {
        const t = Math.max(0, pos.getY(i) / 420);
        const c = t > 0.25 ? mid.clone().lerp(top, Math.min(1, (t - 0.25) / 0.6)) : hor.clone().lerp(mid, t / 0.25);
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
      p.skyMesh.material.color.setRGB(1, 1, 1);
    }
    // lights
    p.hemi.color.set(L.hemi[0]); p.hemi.groundColor.set(L.hemi[1]); p.hemi.intensity = L.hemi[2] * (rain ? 0.9 : 1);
    p.sun.color.set(L.key[0]); p.sun.intensity = L.key[1] * dim;
    p.sunOffset.set(...L.key[2]);
    if (p.fill) { p.fill.color.set(L.fill[0]); p.fill.intensity = L.fill[1] * dim; p.fill.position.set(...L.fill[2]); }
    // fog
    const fogC = C(L.fog[0]);
    let near = L.fog[1], far = L.fog[2];
    if (rain) { fogC.lerp(C('#39414d'), 0.5); near *= 0.85; far *= 0.85; }
    if (snow) { fogC.lerp(C('#a6b0bd'), 0.6); near *= 0.4; far *= 0.6; }
    scene.fog.color.copy(fogC); scene.fog.near = near; scene.fog.far = far;
    this.renderer.toneMappingExposure = L.exposure;
    this.exposure = L.exposure;
    // turf
    GRASS.uGrass.value.setRGB(...L.grass);
    GRASS.uWet.value = rain ? 1 : 0;
    GRASS.uStripe.value = snow ? 0.05 : 0.11;
    // floodlights on / off
    this.flood = L.flood;
    if (p.setFloodlights) p.setFloodlights(L.flood, time, weather);
    // environment
    if (this.envRT) this.envRT.dispose();
    const es = this._envScene(L, rain);
    this.envRT = this.pmrem.fromScene(es, 0.02, 0.1, 300);
    es.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = L.env * (rain ? 0.9 : 1);
    this.preset = L;
  }
}

export const TIMES = ['night', 'dusk', 'day'];
