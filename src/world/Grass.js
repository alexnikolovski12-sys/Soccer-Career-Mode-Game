// Broadcast-style turf, all in the shader (world space, no big textures):
//  - mowing stripes that change with the viewing direction, the way real
//    stripes do (blades laid by the mower look light with the lay, dark against it)
//  - colour variation at three scales + a small tiling blade-detail texture
//  - worn goalmouths / centre spot, an unmown surround past the lines
//  - wet look (darker, glossier: the floodlights reflect off it) when it rains
import * as THREE from 'three';
import { CONFIG } from '../config.js';

function detailTexture() {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, N, N);
  // thousands of short blade strokes, mostly upright, wrapped at the edges so it tiles
  let s = 1234567;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * N, y = rnd() * N, len = 3 + rnd() * 7, a = -Math.PI / 2 + (rnd() - 0.5) * 0.9;
    const v = Math.floor(70 + rnd() * 120);
    g.strokeStyle = `rgba(${v},${v},${v},${0.35 + rnd() * 0.4})`;
    g.lineWidth = 0.6 + rnd() * 0.9;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      if (x + ox < -10 || x + ox > N + 10 || y + oy < -10 || y + oy > N + 10) continue;
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export const GRASS = {
  uWet: { value: 0 },
  uDetail: { value: null },
  uGrass: { value: new THREE.Color(0.075, 0.2, 0.042) },
  uStripe: { value: 0.11 },
};

export function grassMaterial() {
  if (!GRASS.uDetail.value) GRASS.uDetail.value = detailTexture();
  const P = CONFIG.pitch;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, GRASS);
    sh.uniforms.uHalf = { value: new THREE.Vector2(P.length / 2, P.width / 2) };
    sh.uniforms.uStripeW = { value: P.length / P.stripes };
    sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vGW;
uniform float uWet, uStripe, uStripeW; uniform vec3 uGrass; uniform vec2 uHalf; uniform sampler2D uDetail;
float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gh(i), gh(i + vec2(1.0, 0.0)), u.x), mix(gh(i + vec2(0.0, 1.0)), gh(i + vec2(1.0, 1.0)), u.x), u.y); }
float gRoughW;
vec3 turf() {
  vec2 p = vGW.xz;
  vec3 V = normalize(cameraPosition - vGW);
  // inside the mown area (a couple of metres past the lines)
  float inside = (1.0 - smoothstep(uHalf.x + 1.5, uHalf.x + 3.0, abs(p.x))) * (1.0 - smoothstep(uHalf.y + 1.5, uHalf.y + 3.0, abs(p.y)));
  float idx = floor((p.x + uHalf.x) / uStripeW);
  float sgn = mod(idx, 2.0) < 0.5 ? 1.0 : -1.0;
  // soft stripe edges (a mower's pass isn't a hard line)
  float e = fract((p.x + uHalf.x) / uStripeW);
  float edge = smoothstep(0.0, 0.06, e) * smoothstep(1.0, 0.94, e);
  float lay = sgn * mix(0.35, 1.0, clamp(-V.z * 1.25, 0.0, 1.0)) * edge * inside;
  float s = lay * uStripe;
  vec3 c = uGrass * vec3(1.0 + s * 0.9, 1.0 + s, 1.0 + s * 0.55);
  // colour variation: big patches, mid clumps, fine
  float n3 = gn(p * 0.045), n2 = gn(p * 0.31 + 17.0), n1 = gn(p * 2.3 + 5.0);
  c *= 0.9 + 0.12 * n3 + 0.07 * n2 + 0.05 * n1;
  c *= vec3(1.0 + (n3 - 0.5) * 0.08, 1.0, 1.0 - (n3 - 0.5) * 0.1);   // a touch yellower / bluer in places
  // blade detail (two scales, slightly rotated so it doesn't tile visibly)
  float d1 = texture2D(uDetail, p * 0.62).r, d2 = texture2D(uDetail, vec2(p.y, -p.x) * 2.3 + 0.37).r;
  c *= 0.5 + 1.0 * d1 * (0.55 + 0.9 * d2);
  // wear: goalmouths, penalty spots, centre circle
  float gm = exp(-(pow(abs(p.x) - (uHalf.x - 3.5), 2.0) / 14.0 + p.y * p.y / 9.0));
  float ps = exp(-(pow(abs(p.x) - (uHalf.x - 11.0), 2.0) + p.y * p.y) / 1.2);
  float cc = exp(-(p.x * p.x + p.y * p.y) / 6.0) * 0.6;
  float wear = clamp((gm * 0.85 + ps * 0.5 + cc) * (0.55 + 0.9 * n1) * (0.7 + 0.6 * n2), 0.0, 1.0);
  c = mix(c, vec3(0.16, 0.13, 0.075) * (0.8 + 0.4 * n1), wear * 0.55);
  // the unmown surround: a little darker and duller
  c *= mix(0.86, 1.0, inside);
  // wet: darker and glossy
  c *= 1.0 - 0.2 * uWet;
  gRoughW = mix(0.93, 0.38 + 0.2 * n2, uWet) + wear * 0.05;
  return c;
}
` + sh.fragmentShader
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( turf(), opacity );')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = gRoughW;');
  };
  m.customProgramCacheKey = () => 'turf-v1';
  return m;
}
