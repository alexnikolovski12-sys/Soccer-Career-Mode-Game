// Slingshot visuals: 2-D arrow (opposite the drag, coloured by power),
// cancel ring at the touch origin, and a 3-D target circle on the goal mouth
// (or a faint red X when the shot would miss).
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _v = new THREE.Vector3();
const cG = new THREE.Color(), cY = new THREE.Color(), cR = new THREE.Color(), cOut = new THREE.Color();

export function powerColour(p, out = cOut) {
  const S = CONFIG.shot, C = CONFIG.colors;
  cG.set(C.arrowGreen); cY.set(C.arrowYellow); cR.set(C.arrowRed);
  // smooth blends across the zone borders
  const blend = 0.08;
  if (p < S.greenMax - blend) return out.copy(cG);
  if (p < S.greenMax + blend) return out.copy(cG).lerp(cY, (p - (S.greenMax - blend)) / (2 * blend));
  if (p < S.yellowMax - blend) return out.copy(cY);
  if (p < S.yellowMax + blend) return out.copy(cY).lerp(cR, (p - (S.yellowMax - blend)) / (2 * blend));
  return out.copy(cR);
}

export function powerZone(p) {
  const S = CONFIG.shot;
  return p < S.greenMax ? 'CONTROLLED' : p < S.yellowMax ? 'STRONG' : 'ROCKET';
}

export class ShotOverlay {
  constructor(parent, scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'shot-canvas';
    parent.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.dpr = 1;
    this.time = 0;
    this.resize();

    // target circle (3-D, lies on the goal plane)
    const ringMat = new THREE.MeshBasicMaterial({
      color: CONFIG.colors.targetCircle, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide,
    });
    this.ring = new THREE.Group();
    const r = CONFIG.shot.targetRadius;
    const outer = new THREE.Mesh(new THREE.RingGeometry(r * 0.78, r, 40), ringMat);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(r * 0.16, 16), ringMat);
    this.ring.add(outer, dot);
    this.ring.rotation.y = -Math.PI / 2;
    this.ring.renderOrder = 20;
    outer.renderOrder = 20; dot.renderOrder = 20;
    this.ring.visible = false;
    scene.add(this.ring);
    this.ringMat = ringMat;

    // miss X
    const xc = document.createElement('canvas');
    xc.width = xc.height = 64;
    const xg = xc.getContext('2d');
    xg.strokeStyle = CONFIG.colors.missX;
    xg.lineWidth = 9; xg.lineCap = 'round';
    xg.beginPath(); xg.moveTo(14, 14); xg.lineTo(50, 50); xg.moveTo(50, 14); xg.lineTo(14, 50); xg.stroke();
    this.missX = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(xc), depthTest: false, transparent: true, opacity: 0.55,
    }));
    this.missX.scale.set(0.5, 0.5, 1);
    this.missX.renderOrder = 20;
    this.missX.visible = false;
    scene.add(this.missX);
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }

  _begin() {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    return g;
  }

  clear() {
    this._begin();
    this.ring.visible = false;
    this.missX.visible = false;
  }

  /** Aim mode with no finger down: gentle hint pulse around the ball. */
  drawIdle() {
    this._begin();
    this.ring.visible = false;
    this.missX.visible = false;
  }

  drawCancel(a, m) {
    const g = this._begin();
    // cancel zone at the touch origin
    g.lineWidth = 2;
    g.setLineDash([5, 5]);
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.beginPath(); g.arc(a.start.x, a.start.y, m.cancelR + 6, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = '600 13px "Barlow Condensed", sans-serif';
    g.textAlign = 'center';
    g.fillText(a.L > 2 ? 'CANCELLED' : 'PULL BACK', a.start.x, a.start.y - m.cancelR - 14);
  }

  drawArrow(a, m, camera, ballWorld) {
    const g = this._begin();
    this.time += 1 / 60;
    _v.copy(ballWorld).project(camera);
    const bx = (_v.x * 0.5 + 0.5) * this.w, by = (-_v.y * 0.5 + 0.5) * this.h;
    const len = Math.min(a.L, a.maxPull * 1.05);
    const ux = -a.dx / (a.L || 1), uy = -a.dy / (a.L || 1);
    const arrowLen = 26 + len * 1.25;
    const tx = bx + ux * arrowLen, ty = by + uy * arrowLen;
    const p = a.power;
    const col = powerColour(p);
    const css = `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
    const red = p >= CONFIG.shot.yellowMax;
    const pulse = red ? 1 + Math.sin(performance.now() / 1000 * 16) * 0.16 : 1;
    const thick = (6 + p * 9) * pulse;

    // drag guide: origin ring + line from origin to finger
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1.5;
    g.setLineDash([4, 6]);
    g.beginPath(); g.arc(a.start.x, a.start.y, m.cancelR + 6, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(a.start.x, a.start.y); g.lineTo(a.cur.x, a.cur.y); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath(); g.arc(a.cur.x, a.cur.y, 7, 0, Math.PI * 2); g.fill();

    // arrow shaft with glow
    const shaftEnd = arrowLen - thick * 1.6;
    const sx = bx + ux * shaftEnd, sy = by + uy * shaftEnd;
    g.save();
    g.shadowColor = css;
    g.shadowBlur = red ? 22 * pulse : 12;
    const grad = g.createLinearGradient(bx, by, tx, ty);
    grad.addColorStop(0, `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.25)`);
    grad.addColorStop(1, css);
    g.strokeStyle = grad;
    g.lineCap = 'round';
    g.lineWidth = thick;
    g.beginPath(); g.moveTo(bx + ux * 14, by + uy * 14); g.lineTo(sx, sy); g.stroke();
    // head
    const nx = -uy, ny = ux;
    const hw = thick * 1.25 + 6;
    g.fillStyle = css;
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(sx + nx * hw, sy + ny * hw);
    g.lineTo(sx - nx * hw, sy - ny * hw);
    g.closePath(); g.fill();
    g.restore();

    // power readout near the arrow tip
    g.font = '700 15px "Barlow Condensed", sans-serif';
    g.textAlign = 'center';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    const label = `${powerZone(p)} ${Math.round(p * 100)}%`;
    const lx = tx + ux * 22, ly = ty + uy * 22;
    g.strokeText(label, lx, ly);
    g.fillStyle = css;
    g.fillText(label, lx, ly);
  }

  /**
   * pos: world point on the goal plane (or miss point); onTarget toggles circle vs X.
   * The marker keeps a minimum on-screen size so it stays readable from range.
   */
  setTarget(pos, onTarget, camera) {
    if (!pos) { this.ring.visible = false; this.missX.visible = false; return; }
    let k = 1;
    if (camera) {
      const dist = camera.position.distanceTo(pos);
      const minWorld = dist * Math.tan((camera.fov * Math.PI) / 360) * 0.05; // ≈5% of half-height
      k = Math.max(1, minWorld / CONFIG.shot.targetRadius);
    }
    if (onTarget) {
      this.ring.visible = true;
      this.missX.visible = false;
      this.ring.position.set(pos.x - 0.02, pos.y, pos.z);
      const s = (1 + Math.sin(performance.now() / 1000 * 6) * 0.06) * k;
      this.ring.scale.setScalar(s);
    } else {
      this.ring.visible = false;
      this.missX.visible = true;
      this.missX.position.copy(pos);
      this.missX.scale.set(0.5 * k, 0.5 * k, 1);
    }
  }
}
