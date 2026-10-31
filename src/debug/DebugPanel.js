// Toggleable tuning panel (gear icon, 3-finger tap, or the ` key).
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { STAT_KEYS, STAT_LABELS, STAT_PRESETS, TEAMS, statsFromRating } from '../data/playerStats.js';
import { makeRng } from '../core/MathUtil.js';

export class DebugPanel {
  constructor(game, root) {
    this.game = game;
    this.open = false;
    this.showLabels = false;
    this.showLanes = false;
    this.el = document.createElement('div');
    this.el.className = 'debug-panel';
    root.appendChild(this.el);
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'ai-labels';
    root.appendChild(this.labelLayer);
    this.labels = new Map();

    // passing-lane lines
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6 * 12), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(6 * 12), 3));
    this.lanes = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.85 }));
    this.lanes.frustumCulled = false;
    this.lanes.visible = false;
    this.lanes.renderOrder = 15;
    game.scene.add(this.lanes);

    this._build();
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 3) this.toggle();
    }, { passive: true });
    window.addEventListener('keydown', (e) => { if (e.key === '`' || e.key === '~') this.toggle(); });
  }

  toggle(v = !this.open) {
    if (!window.__BREAKAWAY_DEV) return;   // no tuning panel in the game (it could change ratings)
    this.open = v;
    this.el.classList.toggle('show', v);
  }

  _build() {
    const g = this.game;
    const sec = (title) => {
      const s = document.createElement('section');
      s.innerHTML = `<h4>${title}</h4>`;
      this.el.appendChild(s);
      return s;
    };
    const slider = (parent, label, min, max, step, get, set) => {
      const row = document.createElement('label');
      row.className = 'dbg-row';
      const v = get();
      row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${v}"><output>${v}</output>`;
      const inp = row.querySelector('input'), out = row.querySelector('output');
      inp.addEventListener('input', () => {
        const val = parseFloat(inp.value);
        out.textContent = val;
        set(val);
      });
      parent.appendChild(row);
      return { inp, out, refresh: () => { const nv = get(); inp.value = nv; out.textContent = nv; } };
    };
    const button = (parent, label, fn, cls = '') => {
      const b = document.createElement('button');
      b.textContent = label;
      if (cls) b.className = cls;
      b.addEventListener('click', fn);
      parent.appendChild(b);
      return b;
    };

    const head = document.createElement('div');
    head.className = 'dbg-head';
    head.innerHTML = '<b>DEBUG / TUNING</b><span class="dbg-fps"></span>';
    const close = document.createElement('button');
    close.textContent = '✕';
    close.addEventListener('click', () => this.toggle(false));
    head.appendChild(close);
    this.el.appendChild(head);
    this.fpsEl = head.querySelector('.dbg-fps');

    // performance
    const perf = sec('Performance');
    const qrow = document.createElement('div');
    qrow.className = 'dbg-btns';
    button(qrow, 'Auto', () => { g.quality.locked = false; });
    CONFIG.quality.levels.forEach((L, i) => button(qrow, L.name, () => g.quality.set(i, true)));
    perf.appendChild(qrow);

    // match
    const sc = sec('Match');
    const srow = document.createElement('div');
    srow.className = 'dbg-btns';
    button(srow, 'Half time', () => { g.match.clock = 45 * 60; });
    button(srow, 'Score for us', () => { g.match.homeGoals++; });
    sc.appendChild(srow);

    // toggles
    const tg = sec('Overlays');
    const trow = document.createElement('div');
    trow.className = 'dbg-btns';
    const lb = button(trow, 'AI labels: off', () => {
      this.showLabels = !this.showLabels;
      lb.textContent = `AI labels: ${this.showLabels ? 'on' : 'off'}`;
      this.labelLayer.style.display = this.showLabels ? '' : 'none';
    });
    const ln = button(trow, 'Pass lanes: off', () => {
      this.showLanes = !this.showLanes;
      ln.textContent = `Pass lanes: ${this.showLanes ? 'on' : 'off'}`;
      this.lanes.visible = this.showLanes;
    });
    tg.appendChild(trow);
    this.labelLayer.style.display = 'none';

    // player stats
    const ps = sec(`Your player stats (${g.user.name})`);
    const prow = document.createElement('div');
    prow.className = 'dbg-btns';
    const statSliders = [];
    for (const [name, stats] of Object.entries(STAT_PRESETS)) {
      button(prow, name, () => {
        g.user.setStats({ ...stats });
        statSliders.forEach((s) => s.refresh());
      });
    }
    ps.appendChild(prow);
    for (const k of STAT_KEYS) {
      statSliders.push(slider(ps, STAT_LABELS[k], 30, 99, 1, () => g.user.stats[k], (v) => {
        const s = { ...g.user.stats, [k]: v };
        g.user.setStats(s);
      }));
    }

    // team ratings
    const tr = sec('Team ratings');
    slider(tr, 'Teammates', 40, 95, 1, () => TEAMS.home.rating, (v) => {
      TEAMS.home.rating = v;
      const rng = makeRng(7);
      for (const m of g.teammatePool) { m.rating = v; m.setStats(statsFromRating(v, rng)); }
    });
    slider(tr, 'Opponents', 40, 95, 1, () => TEAMS.away.rating, (v) => {
      TEAMS.away.rating = v;
      const rng = makeRng(9);
      for (const d of g.defenderPool) { d.rating = v; d.setStats(statsFromRating(v, rng)); }
    });
    slider(tr, 'Keeper', 40, 95, 1, () => CONFIG.keeper.rating, (v) => { CONFIG.keeper.rating = v; });
    slider(tr, 'Keeper difficulty ×', 0.3, 1.6, 0.05, () => CONFIG.keeper.difficulty, (v) => { CONFIG.keeper.difficulty = v; });

    // gameplay
    const gp = sec('Gameplay');
    slider(gp, 'Moment timer (s)', 8, 45, 1, () => CONFIG.moment.duration, (v) => { CONFIG.moment.duration = v; });
    slider(gp, 'Shot power cap ×', 0.6, 1.4, 0.05, () => CONFIG.shot.powerCap, (v) => { CONFIG.shot.powerCap = v; });
    slider(gp, 'Shot assist', 0, 1, 0.05, () => CONFIG.shot.assist, (v) => { CONFIG.shot.assist = v; });
    slider(gp, 'Shot range (m)', 15, 40, 1, () => CONFIG.shot.rangeMax, (v) => { CONFIG.shot.rangeMax = v; });

    // camera
    const cm = sec('Camera');
    slider(cm, 'Distance ×', 0.5, 2, 0.05, () => CONFIG.camera.distanceMult, (v) => { CONFIG.camera.distanceMult = v; });
    slider(cm, 'Height ×', 0.4, 2, 0.05, () => CONFIG.camera.heightMult, (v) => { CONFIG.camera.heightMult = v; });
  }

  update() {
    const g = this.game;
    if (this.open) {
      this.fpsEl.textContent = `${g.quality.fps.toFixed(0)} fps · ${g.quality.current.name}${g.quality.locked ? ' (locked)' : ''}`;
    }
    if (this.showLabels) this._updateLabels();
    if (this.showLanes) this._updateLanes();
  }

  _updateLabels() {
    const g = this.game;
    const cam = g.camRig.camera;
    const w = window.innerWidth, h = window.innerHeight;
    const v = this._v || (this._v = new THREE.Vector3());
    const seen = new Set();
    for (const p of g.players) {
      seen.add(p);
      let lab = this.labels.get(p);
      if (!lab) {
        lab = document.createElement('div');
        lab.className = `ai-label ${p.team}`;
        this.labelLayer.appendChild(lab);
        this.labels.set(p, lab);
      }
      v.set(p.parts.root.position.x, 2.5, p.parts.root.position.z).project(cam);
      if (v.z > 1) { lab.style.display = 'none'; continue; }
      lab.style.display = '';
      lab.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
      const txt = p.isUser ? 'YOU' : p.isKeeper ? `GK ${g.keeper.state}` : (p.aiLabel || p.ai.state || '');
      if (lab.textContent !== txt) lab.textContent = txt;
    }
    for (const [p, lab] of this.labels) if (!seen.has(p)) lab.style.display = 'none';
  }

  _updateLanes() {
    const g = this.game;
    const pos = this.lanes.geometry.attributes.position;
    const col = this.lanes.geometry.attributes.color;
    const from = g.ball.owner && g.ball.owner.team === 'home' ? g.ball.owner : g.user;
    let i = 0;
    for (const t of g.homePlayers()) {
      if (t === from || i >= 12) continue;
      const lane = g.passing.laneClearance(from.pos, t.pos, 'home').clear;
      const ok = lane > CONFIG.pass.laneClear;
      const c = ok ? [0.2, 1, 0.4] : lane > 1 ? [1, 0.85, 0.2] : [1, 0.25, 0.25];
      pos.setXYZ(i * 2, from.pos.x, 0.08, from.pos.z);
      pos.setXYZ(i * 2 + 1, t.pos.x, 0.08, t.pos.z);
      col.setXYZ(i * 2, ...c); col.setXYZ(i * 2 + 1, ...c);
      i++;
    }
    for (let k = i; k < 12; k++) { pos.setXYZ(k * 2, 0, -10, 0); pos.setXYZ(k * 2 + 1, 0, -10, 0); }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.lanes.geometry.setDrawRange(0, i * 2);
  }
}
