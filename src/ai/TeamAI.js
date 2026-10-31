// Team AI for full 11-a-side matches — the same brain runs both sides.
//  * shape: every player has a formation slot; the whole block slides with the
//    ball, pushes up and spreads in possession, drops and narrows without it
//  * defending: one presser (jockeys, then tackles), a cover man near goal,
//    goal-side marking of runners, pass interceptions, loose-ball chasing
//  * attacking: support angles around the carrier, runs in behind on the last
//    line, wide players hold the width, full-backs overlap
//  * on the ball (AI carriers): dribble at space, pass / through ball / cross,
//    shoot when in range — decision speed and quality come from ratings
// Attack direction: home → +x, away → −x (s = ±1). Positions in the "team
// frame" are fx (−1 own goal line … +1 opposition goal line) and fz (−1 left … +1 right).
import * as THREE from 'three';
import { CONFIG, clamp } from '../config.js';
import { dist2D, pointSegDist2D } from '../core/MathUtil.js';

export const FORMATIONS = {
  '4-3-3': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.36, 0, 'CDM'], [-0.18, -0.4, 'CM'], [-0.18, 0.4, 'CM'], [0.22, -0.72, 'LW'], [0.3, 0, 'ST'], [0.22, 0.72, 'RW']],
  '4-3-3 (2)': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.38, -0.2, 'CDM'], [-0.38, 0.2, 'CDM'], [-0.12, 0, 'CM'], [0.22, -0.72, 'LW'], [0.3, 0, 'ST'], [0.22, 0.72, 'RW']],
  '4-3-3 Attack': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.24, -0.36, 'CM'], [-0.24, 0.36, 'CM'], [0.04, 0, 'CAM'], [0.22, -0.72, 'LW'], [0.3, 0, 'ST'], [0.22, 0.72, 'RW']],
  '4-3-3 False 9': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.3, -0.36, 'CM'], [-0.36, 0, 'CDM'], [-0.3, 0.36, 'CM'], [0.24, -0.64, 'LW'], [0.16, 0, 'CF'], [0.24, 0.64, 'RW']],
  '4-4-2': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.2, -0.72, 'LM'], [-0.26, -0.22, 'CM'], [-0.26, 0.22, 'CM'], [-0.2, 0.72, 'RM'], [0.24, -0.18, 'ST'], [0.24, 0.18, 'ST']],
  '4-4-2 Holding': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.2, -0.72, 'LM'], [-0.38, -0.2, 'CDM'], [-0.38, 0.2, 'CDM'], [-0.2, 0.72, 'RM'], [0.24, -0.18, 'ST'], [0.24, 0.18, 'ST']],
  '4-4-1-1': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.22, -0.72, 'LM'], [-0.28, -0.22, 'CM'], [-0.28, 0.22, 'CM'], [-0.22, 0.72, 'RM'], [0.06, 0, 'CF'], [0.3, 0, 'ST']],
  '4-2-3-1': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.38, -0.2, 'CDM'], [-0.38, 0.2, 'CDM'], [0.02, -0.66, 'LM'], [0.04, 0, 'CAM'], [0.02, 0.66, 'RM'], [0.3, 0, 'ST']],
  '4-2-3-1 Wide': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.38, -0.2, 'CDM'], [-0.38, 0.2, 'CDM'], [0.12, -0.74, 'LW'], [0.04, 0, 'CAM'], [0.12, 0.74, 'RW'], [0.3, 0, 'ST']],
  '4-2-2-2': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.38, -0.22, 'CDM'], [-0.38, 0.22, 'CDM'], [0.02, -0.46, 'CAM'], [0.02, 0.46, 'CAM'], [0.27, -0.16, 'ST'], [0.27, 0.16, 'ST']],
  '4-2-4': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.3, -0.22, 'CM'], [-0.3, 0.22, 'CM'], [0.22, -0.72, 'LW'], [0.28, -0.18, 'ST'], [0.28, 0.18, 'ST'], [0.22, 0.72, 'RW']],
  '4-1-2-1-2': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.38, 0, 'CDM'], [-0.18, -0.42, 'CM'], [-0.18, 0.42, 'CM'], [0.02, 0, 'CAM'], [0.27, -0.16, 'ST'], [0.27, 0.16, 'ST']],
  '4-1-2-1-2 Wide': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.38, 0, 'CDM'], [-0.16, -0.66, 'LM'], [-0.16, 0.66, 'RM'], [0.02, 0, 'CAM'], [0.27, -0.16, 'ST'], [0.27, 0.16, 'ST']],
  '4-1-4-1': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.4, 0, 'CDM'], [-0.12, -0.7, 'LM'], [-0.16, -0.24, 'CM'], [-0.16, 0.24, 'CM'], [-0.12, 0.7, 'RM'], [0.3, 0, 'ST']],
  '4-5-1': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.18, -0.72, 'LM'], [-0.26, -0.3, 'CM'], [-0.04, 0, 'CAM'], [-0.26, 0.3, 'CM'], [-0.18, 0.72, 'RM'], [0.3, 0, 'ST']],
  '4-3-2-1': [[-0.94, 0, 'GK'], [-0.6, -0.72, 'LB'], [-0.68, -0.24, 'CB'], [-0.68, 0.24, 'CB'], [-0.6, 0.72, 'RB'], [-0.3, -0.36, 'CM'], [-0.36, 0, 'CM'], [-0.3, 0.36, 'CM'], [0.1, -0.34, 'CF'], [0.1, 0.34, 'CF'], [0.32, 0, 'ST']],
  '3-4-3': [[-0.94, 0, 'GK'], [-0.68, -0.4, 'CB'], [-0.7, 0, 'CB'], [-0.68, 0.4, 'CB'], [-0.24, -0.76, 'LM'], [-0.3, -0.22, 'CM'], [-0.3, 0.22, 'CM'], [-0.24, 0.76, 'RM'], [0.22, -0.6, 'LW'], [0.3, 0, 'ST'], [0.22, 0.6, 'RW']],
  '3-4-1-2': [[-0.94, 0, 'GK'], [-0.68, -0.4, 'CB'], [-0.7, 0, 'CB'], [-0.68, 0.4, 'CB'], [-0.24, -0.76, 'LM'], [-0.3, -0.22, 'CM'], [-0.3, 0.22, 'CM'], [-0.24, 0.76, 'RM'], [0.02, 0, 'CAM'], [0.27, -0.16, 'ST'], [0.27, 0.16, 'ST']],
  '3-4-2-1': [[-0.94, 0, 'GK'], [-0.68, -0.4, 'CB'], [-0.7, 0, 'CB'], [-0.68, 0.4, 'CB'], [-0.24, -0.76, 'LM'], [-0.3, -0.22, 'CM'], [-0.3, 0.22, 'CM'], [-0.24, 0.76, 'RM'], [0.08, -0.32, 'CF'], [0.08, 0.32, 'CF'], [0.32, 0, 'ST']],
  '3-5-2': [[-0.94, 0, 'GK'], [-0.68, -0.4, 'CB'], [-0.7, 0, 'CB'], [-0.68, 0.4, 'CB'], [-0.3, -0.8, 'LM'], [-0.36, 0, 'CDM'], [-0.16, -0.3, 'CM'], [-0.16, 0.3, 'CM'], [-0.3, 0.8, 'RM'], [0.26, -0.18, 'ST'], [0.26, 0.18, 'ST']],
  '3-1-4-2': [[-0.94, 0, 'GK'], [-0.68, -0.4, 'CB'], [-0.7, 0, 'CB'], [-0.68, 0.4, 'CB'], [-0.42, 0, 'CDM'], [-0.18, -0.76, 'LM'], [-0.2, -0.24, 'CM'], [-0.2, 0.24, 'CM'], [-0.18, 0.76, 'RM'], [0.26, -0.18, 'ST'], [0.26, 0.18, 'ST']],
  '5-3-2': [[-0.94, 0, 'GK'], [-0.55, -0.8, 'LWB'], [-0.68, -0.36, 'CB'], [-0.7, 0, 'CB'], [-0.68, 0.36, 'CB'], [-0.55, 0.8, 'RWB'], [-0.3, -0.36, 'CM'], [-0.36, 0, 'CDM'], [-0.3, 0.36, 'CM'], [0.24, -0.18, 'ST'], [0.24, 0.18, 'ST']],
  '5-2-1-2': [[-0.94, 0, 'GK'], [-0.55, -0.8, 'LWB'], [-0.68, -0.36, 'CB'], [-0.7, 0, 'CB'], [-0.68, 0.36, 'CB'], [-0.55, 0.8, 'RWB'], [-0.34, -0.24, 'CM'], [-0.34, 0.24, 'CM'], [-0.04, 0, 'CAM'], [0.25, -0.18, 'ST'], [0.25, 0.18, 'ST']],
  '5-4-1': [[-0.94, 0, 'GK'], [-0.55, -0.8, 'LWB'], [-0.68, -0.36, 'CB'], [-0.7, 0, 'CB'], [-0.68, 0.36, 'CB'], [-0.55, 0.8, 'RWB'], [-0.24, -0.66, 'LM'], [-0.3, -0.22, 'CM'], [-0.3, 0.22, 'CM'], [-0.24, 0.66, 'RM'], [0.3, 0, 'ST']],
  '5-2-3': [[-0.94, 0, 'GK'], [-0.55, -0.8, 'LWB'], [-0.68, -0.36, 'CB'], [-0.7, 0, 'CB'], [-0.68, 0.36, 'CB'], [-0.55, 0.8, 'RWB'], [-0.34, -0.24, 'CM'], [-0.34, 0.24, 'CM'], [0.2, -0.56, 'LW'], [0.3, 0, 'ST'], [0.2, 0.56, 'RW']],
};
const DEF = new Set(['LB', 'CB', 'RB', 'LWB', 'RWB']);
const FWD = new Set(['ST', 'CF', 'LW', 'RW', 'LF', 'RF']);
const WIDE = new Set(['LW', 'RW', 'LM', 'RM']);

const _fp = new THREE.Vector3();
const _lead = new THREE.Vector3();

export class TeamAI {
  constructor(game, team) {
    this.game = game;
    this.team = team;
    this.s = team === 'home' ? 1 : -1;
    this.assignT = 0;
    this.presser = null;
    this.pressHeld = false;     // home: the user is holding "PRESS" (teammate press)
    this.phase = 'defend';
  }

  get HL() { return CONFIG.pitch.length / 2; }
  get HW() { return CONFIG.pitch.width / 2; }

  /** Outfield players this AI controls (the user's player is never one of them). */
  members() {
    const g = this.game;
    const list = (this.team === 'home' ? g.teammates : g.defenders).filter((p) => p.visible && !p.sentOff);
    if (this.team === 'home' && g.autoplay) list.push(g.user);   // test / demo: the AI plays your man too
    return list;
  }
  all() { return this.team === 'home' ? this.game.homePlayers() : this.game.awayPlayers(); }
  opponents() { return this.team === 'home' ? this.game.awayPlayers() : this.game.homePlayers(); }
  ownGoal() { return { x: -this.s * this.HL, z: 0 }; }
  oppGoal() { return { x: this.s * this.HL, z: 0 }; }
  /** World → team frame (fx forward). */
  fx(x) { return (this.s * x) / this.HL; }
  wx(fx) { return (this.s * fx) * this.HL; }

  reset() {
    this.assignT = 0; this.presser = null;
    for (const m of this.members()) { m.ai.state = 'shape'; m.ai.mark = null; m.ai.tackling = null; m.ai.decideAt = null; m.ai.holdT = 0; }
  }

  // ------------------------------------------------------------ phase
  _phase() {
    const ball = this.game.ball;
    if (ball.owner) return ball.owner.team === this.team ? 'attack' : 'defend';
    if (ball.pass && ball.pass.from) return ball.pass.from.team === this.team ? 'attack' : 'defend';
    const lt = ball.lastTouch;
    return lt && lt.team === this.team ? 'attack' : 'defend';
  }

  // ------------------------------------------------------------ shape
  /** Formation position (world) for a player right now. */
  shapePos(m, out = new THREE.Vector3()) {
    const g = this.game, ball = g.ball;
    const slot = m.slot || { fx: -0.2, fz: 0, pos: 'CM' };
    const bfx = clamp(this.fx(ball.pos.x), -1, 1), bfz = clamp(ball.pos.z / this.HW, -1, 1);
    let fx, fz;
    if (this.phase === 'attack') {
      // push up behind the ball, stretch the pitch
      fx = slot.fx * 0.8 + 0.42 * bfx + 0.14;
      fz = slot.fz * 1.0 + bfz * 0.12;
      if (DEF.has(slot.pos)) fx = Math.min(fx, bfx - 0.08, 0.18);
    } else {
      // compact block between the ball and our goal, shifted to the ball side
      fx = slot.fx * 0.62 + 0.4 * bfx - 0.16;
      fz = slot.fz * 0.62 + bfz * 0.32;
      if (DEF.has(slot.pos)) fx = Math.min(fx, bfx - 0.05);
      fx = Math.max(fx, -0.86);
    }
    fx = clamp(fx, -0.9, 0.88);
    fz = clamp(fz, -0.93, 0.93);
    out.set(this.wx(fx), 0, this.s * fz * this.HW);
    // attackers stay onside
    if (this.phase === 'attack') {
      const line = g.offsideLine(this.team) - this.s * 0.8;
      if (this.s * out.x > this.s * line) out.x = line;
    }
    return out;
  }

  // ------------------------------------------------------------ assignments
  assign() {
    const g = this.game, ball = g.ball, D = CONFIG.defender;
    const mem = this.members().filter((d) => !d.ai.tackling);
    for (const d of mem) { d.ai.state = 'shape'; d.ai.mark = null; d.ai.point = null; d.ai.run = null; }
    let free = mem.slice();
    const take = (d) => { free = free.filter((x) => x !== d); };
    const user = this.team === 'home' && !g.autoplay ? g.user : null;
    const userD = (p) => (user ? dist2D(user.pos, p) : Infinity);

    // a pass from the other team in flight → can someone cut it out?
    if (ball.pass && !ball.owner && ball.pass.from && ball.pass.from.team !== this.team) {
      const best = this._interceptor(free);
      if (best) { best.d.ai.state = 'intercept'; best.d.ai.point = best.pt; take(best.d); }
    }
    // loose ball → nearest chases (unless you're on it)
    if (!ball.owner && !ball.pass && !ball.frozen) {
      let best = null, bd = Infinity;
      for (const d of free) { const dd = dist2D(d.pos, ball.pos); if (dd < bd && d.stumble <= 0) { bd = dd; best = d; } }
      if (best && bd < 30 && bd < userD(ball.pos) - 3) { best.ai.state = 'chase'; take(best); }
    }

    if (this.phase === 'defend') {
      const carrier = ball.owner && ball.owner.team !== this.team ? ball.owner : (ball.pass && ball.pass.to && ball.pass.to.team !== this.team ? ball.pass.to : null);
      if (carrier && !carrier.isKeeper) {
        // presser: the nearest — for your team only when you're not the one closing him down
        let best = null, bd = Infinity;
        for (const d of free) {
          let dd = dist2D(d.pos, carrier.pos);
          if (d === this.presser) dd -= 1.5;
          if (d.stumble > 0) dd += 6;
          if (dd < bd) { bd = dd; best = d; }
        }
        const userClose = userD(carrier.pos) < bd + 3;
        if (best && (!user || this.pressHeld || !userClose)) {
          best.ai.state = ball.owner === carrier ? 'press' : 'mark'; best.ai.mark = carrier; take(best); this.presser = best;
        } else this.presser = null;
        // cover when he's near our goal
        const G = this.ownGoal();
        if (Math.hypot(G.x - carrier.pos.x, carrier.pos.z) < D.coverWhenClose + 8 && free.length > 3) {
          let cb = null, cd = Infinity;
          for (const d of free) { const dd = dist2D(d.pos, carrier.pos); if (dd < cd) { cd = dd; cb = d; } }
          if (cb) { cb.ai.state = 'cover'; cb.ai.mark = carrier; take(cb); }
        }
      }
      // mark dangerous attackers in our half, closest to goal first
      const G = this.ownGoal();
      const threats = this.opponents().filter((a) => !a.isKeeper && a !== carrier && this.fx(a.pos.x) < 0.15)
        .sort((a, b) => Math.hypot(a.pos.x - G.x, a.pos.z) - Math.hypot(b.pos.x - G.x, b.pos.z));
      for (const a of threats) {
        if (!free.length) break;
        let best = null, bd = Infinity;
        for (const d of free) {
          if (!DEF.has(d.slot?.pos) && !(d.slot && d.slot.pos.includes('D')) && this.fx(a.pos.x) < -0.5) { /* midfielders still help in the box */ }
          const dd = dist2D(d.pos, a.pos);
          if (dd < bd) { bd = dd; best = d; }
        }
        if (best && bd < 15) { best.ai.state = 'mark'; best.ai.mark = a; take(best); }
      }
    } else {
      // attacking: runs in behind for forwards, support for the two nearest
      const carrier = ball.owner && ball.owner.team === this.team ? ball.owner : null;
      if (carrier) {
        const byDist = free.slice().sort((a, b) => dist2D(a.pos, carrier.pos) - dist2D(b.pos, carrier.pos));
        let supports = 0;
        for (const m of byDist) {
          const pos = m.slot?.pos || 'CM';
          if (FWD.has(pos) && this.fx(carrier.pos.x) > -0.55 && g.rng.next() < 0.75) { m.ai.state = 'run'; take(m); continue; }
          if (supports < 2 && dist2D(m.pos, carrier.pos) < 26) { m.ai.state = 'support'; supports++; take(m); continue; }
          // full-backs overlap down their wing in the final third
          if ((pos === 'LB' || pos === 'RB') && this.fx(carrier.pos.x) > 0.25 && Math.sign(carrier.pos.z) === Math.sign(this.s * m.slot.fz) && g.rng.next() < 0.6) {
            m.ai.state = 'overlap'; take(m);
          }
        }
      }
    }
  }

  _interceptor(cands) {
    const ball = this.game.ball;
    const v = ball.vel, sp = Math.hypot(v.x, v.z) || 0.1;
    const recv = ball.pass.to;
    let end = { x: ball.pos.x + v.x * 1.6, z: ball.pos.z + v.z * 1.6 };
    if (recv) {
      const along = ((recv.pos.x - ball.pos.x) * v.x + (recv.pos.z - ball.pos.z) * v.z) / sp;
      const reach = Math.max(0, along - 1.2);
      end = { x: ball.pos.x + (v.x / sp) * reach, z: ball.pos.z + (v.z / sp) * reach };
    }
    let best = null, bestMargin = Infinity;
    for (const d of cands) {
      if (d.stumble > 0) continue;
      const { d: dd, t } = pointSegDist2D(d.pos, ball.pos, end);
      const px = ball.pos.x + (end.x - ball.pos.x) * t, pz = ball.pos.z + (end.z - ball.pos.z) * t;
      const tb = Math.hypot(px - ball.pos.x, pz - ball.pos.z) / sp;
      const td = d.attrs.reaction + Math.max(0, dd - CONFIG.defender.interceptReach) / d.attrs.sprintSpeed;
      const margin = td - tb;
      if (margin < 0 && margin < bestMargin) { bestMargin = margin; best = { d, pt: { x: px, z: pz } }; }
    }
    return best;
  }

  // ------------------------------------------------------------ update
  update(dt) {
    const g = this.game, ball = g.ball;
    const ph = this._phase();
    if (ph !== this.phase) { this.phase = ph; this.assignT = 0; }
    this.assignT -= dt;
    if (this.assignT <= 0) { this.assign(); this.assignT = 0.3 + g.rng.next() * 0.1; }
    const carrier = ball.owner;
    for (const m of this.members()) {
      m.sprinting = false;
      m.signal = false;
      if (carrier !== m) m.wantDir = null;
      if (m.ai.tackling) { this._tackleUpdate(m, dt); continue; }
      if (m.stumble > 0) { m.aiLabel = 'recover'; m.steer(m.vel.x, m.vel.z, 1); continue; }
      if (carrier === m) { this._onBall(m, dt); continue; }
      if (ball.pass && ball.pass.to === m && !ball.owner) { this.receive(m); continue; }
      m.aiLabel = m.ai.state;
      switch (m.ai.state) {
        case 'press': this._press(m, m.ai.mark, dt); break;
        case 'cover': this._cover(m, m.ai.mark); break;
        case 'mark': this._mark(m, m.ai.mark); break;
        case 'intercept':
          if (!ball.pass) { m.ai.state = 'shape'; this._shape(m); break; }
          m.sprinting = true;
          m.moveTo(m.ai.point.x, m.ai.point.z, m.attrs.sprintSpeed, 0.4);
          break;
        case 'chase':
          m.sprinting = true;
          m.moveTo(ball.pos.x + ball.vel.x * 0.25, ball.pos.z + ball.vel.z * 0.25, m.attrs.sprintSpeed, 0.3);
          break;
        case 'run': this._run(m, carrier); break;
        case 'support': this._support(m, carrier, dt); break;
        case 'overlap': this._overlap(m); break;
        default: this._shape(m);
      }
      if (carrier && carrier.team !== this.team && !carrier.isKeeper) this._poke(m, carrier, dt);
    }
  }

  _shape(m) {
    const ball = this.game.ball;
    const t = this.shapePos(m, m.ai._t || (m.ai._t = new THREE.Vector3()));
    const d = dist2D(m.pos, t);
    m.sprinting = d > 12;
    m.moveTo(t.x, t.z, d > 12 ? m.attrs.sprintSpeed : d > 4 ? m.runSpeed : m.jogSpeed, 2.5);
    if (d < 3) m.faceTowards(ball.pos.x, ball.pos.z);
  }

  // ------------------------------------------------------------ attacking off the ball
  _run(m, carrier) {
    const g = this.game, ball = g.ball;
    if (!carrier) { this._shape(m); return; }
    const line = g.offsideLine(this.team);
    const W = this.HW;
    const base = this.shapePos(m, m.ai._t || (m.ai._t = new THREE.Vector3()));
    // on the shoulder of the last defender, in the gap nearest his lane
    let x = line - this.s * 0.7;
    if (this.s * x > this.s * this.wx(0.85)) x = this.wx(0.85);
    let bestZ = base.z, bestS = -Infinity;
    for (let k = -3; k <= 3; k++) {
      const cand = clamp(base.z + k * 2.5, -W + 5, W - 5);
      let near = 99;
      for (const d of this.opponents()) near = Math.min(near, Math.hypot(d.pos.x - x, d.pos.z - cand));
      const s = Math.min(near, 6) - Math.abs(cand - base.z) * 0.12;
      if (s > bestS) { bestS = s; bestZ = cand; }
    }
    const d = Math.hypot(x - m.pos.x, bestZ - m.pos.z);
    m.sprinting = d > 6;
    m.moveTo(x, bestZ, d > 6 ? m.attrs.sprintSpeed : m.runSpeed, 1.5);
    m.ai.role = 'runner';
    if (carrier.team === 'home' && carrier.isUser) m.signal = this._open(m) > 3;
  }

  _support(m, carrier, dt) {
    const g = this.game;
    if (!carrier) { this._shape(m); return; }
    const ai = m.ai;
    ai.role = 'support';
    if (!ai.sup) ai.sup = new THREE.Vector3(m.pos.x, 0, m.pos.z);
    ai.supT = (ai.supT || 0) - dt;
    if (ai.supT <= 0) {
      ai.supT = 0.6 + g.rng.next() * 0.3;
      const W = this.HW, line = g.offsideLine(this.team);
      const cx = carrier.pos.x, cz = carrier.pos.z;
      let best = null, bestS = -Infinity;
      const R = 9 + g.rng.next() * 7;
      for (let i = 0; i < 10; i++) {
        const a = -2.5 + (5 * i) / 9;
        const px = cx + this.s * Math.cos(a) * R, pz = cz + Math.sin(a) * R;
        if (Math.abs(pz) > W - 2 || this.s * px > this.s * line - 0.8 || Math.abs(px) > this.HL - 2) continue;
        let open = 99;
        for (const d of this.opponents()) open = Math.min(open, Math.hypot(d.pos.x - px, d.pos.z - pz));
        let spacing = 99;
        for (const o of this.all()) if (o !== m) spacing = Math.min(spacing, Math.hypot(o.pos.x - px, o.pos.z - pz));
        const lane = g.passing.laneClearance(carrier.pos, { x: px, z: pz }, this.team).clear;
        const s = Math.min(open, 6) + Math.min(lane, 4) * 0.8 + Math.min(spacing, 8) * 0.35 + this.s * (px - cx) * 0.03;
        if (s > bestS) { bestS = s; best = { x: px, z: pz }; }
      }
      if (best) ai.sup.set(best.x, 0, best.z);
    }
    const d = dist2D(m.pos, ai.sup);
    m.sprinting = d > 9;
    m.moveTo(ai.sup.x, ai.sup.z, d > 9 ? m.attrs.sprintSpeed : d > 4 ? m.runSpeed : m.jogSpeed * 1.2, 2);
    if (d < 2.5) m.faceTowards(carrier.pos.x, carrier.pos.z);
    if (carrier.isUser) m.signal = this._open(m) > 3.5 && d < 3;
  }

  _overlap(m) {
    const g = this.game, ball = g.ball;
    const side = Math.sign(m.slot.fz * this.s) || 1;
    const x = clamp(ball.pos.x + this.s * 10, -this.HL + 6, this.HL - 6);
    const line = g.offsideLine(this.team);
    const tx = this.s > 0 ? Math.min(x, line - 1) : Math.max(x, line + 1);
    m.sprinting = true;
    m.moveTo(tx, side * (this.HW - 3), m.attrs.sprintSpeed, 2);
  }

  _open(m) {
    let n = 99;
    for (const o of this.opponents()) if (!o.isKeeper) n = Math.min(n, dist2D(o.pos, m.pos));
    return n;
  }

  /** Go and meet a pass (ground: on its line; through ball / cross: onto the spot). */
  receive(m) {
    const ball = this.game.ball;
    m.aiLabel = 'receive';
    if (ball.pass && ball.pass.kind && ball.pass.kind !== 'ground' && ball.pass.aim) {
      const a = ball.pass.aim;
      m.sprinting = true;
      const nearAim = Math.hypot(ball.pos.x - a.x, ball.pos.z - a.z) < 6;
      const slow = Math.hypot(ball.vel.x, ball.vel.z) < 7;
      const chase = ball.pass.kind === 'through' ? (nearAim || slow) : (nearAim && ball.pos.y < 0.9);
      if (chase) m.moveTo(ball.pos.x + ball.vel.x * 0.3, ball.pos.z + ball.vel.z * 0.3, m.attrs.sprintSpeed, 0.2);
      else m.moveTo(a.x, a.z, m.attrs.sprintSpeed, 0.4);
      m.faceTowards(ball.pos.x, ball.pos.z);
      return;
    }
    const v = ball.vel, sp = Math.hypot(v.x, v.z) || 1;
    const ux = v.x / sp, uz = v.z / sp;
    const along = (m.pos.x - ball.pos.x) * ux + (m.pos.z - ball.pos.z) * uz;
    const t = Math.max(0, m.ai.role === 'runner' ? along : along - CONFIG.pass.meetDistance);
    const tx = ball.pos.x + ux * t, tz = ball.pos.z + uz * t;
    const d = Math.hypot(tx - m.pos.x, tz - m.pos.z);
    m.sprinting = d > 3;
    m.moveTo(tx, tz, d > 3 ? m.attrs.sprintSpeed : m.runSpeed, 0.6);
    m.faceTowards(ball.pos.x, ball.pos.z);
  }

  // ------------------------------------------------------------ defending
  _press(d, c, dt) {
    if (!c) { this._shape(d); return; }
    const D = CONFIG.defender, G = this.ownGoal(), g = this.game;
    const gx = G.x - c.pos.x, gz = G.z - c.pos.z;
    const gl = Math.hypot(gx, gz) || 1;
    const tx = c.pos.x + (gx / gl) * D.pressDistance + c.vel.x * 0.25;
    const tz = c.pos.z + (gz / gl) * D.pressDistance + c.vel.z * 0.25;
    const dist = dist2D(d.pos, c.pos);
    if (dist > D.jockeyDistance + 1) {
      d.sprinting = true;
      d.moveTo(tx, tz, d.attrs.sprintSpeed, 1);
    } else {
      d.moveTo(tx, tz, Math.max(c.speed * 1.08 + 1.2, d.jogSpeed), 0.8);
      d.faceTowards(c.pos.x, c.pos.z);
      d.jockey = true;
    }
    const ball = g.ball;
    // your teammates mostly contain; the opposition (and teammates you've told to press) go in
    const eager = D.tackleEagerness * (0.6 + d.rating / 100) * (this.team === 'home' && !this.pressHeld ? 0.45 : 1);
    if (ball.owner === c && dist < D.tackleRange && d.tackleCooldown <= 0 && g.rng.next() < eager * dt) this.startTackle(d, c);
  }

  _cover(d, c) {
    if (!c) { this._shape(d); return; }
    const G = this.ownGoal();
    d.moveTo(c.pos.x + (G.x - c.pos.x) * 0.35, c.pos.z + (G.z - c.pos.z) * 0.35, d.runSpeed, 1.2);
    d.faceTowards(c.pos.x, c.pos.z);
  }

  _mark(d, a) {
    if (!a) { this._shape(d); return; }
    const D = CONFIG.defender, G = this.ownGoal(), ball = this.game.ball;
    const gx = G.x - a.pos.x, gz = G.z - a.pos.z;
    const gl = Math.hypot(gx, gz) || 1;
    const tx = a.pos.x + (gx / gl) * D.markDistance + (ball.pos.x - a.pos.x) * 0.08;
    const tz = a.pos.z + (gz / gl) * D.markDistance + (ball.pos.z - a.pos.z) * 0.12;
    const far = Math.hypot(tx - d.pos.x, tz - d.pos.z) > 5;
    d.sprinting = far;
    d.moveTo(tx, tz, far ? d.attrs.sprintSpeed : d.runSpeed, 1.2);
    d.faceTowards(ball.pos.x, ball.pos.z);
  }

  /** Lunging tackle (AI or the user's TACKLE button). */
  startTackle(d, c, slide = null) {
    const g = this.game;
    const sl = slide == null ? g.rng.chance(0.5) : !!slide;
    d.ai.tackling = { t: 0, target: c, resolved: false, slide: sl };
    d.playAction('tackle', sl ? 0.95 : 0.55, { variant: sl ? 'slide' : 'stand' });
    d.tackleCooldown = CONFIG.defender.tackleCooldown * (d.isUser ? 0.55 : 1);
  }

  /** Steps a tackle in progress; returns true when it's over. */
  tackleStep(d, dt) {
    const g = this.game, ball = g.ball, D = CONFIG.defender;
    const tk = d.ai.tackling;
    if (!tk) return true;
    tk.t += dt;
    d.aiLabel = 'tackle';
    if (!d.isUser) d.moveTo(ball.pos.x, ball.pos.z, d.attrs.sprintSpeed * 1.05, 0.1);
    if (!tk.resolved && tk.t >= D.tackleWindup + (tk.slide ? 0.12 : 0)) {
      tk.resolved = true;
      const c = tk.target;
      const dBall = dist2D(d.pos, ball.pos);
      const bodyFirst = dist2D(d.pos, c.pos) < dBall - D.foulBodyMargin;
      const reach = D.tackleRange + 0.3 + (d.isUser ? 0.8 : 0) + (tk.slide ? 1.3 : 0);
      if (ball.owner !== c || dBall > reach || ball.pos.y > 0.5) {
        this._fail(d, c, false);
      } else if (g.rng.next() < (bodyFirst ? D.foulFromBehind : D.foulMistimed) * (d.isUser ? 0.8 : 1)) {
        c.hit(c.pos.x - d.pos.x, c.pos.z - d.pos.z, 2.5 + d.speed * 0.5);
        c.playAction('fall', 1.0, { side: g.rng.sign() });
        c.stumble = 0.4;
        g.audio.kick(0.3);
        g.events.emit('foul', { by: d, victim: c });
      } else {
        c.footPoint(_fp);
        const gap = Math.hypot(ball.pos.x - _fp.x, ball.pos.z - _fp.z);
        let p = CONFIG.teamMap.tackleSkill(d.rating) - c.attrs.tackleResist;
        p += clamp(gap - 0.45, 0, 1) * 0.5;
        if (c.sprinting) p += 0.08;
        if (d.isUser) p += 0.35;                 // your timing is the skill
        p = clamp(p * (d.isUser ? 0.85 : D.tackleSuccessMult), 0.05, d.isUser ? 0.8 : 0.6);
        if (g.rng.next() < p) this._win(d, c); else this._fail(d, c, true);
      }
    }
    if (tk.t >= (tk.slide ? 0.9 : 0.55)) { d.ai.tackling = null; return true; }
    return false;
  }

  _tackleUpdate(d, dt) { this.tackleStep(d, dt); }

  _win(d, c) {
    const g = this.game, ball = g.ball;
    c.stumble = 0.5;
    c.hit(c.pos.x - d.pos.x, c.pos.z - d.pos.z, 1.5 + d.speed * 0.4);
    c.playAction(g.rng.chance(0.4) ? 'fall' : 'stumble', g.rng.chance(0.4) ? 1.1 : 0.6, { side: g.rng.sign() });
    g.audio.kick(0.35);
    if (g.rng.chance(0.6)) {
      ball.lastKick = { type: 'tackle', by: d, time: g.simTime };
      g.possession.gain(d);
    } else {
      const dx = ball.pos.x - c.pos.x, dz = ball.pos.z - c.pos.z;
      const l = Math.hypot(dx, dz) || 1;
      const sp = g.rng.range(4, 8);
      ball.kick((dx / l) * sp + g.rng.range(-2, 2), 0, (dz / l) * sp + g.rng.range(-2, 2), { type: 'tackle', by: d, ignoreTime: 0.25, time: g.simTime });
      ball.ignore.set(c, 0.45);
    }
    g.events.emit('tackleWon', { by: d, victim: c });
  }

  _fail(d, c, close) {
    const g = this.game;
    d.stumble = CONFIG.defender.stumbleTime * (close ? 1 : 0.7) * (d.isUser ? 0.6 : 1);
    d.hit(d.vel.x || c.pos.x - d.pos.x, d.vel.z || c.pos.z - d.pos.z, 1 + d.speed * 0.4);
    d.playAction(close ? 'fall' : 'stumble', close ? 1.1 : 0.7, { side: g.rng.sign() });
    if (close) g.events.emit('beatDefender', { by: c, defender: d });
  }

  _poke(d, c, dt) {
    if (d.ai.tackling || d.stumble > 0) return;
    const g = this.game, ball = g.ball, D = CONFIG.defender;
    c.footPoint(_fp);
    const gap = Math.hypot(ball.pos.x - _fp.x, ball.pos.z - _fp.z);
    if (gap < D.pokeDistance) return;
    if (dist2D(d.pos, ball.pos) > 1.0 || !ball.canTouch(d)) return;
    if (g.rng.next() < D.pokeChance * dt * (0.5 + d.rating / 100)) {
      if (g.rng.chance(0.5)) { ball.lastKick = { type: 'tackle', by: d, time: g.simTime }; g.possession.gain(d); }
      else {
        const dx = ball.pos.x - d.pos.x, dz = ball.pos.z - d.pos.z, l = Math.hypot(dx, dz) || 1;
        ball.kick((dx / l) * 5, 0, (dz / l) * 5, { type: 'tackle', by: d, ignoreTime: 0.3, time: g.simTime });
      }
      d.playAction('pass', 0.35);
      g.events.emit('tackleWon', { by: d, victim: c, poke: true });
    }
  }

  // ------------------------------------------------------------ on the ball
  _onBall(m, dt) {
    const g = this.game, ball = g.ball, ai = m.ai;
    m.aiLabel = 'on ball';
    ai.holdT = (ai.holdT || 0) + dt;
    if (ai.decideAt == null) ai.decideAt = CONFIG.teamMap.decisionTime(m.rating) * g.rng.range(0.7, 1.2);
    const G = this.oppGoal();
    // carry it at goal, away from the nearest opponent
    let dx = G.x - m.pos.x, dz = -m.pos.z * 0.45;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    let near = null, nd = 99;
    for (const o of this.opponents()) { if (o.isKeeper) continue; const dd = dist2D(o.pos, m.pos); if (dd < nd) { nd = dd; near = o; } }
    if (near && nd < 5) {
      const ax = m.pos.x - near.pos.x, az = m.pos.z - near.pos.z, al = Math.hypot(ax, az) || 1;
      dx += (ax / al) * (5 - nd) * 0.35; dz += (az / al) * (5 - nd) * 0.35;
    }
    // stay in the pitch
    if (Math.abs(m.pos.z) > this.HW - 3) dz -= Math.sign(m.pos.z) * 0.8;
    if (!ai.carry) ai.carry = { x: dx, z: dz };
    const k = Math.min(1, dt * 2.5);
    ai.carry.x += (dx - ai.carry.x) * k; ai.carry.z += (dz - ai.carry.z) * k;
    // touches go where he wants to take it; if the ball's run away from his feet he bends his run back onto it
    const cl = Math.hypot(ai.carry.x, ai.carry.z) || 1;
    m.wantDir = { x: ai.carry.x / cl, z: ai.carry.z / cl };
    let sx = m.wantDir.x, sz = m.wantDir.z;
    const bd = dist2D(m.pos, ball.pos);
    const px = ball.pos.x + ball.vel.x * 0.25 - m.pos.x, pz = ball.pos.z + ball.vel.z * 0.25 - m.pos.z, pd = Math.hypot(px, pz);
    const w = Math.max(0, Math.min(0.9, (bd - 0.85) / 1.1));
    if (w > 0 && pd > 0.01) { sx = sx * (1 - w) + (px / pd) * w; sz = sz * (1 - w) + (pz / pd) * w; }
    m.steer(sx, sz, nd < 3 ? m.jogSpeed * 0.85 : m.runSpeed * 0.8);
    if (ai.holdT < ai.decideAt || g.passing.pending || g.shooting.strike) return;
    ai.decideAt = ai.holdT + 0.3;

    // ---- score every option, take the best
    const pressured = nd < 2.2;
    const fxNow = this.fx(m.pos.x);
    const dGoal = Math.hypot(G.x - m.pos.x, m.pos.z);
    let best = { v: -Infinity, act: null };
    const consider = (v, act) => { if (v > best.v) best = { v, act }; };
    // shoot
    if (g.shooting.aiCanShoot(m)) {
      const lane = g.passing.laneClearance(m.pos, G, this.team).clear;
      let v = dGoal < 10 ? 2.6 : dGoal < 16 ? 1.8 : dGoal < 21 ? 1.1 * (m.stats.shotPower / 80) : 0.55 * (m.stats.shotPower / 85);
      if (lane < 0.9) v -= 0.8;
      v += (m.stats.finishing - 70) / 60;
      consider(v + g.rng.range(-0.15, 0.15), () => g.shooting.aiShoot(m));
    }
    // carry it: worth it while there's grass in front of him
    let ahead = 99;
    for (const o of this.opponents()) {
      if (o.isKeeper) continue;
      const fx2 = this.s * (o.pos.x - m.pos.x), lat = Math.abs(o.pos.z - m.pos.z);
      if (fx2 > -1 && lat < fx2 * 0.9 + 2) ahead = Math.min(ahead, Math.hypot(o.pos.x - m.pos.x, o.pos.z - m.pos.z));
    }
    consider((ahead > 9 ? 0.95 : ahead > 5 ? 0.45 : -0.4) + (pressured ? -0.8 : 0) - Math.max(0, ai.holdT - 2) * 0.4 + (m.stats.dribbling - 70) / 80, null);
    // pass / through ball / cross
    for (const t of this.all()) {
      if (t === m || t.isKeeper || !t.visible || t.sentOff) continue;
      const d = dist2D(t.pos, m.pos);
      if (d < 4 || d > 45) continue;
      const through = t.ai.role === 'runner' && this.s * (t.pos.x - m.pos.x) > 3;
      const aim = through ? g.passing.throughPoint(m, t, _lead) : g.passing.leadPoint(m, t, _lead);
      const clear = g.passing.laneClearance(m.pos, aim, this.team).clear;
      const prog = this.s * (aim.x - m.pos.x);
      const open = Math.min(this._open(t), 6);
      let v = prog / 14 + open * 0.08 - (clear < 1 ? 1.6 : clear < 2.2 ? 0.55 : 0) - d / 90;
      if (through) v += 0.25 + m.stats.vision / 400;
      const inBox = this.fx(t.pos.x) > 0.68 && Math.abs(t.pos.z) < 12;
      const cross = fxNow > 0.55 && Math.abs(m.pos.z) > 12 && inBox;
      if (cross) v += 0.7;
      if (pressured) v += 0.5;
      v -= ((100 - m.stats.passing) / 100) * (d / 40);
      consider(v + g.rng.range(-0.12, 0.12), () => g.passing.requestAIPass(m, t, cross ? 'lofted' : through ? 'through' : d > 30 ? 'lofted' : 'ground'));
    }
    if (g.debugDecisions) g.debugDecisions.push({ id: m.id, fx: +fxNow.toFixed(2), dGoal: +dGoal.toFixed(1), can: g.shooting.aiCanShoot(m), best: +best.v.toFixed(2), act: best.act ? best.act.toString().slice(6, 40) : 'carry', ahead: +ahead.toFixed(1) });
    if (best.act) { best.act(); ai.holdT = 0; ai.decideAt = null; }
  }
}
