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

    this.timer = el('div', 'timer', `
      <svg viewBox="0 0 44 44"><circle class="t-bg" cx="22" cy="22" r="19"/><circle class="t-fg" cx="22" cy="22" r="19"/></svg>
      <span class="t-num">20</span>`);
    top.appendChild(this.timer);
    this.timerRing = this.timer.querySelector('.t-fg');
    this.timerNum = this.timer.querySelector('.t-num');
    this.ringLen = 2 * Math.PI * 19;
    this.timerRing.style.strokeDasharray = `${this.ringLen}`;

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
    this.btnShoot = el('button', 'act shoot', '<span>SHOOT</span>');
    this.btnPass = el('button', 'act pass', '<span>PASS</span>');
    this.btnSprint = el('button', 'act sprint', '<span>SPRINT</span>');
    pad.append(this.btnShoot, this.btnPass, this.btnSprint);
    r.appendChild(pad);
    this.pad = pad;
    this.input.bindButton(this.btnShoot, 'shoot');
    this.input.bindButton(this.btnPass, 'pass');
    this.input.bindButton(this.btnSprint, 'sprint');

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

    // ---- result card
    this.result = el('div', 'result', `
      <div class="r-card">
        <div class="r-kicker"></div>
        <div class="r-title"></div>
        <div class="r-rating"><span class="r-delta"></span><span class="r-label">moment rating</span></div>
        <ul class="r-items"></ul>
        <div class="r-match"></div>
        <div class="r-btns"><button class="r-retry">Retry</button><button class="r-next">Next Moment</button></div>
      </div>`);
    r.appendChild(this.result);
    this._tap(this.result.querySelector('.r-next'), () => this.h.next());
    this._tap(this.result.querySelector('.r-retry'), () => this.h.retry());

    // ---- pause overlay
    this.pauseEl = el('div', 'overlay pause', `
      <div class="o-card"><div class="o-title">PAUSED</div>
      <button class="o-btn resume">Resume</button></div>`);
    r.appendChild(this.pauseEl);
    this._tap(this.pauseEl.querySelector('.resume'), () => this.h.resume());

    // ---- start overlay
    this.startEl = el('div', 'overlay start', `
      <div class="o-card start-card">
        <div class="logo"><span>BREAK</span><b>AWAY</b></div>
        <div class="o-sub">Career Prototype · Attacking Moments</div>
        <div class="loading">Loading pitch…</div>
        <button class="o-btn go" disabled>Tap to Kick Off</button>
        <div class="o-help">
          <div><b>Left thumb</b> move · <b>PASS</b> · hold <b>SPRINT</b></div>
          <div><b>SHOOT</b> freezes time — pull back &amp; release</div>
          <div class="desk">Desktop: WASD · Space pass · Shift sprint · F shoot · mouse drag</div>
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
    const mm = game.moments;
    const m = mm.current;
    const match = mm.match;
    const set = (key, val, fn) => { if (this.last[key] !== val) { this.last[key] = val; fn(val); } };
    set('h', match.homeGoals, (v) => { this.scoreboard.querySelector('.sb-h').textContent = v; });
    set('a', match.awayGoals, (v) => { this.scoreboard.querySelector('.sb-a').textContent = v; });
    set('min', match.minute, (v) => { this.scoreboard.querySelector('.sb-min').textContent = `${v}'`; });
    if (m) {
      const left = Math.max(0, m.timer);
      const frac = left / CONFIG.moment.duration;
      set('tn', Math.ceil(left), (v) => {
        this.timerNum.textContent = v;
        this.timer.classList.toggle('low', v <= 5);
      });
      set('tf', Math.round(frac * 200), () => {
        this.timerRing.style.strokeDashoffset = `${this.ringLen * (1 - frac)}`;
      });
    }
    const statsTxt = `<span><em>MOMENT</em>${mm.momentNo}</span><span><em>GOALS</em>${match.goals}/${match.shots}</span><span><em>RTG</em>${mm.matchRating.toFixed(1)}</span>`;
    set('stats', statsTxt, (v) => { this.statsEl.innerHTML = v; });
    const st = Math.round(game.user.stamina * 100);
    set('stam', st, (v) => {
      this.btnSprint.style.setProperty('--stam', `${v}%`);
      this.btnSprint.classList.toggle('tired', v < CONFIG.statMap.lowStaminaThreshold * 100);
    });
  }

  setShootAvailable(on) {
    if (this.last.shoot === on) return;
    this.last.shoot = on;
    this.btnShoot.classList.toggle('ready', on);
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

  showBig(text, kind) {
    const b = this.big;
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

  showResult(res, match, matchRating) {
    const c = this.result;
    c.querySelector('.r-kicker').textContent = `Moment ${res.number} · ${res.minute}'`;
    const t = c.querySelector('.r-title');
    t.textContent = res.title;
    t.className = `r-title ${res.kind}`;
    const d = c.querySelector('.r-delta');
    d.textContent = `${res.rating >= 0 ? '+' : ''}${res.rating.toFixed(2)}`;
    d.className = `r-delta ${res.rating > 0.001 ? 'pos' : res.rating < -0.001 ? 'neg' : ''}`;
    const items = res.items.length ? res.items : [{ label: 'No rating events', value: 0 }];
    c.querySelector('.r-items').innerHTML = items.map((it) =>
      `<li><span>${it.label}</span><b class="${it.value > 0 ? 'pos' : it.value < 0 ? 'neg' : ''}">${it.value >= 0 ? '+' : ''}${it.value.toFixed(2)}</b></li>`).join('');
    c.querySelector('.r-match').innerHTML =
      `Match rating <b>${matchRating.toFixed(1)}</b> · Goals ${match.goals} · Shots ${match.shots}`;
    c.classList.add('show');
  }

  hideResult() { this.result.classList.remove('show'); }

  setPaused(on) { this.pauseEl.classList.toggle('show', on); }

  updateRotateHint() {
    const portrait = window.innerHeight > window.innerWidth;
    const touch = matchMedia('(pointer: coarse)').matches;
    this.rotateEl.classList.toggle('show', portrait && touch && !this.rotateDismissed);
  }
}
