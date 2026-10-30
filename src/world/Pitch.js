// Pitch, markings, goals with rippling nets, a light stadium shell, sky and lights.
// Everything is procedural so it can be swapped for authored assets later.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';

const P = () => CONFIG.pitch;

// ------------------------------------------------------------------ textures
function grassTexture() {
  const { length, width, stripes } = P();
  const W = 1024, H = 768, spanX = 130, spanZ = 96;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const stripeM = length / stripes;
  const ca = new THREE.Color(CONFIG.colors.grassA), cb = new THREE.Color(CONFIG.colors.grassB);
  const img = g.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const mx = (x / W) * spanX - spanX / 2 + length / 2;
      const stripe = Math.floor(mx / stripeM) & 1;
      const col = stripe ? ca : cb;
      const n = (Math.random() - 0.5) * 0.07 + Math.sin(x * 0.21 + y * 0.13) * 0.008;
      const i = (y * W + x) * 4;
      d[i] = Math.max(0, Math.min(255, (col.r + n) * 255));
      d[i + 1] = Math.max(0, Math.min(255, (col.g + n * 1.3) * 255));
      d[i + 2] = Math.max(0, Math.min(255, (col.b + n) * 255));
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // subtle wear in the goalmouths and centre
  const wear = (wx, wz, r) => {
    const px = ((wx + spanX / 2) / spanX) * W, pz = ((wz + spanZ / 2) / spanZ) * H;
    const grd = g.createRadialGradient(px, pz, 0, px, pz, (r / spanX) * W);
    grd.addColorStop(0, 'rgba(120,110,60,0.18)');
    grd.addColorStop(1, 'rgba(120,110,60,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  };
  wear(length / 2 - 3, 0, 5); wear(-length / 2 + 3, 0, 5); wear(0, 0, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { tex: t, spanX, spanZ };
}

function crowdTexture(simple) {
  const c = document.createElement('canvas');
  const W = simple ? 128 : 512, H = simple ? 32 : 128;
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1f29';
  g.fillRect(0, 0, W, H);
  if (simple) {
    for (let i = 0; i < 600; i++) {
      g.fillStyle = `hsl(${Math.random() * 360},30%,${30 + Math.random() * 30}%)`;
      g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
  } else {
    const palette = ['#e8edf5', '#2c6cf0', '#1b2a4a', '#d9dde6', '#c8283a', '#f2c94c', '#8a8f9c', '#ffffff'];
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 96; col++) {
        const x = col * (W / 96) + (row % 2) * 2.5 + Math.random() * 1.5;
        const y = row * (H / 16) + 3 + Math.random() * 1.5;
        g.fillStyle = Math.random() < 0.7 ? palette[(Math.random() * 3) | 0] : palette[(Math.random() * palette.length) | 0];
        g.fillRect(x, y + 2, 3.2, 4);
        g.fillStyle = `hsl(25,${30 + Math.random() * 30}%,${35 + Math.random() * 35}%)`;
        g.fillRect(x + 0.6, y, 2, 2);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function boardTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 64;
  const g = c.getContext('2d');
  const items = [['BREAKAWAY', '#0f1a33', '#ffe14d'], ['HARBOUR CITY FC', '#1b2a4a', '#ffffff'],
    ['NORTHGATE', '#c8283a', '#ffffff'], ['MATCHDAY', '#111', '#7cf5ff']];
  const w = c.width / items.length;
  items.forEach(([txt, bg, fg], i) => {
    g.fillStyle = bg; g.fillRect(i * w, 0, w, 64);
    g.fillStyle = fg;
    g.font = 'bold 40px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, i * w + w / 2, 34);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
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
    g.computeVertexNormals();
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
    this.group.add(sky);
  }

  _ground() {
    const { tex, spanX, spanZ } = grassTexture();
    this.grassMat = new THREE.MeshLambertMaterial({ map: tex });
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(spanX, spanZ), this.grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.group.add(grass);
    this.grass = grass;
    // outer apron
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: '#2a3a2c' }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.02;
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
    const mat = new THREE.MeshBasicMaterial({
      color: CONFIG.colors.lines, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    mat.color.multiplyScalar(0.92);
    const mesh = new THREE.Mesh(m.build(), mat);
    mesh.position.y = 0.006;
    mesh.renderOrder = 1;
    this.group.add(mesh);
  }

  _goals() {
    const p = P();
    const frameMat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#555555' });
    const netMat = new THREE.MeshBasicMaterial({
      map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.8,
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

  _stadium() {
    const p = P();
    const L = p.length / 2, W = p.width / 2;
    // ad boards
    const boardTex = boardTexture();
    const boardMat = new THREE.MeshBasicMaterial({ map: boardTex });
    const boards = [];
    const mkBoard = (len, x, z, rotY) => {
      const g = new THREE.PlaneGeometry(len, 0.9);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 40);
      g.rotateY(rotY); g.translate(x, 0.45, z);
      boards.push(g);
    };
    mkBoard(p.length + 10, 0, -W - 5, 0);
    mkBoard(p.length + 10, 0, W + 5, Math.PI);
    mkBoard(p.width + 10, -L - 5, 0, Math.PI / 2);
    mkBoard(p.width + 10, L - 0 + 5, 0, -Math.PI / 2);
    const boardMesh = new THREE.Mesh(mergeGeometries(boards), boardMat);
    this.group.add(boardMesh);

    // tiered stands: risers carry the crowd texture, treads are plain
    this.crowdFull = crowdTexture(false);
    this.crowdSimple = crowdTexture(true);
    this.crowdMat = new THREE.MeshLambertMaterial({ map: this.crowdFull });
    const structMat = new THREE.MeshLambertMaterial({ color: CONFIG.colors.stands });
    const roofMat = new THREE.MeshLambertMaterial({ color: CONFIG.colors.standsTrim });
    const risers = [], treads = [], roofs = [];
    const tiers = 7, rise = 1.6, depth = 2.6;
    const side = (len, offset, rotY) => {
      for (let t = 0; t < tiers; t++) {
        const y0 = 1.2 + t * rise, d0 = offset + t * depth;
        const r = new THREE.PlaneGeometry(len + t * 5, rise);
        const uv = r.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (len + t * 5) / 24);
        r.translate(0, y0 + rise / 2, -d0);
        r.rotateY(rotY);
        risers.push(r);
        const tr = new THREE.PlaneGeometry(len + t * 5, depth);
        tr.rotateX(-Math.PI / 2);
        tr.translate(0, y0 + rise, -d0 - depth / 2);
        tr.rotateY(rotY);
        treads.push(tr);
      }
      const back = new THREE.PlaneGeometry(len + tiers * 5, tiers * rise + 8);
      back.translate(0, (tiers * rise + 8) / 2, -(offset + tiers * depth));
      back.rotateY(rotY);
      treads.push(back);
      const roof = new THREE.PlaneGeometry(len + tiers * 5, tiers * depth * 0.8);
      roof.rotateX(Math.PI / 2 + 0.12);
      roof.translate(0, 1.2 + tiers * rise + 6, -(offset + tiers * depth * 0.6));
      roof.rotateY(rotY);
      roofs.push(roof);
    };
    side(p.length + 14, W + 8, 0);            // far touchline (z−) — faces +z
    side(p.length + 14, W + 8, Math.PI);      // near touchline
    side(p.width + 12, L + 9, -Math.PI / 2);  // behind attacking goal (x+)
    side(p.width + 12, L + 9, Math.PI / 2);
    // PlaneGeometry faces +z; the stands at z<0 must face +z (toward pitch): rotation 0 gives -d0 → z negative ✓.
    this.group.add(new THREE.Mesh(mergeGeometries(risers), this.crowdMat));
    this.group.add(new THREE.Mesh(mergeGeometries(treads), structMat));
    const roofMesh = new THREE.Mesh(mergeGeometries(roofs), roofMat);
    roofMesh.material.side = THREE.DoubleSide;
    this.group.add(roofMesh);

    // floodlights: pylons with glowing panels + additive glow sprites
    const pylonMat = new THREE.MeshLambertMaterial({ color: '#4a5263' });
    const panelMat = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
    const gc = document.createElement('canvas');
    gc.width = gc.height = 128;
    const gg = gc.getContext('2d');
    const grd = gg.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,250,225,0.95)');
    grd.addColorStop(0.25, 'rgba(255,245,210,0.35)');
    grd.addColorStop(1, 'rgba(255,245,210,0)');
    gg.fillStyle = grd; gg.fillRect(0, 0, 128, 128);
    const glowMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const pyl = [], pan = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (L + 14), z = sz * (W + 20), h = 38;
        const pg = new THREE.BoxGeometry(0.9, h, 0.9); pg.translate(x, h / 2, z); pyl.push(pg);
        const pn = new THREE.BoxGeometry(7, 3.5, 0.5);
        pn.lookAt(new THREE.Vector3(-x, -h * 0.6, -z));
        pn.translate(x, h + 1.5, z); pan.push(pn);
        const s = new THREE.Sprite(glowMat);
        s.position.set(x * 0.98, h + 1.5, z * 0.98);
        s.scale.set(26, 26, 1);
        this.group.add(s);
      }
    }
    this.group.add(new THREE.Mesh(mergeGeometries(pyl), pylonMat));
    this.group.add(new THREE.Mesh(mergeGeometries(pan), panelMat));
  }

  _lights() {
    const hemi = new THREE.HemisphereLight('#c9d8ff', '#2b4a2a', 1.35);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff6e6', 2.1);
    sun.position.set(-25, 45, 20);
    sun.castShadow = true;
    const s = CONFIG.quality.shadowMapSize;
    sun.shadow.mapSize.set(s, s);
    const cam = sun.shadow.camera;
    cam.left = -20; cam.right = 20; cam.top = 20; cam.bottom = -20; cam.near = 5; cam.far = 120;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    this.sunOffset = sun.position.clone();
  }

  /** Keep the tight shadow frustum centred on the action. */
  focusShadows(x, z) {
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunOffset.x, this.sunOffset.y, z + this.sunOffset.z);
  }

  setCrowdQuality(full) {
    this.crowdMat.map = full ? this.crowdFull : this.crowdSimple;
    this.crowdMat.needsUpdate = true;
  }

  update(dt) {
    this.nets[1].update(dt);
    this.nets[-1].update(dt);
  }
}
