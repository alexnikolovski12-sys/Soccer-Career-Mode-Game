// Minimal state machine. Each state is { enter(data, prev), exit(next), update(dt), frame(realDt) }.

export const STATES = {
  LOADING: 'LOADING',
  MENU: 'MENU',
  KICKOFF: 'KICKOFF',
  GOAL: 'GOAL',
  HALFTIME: 'HALFTIME',
  FULLTIME: 'FULLTIME',
  INTRO: 'INTRO',
  PLAYING: 'PLAYING',
  SHOT_AIM: 'SHOT_AIM',
  SHOT_FLIGHT: 'SHOT_FLIGHT',
  RESULT: 'RESULT',
  PAUSED: 'PAUSED',
};

export class StateMachine {
  constructor() {
    this.states = {};
    this.current = null;
    this.name = null;
    this.prevName = null;
    this.time = 0; // real seconds in current state
    this.listeners = [];
  }

  add(name, state) { this.states[name] = state; return this; }

  onChange(fn) { this.listeners.push(fn); }

  change(name, data) {
    const next = this.states[name];
    if (!next) throw new Error(`Unknown state ${name}`);
    const prev = this.name;
    if (this.current && this.current.exit) this.current.exit(name);
    this.prevName = prev;
    this.name = name;
    this.current = next;
    this.time = 0;
    if (next.enter) next.enter(data, prev);
    for (const fn of this.listeners) fn(name, prev);
  }

  is(...names) { return names.includes(this.name); }

  /** Suspend the current state (no exit) and enter an overlay state, e.g. PAUSED. */
  push(name, data) {
    if (this._stack) return;
    this._stack = { name: this.name, current: this.current, time: this.time };
    this.prevName = this.name;
    this.name = name;
    this.current = this.states[name];
    this.time = 0;
    if (this.current.enter) this.current.enter(data, this._stack.name);
    for (const fn of this.listeners) fn(name, this._stack.name);
  }

  /** Leave the overlay state and resume the suspended one (no enter). */
  pop() {
    if (!this._stack) return;
    if (this.current && this.current.exit) this.current.exit(this._stack.name);
    const prev = this.name;
    ({ name: this.name, current: this.current, time: this.time } = this._stack);
    this._stack = null;
    for (const fn of this.listeners) fn(this.name, prev);
  }

  get suspended() { return this._stack ? this._stack.name : null; }

  update(dt) { if (this.current && this.current.update) this.current.update(dt); }

  frame(realDt) {
    this.time += realDt;
    if (this.current && this.current.frame) this.current.frame(realDt);
  }
}
