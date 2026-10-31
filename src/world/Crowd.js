// A 3D crowd: tens of thousands of instanced people (one quad each, always
// turned to the camera) standing in the rows of the stands. Shirts follow the
// two teams (the away end in its own colours), and the crowd lives: idle
// shuffling, a rising buzz when there's a chance, and a jumping, arms-up
// eruption when a goal goes in.
import * as THREE from 'three';

const COLS = 8;  // figure variants per row of the atlas

/** Atlas: R = shading, G = shirt mask, B = skin mask, A = coverage. Row 0 arms down, row 1 arms up. */
function atlas() {
  const CW = 64, CH = 128, W = CW * COLS, H = CH * 2;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const shade = mk(), shirt = mk(), skin = mk(), cov = mk();
  const ctx = [shade, shirt, skin, cov].map((c) => c.getContext('2d'));
  let s = 99;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const fig = (ci, up) => {
    const ox = ci * CW, oy = up * CH;
    const cx = ox + CW / 2 + (rnd() - 0.5) * 4;
    const sw = 15 + rnd() * 6;               // shoulder half-width
    const neck = oy + 34 + rnd() * 4;
    const headR = 9 + rnd() * 2;
    const hairT = rnd();
    const hood = rnd() < 0.15, scarf = rnd() < 0.3, cap = rnd() < 0.15;
    const draw = (g, part) => {
      g.save();
      const body = () => {
        // torso (shirt) down to the bottom of the cell: the row in front hides the legs
        g.beginPath();
        g.moveTo(cx - sw, neck + 10);
        g.quadraticCurveTo(cx - sw, neck + 2, cx - sw * 0.5, neck);
        g.lineTo(cx + sw * 0.5, neck);
        g.quadraticCurveTo(cx + sw, neck + 2, cx + sw, neck + 10);
        g.lineTo(cx + sw * 0.82, oy + CH);
        g.lineTo(cx - sw * 0.82, oy + CH);
        g.closePath(); g.fill();
      };
      const arms = (fillArm, fillHand) => {
        for (const sd of [-1, 1]) {
          g.fillStyle = fillArm;
          g.beginPath();
          if (up) {
            // arms raised in a V
            const hx = cx + sd * (sw + 12 + rnd() * 4), hy = oy + 6 + rnd() * 8;
            g.moveTo(cx + sd * (sw - 2), neck + 6); g.lineTo(hx + sd * 3, hy + 6); g.lineTo(hx - sd * 4, hy + 8); g.lineTo(cx + sd * (sw - 9), neck + 12);
            g.closePath(); g.fill();
            g.fillStyle = fillHand; g.beginPath(); g.arc(hx, hy + 4, 4, 0, 7); g.fill();
          } else {
            g.moveTo(cx + sd * sw, neck + 6); g.lineTo(cx + sd * (sw + 3), oy + 100); g.lineTo(cx + sd * (sw - 5), oy + 100); g.lineTo(cx + sd * (sw - 6), neck + 14);
            g.closePath(); g.fill();
          }
        }
      };
      if (part === 'cov') {
        g.fillStyle = '#fff';
        body(); arms('#fff', '#fff');
        g.beginPath(); g.arc(cx, neck - headR + 1, headR, 0, 7); g.fill();
        g.fillRect(cx - 4, neck - 4, 8, 8);
        if (cap) g.fillRect(cx - headR - 1, neck - headR * 2 + 1, headR * 2 + 7, 5);
      } else if (part === 'shirt') {
        g.fillStyle = '#fff'; body(); arms('#fff', '#000');
        if (hood) { g.fillStyle = '#000'; g.fillRect(cx - sw * 0.25, neck + 26, sw * 0.5, 4); }
        if (scarf) { g.fillStyle = '#fff'; g.fillRect(cx - sw * 0.55, neck, sw * 1.1, 7); }
      } else if (part === 'skin') {
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(cx, neck - headR + 1, headR, 0, 7); g.fill();
        g.fillRect(cx - 4, neck - 4, 8, 8);
        if (!up) for (const sd of [-1, 1]) { g.beginPath(); g.arc(cx + sd * (sw - 1), oy + 102, 3.5, 0, 7); g.fill(); }
        else arms('#000', '#fff');
        // hair / cap cover the top of the head
        g.fillStyle = '#000';
        if (cap) g.fillRect(cx - headR - 1, neck - headR * 2 - 2, headR * 2 + 7, 8);
        else if (hairT > 0.25) { g.beginPath(); g.arc(cx, neck - headR, headR + 0.5, Math.PI * 1.05, Math.PI * 1.95); g.fill(); }
      } else {
        // shading: lit from above-left, darker lower down
        const gr = g.createLinearGradient(ox, oy, ox + CW, oy + CH);
        gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#8a8a8a');
        g.fillStyle = gr; g.fillRect(ox, oy, CW, CH);
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.fillRect(cx - 2, neck + 8, 1.5, CH - 50);       // shirt fold
        g.fillStyle = 'rgba(0,0,0,.55)';
        if (cap) g.fillRect(cx - headR - 1, neck - headR * 2 - 2, headR * 2 + 7, 8);
        else if (hairT > 0.25) { g.beginPath(); g.arc(cx, neck - headR, headR + 0.5, Math.PI * 1.05, Math.PI * 1.95); g.fill(); }
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.fillRect(cx - sw, neck + 60, sw * 2, CH);        // the seat-back shadow
      }
      g.restore();
    };
    const keep = s;
    for (const [k, part] of [[0, 'shade'], [1, 'shirt'], [2, 'skin'], [3, 'cov']]) { s = keep; draw(ctx[k], part); }
  };
  for (let up = 0; up < 2; up++) { s = 99; for (let i = 0; i < COLS; i++) fig(i, up); }
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const og = out.getContext('2d');
  const id = og.createImageData(W, H);
  const d = [shade, shirt, skin, cov].map((c) => c.getContext('2d').getImageData(0, 0, W, H).data);
  for (let i = 0; i < W * H * 4; i += 4) {
    id.data[i] = d[0][i]; id.data[i + 1] = d[1][i]; id.data[i + 2] = d[2][i]; id.data[i + 3] = d[3][i];
  }
  og.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.colorSpace = THREE.NoColorSpace;
  t.premultiplyAlpha = false;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const VERT = /* glsl */`
attribute vec3 iPos;
attribute vec4 iData;     // variant, phase, scale, light
attribute vec3 iShirt;
attribute vec3 iSkin;
uniform float uTime, uExcite, uCheer;
uniform vec3 uCamPos;
varying vec2 vUv;
varying vec3 vShirt, vSkin;
varying float vLight;
varying float vFlash;
#include <fog_pars_vertex>
void main() {
  float ph = iData.y, sc = iData.z;
  float hop = uCheer * max(0.0, sin(uTime * 8.5 + ph * 40.0)) * (0.25 + 0.2 * fract(ph * 13.7));
  float idle = sin(uTime * (0.6 + fract(ph * 5.3)) + ph * 20.0) * 0.02;
  float buzz = uExcite * max(0.0, sin(uTime * 5.0 + ph * 31.0)) * 0.07;
  vec3 c = iPos + vec3(idle, hop + buzz, 0.0);
  vec3 toCam = uCamPos - c; toCam.y = 0.0;
  toCam = normalize(toCam + vec3(1e-4));
  vec3 right = vec3(toCam.z, 0.0, -toCam.x);
  vec3 wp = c + right * (position.x * 0.8 * sc) + vec3(0.0, position.y * 1.6 * sc, 0.0);
  float up = step(1.0 - clamp(uCheer * 1.2 + uExcite * 0.25, 0.0, 1.0), fract(ph * 7.31));
  vUv = vec2((iData.x + uv.x) / ${COLS}.0, (up + uv.y) * 0.5);
  vShirt = iShirt; vSkin = iSkin; vLight = iData.w;
  // phone cameras going off when there's a goal
  vFlash = uCheer * step(0.992, fract(uTime * (0.6 + fract(ph * 3.7)) + ph * 91.0));
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
uniform sampler2D uAtlas;
uniform float uLight;
varying vec2 vUv;
varying vec3 vShirt, vSkin;
varying float vLight;
varying float vFlash;
#include <fog_pars_fragment>
void main() {
  vec4 a = texture2D(uAtlas, vUv);
  if (a.a < 0.5) discard;
  vec3 pants = vec3(0.025, 0.027, 0.035);
  vec3 c = mix(pants, vShirt, a.g);
  c = mix(c, vSkin, a.b);
  c *= (0.3 + 0.7 * a.r) * uLight * vLight;
  c += vec3(vFlash * 6.0);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

export class Crowd {
  /**
   * seats: [{ x, y, z, light, end }] — end: which stand (for home / away sections)
   */
  constructor(group, allSeats) {
    const seats = allSeats.filter((q) => !q.front);
    const n = seats.length;
    this.n = n;
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    g.setAttribute('uv', quad.attributes.uv);
    const iPos = new Float32Array(n * 3), iData = new Float32Array(n * 4);
    this.iShirt = new Float32Array(n * 3);
    const iSkin = new Float32Array(n * 3);
    this.kind = new Uint8Array(n);   // 0 home fan, 1 away fan, 2 neutral
    this.neutral = new Float32Array(n * 3);
    const skins = [[0.62, 0.42, 0.3], [0.45, 0.29, 0.19], [0.25, 0.15, 0.09], [0.7, 0.52, 0.4], [0.55, 0.38, 0.26]];
    const neutrals = [[0.02, 0.02, 0.025], [0.05, 0.05, 0.06], [0.12, 0.12, 0.13], [0.4, 0.4, 0.42], [0.03, 0.05, 0.14], [0.2, 0.04, 0.03], [0.07, 0.11, 0.06], [0.25, 0.18, 0.1]];
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) {
      const q = seats[i];
      iPos[i * 3] = q.x; iPos[i * 3 + 1] = q.y; iPos[i * 3 + 2] = q.z;
      iData[i * 4] = Math.floor(rnd() * COLS);
      iData[i * 4 + 1] = rnd();
      iData[i * 4 + 2] = 0.92 + rnd() * 0.16;
      iData[i * 4 + 3] = q.light * (0.85 + rnd() * 0.3);
      const sk = skins[Math.floor(rnd() * skins.length)];
      iSkin.set(sk, i * 3);
      // away fans fill one corner of the stand behind the right-hand goal
      this.kind[i] = q.away ? (rnd() < 0.8 ? 1 : 2) : rnd() < 0.5 ? 0 : 2;
      const nc = neutrals[Math.floor(rnd() * neutrals.length)];
      this.neutral.set(nc, i * 3);
    }
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
    g.setAttribute('iData', new THREE.InstancedBufferAttribute(iData, 4));
    this.shirtAttr = new THREE.InstancedBufferAttribute(this.iShirt, 3);
    g.setAttribute('iShirt', this.shirtAttr);
    g.setAttribute('iSkin', new THREE.InstancedBufferAttribute(iSkin, 3));
    g.instanceCount = n;
    this.u = {
      uAtlas: { value: atlas() }, uTime: { value: 0 }, uExcite: { value: 0 }, uCheer: { value: 0 },
      uCamPos: { value: new THREE.Vector3() }, uLight: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    });
    Object.assign(mat.uniforms, this.u);
    mat.alphaToCoverage = true;
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    group.add(this.mesh);
    this.front = new FrontFans(group, allSeats.filter((q) => q.front), this.u);
    this.setColours([0.8, 0.8, 0.85], [0.1, 0.1, 0.4]);
    this.excite = 0; this.cheerT = 0;
  }

  /** Shirt colours: home fans in the home kit, away fans in theirs. */
  setColours(home, away) {
    const lin = (c) => (Array.isArray(c) ? c : (() => { const k = new THREE.Color(c); return [k.r, k.g, k.b]; })());
    const h = lin(home), a = lin(away);
    let s = 3;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < this.n; i++) {
      const k = this.kind[i];
      const base = k === 0 ? h : k === 1 ? a : [this.neutral[i * 3], this.neutral[i * 3 + 1], this.neutral[i * 3 + 2]];
      const v = 0.55 + rnd() * 0.35;
      this.iShirt[i * 3] = base[0] * v; this.iShirt[i * 3 + 1] = base[1] * v; this.iShirt[i * 3 + 2] = base[2] * v;
    }
    this.shirtAttr.needsUpdate = true;
    if (this.front) this.front.setColours(h, a);
  }

  setBall(v) { if (this.front) this.front.uBall.value.copy(v); }

  /** 0..1 how close the play is to a goal (the crowd rises). */
  setExcitement(e) { this.excite = e; }
  /** A goal: everyone up, jumping, for a few seconds. */
  cheer(sec = 6) { this.cheerT = sec; }

  update(dt, t, camPos, light) {
    this.cheerT = Math.max(0, this.cheerT - dt);
    const u = this.u;
    u.uTime.value = t;
    u.uCheer.value += ((this.cheerT > 0 ? Math.min(1, this.cheerT / 1.5) : 0) - u.uCheer.value) * Math.min(1, dt * 4);
    u.uExcite.value += (this.excite - u.uExcite.value) * Math.min(1, dt * 1.5);
    u.uCamPos.value.copy(camPos);
    if (light != null) u.uLight.value = light;
  }
}

// ------------------------------------------------------------------ front rows: real 3D fans
// The rows nearest the pitch (what close camera shots see) are low-poly 3D people,
// turned toward the ball, arms going up and bodies bouncing with the game.
function fanGeometry() {
  const parts = [];
  // [w, h, d, cx, cy, cz, part(0 shirt, 1 skin, 2 pants, 3 head), arm(-1/0/1)]
  const boxes = [
    [0.4, 0.52, 0.22, 0, 1.12, 0, 0, 0],        // torso
    [0.36, 0.55, 0.2, 0, 0.6, 0, 2, 0],         // legs / hips (mostly hidden by the row in front)
    [0.1, 0.1, 0.1, 0, 1.42, 0, 1, 0],          // neck
    [0.11, 0.62, 0.11, -0.25, 1.06, 0, 0, -1],  // arms (shoulder at y 1.36)
    [0.11, 0.62, 0.11, 0.25, 1.06, 0, 0, 1],
  ];
  const pos = [], nor = [], prt = [], arm = [], idx = [];
  for (const [w, h, d, cx, cy, cz, part, a] of boxes) {
    const g = new THREE.BoxGeometry(w, h, d);
    const P = g.attributes.position, N = g.attributes.normal, base = pos.length / 3;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i);
      pos.push(P.getX(i) + cx, y + cy, P.getZ(i) + cz);
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      prt.push(a !== 0 && y < 0 ? 1 : part);            // hands / forearms: skin
      arm.push(a);
    }
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
  }
  // head: a low-poly ball, hair on top
  const hg = new THREE.IcosahedronGeometry(0.115, 1);
  const H = hg.attributes.position, HN = hg.attributes.normal, b0 = pos.length / 3;
  for (let i = 0; i < H.count; i++) {
    pos.push(H.getX(i), H.getY(i) * 1.12 + 1.58, H.getZ(i) * 1.05);
    nor.push(HN.getX(i), HN.getY(i), HN.getZ(i));
    prt.push(H.getY(i) > 0.035 || H.getZ(i) < -0.06 ? 3 : 1);
    arm.push(0);
  }
  for (let i = 0; i < H.count; i++) idx.push(b0 + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(prt, 1));
  g.setAttribute('aArm', new THREE.Float32BufferAttribute(arm, 1));
  g.setIndex(idx);
  return g;
}

const FAN_VERT = /* glsl */`
attribute float aPart, aArm;
attribute vec3 iPos, iShirt, iSkin;
attribute vec4 iData;   // yaw, phase, scale, light
uniform float uTime, uExcite, uCheer;
uniform vec3 uBall;
varying vec3 vCol; varying float vLight; varying vec3 vN;
#include <fog_pars_vertex>
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
void main() {
  float ph = iData.y, sc = iData.z;
  vec3 p = position, n = normal;
  // arms: hang, then go up (and wave) as the crowd gets going
  if (aArm != 0.0) {
    float up = clamp(uCheer * 1.4 * step(0.25, fract(ph * 7.31 + aArm * 0.37)) + uExcite * step(0.75, fract(ph * 5.1)), 0.0, 1.0);
    float a = -(0.08 + up * (2.75 + 0.18 * sin(uTime * 9.0 + ph * 40.0)));
    vec3 piv = vec3(0.21 * aArm, 1.36, 0.0);
    vec3 q = p - piv;
    float c = cos(a), s = sin(a);
    q = vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
    q.x += aArm * up * 0.25 * (q.y > 0.0 ? q.y : 0.0);
    p = piv + q;
    n = vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c);
  }
  // follow the ball (within reason), bounce when it's exciting
  vec2 d = uBall.xz - iPos.xz;
  float yb = atan(d.x, d.y);
  float dy = yb - iData.x; dy = atan(sin(dy), cos(dy));
  float yaw = iData.x + clamp(dy, -0.9, 0.9) * 0.85 + sin(uTime * 0.4 + ph * 9.0) * 0.08;
  float hop = uCheer * max(0.0, sin(uTime * 8.5 + ph * 40.0)) * (0.2 + 0.18 * fract(ph * 13.7)) + uExcite * max(0.0, sin(uTime * 5.0 + ph * 31.0)) * 0.05;
  mat3 R = rotY(yaw);
  vec3 wp = iPos + R * (p * sc) + vec3(0.0, hop, 0.0);
  vN = normalize(R * n);
  vec3 hair = mix(vec3(0.03, 0.022, 0.015), vec3(0.32, 0.22, 0.1), step(0.82, fract(ph * 17.3)));
  vCol = aPart < 0.5 ? iShirt : aPart < 1.5 ? iSkin : aPart < 2.5 ? vec3(0.03, 0.032, 0.04) : hair;
  vLight = iData.w;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FAN_FRAG = /* glsl */`
uniform float uLight;
varying vec3 vCol; varying float vLight; varying vec3 vN;
#include <fog_pars_fragment>
void main() {
  float l = 0.42 + 0.58 * max(dot(normalize(vN), normalize(vec3(0.3, 0.9, 0.35))), 0.0);
  vec3 c = vCol * l * uLight * vLight * 1.15;
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

export class FrontFans {
  constructor(group, seats, shared) {
    const n = seats.length;
    this.n = n;
    const base = fanGeometry();
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    for (const k of ['position', 'normal', 'aPart', 'aArm']) g.setAttribute(k, base.attributes[k]);
    const iPos = new Float32Array(n * 3), iData = new Float32Array(n * 4), iSkin = new Float32Array(n * 3);
    this.iShirt = new Float32Array(n * 3);
    this.kind = new Uint8Array(n); this.neutral = new Float32Array(n * 3);
    const skins = [[0.62, 0.42, 0.3], [0.45, 0.29, 0.19], [0.25, 0.15, 0.09], [0.7, 0.52, 0.4], [0.55, 0.38, 0.26]];
    const neutrals = [[0.02, 0.02, 0.025], [0.05, 0.05, 0.06], [0.12, 0.12, 0.13], [0.4, 0.4, 0.42], [0.03, 0.05, 0.14], [0.2, 0.04, 0.03], [0.07, 0.11, 0.06]];
    let s = 21;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    seats.forEach((q, i) => {
      iPos.set([q.x, q.y, q.z], i * 3);
      iData.set([q.yaw, rnd(), 0.92 + rnd() * 0.14, q.light * (0.85 + rnd() * 0.3)], i * 4);
      iSkin.set(skins[Math.floor(rnd() * skins.length)], i * 3);
      this.kind[i] = q.away ? (rnd() < 0.8 ? 1 : 2) : rnd() < 0.55 ? 0 : 2;
      this.neutral.set(neutrals[Math.floor(rnd() * neutrals.length)], i * 3);
    });
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
    g.setAttribute('iData', new THREE.InstancedBufferAttribute(iData, 4));
    g.setAttribute('iSkin', new THREE.InstancedBufferAttribute(iSkin, 3));
    this.shirtAttr = new THREE.InstancedBufferAttribute(this.iShirt, 3);
    g.setAttribute('iShirt', this.shirtAttr);
    g.instanceCount = n;
    const mat = new THREE.ShaderMaterial({ vertexShader: FAN_VERT, fragmentShader: FAN_FRAG, fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]) });
    this.uBall = { value: new THREE.Vector3() };
    Object.assign(mat.uniforms, { uTime: shared.uTime, uExcite: shared.uExcite, uCheer: shared.uCheer, uLight: shared.uLight, uBall: this.uBall });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    group.add(this.mesh);
  }

  setColours(h, a) {
    let s = 5;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < this.n; i++) {
      const k = this.kind[i];
      const b = k === 0 ? h : k === 1 ? a : [this.neutral[i * 3], this.neutral[i * 3 + 1], this.neutral[i * 3 + 2]];
      const v = 0.55 + rnd() * 0.35;
      this.iShirt[i * 3] = b[0] * v; this.iShirt[i * 3 + 1] = b[1] * v; this.iShirt[i * 3 + 2] = b[2] * v;
    }
    this.shirtAttr.needsUpdate = true;
  }
}
