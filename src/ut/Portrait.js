// Card headshots: the player's real in-game model (face, hair, kit) rendered
// head-and-shoulders into a small image, once, then cached. Queued so a long
// club list fills in over a few frames instead of stalling.
import * as THREE from 'three';
import { Player } from '../entities/Player.js';
import { statsFromRating } from '../data/playerStats.js';
import { makeRng } from '../core/MathUtil.js';
import { club } from './world.js';
import { kitLook } from './kits.js';

const SIZE = 192;

export class Portraits {
  constructor() {
    this.cache = new Map();
    this.queue = [];
    this.waiting = new Map();   // id → [img elements]
    try {
      const c = document.createElement('canvas');
      c.width = c.height = SIZE;
      const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.15;
      r.setClearColor(0x000000, 0);
      this.renderer = r; this.canvas = c;
    } catch (_) { this.failed = true; return; }
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404858, 1.4));
    const key = new THREE.DirectionalLight(0xfff0dd, 2.6); key.position.set(1.2, 2.2, 2.5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 1.6); rim.position.set(-2, 2, -1.5); this.scene.add(rim);
    this.camera = new THREE.PerspectiveCamera(24, 1, 0.05, 20);
    this.player = new Player(this.scene, { id: 'portrait', team: 'home', role: 'mate', name: '', look: { kitColour: '#ffffff', shortsColour: '#111', skinTone: '#c68a5e', number: -1 }, stats: statsFromRating(70, makeRng(3)), rating: 70 });
    this.player.place(0, 0, 0);
    this.player.setShadows(false);
    this.player.blob.visible = false;
  }

  /** Fill <img> with the card's headshot (now if cached, otherwise soon). */
  into(img, c) {
    if (this.failed) return;
    const url = this.cache.get(c.id);
    if (url) { img.src = url; return; }
    const w = this.waiting.get(c.id);
    if (w) { w.push(img); return; }
    this.waiting.set(c.id, [img]);
    this.queue.push(c);
    this._kick();
  }

  _kick() {
    if (this.busy) return;
    this.busy = true;
    const step = () => {
      const t0 = performance.now();
      while (this.queue.length && performance.now() - t0 < 12) this._render(this.queue.shift());
      if (this.queue.length) requestAnimationFrame(step); else this.busy = false;
    };
    requestAnimationFrame(step);
  }

  _render(c) {
    const p = this.player, L = c.look;
    const cl = club(c.club);
    p.isKeeper = c.pos === 'GK';
    p.setKit(c.pos === 'GK' ? { kitColour: '#2bd47d', shortsColour: '#16161c', socksColour: '#2bd47d', accent: '#16161c', pattern: 0, sponsor: -1 } : { ...kitLook(cl.kit), sponsor: -1 });
    p.setAppearance({ skin: L.skin, hairColour: L.hairColour, hairStyle: L.hairStyle, facial: L.facial, face: L.face, eyeColour: L.eyeColour, number: -1, sleeves: 'short' });
    p.setHeight(1.8);
    // a relaxed idle frame
    p.anim.action = null;
    p.updateAnimation(0.5, false);
    p.render(1, 0);
    p.parts.root.updateMatrixWorld(true);
    const head = new THREE.Vector3();
    p.parts.head.getWorldPosition(head);
    // the head bone sits at the top of the neck: frame the face and a bit of shoulder
    const fx = head.x, fy = head.y + 0.05, fz = head.z + 0.03;
    this.camera.position.set(fx + 0.2, fy + 0.03, fz + 1.12);
    this.camera.lookAt(fx, fy - 0.05, fz);
    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/png');
    this.cache.set(c.id, url);
    for (const img of this.waiting.get(c.id) || []) img.src = url;
    this.waiting.delete(c.id);
  }
}
