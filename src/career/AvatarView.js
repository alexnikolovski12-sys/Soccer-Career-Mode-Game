// Your actual 3D player (same model + motion-captured idle as in matches),
// shown on the career home screen in your club's kit. Drag to spin him.
import * as THREE from 'three';
import { Player } from '../entities/Player.js';
import { statsFromRating } from '../data/playerStats.js';
import { makeRng } from '../core/MathUtil.js';

export class AvatarView {
  constructor() {
    const c = (this.canvas = document.createElement('canvas'));
    c.className = 'avatar3d';
    let r;
    try {
      r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch (_) { this.failed = true; return; }
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 0.75, 0.1, 50);
    this.camera.position.set(0, 1.0, 4.3);
    this.camera.lookAt(0, 0.93, 0);
    // studio lighting: soft fill, warm key, purple rim to sit on the hub background
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a1c66, 1.25));
    const key = new THREE.DirectionalLight(0xfff2e0, 2.4); key.position.set(2.5, 4, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xb37bff, 2.2); rim.position.set(-3, 3, -3); this.scene.add(rim);
    // a little plinth glow under his feet
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), new THREE.MeshBasicMaterial({ color: 0xc9a2ff, transparent: true, opacity: 0.22 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.005;
    this.scene.add(disc);
    this.player = null;
    // heading 0 faces the camera (+z); a slight three-quarter turn
    this.yaw = 0.18; this.dragV = 0; this.t = 0;
    this._drag(c);
  }

  _drag(c) {
    let id = null, lx = 0;
    c.addEventListener('pointerdown', (e) => { id = e.pointerId; lx = e.clientX; try { c.setPointerCapture(id); } catch (_) { /* ignore */ } e.stopPropagation(); });
    c.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; const dx = e.clientX - lx; lx = e.clientX; this.yaw += dx * 0.012; this.dragV = dx * 0.012; this.lastDrag = performance.now(); });
    const up = (e) => { if (e.pointerId === id) id = null; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }

  /** Dress the model: club kit + the player's skin and hair. */
  setPlayer({ kit, skin, hair, number = 9 }) {
    if (this.failed) return;
    const look = {
      kitColour: kit.primary, shortsColour: kit.shorts, socksColour: kit.socks,
      skinTone: skin, hairColour: hair, bootColour: '#111111', height: 1.8, number,
    };
    if (!this.player) {
      this.player = new Player(this.scene, {
        id: 'avatar', team: 'home', role: 'mate', name: '', look,
        stats: statsFromRating(70, makeRng(7)), rating: 70,
      });
      this.player.place(0, 0, this.yaw); // start facing the camera (no instant spin for the animator)
      if (this.player.animator) this.player.animator._lastHeading = this.yaw;
      this.player.setShadows(false);
      if (this.player.blob) this.player.blob.visible = false;
    } else {
      this.player.setKit({ kitColour: kit.primary, shortsColour: kit.shorts, socksColour: kit.socks });
      this.player.setSkinHair(skin, hair);
    }
  }

  /** Put the view into `host` (re-attached on every hub render) and run it. */
  attach(host) {
    if (this.failed) { host.innerHTML = '<div class="avatar3d-fallback"></div>'; return; }
    host.appendChild(this.canvas);
    this._resize(host);
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame((t) => this._loop(t)); }
  }

  _resize(host) {
    const w = Math.max(60, host.clientWidth), h = Math.max(80, host.clientHeight);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`;
    this.camera.aspect = w / h;
    // keep the whole body in frame whatever the box shape
    this.camera.fov = w / h < 0.75 ? 29 : 27;
    this.camera.updateProjectionMatrix();
  }

  _loop(now) {
    // stop when the hub isn't showing the home screen
    if (!this.canvas.isConnected) { this.raf = null; return; }
    this.raf = requestAnimationFrame((t) => this._loop(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    if (this.canvas.parentElement) this._resize(this.canvas.parentElement);
    const p = this.player;
    if (!p) return;
    // spin with drag momentum, then drift back to a gentle idle sway
    const idle = !this.lastDrag || now - this.lastDrag > 1600;
    if (!idle) { this.dragV *= Math.exp(-4 * dt); this.yaw += this.dragV * 0.2; }
    else this.yaw += ((0.18 + Math.sin(this.t * 0.35) * 0.28) - this.yaw) * Math.min(1, dt * 0.8);
    p.savePrev();
    p.heading = p.prevHeading = this.yaw;
    p.updateAnimation(dt, false);
    p.render(1, this.t);
    this.renderer.render(this.scene, this.camera);
  }
}
