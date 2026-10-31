// The footballer body: one smooth skinned human mesh (MakeHuman base, CC0),
// shared by every player. Kit, skin, face, hair and boots are drawn by the
// shader from per-vertex body regions, so a player's whole look is a handful
// of uniforms + morph weights (face/body shape) — no textures to download.
import * as THREE from 'three';
import { HUMAN_META as M, HUMAN_BLOB } from './humanData.js';

export const RIG = M.rig;
export const BONE_NAMES = M.bones;   // body, torso, head, shL, elL, shR, elR, hipL, kneeL, ankleL, hipR, kneeR, ankleR
export const MORPHS = M.morphs.map((m) => m[0]);

let GEO = null;
function decode() {
  const bin = atob(HUMAN_BLOB);
  const buf = new ArrayBuffer(bin.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const T = { Int16Array, Uint16Array, Uint8Array, Float32Array };
  const arr = {};
  for (const [name, type, off, len] of M.layout) arr[name] = new T[type](buf, off, len);
  return arr;
}

/** Shared geometry (built once). */
export function humanGeometry() {
  if (GEO) return GEO;
  const A = decode(), n = M.n;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = A.position[i] / M.PQ;
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(Uint16Array.from(A.index), 1));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(Uint16Array.from(A.skinIndex), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(A.skinWeight, (w) => w / 255), 4));
  g.setAttribute('aLimb', new THREE.BufferAttribute(Float32Array.from(A.limb, (v) => v / 1000), 1));
  g.setAttribute('aHair', new THREE.BufferAttribute(Float32Array.from(A.hair, (v) => v / 1000), 1));
  g.setAttribute('aEye', new THREE.BufferAttribute(Float32Array.from(A.eye), 1));
  g.setAttribute('aFace', new THREE.BufferAttribute(Float32Array.from(A.face, (v) => v / 255), 3));
  g.computeVertexNormals();
  g.morphAttributes.position = M.morphs.map(([name, count]) => {
    const ids = A[`m:${name}:ids`], d = A[`m:${name}:d`];
    const out = new Float32Array(n * 3);
    for (let k = 0; k < count; k++) { const i = ids[k] * 3; out[i] = d[k * 3] / M.MQ; out[i + 1] = d[k * 3 + 1] / M.MQ; out[i + 2] = d[k * 3 + 2] / M.MQ; }
    const at = new THREE.BufferAttribute(out, 3); at.name = name; return at;
  });
  g.morphTargetsRelative = true;
  g.computeBoundingSphere();
  g.boundingSphere.radius *= 1.5;
  GEO = g;
  return g;
}

// ---------------------------------------------------------------- digits for shirt numbers
let DIGITS = null;
function digitsTex() {
  if (DIGITS) return DIGITS;
  const c = document.createElement('canvas');
  c.width = 640; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.font = 'bold 86px "Barlow Condensed", "Arial Narrow", Impact, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let d = 0; d < 10; d++) g.fillText(String(d), d * 64 + 32, 52);
  DIGITS = new THREE.CanvasTexture(c);
  DIGITS.colorSpace = THREE.NoColorSpace;
  DIGITS.anisotropy = 4;
  return DIGITS;
}

// sponsor wordmarks (fictional), one per row
export const SPONSORS = ['NORTHGATE', 'VOLTA', 'AEROPLAY', 'KINETIC', 'MERIDIAN', 'SOLARA', 'APEX AIR', 'HALO BANK'];
let SPON = null;
function sponsorsTex() {
  if (SPON) return SPON;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  SPONSORS.forEach((t, i) => {
    let fs = 110;
    g.font = `italic 900 ${fs}px "Barlow Condensed", "Arial Black", Impact, sans-serif`;
    while (g.measureText(t).width > 480 && fs > 40) { fs -= 4; g.font = `italic 900 ${fs}px "Barlow Condensed", "Arial Black", Impact, sans-serif`; }
    g.fillText(t, 256, 1024 - (i * 128 + 64));
  });
  SPON = new THREE.CanvasTexture(c);
  SPON.colorSpace = THREE.NoColorSpace; SPON.anisotropy = 4;
  return SPON;
}

const L = M.landmarks;
const v3 = (a) => `vec3(${a.map((x) => x.toFixed(4)).join(',')})`;
const COMMON = /* glsl */`
varying vec3 vBind; varying float vLimb; varying vec4 vReg; varying float vHair; varying float vEye; varying vec3 vFace;
uniform vec4 uHairA;      // x threshold, y volume (m), z top boost, w style (1 mohawk, 2 fade)
uniform float uSleeve;    // limb param where the sleeve ends (0.55 short, 2.1 long)
// collar: around the neck the shirt stops at the collar line; away from the neck (shoulders) it's all shirt
float neckY(vec3 p) {
  float r = length(vec2(p.x, (p.z - 0.01) * 1.15));
  float collar = 1.49 - 0.045 * clamp((p.z - 0.02) / 0.06, 0.0, 1.0);
  return p.y > 1.545 ? -1.0 : collar + 10.0 * smoothstep(0.075, 0.095, r);
}
float hairMask(float h, vec3 p) {
  if (uHairA.x > 5.0) return 0.0;
  float m = smoothstep(uHairA.x, uHairA.x + 0.3, h);
  if (uHairA.w > 0.5 && uHairA.w < 1.5) m *= 1.0 - smoothstep(0.022, 0.03, abs(p.x));       // mohawk strip
  return m;
}
`;

const VERT_HEAD = /* glsl */`
attribute float aLimb; attribute float aHair; attribute float aEye; attribute vec3 aFace;
${COMMON}
uniform float uHT, uMove;
float clothOffset(float Lm, vec3 p, float h) {
  float off = 0.0;
  if (aEye > 0.5) return 0.0;
  // shirt / shorts flutter in the wind of running (a few mm, rippling up the body)
  float fl = sin(uHT * (9.0 + 5.0 * uMove) + p.y * 26.0 + p.x * 17.0) * 0.5 + sin(uHT * 13.0 - p.y * 41.0 + p.z * 23.0) * 0.5;
  if (Lm < 0.0 && p.y < neckY(p) && p.y > 0.86) off += fl * (0.0015 + 0.0045 * uMove) * smoothstep(1.4, 1.05, p.y);
  if (Lm >= 5.0 && Lm - 10.0 < 0.55) off += fl * (0.001 + 0.004 * uMove) * smoothstep(0.0, 0.5, Lm - 10.0);
  if (Lm >= 5.0) {
    float l = Lm - 10.0;
    if (l < 0.55) off = 0.016 + 0.016 * smoothstep(0.0, 0.55, l);
    else if (l > 1.1 && l < 1.97) off = 0.004 + 0.003 * smoothstep(1.1, 1.3, l) * (1.0 - smoothstep(1.6, 1.9, l));
    else if (l >= 1.97) off = 0.008;
  } else if (Lm >= 0.0) {
    if (Lm < uSleeve) off = Lm < 1.0 ? 0.005 + 0.009 * smoothstep(0.15, 0.55, Lm) * (1.0 - smoothstep(0.6, 0.9, Lm)) : 0.004;
  } else if (p.y < neckY(p)) {
    off = p.y < 1.0 ? 0.016 : 0.01 + 0.006 * smoothstep(1.25, 1.0, p.y);
  }
  float hm = hairMask(h, p);
  if (hm > 0.0) off += uHairA.y * hm * (1.0 + uHairA.z * clamp((p.y - 1.70) / 0.1, 0.0, 1.0));
  return off;
}
`;

const FRAG_HEAD = /* glsl */`
${COMMON}
uniform vec3 uSkin, uHairC, uKit, uKit2, uShorts, uSocks, uBoot, uNumCol, uGlove, uEyeC;
uniform float uPattern, uGK, uFacial;
uniform vec2 uNum;        // tens, ones (tens < 0 = single digit; both < 0 = none)
uniform sampler2D uDigits; uniform sampler2D uSponsors; uniform float uSpon;
float gRough;
float gFab;
uniform float uWetK;
float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 shirtCol(vec3 p, float Lm) {
  float pat = uPattern;
  float a = 0.0;
  if (pat > 0.5 && pat < 1.5) a = step(0.5, fract((p.x + 0.0275) / 0.11));
  else if (pat < 2.5 && pat > 1.5) a = step(0.5, fract(p.y / 0.13));
  else if (pat < 3.5 && pat > 2.5) a = step(0.0, p.x);
  else if (pat < 4.5 && pat > 3.5) a = step(abs(p.x * 0.9 - (p.y - 1.26)), 0.055);
  else if (pat < 5.5 && pat > 4.5) a = Lm >= 0.0 ? 1.0 : 0.0;
  else if (pat < 6.5 && pat > 5.5) a = step(0.86, fract((p.x + 0.0275) / 0.055));
  return mix(uKit, uKit2, a);
}
float digitAt(float d, vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(uDigits, vec2((d + 0.12 + uv.x * 0.76) / 10.0, uv.y)).r;
}
vec3 bodyColour() {
  vec3 p = vBind; float Lm = vReg.x > 0.5 ? 10.0 + vReg.y / max(vReg.x, 0.5) : vReg.z > 0.5 ? vReg.w / max(vReg.z, 0.5) : -1.0;
  vec3 col = uSkin; gRough = 0.55; gFab = 0.0;
  float grain = hash3(floor(p * 900.0));
  if (vEye > 0.5) {
    vec3 c = p.x > 0.0 ? ${v3(L.eyeL)} : ${v3(L.eyeR)};
    vec3 d = normalize(p - c);
    float iris = smoothstep(0.90, 0.915, d.z), pupil = smoothstep(0.972, 0.978, d.z);
    col = mix(vec3(0.84, 0.82, 0.8), uEyeC, iris);
    col = mix(col, vec3(0.02), pupil);
    gRough = 0.08;
    return col;
  }
  if (Lm >= 5.0) {
    float l = Lm - 10.0;
    if (l < 0.55) { col = uShorts; gRough = 0.75; gFab = 1.0; if (l > 0.5) col = mix(col, uKit2, 0.6); if (abs(abs(p.x) - 0.17) < 0.006 && l > 0.0) col = mix(col, uKit2, 0.8); }
    else if (l < 1.1) col = uSkin;
    else if (l < 1.97) { col = uSocks; gRough = 0.9; gFab = 1.0; if (l < 1.17) col = mix(uSocks, uKit2, 0.85); }
    else { col = uBoot; gRough = 0.32; if (p.y < 0.016) col = mix(uBoot, vec3(0.92), 0.6); if (abs(fract(p.z * 12.0) - 0.5) < 0.08 && p.y > 0.03 && p.y < 0.06) col = mix(col, vec3(0.95), 0.7); }
  } else if (Lm >= 0.0) {
    if (Lm < uSleeve) { col = shirtCol(p, Lm); gRough = 0.8; gFab = 1.0; if (uSleeve - Lm < 0.045) col = mix(col, uKit2, 0.85); }
    else if (Lm > 1.92 && uGK > 0.5) { col = uGlove; gRough = 0.7; }
  } else if (p.y < neckY(p)) {
    if (p.y < 1.0) { col = uShorts; gRough = 0.75; gFab = 1.0; }
    else {
      col = shirtCol(p, -1.0); gRough = 0.8; gFab = 1.0;
      if (neckY(p) - p.y < 0.016) col = mix(col, uKit2, 0.9);                         // collar
      if (p.y < 1.03) col = mix(col, uKit2, 0.15);
      // number on the back
      if (p.z < -0.03 && uNum.y >= 0.0) {
        vec2 uv = vec2((0.105 - p.x) / 0.21, (p.y - 1.15) / 0.21);
        float m = 0.0;
        if (uNum.x < 0.0) m = digitAt(uNum.y, vec2(uv.x * 2.0 - 0.5, uv.y));
        else m = max(digitAt(uNum.x, vec2(uv.x * 2.0, uv.y)), digitAt(uNum.y, vec2(uv.x * 2.0 - 1.0, uv.y)));
        col = mix(col, uNumCol, m);
      }
      // badge on the left chest + a sponsor panel
      if (p.z > 0.04) {
        // crest: a little shield
        vec2 q = vec2(abs(p.x - 0.085), p.y - 1.37);
        float shield = step(q.x, 0.019 - max(0.0, -q.y) * 0.55) * step(-0.026, q.y) * step(q.y, 0.016);
        col = mix(col, uKit2, shield);
        col = mix(col, uNumCol, shield * step(q.x, 0.006) * step(-0.012, q.y) * step(q.y, 0.006));
        if (uSpon >= 0.0) {
          vec2 sv = vec2((p.x + 0.11) / 0.22, (p.y - 1.215) / 0.075);
          if (sv.x > 0.0 && sv.x < 1.0 && sv.y > 0.0 && sv.y < 1.0) col = mix(col, uNumCol, texture2D(uSponsors, vec2(sv.x, (uSpon + sv.y) / 8.0)).r);
        }
      }
    }
  } else {
    // head & neck: skin, lips, brows, facial hair, hair
    vec3 skin = uSkin * (0.97 + 0.06 * grain);
    col = skin;
    float lips = smoothstep(0.42, 0.75, vFace.x) * step(0.13, p.z);
    col = mix(col, uSkin * vec3(0.8, 0.58, 0.56), lips * 0.7);
    float brow = smoothstep(0.35, 0.7, vFace.y) * step(${(L.eyeL[1] + 0.009).toFixed(4)}, p.y);
    col = mix(col, uHairC * 0.55, brow * (0.65 + 0.3 * grain));
    float lid = smoothstep(0.55, 0.9, vFace.z);
    col *= 1.0 - 0.18 * lid;
    if (uFacial > 0.5) {
      float jaw = smoothstep(1.648, 1.632, p.y) * smoothstep(1.535, 1.56, p.y) * smoothstep(-0.03, 0.03, p.z) * (1.0 - lips);
      float m = 0.0;
      if (uFacial < 1.5) m = jaw * 0.4;                                                   // stubble
      else if (uFacial < 2.5) m = jaw * 0.9;                                              // beard
      else if (uFacial < 3.5) m = jaw * smoothstep(0.03, 0.018, abs(p.x)) * 0.9;          // goatee
      else m = smoothstep(1.628, 1.633, p.y) * smoothstep(1.645, 1.64, p.y) * smoothstep(0.03, 0.02, abs(p.x)) * step(0.14, p.z); // moustache
      col = mix(col, uHairC * (0.75 + 0.4 * grain), m * (0.6 + 0.4 * grain));
    }
    float hm = hairMask(vHair, p);
    if (hm > 0.0) {
      float strand = hash3(floor(vec3(p.x * 700.0, p.y * 160.0, p.z * 700.0)));
      vec3 hc = uHairC * (0.75 + 0.5 * strand);
      if (uHairA.w > 1.5) hm *= mix(0.45, 1.0, smoothstep(1.69, 1.75, p.y));           // skin fade on the sides
      col = mix(col, hc, hm);
      gRough = mix(gRough, 0.5, hm);
    }
  }
  return col * (0.97 + 0.04 * grain);
}
`;

const SHARED = {}; // uniforms that never change
/** Shared by every player: time (cloth flutter) and how wet the kits are. */
export const HUMAN_FX = { time: { value: 0 }, wet: { value: 0 } };
function patch(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.u);
    sh.uniforms.uHT = HUMAN_FX.time; sh.uniforms.uWetK = HUMAN_FX.wet;
    sh.uniforms.uDigits = { value: digitsTex() };
    sh.uniforms.uSponsors = { value: sponsorsTex() };
    sh.vertexShader = VERT_HEAD + sh.vertexShader
      .replace('#include <morphnormal_vertex>', `#include <morphnormal_vertex>
 vec3 baseN = objectNormal;
 if (aEye < 0.5 && ((aLimb < 0.0 && position.y < neckY(position)) || (aLimb >= 5.0 && aLimb < 10.55))) {
   vec3 cyl = normalize(vec3(position.x - (aLimb >= 5.0 ? sign(position.x) * 0.1 : 0.0), 0.0, (position.z - 0.0) * 1.3) + 1e-4);
   objectNormal = normalize(mix(objectNormal, cyl, 0.55));
 }`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vBind = position; vLimb = aLimb; { float isLeg = aLimb >= 5.0 ? 1.0 : 0.0, isArm = (aLimb >= 0.0 && aLimb < 5.0) ? 1.0 : 0.0; vReg = vec4(isLeg, isLeg > 0.5 ? aLimb - 10.0 : 0.0, isArm, isArm > 0.5 ? aLimb : 0.0); } vHair = aHair; vEye = aEye; vFace = aFace;')
      .replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\n transformed += baseN * clothOffset(aLimb, position, aHair);');
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( bodyColour() * diffuse, opacity );')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = gRough * mix(1.0, gFab > 0.5 ? 0.62 : 0.5, uWetK);')
      // fabric sheen: polyester kits catch the floodlights at grazing angles
      .replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0) * (0.22 * gFab + 0.06) ;\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'human-v4';
}

const col = (c) => new THREE.Color(c);
/** A player's own material (all players share the program, each has its own uniforms). */
export function humanMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 });
  m.userData.u = {
    uSkin: { value: col('#c68a5e') }, uHairC: { value: col('#1a1310') }, uKit: { value: col('#ffffff') }, uKit2: { value: col('#111111') },
    uShorts: { value: col('#ffffff') }, uSocks: { value: col('#ffffff') }, uBoot: { value: col('#111111') }, uNumCol: { value: col('#111111') },
    uGlove: { value: col('#f2f2f2') }, uEyeC: { value: col('#4a2e1a') },
    uPattern: { value: 0 }, uGK: { value: 0 }, uMove: { value: 0 }, uSpon: { value: 0 }, uFacial: { value: 0 }, uSleeve: { value: 0.55 },
    uHairA: { value: new THREE.Vector4(0, 0.012, 0.3, 0) }, uNum: { value: new THREE.Vector2(-1, 9) },
  };
  patch(m);
  return m;
}

// hairstyles: [threshold, volume m, top boost, style]
export const HAIR_STYLES = {
  bald: [9, 0, 0, 0], buzz: [0.05, 0.002, 0, 0], short: [-0.1, 0.009, 0.5, 0], crop: [-0.05, 0.006, 0.3, 2],
  quiff: [-0.05, 0.011, 1.6, 2], curly: [-0.2, 0.02, 0.5, 0], afro: [-0.3, 0.04, 0.6, 0], long: [-0.7, 0.016, 0.3, 0],
  mohawk: [-0.1, 0.02, 1.4, 1], bun: [-0.1, 0.01, 0.3, 0], fade: [-0.05, 0.01, 0.9, 2], receding: [0.6, 0.008, 0.2, 0],
};

/**
 * Pose the bones in the bind pose (MakeHuman's A-pose, which the mesh is
 * modelled in) and bind the skeleton. Bones are placed by the rig offsets, so
 * at runtime the same bones drive the same body.
 */
export function bindHuman(mesh, bones, parts) {
  const down = new THREE.Vector3(0, -1, 0);
  const B = M.bind;
  const dir = (a, side) => new THREE.Vector3(a[0] * side, a[1], a[2]).normalize();
  const root = parts.root;
  const keep = { p: root.position.clone(), r: root.rotation.y, s: parts.body.scale.x };
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0);
  parts.body.scale.setScalar(1);
  parts.body.position.set(0, RIG.bodyY, 0);
  for (const o of [parts.body, parts.torso, parts.head]) o.quaternion.identity();
  const chain = (upper, lower, end, d1, d2) => {
    const q1 = new THREE.Quaternion().setFromUnitVectors(down, d1);
    const q2 = new THREE.Quaternion().setFromUnitVectors(down, d2);
    upper.quaternion.copy(q1);
    lower.quaternion.copy(q1.clone().invert().multiply(q2));
    if (end) end.quaternion.copy(q2.clone().invert());
  };
  for (const [side, leg, arm] of [[1, parts.legL, parts.armL], [-1, parts.legR, parts.armR]]) {
    chain(leg.hip, leg.knee, leg.ankle, dir(B.thigh, side), dir(B.shin, side));
    chain(arm.sh, arm.el, null, dir(B.upperArm, side), dir(B.foreArm, side));
  }
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones), new THREE.Matrix4());
  for (const b of bones) b.quaternion.identity();
  root.position.copy(keep.p); root.rotation.y = keep.r;
  parts.body.scale.setScalar(keep.s);
}
