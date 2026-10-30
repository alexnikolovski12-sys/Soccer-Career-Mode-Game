// Floating virtual joystick: the base appears where the thumb lands,
// the knob follows within a radius. Output is analog with a dead zone.
import { CONFIG } from '../config.js';
import { getSafeInsets } from './safeArea.js';

export class Joystick {
  constructor(parent) {
    this.el = document.createElement('div');
    this.el.className = 'joy';
    this.base = document.createElement('div');
    this.base.className = 'joy-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.base.appendChild(this.knob);
    this.el.appendChild(this.base);
    parent.appendChild(this.el);

    this.pointerId = null;
    this.origin = { x: 0, y: 0 };
    this.value = { x: 0, y: 0, mag: 0 }; // y positive = up on screen
    this.radius = 60;
    this.resize();
    this._showIdle();
  }

  get active() { return this.pointerId !== null; }

  resize() {
    const m = Math.min(window.innerWidth, window.innerHeight);
    this.radius = Math.max(44, Math.min(78, m * 0.14));
    const size = this.radius * 2;
    this.base.style.width = this.base.style.height = `${size}px`;
    const k = this.radius * 0.9;
    this.knob.style.width = this.knob.style.height = `${k}px`;
    this.knob.style.marginLeft = this.knob.style.marginTop = `${-k / 2}px`;
    if (!this.active) this._showIdle();
  }

  /** Resting position hint (bottom-left, inside safe area). */
  _showIdle() {
    const safe = getSafeInsets();
    this._place(safe.left + this.radius + 34, window.innerHeight - safe.bottom - this.radius - 30);
    this.el.classList.remove('active');
    this.knob.style.transform = 'translate(0px, 0px)';
  }

  _place(x, y) {
    this.origin.x = x; this.origin.y = y;
    this.base.style.transform = `translate(${x - this.radius}px, ${y - this.radius}px)`;
  }

  begin(id, x, y) {
    this.pointerId = id;
    this._place(x, y);
    this.el.classList.add('active');
    this.move(id, x, y);
  }

  move(id, x, y) {
    if (id !== this.pointerId) return;
    let dx = x - this.origin.x, dy = y - this.origin.y;
    const d = Math.hypot(dx, dy);
    const r = this.radius;
    if (d > r) { dx *= r / d; dy *= r / d; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const raw = Math.min(d / r, 1);
    const dz = CONFIG.dribble.joyDeadZone;
    if (raw < dz || d < 1e-3) {
      this.value.x = 0; this.value.y = 0; this.value.mag = 0;
    } else {
      const mag = (raw - dz) / (1 - dz);
      this.value.x = (dx / d) * mag;
      this.value.y = (-dy / d) * mag;
      this.value.mag = mag;
    }
  }

  end(id) {
    if (id !== this.pointerId) return;
    this.pointerId = null;
    this.value.x = 0; this.value.y = 0; this.value.mag = 0;
    this._showIdle();
  }

  cancel() { if (this.pointerId !== null) this.end(this.pointerId); }

  setVisible(v) { this.el.style.display = v ? '' : 'none'; }
}
