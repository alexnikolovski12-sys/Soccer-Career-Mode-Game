// Pitch, markings, goals with rippling nets, a light stadium shell, sky and lights.
// Everything is procedural so it can be swapped for authored assets later.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { grassMaterial, grassShells, PitchWear } from './Grass.js';
import { Crowd } from './Crowd.js';

const P = () => CONFIG.pitch;

// ------------------------------------------------------------------ textures
function boardTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 128;
  const g = c.getContext('2d');
  const sets = [
    [['BREAKAWAY', '#0f1a33', '#ffe14d'], ['HARBOUR CITY FC', '#12305e', '#ffffff'], ['NORTHGATE', '#c8283a', '#ffffff'], ['MATCHDAY', '#111', '#7cf5ff'],
      ['VOLTA ENERGY', '#0d5c3a', '#c9ff4a'], ['SKYLINE AIR', '#ffffff', '#0b2a6b'], ['BREAKAWAY', '#0f1a33', '#ffe14d'], ['KICK ON', '#f2c21b', '#111111']],
    [['PRISM BANK', '#4a1d8f', '#ffffff'], ['BREAKAWAY ULTIMATE TEAM', '#05080f', '#7cf5ff'], ['RAPID CARS', '#e8e8e8', '#c8283a'], ['FRESHCO', '#2a7a2a', '#ffffff'],
      ['GOAL TV', '#c8283a', '#ffe14d'], ['NORTHGATE', '#111', '#ffffff'], ['ORBIT MOBILE', '#ff6a00', '#ffffff'], ['BREAKAWAY', '#0f1a33', '#ffe14d']],
  ];
  sets.forEach((items, row) => {
    const w = c.width / items.length;
    items.forEach(([txt, bg, fg], i) => {
      g.fillStyle = bg; g.fillRect(i * w, row * 64, w, 64);
      g.fillStyle = fg;
      g.font = `bold ${txt.length > 16 ? 30 : 40}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, i * w + w / 2, row * 64 + 34);
    });
  });
  // LED pixel grid
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x < c.width; x += 3) g.fillRect(x, 0, 1, c.height);
  for (let y = 0; y < c.height; y += 3) g.fillRect(0, y, c.width, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.repeat.set(1, 0.5);
  return t;
}

function glowTexture() {
  const gc = document.createElement('canvas');
  gc.width = gc.height = 128;
  const gg = gc.getContext('2d');
  const grd = gg.createRadialGradient(64, 64, 2, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,252,240,1)');
  grd.addColorStop(0.12, 'rgba(255,248,225,0.55)');
  grd.addColorStop(0.4, 'rgba(255,245,215,0.12)');
  grd.addColorStop(1, 'rgba(255,245,210,0)');
  gg.fillStyle = grd; gg.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(gc);
}

function netTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i <= 64; i += 16) { g.moveTo(i, 0); g.lineTo(i, 64); g.moveTo(0, i); g.lineTo(64, i); }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ------------------------------------------------------------------ marking geometry
class MarkingBuilder {
  constructor() { this.pos = []; this.idx = []; }
  quad(ax, az, bx, bz, w) {
    const dx = bx - ax, dz = bz - az;
    const l = Math.hypot(dx, dz) || 1;
    const nx = (-dz / l) * w / 2, nz = (dx / l) * w / 2;
    const i = this.pos.length / 3;
    this.pos.push(ax + nx, 0, az + nz, ax - nx, 0, az - nz, bx - nx, 0, bz - nz, bx + nx, 0, bz + nz);
    this.idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
  }
  line(ax, az, bx, bz) { this.quad(ax, az, bx, bz, P().lineWidth); }
  rect(x0, z0, x1, z1) {
    const h = P().lineWidth / 2;
    this.line(x0 - h, z0, x1 + h, z0); this.line(x0 - h, z1, x1 + h, z1);
    this.line(x0, z0, x0, z1); this.line(x1, z0, x1, z1);
  }
  arc(cx, cz, r, a0, a1, seg = 48) {
    const w = P().lineWidth;
    for (let i = 0; i < seg; i++) {
      const t0 = a0 + ((a1 - a0) * i) / seg, t1 = a0 + ((a1 - a0) * (i + 1)) / seg;
      const ri = r - w / 2, ro = r + w / 2;
      const k = this.pos.length / 3;
      this.pos.push(
        cx + Math.cos(t0) * ri, 0, cz + Math.sin(t0) * ri, cx + Math.cos(t0) * ro, 0, cz + Math.sin(t0) * ro,
        cx + Math.cos(t1) * ro, 0, cz + Math.sin(t1) * ro, cx + Math.cos(t1) * ri, 0, cz + Math.sin(t1) * ri,
      );
      this.idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
  }
  disc(cx, cz, r) {
    const k = this.pos.length / 3;
    this.pos.push(cx, 0, cz);
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.pos.push(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
    }
    for (let i = 0; i < n; i++) this.idx.push(k, k + 2 + i, k + 1 + i);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setIndex(this.idx);
    const n = new Float32Array(this.pos.length);
    for (let i = 1; i < n.length; i += 3) n[i] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    return g;
  }
}

// ------------------------------------------------------------------ net
class GoalNet {
  constructor(side, material) {
    const p = P();
    this.side = side;
    const gx = side * p.length / 2;
    const hw = p.goalWidth / 2, H = p.goalHeight, D = p.goalDepth, backH = H - 0.5;
    const s = side;
    const panels = [
      // back
      { c: [[gx + s * D, 0, -hw], [gx + s * D, 0, hw], [gx + s * D, backH, -hw], [gx + s * D, backH, hw]], n: [s, 0, 0], u: 14, v: 6 },
      // roof
      { c: [[gx, H, -hw], [gx, H, hw], [gx + s * D, backH, -hw], [gx + s * D, backH, hw]], n: [s * 0.25, 1, 0], u: 14, v: 4 },
      // sides
      { c: [[gx, 0, -hw], [gx + s * D, 0, -hw], [gx, H, -hw], [gx + s * D, backH, -hw]], n: [0, 0, -1], u: 4, v: 6 },
      { c: [[gx, 0, hw], [gx + s * D, 0, hw], [gx, H, hw], [gx + s * D, backH, hw]], n: [0, 0, 1], u: 4, v: 6 },
    ];
    const geos = [];
    for (const pn of panels) {
      const [a, b, c2, d] = pn.c;
      const pos = [], uv = [], idx = [], nrm = [];
      for (let j = 0; j <= pn.v; j++) {
        for (let i = 0; i <= pn.u; i++) {
          const u = i / pn.u, v = j / pn.v;
          for (let k = 0; k < 3; k++) {
            const bottom = a[k] + (b[k] - a[k]) * u;
            const top = c2[k] + (d[k] - c2[k]) * u;
            pos.push(bottom + (top - bottom) * v);
          }
          nrm.push(...pn.n);
          uv.push(u * pn.u * 0.5, v * pn.v * 0.5);
        }
      }
      for (let j = 0; j < pn.v; j++) {
        for (let i = 0; i < pn.u; i++) {
          const q = j * (pn.u + 1) + i;
          idx.push(q, q + 1, q + pn.u + 1, q + 1, q + pn.u + 2, q + pn.u + 1);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      geos.push(g);
    }
    const geo = mergeGeometries(geos);
    this.base = Float32Array.from(geo.attributes.position.array);
    this.dir = Float32Array.from(geo.attributes.normal.array);
    // normalise displacement directions
    for (let i = 0; i < this.dir.length; i += 3) {
      const l = Math.hypot(this.dir[i], this.dir[i + 1], this.dir[i + 2]) || 1;
      this.dir[i] /= l; this.dir[i + 1] /= l; this.dir[i + 2] /= l;
    }
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.impacts = [];
    this.active = false;
  }

  hit(x, y, z, strength) {
    this.impacts.push({ x, y, z, s: Math.min(0.55, strength * 0.025), age: 0 });
    if (this.impacts.length > 4) this.impacts.shift();
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;
    const pos = this.mesh.geometry.attributes.position;
    const arr = pos.array, base = this.base, dir = this.dir;
    for (const im of this.impacts) im.age += dt;
    this.impacts = this.impacts.filter((im) => im.age < 2.5);
    if (!this.impacts.length) {
      arr.set(base);
      pos.needsUpdate = true;
      this.active = false;
      return;
    }
    for (let i = 0; i < arr.length; i += 3) {
      let disp = 0;
      for (const im of this.impacts) {
        const dx = base[i] - im.x, dy = base[i + 1] - im.y, dz = base[i + 2] - im.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 9) continue;
        const d = Math.sqrt(d2);
        disp += im.s * Math.exp(-d2 / 0.9) * Math.exp(-im.age * 2.4) * Math.cos(im.age * 13 - d * 3.5);
      }
      arr[i] = base[i] + dir[i] * disp;
      arr[i + 1] = base[i + 1] + dir[i + 1] * disp;
      arr[i + 2] = base[i + 2] + dir[i + 2] * disp;
    }
    pos.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ Pitch
export class Pitch {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this._sky();
    this._ground();
    this._markings();
    this._goals();
    this._stadium();
    this._lights();
    scene.fog = new THREE.Fog(CONFIG.colors.fog, 110, 300);
  }

  _sky() {
    const geo = new THREE.SphereGeometry(420, 24, 12);
    const top = new THREE.Color(CONFIG.colors.skyTop), hor = new THREE.Color(CONFIG.colors.skyHorizon);
    const cols = [];
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = Math.max(0, p.getY(i) / 420);
      const c = hor.clone().lerp(top, Math.pow(t, 0.6));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    this.skyMesh = sky;
    this.group.add(sky);
  }

  _ground() {
    const spanX = 150, spanZ = 112;
    this.grassMat = grassMaterial();
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(spanX, spanZ), this.grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.group.add(grass);
    this.grass = grass;
    this.wear = new PitchWear();
    this.shells = grassShells(10);
    this.shells.visible = false;
    this.group.add(this.shells);
    // concrete / track beyond the boards
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.95 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.03;
    this.group.add(apron);
  }

  _markings() {
    const p = P();
    const L = p.length / 2, W = p.width / 2;
    const m = new MarkingBuilder();
    m.rect(-L, -W, L, W);
    m.line(0, -W, 0, W);
    m.arc(0, 0, p.centreRadius, 0, Math.PI * 2, 64);
    m.disc(0, 0, 0.16);
    for (const s of [-1, 1]) {
      const gx = s * L;
      const bx = gx - s * p.penaltyDepth, sx = gx - s * p.sixDepth;
      m.rect(Math.min(gx, bx), -p.penaltyWidth / 2, Math.max(gx, bx), p.penaltyWidth / 2);
      m.rect(Math.min(gx, sx), -p.sixWidth / 2, Math.max(gx, sx), p.sixWidth / 2);
      const spot = gx - s * p.penaltySpot;
      m.disc(spot, 0, 0.13);
      const a = Math.acos((p.penaltyDepth - p.penaltySpot) / p.arcRadius);
      const base = s > 0 ? Math.PI : 0;
      m.arc(spot, 0, p.arcRadius, base - a, base + a, 24);
      for (const zs of [-1, 1]) {
        // corner arcs
        const a0 = Math.atan2(-zs, -s);
        m.arc(gx, zs * W, 1, a0 - Math.PI / 4, a0 + Math.PI / 4, 8);
      }
    }
    // painted lines: lit like the grass (not glowing), a little translucent
    const mat = new THREE.MeshStandardMaterial({
      color: CONFIG.colors.lines, roughness: 0.82, transparent: true, opacity: 0.9, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    mat.color.multiplyScalar(0.86);
    const mesh = new THREE.Mesh(m.build(), mat);
    mesh.position.y = 0.006;
    this.lines = mesh;
    mesh.renderOrder = 1;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  _goals() {
    const p = P();
    const frameMat = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.35, metalness: 0.05 });
    const netMat = new THREE.MeshBasicMaterial({
      map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.7, color: 0xd8dade,
    });
    netMat.map.repeat.set(1, 1);
    this.nets = {};
    for (const s of [-1, 1]) {
      const gx = s * (p.length / 2);
      const R = p.postRadius, hw = p.goalWidth / 2 + R, H = p.goalHeight + R;
      const postGeo = new THREE.CylinderGeometry(R, R, H, 12);
      const barGeo = new THREE.CylinderGeometry(R, R, hw * 2 + R * 2, 12);
      const geos = [];
      for (const z of [-hw, hw]) {
        const g = postGeo.clone(); g.translate(gx, H / 2, z); geos.push(g);
        // back stanchions
        const sg = new THREE.CylinderGeometry(0.03, 0.03, p.goalDepth + 0.1, 6);
        sg.rotateZ(Math.PI / 2); sg.translate(gx + s * p.goalDepth / 2, 0.03, z); geos.push(sg);
        const bk = new THREE.CylinderGeometry(0.03, 0.03, p.goalHeight - 0.5, 6);
        bk.translate(gx + s * p.goalDepth, (p.goalHeight - 0.5) / 2, z); geos.push(bk);
      }
      const bar = barGeo.clone(); bar.rotateX(Math.PI / 2); bar.translate(gx, H, 0); geos.push(bar);
      const frame = new THREE.Mesh(mergeGeometries(geos), frameMat);
      frame.castShadow = true;
      this.group.add(frame);
      const net = new GoalNet(s, netMat);
      this.group.add(net.mesh);
      this.nets[s] = net;
    }
  }

  /**
   * A two-tier bowl: stepped rows (seats + concrete treads) on all four sides,
   * chamfered corners where the stands meet, an LED ribbon between the tiers,
   * roofs with floodlight banks along their front edges, and a 3D crowd.
   */
  _stadium() {
    const p = P();
    const L = p.length / 2, W = p.width / 2;
    // ---- LED boards around the pitch
    const boardTex = boardTexture();
    this.boardTex = boardTex;
    this.boardMat = new THREE.MeshBasicMaterial({ map: boardTex });
    const boards = [];
    const mkBoard = (len, x, z, rotY) => {
      const g = new THREE.PlaneGeometry(len, 0.95);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 64);
      g.rotateY(rotY); g.translate(x, 0.5, z);
      boards.push(g);
      // the frame / back of the board
      const back = new THREE.BoxGeometry(len, 1.0, 0.25); back.translate(0, 0.5, -0.14); back.rotateY(rotY); back.translate(x, 0, z);
      this._boardBacks.push(back);
    };
    this._boardBacks = [];
    mkBoard(p.length + 12, 0, -W - 5, 0);
    mkBoard(p.length + 12, 0, W + 5, Math.PI);
    mkBoard(p.width + 14, -L - 5, 0, Math.PI / 2);
    mkBoard(p.width + 14, L + 5, 0, -Math.PI / 2);
    this.group.add(new THREE.Mesh(mergeGeometries(boards), this.boardMat));
    this.group.add(new THREE.Mesh(mergeGeometries(this._boardBacks), new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.7 })));

    // ---- the bowl
    const sides = [
      { rot: 0, d0: W + 7.5, half: (d) => L - W + d, away: false },               // far touchline (z−)
      { rot: Math.PI, d0: W + 7.5, half: (d) => L - W + d, away: false },         // near touchline (z+)
      { rot: -Math.PI / 2, d0: L + 7.5, half: (d) => W - L + d, away: true },      // behind the x+ goal
      { rot: Math.PI / 2, d0: L + 7.5, half: (d) => W - L + d, away: false },      // behind the x− goal
    ];
    const tiers = [
      { rows: 22, rise: 0.45, depth: 0.85, y0: 1.1, dOff: 0, occ: 0.9 },
      { rows: 16, rise: 0.62, depth: 0.85, y0: 14.2, dOff: 22 * 0.85 - 3.2, occ: 0.84 },
    ];
    const pos = [], col = [], idx = [];
    const seatCols = [new THREE.Color('#1c2a4a'), new THREE.Color('#202d50')];
    const conc = new THREE.Color('#4a4f58'), dark = new THREE.Color('#23262d'), fascia = new THREE.Color('#14161b');
    const quad = (a, b, c, d, cl) => {
      const k = pos.length / 3;
      for (const v of [a, b, c, d]) { pos.push(v[0], v[1], v[2]); col.push(cl.r, cl.g, cl.b); }
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    };
    // local (lx, y, d) → world, for a side rotated by rot (d = distance out from the pitch centre)
    const W3 = (rot, lx, y, d) => { const c = Math.cos(rot), sn = Math.sin(rot); return [lx * c - d * sn, y, -lx * sn - d * c]; };
    const seats = [];
    let rs = 11;
    const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
    const ribbons = [];
    for (const S of sides) {
      for (const [ti, T] of tiers.entries()) {
        for (let r = 0; r < T.rows; r++) {
          const y = T.y0 + r * T.rise, d = S.d0 + T.dOff + r * T.depth;
          const hf = S.half(d), hb = S.half(d + T.depth);
          // riser (seat backs) and tread
          quad(W3(S.rot, -hf, y, d), W3(S.rot, hf, y, d), W3(S.rot, hf, y + T.rise, d), W3(S.rot, -hf, y + T.rise, d), seatCols[r & 1]);
          quad(W3(S.rot, -hf, y + T.rise, d), W3(S.rot, hf, y + T.rise, d), W3(S.rot, hb, y + T.rise, d + T.depth), W3(S.rot, -hb, y + T.rise, d + T.depth), conc);
          // people
          const sw = 0.6;
          const n = Math.floor((hf * 2) / sw);
          for (let k = 0; k < n; k++) {
            if (k % 18 === 9) continue;                         // aisles
            if (rnd() > T.occ) continue;
            const lx = -hf + (k + 0.5) * sw + (rnd() - 0.5) * 0.12;
            const w = W3(S.rot, lx, y + T.rise, d + T.depth * 0.42 + (rnd() - 0.5) * 0.08);
            const under = ti === 1 ? 0.62 + 0.25 * (1 - r / T.rows) : 1 - 0.25 * (r / T.rows);
            seats.push({ x: w[0], y: w[1], z: w[2], light: under, away: S.away && ti === 0 && lx < 0, front: ti === 0 && r < 5, yaw: S.rot });
          }
        }
        // back / side walls of the tier
        const dTop = S.d0 + T.dOff + T.rows * T.depth, yTop = T.y0 + T.rows * T.rise;
        const hT = S.half(dTop);
        quad(W3(S.rot, -hT, yTop, dTop), W3(S.rot, hT, yTop, dTop), W3(S.rot, hT, yTop + (ti ? 3.5 : 3.1), dTop), W3(S.rot, -hT, yTop + (ti ? 3.5 : 3.1), dTop), dark);
        // front wall below the first row
        const dF = S.d0 + T.dOff, hF = S.half(dF);
        quad(W3(S.rot, -hF, ti ? T.y0 - 3.3 : 0, dF), W3(S.rot, hF, ti ? T.y0 - 3.3 : 0, dF), W3(S.rot, hF, T.y0, dF), W3(S.rot, -hF, T.y0, dF), ti ? fascia : dark);
        if (ti === 1) ribbons.push([W3(S.rot, -hF, T.y0 - 2.9, dF - 0.02), W3(S.rot, hF, T.y0 - 2.9, dF - 0.02), W3(S.rot, hF, T.y0 - 1.9, dF - 0.02), W3(S.rot, -hF, T.y0 - 1.9, dF - 0.02), hF]);
      }
      // outer wall up to the roof
      const dBack = S.d0 + tiers[1].dOff + tiers[1].rows * tiers[1].depth, hB = S.half(dBack);
      quad(W3(S.rot, -hB, 0, dBack + 0.5), W3(S.rot, hB, 0, dBack + 0.5), W3(S.rot, hB, 31, dBack + 0.5), W3(S.rot, -hB, 31, dBack + 0.5), dark);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const bowl = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.group.add(bowl);

    // ---- LED ribbon between the tiers (scrolls with the boards)
    const rg = [];
    for (const [a, b, c, d, hF] of ribbons) {
      const q = new THREE.BufferGeometry();
      q.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
      q.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, hF * 2 / 64, 0, hF * 2 / 64, 1, 0, 1], 2));
      q.setIndex([0, 1, 2, 0, 2, 3]);
      rg.push(q);
    }
    this.ribbonMat = new THREE.MeshBasicMaterial({ map: boardTex, side: THREE.DoubleSide });
    this.group.add(new THREE.Mesh(mergeGeometries(rg), this.ribbonMat));

    // ---- roofs (chamfered to meet at the corners) with floodlight banks on the front edge
    const roofs = [], strips = [];
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: 0xffffff });
    this.glowMat = glowMat;
    this.glows = [];
    for (const S of sides) {
      const dFront = S.d0 + 7, dBack = S.d0 + tiers[1].dOff + tiers[1].rows * tiers[1].depth + 0.5;
      const yF = 29.5, yB = 31.5;
      const hf = S.half(dFront), hb = S.half(dBack);
      const q = new THREE.BufferGeometry();
      q.setAttribute('position', new THREE.Float32BufferAttribute([...W3(S.rot, -hf, yF, dFront), ...W3(S.rot, hf, yF, dFront), ...W3(S.rot, hb, yB, dBack), ...W3(S.rot, -hb, yB, dBack)], 3));
      q.setIndex([0, 1, 2, 0, 2, 3]);
      q.computeVertexNormals();
      roofs.push(q);
      // light bank: a bright strip under the front edge + glow sprites
      const st = new THREE.BufferGeometry();
      const yS = yF - 0.6;
      st.setAttribute('position', new THREE.Float32BufferAttribute([...W3(S.rot, -hf * 0.86, yS, dFront - 0.1), ...W3(S.rot, hf * 0.86, yS, dFront - 0.1), ...W3(S.rot, hf * 0.86, yS + 0.9, dFront - 0.1), ...W3(S.rot, -hf * 0.86, yS + 0.9, dFront - 0.1)], 3));
      st.setIndex([0, 1, 2, 0, 2, 3]);
      strips.push(st);
      const nG = Math.round(hf * 2 * 0.86 / 9);
      for (let k = 0; k < nG; k++) {
        const lx = -hf * 0.86 + (k + 0.5) * (hf * 2 * 0.86 / nG);
        const sp = new THREE.Sprite(glowMat);
        sp.position.set(...W3(S.rot, lx, yS + 0.45, dFront - 0.4));
        sp.scale.set(9, 9, 1);
        this.group.add(sp);
        this.glows.push(sp);
      }
    }
    const roofMesh = new THREE.Mesh(mergeGeometries(roofs), new THREE.MeshLambertMaterial({ color: '#30353f', side: THREE.DoubleSide }));
    this.group.add(roofMesh);
    this.stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.98, 0.93).multiplyScalar(6), side: THREE.DoubleSide, fog: false });
    this.group.add(new THREE.Mesh(mergeGeometries(strips), this.stripMat));

    // ---- corner flags
    const flagGeo = new THREE.PlaneGeometry(0.42, 0.3, 6, 1); flagGeo.translate(0.21, 0, 0);
    const poleGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.6, 6); poleGeo.translate(0, 0.8, 0);
    const poleMat = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.5 });
    this.flagT = { value: 0 };
    const flagMat = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.7, side: THREE.DoubleSide });
    flagMat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = this.flagT;
      sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float fx = position.x / 0.42; transformed.z += sin(uT * 7.0 - fx * 4.0) * 0.06 * fx; transformed.y -= fx * fx * 0.04;');
    };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(sx * L, 0, sz * W); pole.castShadow = true; this.group.add(pole);
      const fl = new THREE.Mesh(flagGeo, flagMat); fl.position.set(sx * L, 1.42, sz * W); fl.rotation.y = Math.atan2(-sz, sx) + Math.PI / 2; this.group.add(fl);
    }

    // ---- crowd (shuffled so dropping instances on lower quality thins it evenly)
    for (let i = seats.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [seats[i], seats[j]] = [seats[j], seats[i]]; }
    this.crowd = new Crowd(this.group, seats);
  }

  /** Floodlights on (night) / dimmed (dusk) / off (day). */
  setFloodlights(k) {
    this.floodK = k;
    for (const g of this.glows) g.visible = k > 0.05;
    this.glowMat.opacity = Math.min(1, k * 1.1);
    this.stripMat.color.setRGB(1, 0.98, 0.93).multiplyScalar(k > 0.05 ? 1.5 + 5 * k : 0.35);
    // LED boards punch through more at night
    this.boardMat.color.setScalar(k > 0.5 ? 1.7 : k > 0 ? 1.4 : 1.15);
    this.ribbonMat.color.setScalar(k > 0.5 ? 1.5 : 1.1);
    this.crowdLight = k > 0.5 ? 0.4 : k > 0 ? 0.5 : 0.75;
  }

  _lights() {
    const hemi = new THREE.HemisphereLight('#c9d8ff', '#2b4a2a', 0.6);
    this.scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight('#fff6e6', 2.2);
    sun.position.set(-12, 70, -30);
    sun.castShadow = true;
    const s = CONFIG.quality.shadowMapSize;
    sun.shadow.mapSize.set(s, s);
    const cam = sun.shadow.camera;
    cam.left = -20; cam.right = 20; cam.top = 20; cam.bottom = -20; cam.near = 5; cam.far = 140;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    this.sunOffset = sun.position.clone();
    // second light (the floodlights on the other side / sky fill): no shadows
    const fill = new THREE.DirectionalLight('#eef3ff', 1.1);
    fill.position.set(30, 40, 45);
    this.scene.add(fill);
    this.fill = fill;
    this.crowdLight = 0.62;
  }

  /** Keep the tight shadow frustum centred on the action. */
  focusShadows(x, z) {
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunOffset.x, this.sunOffset.y, z + this.sunOffset.z);
  }

  /** Crowd density by quality level. */
  setCrowdQuality(full) {
    if (this.crowd) this.crowd.mesh.geometry.instanceCount = full ? this.crowd.n : Math.floor(this.crowd.n * 0.45);
  }

  /** Per frame: LED boards, flags, the crowd. */
  updateStadium(dt, t, camPos) {
    this.flagT.value = t;
    if (this.boardTex) {
      this.boardTex.offset.x = (t * 0.012) % 1;
      // switch the ad set every 12 s
      this.boardTex.offset.y = Math.floor(t / 12) % 2 ? 0.5 : 0;
    }
    if (this.crowd) this.crowd.update(dt, t, camPos, this.crowdLight);
  }

  update(dt) {
    this.nets[1].update(dt);
    this.nets[-1].update(dt);
  }
}
