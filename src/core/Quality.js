// Adaptive quality: watches FPS and steps down (shadows off → lower
// resolution → simpler crowd) when below target, back up when it recovers.
import { CONFIG } from '../config.js';

export class Quality {
  constructor(apply) {
    this.apply = apply; // (levelObject, index) => void
    this.level = CONFIG.quality.startLevel;
    this.fps = 60;
    this._frames = 0;
    this._acc = 0;
    this._low = 0;
    this._high = 0;
    this.locked = false;   // debug can pin a level
    this.cooldown = 0;
    this.failed = {};      // level → times we had to drop out of it
  }

  get current() { return CONFIG.quality.levels[this.level]; }

  set(level, lock = false) {
    const L = CONFIG.quality.levels;
    this.level = Math.max(0, Math.min(L.length - 1, level));
    this.locked = lock;
    this._low = this._high = 0;
    this.cooldown = 2;
    this.apply(L[this.level], this.level);
  }

  /** realDt per rendered frame. `active` = gameplay is running (don't adapt on overlays). */
  tick(realDt, active) {
    this._frames++;
    this._acc += realDt;
    if (this._acc < 0.5) return;
    this.fps = this._frames / this._acc;
    const span = this._acc;
    this._frames = 0;
    this._acc = 0;
    if (this.locked || !active || document.hidden) return;
    if (this.cooldown > 0) { this.cooldown -= span; return; }
    const Q = CONFIG.quality;
    if (this.fps < Q.downFps) { this._low += span; this._high = 0; } else { this._low = 0; }
    if (this.fps >= Q.upFps) this._high += span; else this._high = 0;
    if (this._low >= Q.downTime && this.level > 0) {
      this.failed[this.level] = (this.failed[this.level] || 0) + 1;
      this.set(this.level - 1);
    } else if (this._high >= Q.upTime && this.level < Q.levels.length - 1 && this.level < this._ceiling()) {
      this.set(this.level + 1);
    }
  }

  // never auto-step above the start level
  // never auto-step above the start level, nor back into a level that failed twice
  _ceiling() {
    let c = CONFIG.quality.startLevel;
    while (c > 0 && (this.failed[c] || 0) >= 2) c--;
    return c;
  }
}
