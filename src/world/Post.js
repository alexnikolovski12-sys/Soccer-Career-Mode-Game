// Post-processing tuned for a phone: the scene is rendered to an HDR
// multisampled target, the bright parts (floodlights, LED boards, white kits
// in the lights) bloom at quarter and eighth resolution, and one final pass
// does exposure, filmic tone mapping, a broadcast colour grade, vignette and
// dithering. Turned off on the lower quality levels.
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const BRIGHT = `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = clamp((l - uThresh) / max(l, 1e-4), 0.0, 1.0);
  gl_FragColor = vec4(min(c * k, vec3(40.0)), 1.0);
}`;

const BLUR = `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += (texture2D(tSrc, vUv + uDir * 1.3846153846).rgb + texture2D(tSrc, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
  c += (texture2D(tSrc, vUv + uDir * 3.2307692308).rgb + texture2D(tSrc, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const DOWN = `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c * 0.25, 1.0);
}`;

const FINAL = `uniform sampler2D tScene, tB1, tB2; uniform vec2 uPx; uniform float uExposure, uBloom, uSat, uContrast, uVignette, uTime;
uniform vec3 uLift, uGain; varying vec2 vUv;
vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= 1.0 / 0.6;
  color = ACESInputMat * color; color = RRTAndODTFit(color); color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  // broadcast-style sharpening (unsharp mask) + a whisper of lens fringing toward the edges
  vec2 px = uPx;
  vec3 blur = (texture2D(tScene, vUv + vec2(px.x, 0.0)).rgb + texture2D(tScene, vUv - vec2(px.x, 0.0)).rgb
             + texture2D(tScene, vUv + vec2(0.0, px.y)).rgb + texture2D(tScene, vUv - vec2(0.0, px.y)).rgb) * 0.25;
  c = max(c + (c - blur) * 0.45, 0.0);
  vec2 cq = (vUv - 0.5);
  float ca = dot(cq, cq) * 0.004;
  c.r = mix(c.r, texture2D(tScene, vUv - cq * ca * 2.0).r, 0.5);
  c.b = mix(c.b, texture2D(tScene, vUv + cq * ca * 2.0).b, 0.5);
  c += (texture2D(tB1, vUv).rgb * 0.55 + texture2D(tB2, vUv).rgb * 0.9) * uBloom;
  c = aces(c * uExposure);
  // grade (display-referred): saturation, gentle S-curve, cool lift / warm gain
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
  c = c * uGain + uLift * (1.0 - c);
  // vignette
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
  c = toSRGB(clamp(c, 0.0, 1.0));
  // dither (kills banding in the sky / grass gradients)
  float n = fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.enabled = false;
    const gl = renderer.getContext();
    const half = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
    this.type = half ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.maxSamples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
    const mk = (s = 0, depth = false) => new THREE.WebGLRenderTarget(1, 1, { type: this.type, samples: s, depthBuffer: depth, stencilBuffer: false, colorSpace: THREE.LinearSRGBColorSpace });
    this.scene = mk(this.maxSamples, true);
    this.a = mk(); this.b = mk(); this.c = mk(); this.d = mk();
    for (const t of [this.a, this.b, this.c, this.d]) { t.texture.minFilter = t.texture.magFilter = THREE.LinearFilter; t.texture.generateMipmaps = false; }
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    const sm = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
    this.mBright = sm(BRIGHT, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 1.1 } });
    this.mBlur = sm(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.mDown = sm(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mFinal = sm(FINAL, {
      tScene: { value: null }, tB1: { value: null }, tB2: { value: null }, uPx: { value: new THREE.Vector2(1, 1) },
      uExposure: { value: 1 }, uBloom: { value: 0.6 }, uSat: { value: 1.08 }, uContrast: { value: 0.12 }, uVignette: { value: 0.22 },
      uLift: { value: new THREE.Vector3(0.006, 0.008, 0.014) }, uGain: { value: new THREE.Vector3(1.0, 0.995, 0.98) }, uTime: { value: 0 },
    });
    this.w = 0; this.h = 0;
  }

  setSize(w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.scene.setSize(w, h);
    const w4 = Math.max(1, w >> 2), h4 = Math.max(1, h >> 2), w8 = Math.max(1, w >> 3), h8 = Math.max(1, h >> 3);
    this.a.setSize(w4, h4); this.b.setSize(w4, h4); this.c.setSize(w8, h8); this.d.setSize(w8, h8);
  }

  /** look: { exposure, bloom, sat, contrast } */
  setLook(o) {
    const u = this.mFinal.uniforms;
    if (o.exposure != null) u.uExposure.value = o.exposure;
    if (o.bloom != null) u.uBloom.value = o.bloom;
    if (o.sat != null) u.uSat.value = o.sat;
    if (o.contrast != null) u.uContrast.value = o.contrast;
    if (o.thresh != null) this.mBright.uniforms.uThresh.value = o.thresh;
  }

  _pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.qs, this.cam);
  }

  render(scene, camera, time = 0) {
    const r = this.r;
    const size = r.getDrawingBufferSize(this._sz || (this._sz = new THREE.Vector2()));
    this.setSize(size.x, size.y);
    r.setRenderTarget(this.scene);
    r.render(scene, camera);
    // bloom
    const br = this.mBright.uniforms;
    br.tSrc.value = this.scene.texture; br.uTexel.value.set(1 / this.w, 1 / this.h);
    this._pass(this.mBright, this.a);
    const bl = this.mBlur.uniforms;
    bl.tSrc.value = this.a.texture; bl.uDir.value.set(1 / this.a.width, 0); this._pass(this.mBlur, this.b);
    bl.tSrc.value = this.b.texture; bl.uDir.value.set(0, 1 / this.a.height); this._pass(this.mBlur, this.a);
    const dn = this.mDown.uniforms;
    dn.tSrc.value = this.a.texture; dn.uTexel.value.set(0.5 / this.a.width, 0.5 / this.a.height); this._pass(this.mDown, this.c);
    bl.tSrc.value = this.c.texture; bl.uDir.value.set(1 / this.c.width, 0); this._pass(this.mBlur, this.d);
    bl.tSrc.value = this.d.texture; bl.uDir.value.set(0, 1 / this.c.height); this._pass(this.mBlur, this.c);
    const f = this.mFinal.uniforms;
    f.uPx.value.set(1 / this.w, 1 / this.h);
    f.tScene.value = this.scene.texture; f.tB1.value = this.a.texture; f.tB2.value = this.c.texture; f.uTime.value = time % 100;
    this._pass(this.mFinal, null);
  }
}
