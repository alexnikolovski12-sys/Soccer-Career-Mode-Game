// Broadcast-style HUD (original design): scoreboard, timer ring, moment stats,
// thumb buttons, banners, result card, pause/start overlays, rotate hint.
import { CONFIG } from '../config.js';
import { TEAMS } from '../data/playerStats.js';

const ICON = {
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm9 4.6v-2.2l-2.3-.5a7 7 0 0 0-.7-1.7l1.3-2-1.6-1.6-2 1.3a7 7 0 0 0-1.7-.7L13.1 3h-2.2l-.5 2.3a7 7 0 0 0-1.7.7l-2-1.3-1.6 1.6 1.3 2a7 7 0 0 0-.7 1.7L3 10.9v2.2l2.3.5c.15.6.4 1.2.7 1.7l-1.3 2 1.6 1.6 2-1.3c.5.3 1.1.55 1.7.7l.5 2.3h2.2l.5-2.3c.6-.15 1.2-.4 1.7-.7l2 1.3 1.6-1.6-1.3-2c.3-.5.55-1.1.7-1.7z"/></svg>',
};

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

export class HUD {
  constructor(root, input, handlers) {
    this.root = root;
    this.input = input;
    this.h = handlers;
    this._build();
    this.last = {};
  }

  _build() {
    const r = this.root;
    const home = TEAMS.home, away = TEAMS.away;

    // ---- top bar
    const top = el('div', 'hud-top');
    this.scoreboard = el('div', 'scoreboard', `
      <div class="sb-team"><i style="background:${home.kit.accent}"></i><b>${home.short}</b></div>
      <div class="sb-score"><span class="sb-h">0</span><span class="sb-sep">–</span><span class="sb-a">0</span></div>
      <div class="sb-team"><b>${away.short}</b><i style="background:${away.kit.accent}"></i></div>
      <div class="sb-min">0'</div>`);
    top.appendChild(this.scoreboard);


    const right = el('div', 'top-right');
    this.statsEl = el('div', 'mstats', '');
    right.appendChild(this.statsEl);
    const icons = el('div', 'icons');
    this.btnPause = el('button', 'icon-btn', ICON.pause);
    this.btnMute = el('button', 'icon-btn', ICON.sound);
    this.btnGear = el('button', 'icon-btn', ICON.gear);
    this.btnPause.setAttribute('aria-label', 'Pause');
    this.btnMute.setAttribute('aria-label', 'Mute');
    this.btnGear.setAttribute('aria-label', 'Debug');
    icons.append(this.btnPause, this.btnMute, this.btnGear);
    right.appendChild(icons);
    top.appendChild(right);
    r.appendChild(top);
    this._tap(this.btnPause, () => this.h.pause());
    this._tap(this.btnMute, () => this.h.mute());
    this._tap(this.btnGear, () => this.h.debug());

    // ---- action buttons
    const pad = el('div', 'pad');
    // FC-mobile style cluster: THROUGH / SHOOT on top, PASS / SPRINT below.
    const chev = (dirs) => dirs.map((d) => `<i class="chev ${d}"></i>`).join('');
    const btn = (cls, label, dirs, tips = {}) => el('button', `act ${cls}`,
      `<b class="ring"></b><b class="meter"></b>${chev(dirs)}${Object.entries(tips).map(([d, t]) => `<i class="tip ${d}">${t}</i>`).join('')}<span>${label}</span>`);
    this.btnThrough = btn('through', 'THROUGH', ['up', 'down']);
    this.btnShoot = btn('shoot', 'SHOOT', ['up', 'down', 'left', 'right'],
      { up: 'CHIP', down: 'DRIVEN', left: 'FAKE', right: 'FINESSE' });
    this.btnPass = btn('pass', 'PASS', ['up', 'down', 'left', 'right']);
    this.btnSprint = btn('sprint', 'SPRINT', ['up', 'down', 'left', 'right']);
    pad.append(this.btnThrough, this.btnShoot, this.btnPass, this.btnSprint);
    r.appendChild(pad);
    this.pad = pad;
    this.input.bindGesture(this.btnShoot, 'shoot');
    this.input.bindGesture(this.btnPass, 'pass', { quick: 0.09 });
    this.input.bindGesture(this.btnThrough, 'through', { quick: 0.06 });
    this.input.bindButton(this.btnSprint, 'sprint');

    // ---- free kick: choose PASS / SHOOT, then tap to lock the aim line, then the power
    this.fk = el('div', 'fk', `
      <div class="fk-choose"><button class="fk-btn fk-pass">PASS</button><button class="fk-btn fk-shoot">SHOOT</button></div>
      <div class="fk-tap"></div>
      <div class="fk-power"><div class="fk-zone"></div><div class="fk-mark"></div><span>POWER</span></div>
      <div class="fk-hint"></div>`);
    r.appendChild(this.fk);
    const fkTap = (sel, fn) => this.fk.querySelector(sel).addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); this.input.anyInteraction && this.input.anyInteraction(); fn();
    });
    fkTap('.fk-pass', () => this.h.fkAction && this.h.fkAction('pass'));
    fkTap('.fk-shoot', () => this.h.fkAction && this.h.fkAction('shoot'));
    fkTap('.fk-tap', () => this.h.fkAction && this.h.fkAction('tap'));

    // ---- penalty timing circle
    this.pen = el('div', 'pen-meter', '<div class="pm-ring"></div><div class="pm-dot"></div><div class="pm-hint">TAP SHOOT WHEN IT\'S SMALL &amp; GREEN</div>');
    r.appendChild(this.pen);

    // ---- banners
    this.intro = el('div', 'banner intro', `
      <div class="b-kicker"></div><div class="b-title"></div><div class="b-sub"></div>`);
    r.appendChild(this.intro);
    this.flashEl = el('div', 'flash', '');
    r.appendChild(this.flashEl);
    this.big = el('div', 'bigbanner', '');
    r.appendChild(this.big);
    this.replayTag = el('div', 'replay-tag', '<i></i>REPLAY<span>tap to skip</span>');
    r.appendChild(this.replayTag);
    this.letterbox = el('div', 'letterbox', '<div></div><div></div>');
    r.appendChild(this.letterbox);

    // ---- aim UI
    this.aimUI = el('div', 'aim-ui', `
      <div class="aim-hint">Pull back anywhere &amp; release to shoot<br><small>Drag back to the start to cancel · down = loft · sideways = aim</small></div>`);
    this.btnCancel = el('button', 'cancel-btn', 'Cancel');
    this.aimUI.appendChild(this.btnCancel);
    r.appendChild(this.aimUI);
    this._tap(this.btnCancel, () => this.h.cancelShot());
    this.vignette = el('div', 'vignette', '');
    r.appendChild(this.vignette);

    // ---- half time / full time card
    this.result = el('div', 'result', `
      <div class="r-card mcard">
        <div class="r-kicker"></div>
        <div class="mc-score"><div class="mc-team mc-h"></div><div class="mc-num"></div><div class="mc-team mc-a"></div></div>
        <div class="mc-goals"></div>
        <ul class="r-items mc-stats"></ul>
        <div class="r-btns"><button class="r-next">Continue</button></div>
      </div>`);
    r.appendChild(this.result);
    this._tap(this.result.querySelector('.r-next'), () => this.h.next());

    // ---- pause overlay
    this.pauseEl = el('div', 'overlay pause', `
      <div class="o-card"><div class="o-title">PAUSED</div>
      <button class="o-btn resume">Resume</button><button class="o-btn quit">Quit Match</button></div>`);
    r.appendChild(this.pauseEl);
    this._tap(this.pauseEl.querySelector('.resume'), () => this.h.resume());
    this._tap(this.pauseEl.querySelector('.quit'), () => this.h.quit && this.h.quit());

    // ---- start overlay
    this.startEl = el('div', 'overlay start', `
      <div class="o-card start-card">
        <div class="logo"><span>BREAK</span><b>AWAY</b></div>
        <div class="o-sub">Ultimate Team</div>
        <div class="loading">Loading pitch…</div>
        <button class="o-btn go" disabled>Tap to Kick Off</button>
        <div class="o-help">
          <div><b>Left thumb</b> move · <b>PASS</b> · hold <b>SPRINT</b></div>
          <div><b>Defending</b>: PASS switches · SHOOT tackles · hold THROUGH to press</div>
          <div class="desk credits">Crowd audio: Gregor Quendel — Free Crowd Cheering Sounds (CC BY 4.0); stadium recordings CC0 via Freesound.</div>
          <div class="desk">Desktop: WASD move · Shift sprint · Space pass (C = lofted) · T through · hold F shoot (G driven, H chip, J finesse, K fake)</div>
        </div>
      </div>`);
    r.appendChild(this.startEl);

    // ---- rotate hint
    this.rotateEl = el('div', 'rotate-hint', '<span class="phone"></span>Rotate for the best view <button>OK</button>');
    r.appendChild(this.rotateEl);
    this.rotateDismissed = false;
    this._tap(this.rotateEl.querySelector('button'), () => { this.rotateDismissed = true; this.updateRotateHint(); });

    this.setControlsVisible(false);
  }

  _tap(btn, fn) {
    btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
  }

  // ------------------------------------------------------------ start
  ready(onStart) {
    const go = this.startEl.querySelector('.go');
    this.startEl.querySelector('.loading').style.display = 'none';
    go.disabled = false;
    this._tap(go, () => { this.startEl.classList.add('hide'); onStart(); });
  }

  // ------------------------------------------------------------ per-frame
  update(game) {
    const match = game.match;
    const set = (key, val, fn) => { if (this.last[key] !== val) { this.last[key] = val; fn(val); } };
    set('h', match.homeGoals, (v) => { this.scoreboard.querySelector('.sb-h').textContent = v; });
    set('a', match.awayGoals, (v) => { this.scoreboard.querySelector('.sb-a').textContent = v; });
    set('min', match.clockText, (v) => { this.scoreboard.querySelector('.sb-min').textContent = v; });
    const u = game.user;
    const statsTxt = `<span><em>${match.half === 1 ? '1ST' : '2ND'}</em>HALF</span><span><em>YOU</em>${(u && u.name) || ''}</span>`;
    set('stats', statsTxt, (v) => { this.statsEl.innerHTML = v; });
  }

  /** Match HUD (scoreboard etc.) on / off — off on the Ultimate Team screens. */
  setMatchHud(on) {
    this.root.classList.toggle('in-menu', !on);
  }

  /** Defending: the buttons become SWITCH / TACKLE / PRESS. */
  setDefending(def) {
    if (this.last.def === def) return;
    this.last.def = def;
    this.btnShoot.querySelector('span').textContent = def ? 'TACKLE' : 'SHOOT';
    this.btnThrough.querySelector('span').textContent = def ? 'PRESS' : 'THROUGH';
    this.pad.classList.toggle('defending', def);
  }

  /** Half time / full time: score, scorers, stats. */
  showMatchCard(title, m, btn) {
    const c = this.result, res = m.result();
    c.querySelector('.r-kicker').textContent = title;
    c.querySelector('.mc-h').textContent = TEAMS.home.name;
    c.querySelector('.mc-a').textContent = TEAMS.away.name;
    c.querySelector('.mc-num').textContent = `${res.gf} – ${res.ga}`;
    const g = (team) => res.goals.filter((x) => x.team === team).map((x) => `${x.name}${x.own ? ' (og)' : ''} ${x.minute}'`).join(', ');
    c.querySelector('.mc-goals').innerHTML = `<span>${g('home')}</span><span>${g('away')}</span>`;
    const row = (label, a, b) => `<li><b>${a}</b><span>${label}</span><b>${b}</b></li>`;
    c.querySelector('.mc-stats').innerHTML = row('Possession', `${res.possession}%`, `${100 - res.possession}%`) +
      row('Shots', res.shots[0], res.shots[1]) + row('On target', res.onTarget[0], res.onTarget[1]) +
      (title === 'FULL TIME' ? `<li class="mc-rate"><span>Your rating</span><b>${res.rating.toFixed(1)}</b></li>` : '');
    c.querySelector('.r-next').textContent = btn;
    c.classList.add('show');
  }

  setShootAvailable(on) {
    if (this.last.shoot === on) return;
    this.last.shoot = on;
    this.btnShoot.classList.toggle('ready', on);
  }

  /** Shot power ring on the SHOOT button while it's held (0..1). */
  setShotCharge(v) {
    const r = Math.round(v * 100);
    if (this.last.charge === r) return;
    this.last.charge = r;
    this.btnShoot.style.setProperty('--charge', `${r}%`);
    this.btnShoot.classList.toggle('charging', r > 0);
  }

  /** Penalty circle at screen point (x, y): size 0 (small, green) .. 1 (big, red). */
  setPenaltyMeter(on, x = 0, y = 0, size = 1, u = 1) {
    this.pen.classList.toggle('show', on);
    if (!on) return;
    const d = (34 + size * 150) * u;
    const ring = this.pen.firstElementChild, dot = ring.nextElementSibling, hint = dot.nextElementSibling;
    const hue = Math.round((1 - size) * 120); // red → green
    this.pen.style.setProperty('--pm', `hsl(${hue} 95% 55%)`);
    ring.style.cssText = `left:${x}px;top:${y}px;width:${d}px;height:${d}px;`;
    dot.style.cssText = `left:${x}px;top:${y}px;`;
    hint.style.cssText = `left:${x}px;top:${y + 100 * u}px;`;
  }

  /** Lofted-pass power ring on PASS while held (0..1, after the tap threshold). */
  setPassCharge(v) {
    const r = Math.round(v * 100);
    if (this.last.pcharge === r) return;
    this.last.pcharge = r;
    this.btnPass.style.setProperty('--charge', `${r}%`);
    this.btnPass.classList.toggle('charging', r > 0);
  }

  /** Which action buttons show: all | shoot (penalties) | none (free kicks). */
  setButtonMode(mode) {
    if (this.last.bmode === mode) return;
    this.last.bmode = mode;
    this.pad.classList.toggle('mode-shoot', mode === 'shoot');
    this.pad.classList.toggle('mode-none', mode === 'none');
  }

  /** Free kick UI stage: null | choose | aim | power */
  fkStage(stage, hint = '') {
    this.fk.className = `fk ${stage ? 'show ' + stage : ''}`;
    this.fk.querySelector('.fk-hint').textContent = hint;
  }

  fkPower(v, zoneLo, zoneHi) {
    const bar = this.fk.querySelector('.fk-power');
    bar.style.setProperty('--v', `${(v * 100).toFixed(1)}%`);
    bar.style.setProperty('--lo', `${zoneLo * 100}%`);
    bar.style.setProperty('--hi', `${zoneHi * 100}%`);
  }

  /** Scoreboard team names/colours (career matches). */
  setTeams(home, away) {
    const t = this.scoreboard.querySelectorAll('.sb-team');
    t[0].innerHTML = `<i style="background:${home.kit.accent}"></i><b>${home.short}</b>`;
    t[1].innerHTML = `<b>${away.short}</b><i style="background:${away.kit.accent}"></i>`;
  }


  setPassLabel(txt) {
    if (this.last.passLabel === txt) return;
    this.last.passLabel = txt;
    this.btnPass.querySelector('span').textContent = txt;
  }

  setControlsVisible(on) {
    this.pad.classList.toggle('hidden', !on);
  }

  setMuted(m) { this.btnMute.innerHTML = m ? ICON.mute : ICON.sound; }

  // ------------------------------------------------------------ banners
  showIntro(kicker, title, sub) {
    this.intro.querySelector('.b-kicker').textContent = kicker;
    this.intro.querySelector('.b-title').textContent = title;
    this.intro.querySelector('.b-sub').textContent = sub;
    this.intro.classList.remove('show');
    void this.intro.offsetWidth;
    this.intro.classList.add('show');
  }

  hideIntro() { this.intro.classList.remove('show'); }

  flash(text, kind = 'neutral') {
    const f = this.flashEl;
    f.textContent = text;
    f.className = `flash ${kind}`;
    void f.offsetWidth;
    f.classList.add('show');
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => f.classList.remove('show'), 1400);
  }

  showBig(text, kind, hold = 1.2) {
    const b = this.big;
    // big banners clear quickly so they don't sit over the play / celebration
    clearTimeout(this._bigT);
    if (hold > 0) this._bigT = setTimeout(() => this.hideBig(), hold * 1000);
    b.innerHTML = text.split('').map((c, i) => `<span style="animation-delay:${i * 40}ms">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    b.className = `bigbanner ${kind}`;
    void b.offsetWidth;
    b.classList.add('show');
  }

  hideBig() { this.big.classList.remove('show'); }

  setAim(on) {
    this.aimUI.classList.toggle('show', on);
    this.vignette.classList.toggle('show', on);
  }

  setReplay(on) {
    this.replayTag.classList.toggle('show', on);
    this.letterbox.classList.toggle('show', on);
  }

  hideResult() { this.result.classList.remove('show'); }

  setPaused(on) { this.pauseEl.classList.toggle('show', on); }

  updateRotateHint() {
    const portrait = window.innerHeight > window.innerWidth;
    const touch = matchMedia('(pointer: coarse)').matches;
    this.rotateEl.classList.toggle('show', portrait && touch && !this.rotateDismissed);
  }
}
