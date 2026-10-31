// Under floodlights every player throws several faint shadows, one per light
// bank, fanning out from his feet — the most recognisable thing about a night
// game on TV. One instanced quad per player per light; length from the
// light's height and distance, fading with distance from the feet.
import * as THREE from 'three';
import { FLOODS } from './Look.js';

function shadowTex() {
  const W = 32, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const id = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);                       // 0 at the feet → 1 at the head's shadow
    const width = 0.55 + 0.45 * Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) - (t > 0.82 ? (t - 0.82) * 2 : 0);
    const dens = (1 - t * 0.55) * Math.min(1, t * 9 + 0.35);
    for (let x = 0; x < W; x++) {
      const u = Math.abs(x / (W - 1) - 0.5) * 2 / Math.max(0.1, width);
      const a = Math.max(0, 1 - u * u) ** 1.4 * dens;
      const i = (y * W + x) * 4;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = 0; id.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(id, 0, 0);
  return new THREE.CanvasTexture(c);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _e = new THREE.Euler();

export class FloodShadows {
  constructor(scene, max = 24) {
    this.max = max;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, 0.5);              // from the feet (z = 0) out along +z
    const mat = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.2,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    this.mesh = new THREE.InstancedMesh(geo, mat, max * FLOODS.length);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.strength = 1;
  }

  setStrength(k) { this.strength = k; this.mesh.visible = k > 0.01; this.mesh.material.opacity = 0.17 * k; }

  /** players: anything with pos (Vector3), visible, height (m) */
  update(players) {
    if (!this.mesh.visible) return;
    let n = 0;
    for (const p of players) {
      if (!p || !p.visible || n >= this.max * FLOODS.length) continue;
      const h = 1.8 * (p.heightScale || 1);
      for (const L of FLOODS) {
        const dx = p.pos.x - L[0], dz = p.pos.z - L[2];
        const d = Math.hypot(dx, dz) || 1;
        const len = Math.min(7, (h * d) / Math.max(4, L[1] - h));
        _e.set(0, Math.atan2(dx, dz), 0);
        _q.setFromEuler(_e);
        _s.set(0.62, 1, len);
        _p.set(p.pos.x, 0.012, p.pos.z);
        _m.compose(_p, _q, _s);
        this.mesh.setMatrixAt(n++, _m);
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
