// Goal replay: a ring buffer of rendered transforms (players' root + pose,
// ball position + rotation) stamped with sim time, played back in slow-mo.
import { CONFIG } from '../config.js';
import { Player } from '../entities/Player.js';

export class Replay {
  constructor(game) {
    this.game = game;
    this.players = [];
    this.cap = 0;
    this.frames = 0;
    this.head = 0;
    this.times = null;
    this.buf = null;
    this.playing = false;
  }

  reset(players) {
    this.players = players.slice();
    this.stride = this.players.length * Player.RECORD_SIZE + 7;
    // build-up + tail + the live celebration recorded before playback starts
    // build-up + the whole celebration (a big late-goal one runs longest)
    const seconds = Math.max(CONFIG.juice.replaySeconds + CONFIG.juice.celebrateTime * 1.6 + 2, 9);   // (a foul replay reaches ~6 s back)
    const cap = Math.ceil(seconds * 62);
    if (!this.buf || this.cap !== cap || this.buf.length !== cap * this.stride) {
      this.cap = cap;
      this.buf = new Float32Array(cap * this.stride);
      this.times = new Float64Array(cap);
    }
    this.frames = 0;
    this.head = 0;
    this.lastTime = -1;
  }

  /** Call after rendering a frame. */
  record(simTime) {
    // at most one frame per sim step (keeps 120 Hz displays from overrunning the buffer)
    if (this.playing || simTime < this.lastTime + 1 / 61) return;
    this.lastTime = simTime;
    const i = this.head;
    const o = i * this.stride;
    const RS = Player.RECORD_SIZE;
    for (let k = 0; k < this.players.length; k++) this.players[k].writeRecord(this.buf, o + k * RS);
    const b = this.game.ball.mesh;
    const bo = o + this.players.length * RS;
    this.buf[bo] = b.position.x; this.buf[bo + 1] = b.position.y; this.buf[bo + 2] = b.position.z;
    this.buf[bo + 3] = b.quaternion.x; this.buf[bo + 4] = b.quaternion.y;
    this.buf[bo + 5] = b.quaternion.z; this.buf[bo + 6] = b.quaternion.w;
    this.times[i] = simTime;
    this.head = (this.head + 1) % this.cap;
    this.frames = Math.min(this.frames + 1, this.cap);
  }

  _idx(n) { // n-th oldest frame
    return (this.head - this.frames + n + this.cap * 2) % this.cap;
  }

  /** Start playback of sim-time range [from, to] (clamped to what was recorded). */
  start(from, to, speed, slowUntil = Infinity) {
    this.slowUntil = slowUntil;
    if (this.frames < 4) return false;
    const newest = this.times[this._idx(this.frames - 1)];
    const oldest = this.times[this._idx(0)];
    this.t0 = Math.max(oldest, from);
    this.t1 = Math.min(newest, to);
    if (this.t1 - this.t0 < 0.3) return false;
    this.t = this.t0;
    this.speed = speed;
    this.cursor = 0;
    this.playing = true;
    return true;
  }

  stop() { this.playing = false; }

  get progress() { return this.playing ? (this.t - this.t0) / (this.t1 - this.t0) : 1; }

  /** Advance playback by real dt; returns false when finished. */
  update(realDt) {
    if (!this.playing) return false;
    // ease in/out of the slowest section around the end
    // slow-motion for the goal itself, then the celebration at normal speed
    this.t += realDt * (this.t < this.slowUntil ? this.speed : 1);
    if (this.t >= this.t1) { this.t = this.t1; this._apply(); this.playing = false; return false; }
    this._apply();
    return true;
  }

  _apply() {
    // find frames around t (cursor moves forward only)
    let n = this.cursor;
    while (n < this.frames - 2 && this.times[this._idx(n + 1)] < this.t) n++;
    this.cursor = n;
    const ia = this._idx(n), ib = this._idx(Math.min(n + 1, this.frames - 1));
    const ta = this.times[ia], tb = this.times[ib];
    const f = tb > ta ? Math.min(1, Math.max(0, (this.t - ta) / (tb - ta))) : 0;
    const oa = ia * this.stride, ob = ib * this.stride;
    const RS = Player.RECORD_SIZE;
    const buf = this.buf;
    for (let k = 0; k < this.players.length; k++) {
      this._lerpPlayer(this.players[k], oa + k * RS, ob + k * RS, f);
    }
    const bo = this.players.length * RS;
    const ball = this.game.ball;
    const m = ball.mesh;
    m.position.set(
      buf[oa + bo] + (buf[ob + bo] - buf[oa + bo]) * f,
      buf[oa + bo + 1] + (buf[ob + bo + 1] - buf[oa + bo + 1]) * f,
      buf[oa + bo + 2] + (buf[ob + bo + 2] - buf[oa + bo + 2]) * f,
    );
    m.quaternion.set(buf[ob + bo + 3], buf[ob + bo + 4], buf[ob + bo + 5], buf[ob + bo + 6]);
    ball.blob.position.set(m.position.x, 0.012, m.position.z);
    this.ballPos = m.position;
  }

  _lerpPlayer(p, oa, ob, f) {
    // readRecord supports separate a/b buffers with the same offset; use temp views
    const tmp = this._tmpA || (this._tmpA = new Float32Array(Player.RECORD_SIZE));
    const tmpB = this._tmpB || (this._tmpB = new Float32Array(Player.RECORD_SIZE));
    tmp.set(this.buf.subarray(oa, oa + Player.RECORD_SIZE));
    tmpB.set(this.buf.subarray(ob, ob + Player.RECORD_SIZE));
    p.readRecord(tmp, tmpB, 0, f);
  }
}
