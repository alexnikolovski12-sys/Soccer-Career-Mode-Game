// Unified touch + mouse + keyboard input with full multi-touch.
// - Left half of the touch layer drives the floating joystick.
// - HUD buttons register through bindButton() and track their own pointers.
// - In aim mode every touch on the layer goes to the slingshot handlers.
import { Joystick } from '../ui/Joystick.js';

export class Input {
  constructor(layer, uiRoot) {
    this.layer = layer;
    this.joystick = new Joystick(uiRoot);
    this.move = { x: 0, y: 0, mag: 0 };
    this.held = {};       // name → bool
    this.pressed = {};    // name → edge flag (consumed by game)
    this.keys = new Set();
    this.aimHandlers = null;
    this.aimPointer = null;
    this.enabled = true;
    this.anyInteraction = null; // callback for first user gesture (audio unlock)

    layer.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointermove', (e) => this._move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', (e) => this._up(e));

    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => this.releaseAll());

    // iOS: block page scroll, pinch and double-tap zoom everywhere.
    const block = (e) => {
      // the debug panel needs native scrolling and slider drags
      if (e.target && e.target.closest && e.target.closest('.debug-panel')) return;
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', block, { passive: false });
    document.addEventListener('gesturestart', block);
    document.addEventListener('gesturechange', block);
    document.addEventListener('dblclick', block);
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = performance.now();
      if (now - lastTouchEnd < 300 && e.target === layer && e.cancelable) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
    document.addEventListener('contextmenu', block);
  }

  _gesture() { if (this.anyInteraction) this.anyInteraction(); }

  _down(e) {
    this._gesture();
    if (!this.enabled) return;
    e.preventDefault();
    if (this.aimHandlers) {
      if (this.aimPointer === null) {
        this.aimPointer = e.pointerId;
        this.aimHandlers.down(e.clientX, e.clientY);
      }
      return;
    }
    if (e.clientX < window.innerWidth * 0.5 && !this.joystick.active) {
      this.joystick.begin(e.pointerId, e.clientX, e.clientY);
    }
  }

  _move(e) {
    if (this.aimHandlers && e.pointerId === this.aimPointer) {
      this.aimHandlers.move(e.clientX, e.clientY);
      return;
    }
    if (e.pointerId === this.joystick.pointerId) this.joystick.move(e.pointerId, e.clientX, e.clientY);
  }

  _up(e) {
    if (e.pointerId === this.aimPointer) {
      this.aimPointer = null;
      if (this.aimHandlers) this.aimHandlers.up(e.clientX, e.clientY);
      return;
    }
    if (e.pointerId === this.joystick.pointerId) this.joystick.end(e.pointerId);
  }

  /** Make a DOM element act as a hold/tap button. */
  bindButton(el, name) {
    const pointers = new Set();
    const down = (e) => {
      this._gesture();
      e.preventDefault();
      e.stopPropagation();
      if (!this.enabled && name !== 'ui') return;
      pointers.add(e.pointerId);
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      this.held[name] = true;
      this.pressed[name] = true;
      el.classList.add('down');
    };
    const up = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size === 0) { this.held[name] = false; el.classList.remove('down'); }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  _key(e, isDown) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    const k = e.key.toLowerCase();
    const map = {
      ' ': 'pass', f: 'shoot', shift: 'sprint', escape: 'cancel', p: 'pause', enter: 'confirm', r: 'retry',
    };
    if (isDown) this._gesture();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      if (isDown) this.keys.add(k); else this.keys.delete(k);
      e.preventDefault();
      return;
    }
    const name = map[k];
    if (!name) return;
    e.preventDefault();
    if (isDown && !this.held[name]) this.pressed[name] = true;
    this.held[name] = isDown;
  }

  consume(name) {
    const v = !!this.pressed[name];
    this.pressed[name] = false;
    return v;
  }

  clearPresses() { for (const k in this.pressed) this.pressed[k] = false; }

  releaseAll() {
    this.keys.clear();
    for (const k in this.held) this.held[k] = false;
    this.joystick.cancel();
    this.aimPointer = null;
  }

  setAimMode(handlers) {
    this.aimHandlers = handlers;
    this.aimPointer = null;
    if (handlers) { this.joystick.cancel(); this.joystick.setVisible(false); }
  }

  /** Call once per frame: merges joystick + keyboard into this.move. */
  poll() {
    let kx = 0, ky = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) kx -= 1;
    if (k.has('d') || k.has('arrowright')) kx += 1;
    if (k.has('w') || k.has('arrowup')) ky += 1;
    if (k.has('s') || k.has('arrowdown')) ky -= 1;
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      this.move.x = kx / l; this.move.y = ky / l; this.move.mag = 1;
    } else {
      const j = this.joystick.value;
      this.move.x = j.x; this.move.y = j.y; this.move.mag = j.mag;
    }
    return this.move;
  }
}
