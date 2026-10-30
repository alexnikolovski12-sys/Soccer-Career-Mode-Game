// Career hub UI: Home (date, next fixture, SIM / TRAINING / PLAY MATCH, task
// list, avatar + Customise), Messages, Club, Country, Shop tabs; the new
// career flow (name → 3 starting offers → nationality) and all the pop-ups
// (training report, social posts, match report, season review).
import { world, club, league, nation, NATIONS, kitSVG, crestSVG, countryOf, CUSTOM, BRAND_CATS } from './data.js';
import { Career, fmtDate, fmtMoney, overallOf, STAT_KEYS, SHOP, AGENT_TIERS } from './Career.js';
import { HUB_CSS } from './hubStyles.js';
import { ICON, flag } from './icons.js';
import { AvatarView } from './AvatarView.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtNum = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);
const STAT_LABEL = { pace: 'PAC', acceleration: 'ACC', dribbling: 'DRI', ballControl: 'CTL', passing: 'PAS', vision: 'VIS', finishing: 'FIN', shotPower: 'POW', composure: 'COM', stamina: 'STA' };
const FROM = {
  coach: { name: 'Head Coach', icon: ICON.clipboard }, agent: { name: 'Your Agent', icon: ICON.briefcase }, sponsor: { name: 'Sponsorship', icon: ICON.deal },
  club: { name: 'Club', icon: ICON.shield }, country: { name: 'National Team', icon: ICON.globe },
};

export class Hub {
  constructor(root, game) {
    this.game = game;
    this.career = new Career();
    this.tab = 'home';
    this.busy = false;
    if (!document.getElementById('hub-css')) {
      const st = document.createElement('style'); st.id = 'hub-css'; st.textContent = HUB_CSS; document.head.appendChild(st);
    }
    this.el = h('div', 'hub');
    root.appendChild(this.el);
    this.career.onChange(() => { if (this.isOpen && !this.busy) this.render(); });
  }

  get isOpen() { return this.el.classList.contains('show'); }
  open() {
    this.el.classList.add('show');
    if (!this.career.s && !this.career.load()) this.newCareer();
    else this.render();
  }
  close() { this.el.classList.remove('show'); }

  // ------------------------------------------------------------ new career
  newCareer() {
    const el = this.el;
    el.innerHTML = '';
    const wrap = h('div', 'hub-setup hub-scroll');
    wrap.innerHTML = `
      <div class="hub-brand">BREAKAWAY <b>CAREER</b></div>
      <h1>Create your player</h1>
      <label class="hub-field">Player name<input class="nm" maxlength="18" placeholder="e.g. Alex Vance" value=""></label>
      <button class="hub-btn primary go">Continue</button>`;
    el.appendChild(wrap);
    const go = () => {
      const name = wrap.querySelector('.nm').value.trim() || 'A. Vance';
      this._pickOffer(name);
    };
    wrap.querySelector('.go').onclick = go;
    wrap.querySelector('.nm').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  }

  _pickOffer(name) {
    const offers = this.career.startingOffers();
    const el = this.el;
    el.innerHTML = '';
    const wrap = h('div', 'hub-setup hub-scroll');
    wrap.innerHTML = `<div class="hub-brand">BREAKAWAY <b>CAREER</b></div>
      <h1>Three clubs want to sign you</h1><p class="hub-sub">Pick where your career starts. All three play in an L3 league.</p>
      <div class="offer-row">${offers.map((o, i) => this._offerCard(o, i)).join('')}</div>`;
    el.appendChild(wrap);
    wrap.querySelectorAll('.offer').forEach((b) => { b.onclick = () => this._pickNation(name, offers[+b.dataset.i]); });
  }

  _offerCard(o, i, extra = '') {
    const c = club(o.clubId), L = league(c.league), co = countryOf(c.country);
    return `<button class="offer" data-i="${i}">
      <div class="of-top">${crestSVG(c, 44)}${kitSVG(c.kit, 44)}</div>
      <div class="of-name">${esc(c.name)}</div>
      <div class="of-lg">${flag(c.country, 18)} ${esc(L.name)}</div>
      <div class="of-meta"><span>Club rating <b>${c.rating}</b></span><span>Wage <b>${fmtMoney(o.wage)}/wk</b></span></div>${extra}
    </button>`;
  }

  _pickNation(name, offer) {
    const el = this.el;
    el.innerHTML = '';
    const wrap = h('div', 'hub-setup hub-scroll');
    wrap.innerHTML = `<div class="hub-brand">BREAKAWAY <b>CAREER</b></div>
      <h1>Choose your nationality</h1><p class="hub-sub">Big football nations are harder to get called up for.</p>
      <div class="nation-grid">${NATIONS.map((n) => `<button class="nat" data-id="${n.id}">${flag(n.id, 30)}${esc(n.name)}</button>`).join('')}</div>`;
    el.appendChild(wrap);
    wrap.querySelectorAll('.nat').forEach((b) => {
      b.onclick = () => {
        this.career.create({ name, nationality: b.dataset.id, clubId: offer.clubId, wage: offer.wage });
        this.tab = 'home';
        this.render();
      };
    });
  }

  // ------------------------------------------------------------ main render
  render() {
    const C = this.career, s = C.s;
    if (!s) return;
    const c = club(s.clubId);
    const unread = C.unread();
    this.el.innerHTML = '';
    const top = h('div', 'hub-top');
    top.innerHTML = `
      <div class="hub-logo">B</div>
      <div class="hub-tabs">
        ${['home', 'messages', 'club', 'country', 'shop'].map((t) => `<button class="tab ${this.tab === t ? 'on' : ''}" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}${t === 'messages' && unread ? `<i>${unread}</i>` : ''}</button>`).join('')}
      </div>
      <div class="hub-club">${crestSVG(c, 26)}<div><b>${esc(c.name)}</b><span>${fmtMoney(s.money)} · ${fmtNum(s.followers)} followers</span></div></div>`;
    this.el.appendChild(top);
    top.querySelectorAll('.tab').forEach((b) => { b.onclick = () => { this.tab = b.dataset.t; this.render(); }; });
    const body = h('div', `hub-body tab-${this.tab}`);
    this.el.appendChild(body);
    this[`_tab_${this.tab}`](body);
  }

  // ------------------------------------------------------------ HOME
  _tab_home(body) {
    const C = this.career, s = C.s, c = club(s.clubId), S = s.season;
    const ev = C.eventToday();
    const fx = C.nextFixture();
    const left = h('div', 'home-left hub-scroll');
    const d = fmtDate(s.date).toUpperCase();
    const label = s.seasonOver ? 'Season complete' : fx ? `Matchday ${fx.md + 1} of ${S.rounds.length}` : '';
    let fixtureHTML = '';
    if (fx && !s.seasonOver) {
      const H = club(fx.homeId), A = club(fx.awayId);
      const pos = (id) => C.table().findIndex((r) => r.id === id) + 1;
      const ord = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;
      const when = fx.date === s.date ? 'Today' : fmtDate(fx.date);
      fixtureHTML = `<div class="fixture">
        <div class="fx-league">${flag(c.country, 18)} ${esc(league(c.league).name)} <span>${when}</span></div>
        <div class="fx-teams"><div class="fx-crests">${crestSVG(H, 40)}${crestSVG(A, 40)}</div>
          <div class="fx-names"><div>${esc(H.name.toUpperCase())} <em>${S.md ? ord(pos(H.id)) : ''}</em></div><div>${esc(A.name.toUpperCase())} <em>${S.md ? ord(pos(A.id)) : ''}</em></div></div>
        </div></div>`;
    }
    let action = '';
    if (s.seasonOver) action = `<button class="hub-btn primary act-review">Season Review</button>`;
    else if (ev && ev.type === 'match') action = `<button class="hub-btn primary act-play">${ICON.play(16)} Play Match</button><button class="hub-btn act-simmatch">Sim Match</button>`;
    else if (ev && ev.type === 'training') action = `<button class="hub-btn primary act-train">Training Day — Sim</button>`;
    else action = `<button class="hub-btn primary act-sim">Sim ${ICON.ffwd(16)}</button>`;
    left.innerHTML = `<div class="date">${d}</div><div class="md">${label}</div>${fixtureHTML}<div class="actions">${action}</div><div class="tasks"></div>`;
    body.appendChild(left);
    // tasks underneath
    const tasks = left.querySelector('.tasks');
    const items = [];
    const unread = C.unread();
    if (unread) items.push({ icon: ICON.mail(20), t: `${unread} new message${unread > 1 ? 's' : ''}`, go: () => { this.tab = 'messages'; this.render(); } });
    for (const t of s.tasks) items.push({ icon: ICON.phone(20), t: t.title, sub: t.sub, go: () => this._socialPopup(t) });
    const done = S.objectives.filter((o) => C.objectiveDone(o)).length;
    items.push({ icon: ICON.target(20), t: `Club objectives ${done}/${S.objectives.length}`, go: () => { this.tab = 'club'; this.render(); } });
    if (s.country.calledUp) items.push({ icon: flag(s.player.nationality, 22), t: `International: ${s.country.caps} caps`, go: () => { this.tab = 'country'; this.render(); } });
    tasks.innerHTML = items.map((it, i) => `<button class="task" data-i="${i}"><span class="ti">${it.icon}</span><span class="tt">${esc(it.t)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span><span class="tg">${ICON.chevron(16)}</span></button>`).join('');
    tasks.querySelectorAll('.task').forEach((b) => { b.onclick = items[+b.dataset.i].go; });
    // right: avatar
    const right = h('div', 'home-right');
    const P = s.player;
    right.innerHTML = `<div class="avatar-card"><div class="av3d"></div><div class="av-name">${esc(P.name)}</div>
      <div class="av-meta">${flag(P.nationality, 18)} ${P.position} · Age ${P.age} · <b>${overallOf(P.stats)}</b> OVR</div>
      <button class="hub-btn small act-custom">Customise</button></div>`;
    body.appendChild(right);
    // your real 3D player in the club kit
    this.avatar = this.avatar || new AvatarView();
    this.avatar.setPlayer({ kit: c.kit, skin: P.look.skin, hair: P.look.hairColour || P.look.hair, look: P.look });
    requestAnimationFrame(() => this.avatar.attach(right.querySelector('.av3d')));
    const q = (sel) => left.querySelector(sel);
    if (q('.act-sim')) q('.act-sim').onclick = () => this._sim();
    if (q('.act-train')) q('.act-train').onclick = () => this._train();
    if (q('.act-play')) q('.act-play').onclick = () => this._play(fx);
    if (q('.act-simmatch')) q('.act-simmatch').onclick = () => this._simMatch(fx);
    if (q('.act-review')) q('.act-review').onclick = () => this._seasonReview();
    right.querySelector('.act-custom').onclick = () => this._customise();
  }

  _avatar(P, c) {
    const k = c.kit;
    return `<svg class="avatar" viewBox="0 0 120 140">
      <defs><clipPath id="avs"><path d="M20 92 Q24 80 44 76 L60 84 L76 76 Q96 80 100 92 L106 140 L14 140 Z"/></clipPath></defs>
      <g clip-path="url(#avs)"><rect width="120" height="140" fill="${k.primary}"/>${k.pattern === 'stripes' ? [36, 54, 72, 90].map((x) => `<rect x="${x}" y="70" width="9" height="70" fill="${k.secondary}"/>`).join('') : k.pattern === 'hoops' ? [96, 112, 128].map((y) => `<rect x="0" y="${y}" width="120" height="8" fill="${k.secondary}"/>`).join('') : k.pattern === 'halves' ? '<rect x="60" y="70" width="60" height="70" fill="' + k.secondary + '"/>' : k.pattern === 'sash' ? `<polygon points="28,80 42,80 100,140 86,140" fill="${k.secondary}"/>` : `<rect x="0" y="104" width="120" height="8" fill="${k.secondary}"/>`}</g>
      <rect x="51" y="62" width="18" height="18" rx="6" fill="${P.look.skin}"/>
      <ellipse cx="60" cy="44" rx="22" ry="26" fill="${P.look.skin}"/>
      <path d="M37 40 Q38 16 60 16 Q83 16 83 40 Q78 28 60 28 Q44 28 37 40 Z" fill="${P.look.hair}"/>
      <circle cx="51" cy="46" r="2.4" fill="#1b1b1b"/><circle cx="69" cy="46" r="2.4" fill="#1b1b1b"/>
      <path d="M53 57 Q60 61 67 57" stroke="#5a3424" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`;
  }

  // ---- sim day by day, stopping at training / match days
  _sim() {
    if (this.busy) return;
    this.busy = true;
    const C = this.career;
    const step = () => {
      const e = C.advanceDay();
      // quick live update of the date while simming
      const d = this.el.querySelector('.date');
      if (d) d.textContent = fmtDate(C.s.date).toUpperCase();
      if (e) { this.busy = false; this.render(); return; }
      setTimeout(step, 110);
    };
    step();
  }

  _train() {
    const r = this.career.train();
    const gains = Object.entries(r.gains).map(([k, v]) => `<li>${STAT_LABEL[k]} <b>+${v}</b></li>`).join('') || '<li>No attribute gains this time</li>';
    this._popup('Training report', `<div class="grade g${r.grade}">${r.grade}</div><p>Session grade ${r.grade}. Overall now <b>${r.overall}</b>.</p><ul class="gains">${gains}</ul>`,
      [{ label: 'Continue', primary: true, fn: () => this._sim() }]);
  }

  _simMatch(fx) {
    const C = this.career;
    const r = C.simMatch(fx);
    C.recordMatch(fx, r);
    this._matchReport(fx, r);
  }

  _matchReport(fx, r) {
    const H = club(fx.homeId), A = club(fx.awayId);
    const hg = fx.home ? r.gf : r.ga, ag = fx.home ? r.ga : r.gf;
    const res = r.gf > r.ga ? 'WIN' : r.gf < r.ga ? 'LOSS' : 'DRAW';
    this._popup('Full time', `<div class="ft">${crestSVG(H, 40)}<div class="ft-score">${hg} – ${ag}</div>${crestSVG(A, 40)}</div>
      <div class="ft-res ${res.toLowerCase()}">${res}</div>
      <p class="ft-line">${esc(H.name)} vs ${esc(A.name)}</p>
      <div class="ft-stats"><div><b>${r.rating.toFixed(1)}</b><span>Rating</span></div><div><b>${r.goals}</b><span>Goals</span></div><div><b>${r.assists || 0}</b><span>Assists</span></div></div>`,
    [{ label: 'Continue', primary: true }]);
  }

  _play(fx) {
    const C = this.career, s = C.s;
    this.close();
    this.game.startCareerMatch({
      fixture: fx, my: club(s.clubId), opp: club(fx.oppId), player: s.player,
      onFinish: (r) => {
        C.recordMatch(fx, r);
        this.open();
        this._matchReport(fx, r);
      },
    });
  }

  _socialPopup(t) {
    const opts = t.ctx.res === 'win'
      ? [['celebrate', 'Celebrate the win', 'fire'], ['fans', 'Thank the fans', 'heart'], ['hype', 'Hype the next game', 'bolt'], ['none', "Don't post", 'mute']]
      : t.ctx.res === 'loss'
        ? [['fans', 'Thank the travelling fans', 'heart'], ['focus', '"We go again"', 'fist'], ['none', "Don't post", 'mute']]
        : [['fans', 'Thank the fans', 'heart'], ['focus', '"Onto the next one"', 'fist'], ['hype', 'Hype the next game', 'bolt'], ['none', "Don't post", 'mute']];
    this._popup('Social media', `<p><b>${esc(t.title)}</b><br><small>${esc(t.sub)}</small></p><p>What do you post?</p>`,
      opts.map(([k, label, ic]) => ({
        label, icon: ICON[ic](16), fn: () => {
          const g = this.career.socialPost(t.id, k);
          if (k !== 'none') this._toast(`+${fmtNum(g)} followers`);
        },
      })));
  }

  // ------------------------------------------------------------ MESSAGES
  _tab_messages(body) {
    const s = this.career.s;
    const list = h('div', 'msg-list hub-scroll');
    const detail = h('div', 'msg-detail hub-scroll');
    body.appendChild(list); body.appendChild(detail);
    if (!s.messages.length) { list.innerHTML = '<p class="empty">No messages yet.</p>'; return; }
    const show = (m) => {
      m.read = true;
      this.career.save();
      list.querySelectorAll('.msg').forEach((x) => x.classList.toggle('on', +x.dataset.id === m.id));
      list.querySelector(`.msg[data-id="${m.id}"]`)?.classList.remove('unread');
      const f = FROM[m.from] || { name: m.from, icon: ICON.mail };
      detail.innerHTML = `<div class="md-from">${f.icon(16)} ${f.name} · <span>${fmtDate(m.date)}</span></div><h2>${esc(m.subject)}</h2><p>${esc(m.body)}</p>
        ${m.actions && !m.done ? `<div class="md-acts">${m.actions.map((a, i) => `<button class="hub-btn ${i === 0 ? 'primary' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>` : m.choice ? `<p class="md-done">You chose: <b>${esc(m.choice)}</b></p>` : ''}`;
      detail.querySelectorAll('.md-acts button').forEach((b) => { b.onclick = () => { this.career.act(m.id, +b.dataset.i); this.render(); }; });
      this.render.bind(this);
    };
    list.innerHTML = s.messages.map((m) => {
      const f = FROM[m.from] || { name: m.from, icon: ICON.mail };
      return `<button class="msg ${m.read ? '' : 'unread'}" data-id="${m.id}"><span class="mi">${f.icon(20)}</span><span class="mt"><b>${esc(m.subject)}</b><small>${f.name}</small></span></button>`;
    }).join('');
    list.querySelectorAll('.msg').forEach((b) => { b.onclick = () => show(s.messages.find((m) => m.id === +b.dataset.id)); });
    show(s.messages[0]);
  }

  // ------------------------------------------------------------ CLUB
  _tab_club(body) {
    const C = this.career, s = C.s, c = club(s.clubId), S = s.season, L = league(c.league);
    const left = h('div', 'club-left hub-scroll');
    left.innerHTML = `<div class="club-card">${crestSVG(c, 54)}${kitSVG(c.kit, 54)}<div><h2>${esc(c.name)}</h2><span>${flag(c.country, 18)} ${esc(L.name)} · ${C.position()}${['th', 'st', 'nd', 'rd'][C.position()] || 'th'} place</span></div></div>
      <div class="club-row"><div><b>${fmtMoney(s.wage)}</b><span>Wage / week</span></div><div><b>${S.apps}</b><span>Apps</span></div><div><b>${S.goals}</b><span>Goals</span></div><div><b>${C._avg().toFixed(1)}</b><span>Avg rating</span></div></div>
      <h3>Season objectives <small>complete them all to be offered a new deal</small></h3>
      ${S.objectives.map((o) => {
        const p = C.objectiveProgress(o), done = C.objectiveDone(o);
        const pct = Math.min(100, (p / o.target) * 100);
        return `<div class="obj ${done ? 'done' : ''}"><div class="ob-t"><span class="obl">${done ? ICON.check(18) : ICON.box(18)} ${esc(o.label)}</span><span>${o.id === 'avg' ? p.toFixed(1) : p}/${o.target}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
      }).join('')}`;
    const right = h('div', 'club-right hub-scroll');
    const T = C.table();
    right.innerHTML = `<h3>${esc(L.name)} table</h3><table class="tbl"><tr><th>#</th><th>Club</th><th>P</th><th>GD</th><th>Pts</th></tr>
      ${T.map((r, i) => `<tr class="${r.id === s.clubId ? 'me' : ''}"><td>${i + 1}</td><td>${esc(club(r.id).name)}</td><td>${r.p}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td><b>${r.pts}</b></td></tr>`).join('')}</table>`;
    body.appendChild(left); body.appendChild(right);
  }

  // ------------------------------------------------------------ COUNTRY
  _tab_country(body) {
    const C = this.career, s = C.s, n = nation(s.player.nationality);
    const objs = C.nationObjectives();
    const wrap = h('div', 'country hub-scroll');
    wrap.innerHTML = `<div class="nat-head"><span class="bigflag">${flag(n.id, 54)}</span><div><h2>${esc(n.name)}</h2>
      <span class="${s.country.calledUp ? 'ok' : 'no'}">${s.country.calledUp ? 'In the squad' : 'Not called up yet'}</span></div>
      <div class="caps"><b>${s.country.caps}</b><span>Caps</span></div><div class="caps"><b>${s.country.goals}</b><span>Goals</span></div></div>
      <h3>${s.country.calledUp ? 'Stay in the squad' : 'Earn a call-up'} <small>${s.country.calledUp ? 'easy — just keep playing well' : 'checked at every international break'}</small></h3>
      ${objs.map((o) => `<div class="obj ${o.ok ? 'done' : ''}"><div class="ob-t"><span class="obl">${o.ok ? ICON.check(18) : ICON.box(18)} ${esc(o.label)}</span><span>${o.value}</span></div></div>`).join('')}`;
    body.appendChild(wrap);
  }

  // ------------------------------------------------------------ SHOP
  _tab_shop(body) {
    const C = this.career, s = C.s;
    const wrap = h('div', 'shop hub-scroll');
    const next = AGENT_TIERS[s.agentTier + 1];
    const items = SHOP.map((it) => {
      let title = it.title, desc = it.desc, cost = it.cost, owned = false;
      if (it.kind === 'agent') {
        title = next ? `Upgrade to ${next.name}` : `${AGENT_TIERS[s.agentTier].name} (max)`;
        desc = `Current: ${AGENT_TIERS[s.agentTier].name}. ${it.desc}`;
        cost = next ? next.cost : 0; owned = !next;
      }
      if (it.kind === 'once' && s[it.flag]) owned = true;
      const can = !owned && s.money >= cost;
      return `<div class="shop-item"><div><b>${esc(title)}</b><small>${esc(desc)}</small></div>
        <button class="hub-btn ${can ? 'primary' : ''}" data-id="${it.id}" ${owned || !can ? 'disabled' : ''}>${owned ? 'Owned' : fmtMoney(cost)}</button></div>`;
    }).join('');
    const inv = s.investments.map((v, i) => `<div class="shop-item"><div><b>${esc(v.title)}</b><small>Worth ${fmtMoney(v.value)}${v.risk ? ' · pays out at season end' : ''}</small></div>
      ${v.risk ? '' : `<button class="hub-btn" data-cash="${i}">Cash out</button>`}</div>`).join('');
    const sp = (s.sponsors || []).filter((x) => x.weeks > 0).map((x) => `<div class="shop-item"><div><b>${ICON.deal(16)} ${esc(x.brand)}</b><small>${esc(BRAND_CATS[x.cat] || 'Sponsor')} · ${fmtMoney(x.weekly)}/wk · ${x.weeks} weeks left</small></div></div>`).join('');
    wrap.innerHTML = `<div class="bank"><div><b>${fmtMoney(s.money)}</b><span>Bank</span></div><div><b>${fmtMoney(s.wage)}</b><span>Wage / week</span></div><div><b>${fmtNum(s.followers)}</b><span>Followers</span></div></div>
      <h3>Shop</h3>${items}${inv ? `<h3>Your investments</h3>${inv}` : ''}${sp ? `<h3>Sponsorships</h3>${sp}` : ''}`;
    body.appendChild(wrap);
    wrap.querySelectorAll('[data-id]').forEach((b) => {
      b.onclick = () => { if (C.buy(SHOP.find((x) => x.id === b.dataset.id))) this._toast('Purchased!'); this.render(); };
    });
    wrap.querySelectorAll('[data-cash]').forEach((b) => { b.onclick = () => { C.cashOut(+b.dataset.cash); this.render(); }; });
  }

  // ------------------------------------------------------------ CUSTOMISE
  _customise() {
    const C = this.career, s = C.s, c = club(s.clubId);
    const L = s.player.look;
    const panel = h('div', 'custom');
    this.el.appendChild(panel);
    const draw = () => {
      const look = { ...L, hairColour: L.hairColour || L.hair };
      const unlocked = C.bootsUnlocked();
      const chip = (key, val, label) => `<button class="chip ${look[key] === val ? 'on' : ''}" data-k="${key}" data-v="${val}">${esc(label)}</button>`;
      const sw = (key, val, locked) => `<button class="sw ${look[key] === val ? 'on' : ''} ${locked ? 'locked' : ''}" data-k="${key}" data-v="${val}" ${locked ? 'disabled' : ''} style="background:${val}"></button>`;
      panel.innerHTML = `<div class="cu-head"><b>Customise</b><button class="hub-btn small cu-done">Done</button></div>
        <div class="cu-body"><div class="cu-view"></div><div class="cu-opts hub-scroll">
          <h4>Hair</h4><div class="chips">${CUSTOM.hairStyles.map(([v, l]) => chip('hairStyle', v, l)).join('')}</div>
          <h4>Hair colour</h4><div class="sws">${CUSTOM.hairColours.map((v) => sw('hairColour', v)).join('')}</div>
          <h4>Face</h4><div class="chips">${CUSTOM.facial.map(([v, l]) => chip('facial', v, l)).join('')}</div>
          <h4>Skin</h4><div class="sws">${CUSTOM.skins.map((v) => sw('skin', v)).join('')}</div>
          <h4>Sleeves</h4><div class="chips">${CUSTOM.sleeves.map(([v, l]) => chip('sleeves', v, l)).join('')}</div>
          <h4>Boots ${unlocked ? '' : `<small>${ICON.box(14)} Get a boots sponsor to unlock colours</small>`}</h4>
          <div class="sws">${CUSTOM.boots.map((v) => sw('boots', v, !unlocked && v !== CUSTOM.bootsDefault)).join('')}</div>
          <h4>Shirt number <small>your teammates take the other numbers</small></h4>
          <div class="num"><button class="hub-btn small" data-n="-1">−</button><b>${look.number ?? 9}</b><button class="hub-btn small" data-n="1">+</button></div>
        </div></div>`;
      // live 3D preview
      this.avatar = this.avatar || new AvatarView();
      this.avatar.setPlayer({ kit: c.kit, skin: look.skin, hair: look.hairColour, look });
      requestAnimationFrame(() => this.avatar.attach(panel.querySelector('.cu-view')));
      panel.querySelectorAll('[data-k]').forEach((b) => {
        b.onclick = () => { if (b.disabled) return; C.customise({ [b.dataset.k]: b.dataset.v, ...(b.dataset.k === 'hairColour' ? { hair: b.dataset.v } : {}) }); draw(); };
      });
      panel.querySelectorAll('[data-n]').forEach((b) => {
        b.onclick = () => { let n = (look.number ?? 9) + +b.dataset.n; if (n < 1) n = 99; if (n > 99) n = 1; C.customise({ number: n }); draw(); };
      });
      panel.querySelector('.cu-done').onclick = () => { this.busy = false; panel.remove(); this.render(); };
    };
    this.busy = true; // don't let the background re-render while customising
    draw();
  }

  // ------------------------------------------------------------ season review
  _seasonReview() {
    const C = this.career, s = C.s, c = club(s.clubId);
    const done = C.allObjectivesDone();
    const offers = s.offersPending || [];
    const objs = s.season.objectives.map((o) => `<li class="${C.objectiveDone(o) ? 'ok' : 'no'}">${C.objectiveDone(o) ? ICON.check(18) : ICON.cross(18)} ${esc(o.label)}</li>`).join('');
    const html = `<p>${esc(c.name)} finished <b>${C.position()}${['th', 'st', 'nd', 'rd'][C.position()] || 'th'}</b>. You played ${s.season.apps}, scored ${s.season.goals}, average ${C._avg().toFixed(2)}.</p>
      <ul class="rev">${objs}</ul>
      <p>${done ? 'You hit every objective — the club want to keep you.' : "You didn't hit every objective, so the club won't renew. Your agent found you these options:"}</p>
      <div class="offer-row small">${done ? `<button class="offer stay"><div class="of-top">${crestSVG(c, 36)}${kitSVG(c.kit, 36)}</div><div class="of-name">Stay at ${esc(c.name)}</div><div class="of-meta"><span>New deal <b>${fmtMoney(Math.round(s.wage * 1.25 / 100) * 100)}/wk</b></span></div></button>` : ''}
      ${offers.map((o, i) => this._offerCard(o, i)).join('')}</div>`;
    const p = this._popup('Season review', html, []);
    p.querySelector('.stay')?.addEventListener('click', () => { C.chooseNextSeason(null); this._closePopup(); this.render(); });
    p.querySelectorAll('.offer:not(.stay)').forEach((b) => b.addEventListener('click', () => { C.chooseNextSeason(offers[+b.dataset.i]); this._closePopup(); this.render(); }));
  }

  // ------------------------------------------------------------ pop-ups
  _popup(title, html, buttons) {
    this._closePopup();
    const p = h('div', 'hub-pop');
    p.innerHTML = `<div class="pop-card hub-scroll"><h2>${esc(title)}</h2><div class="pop-body">${html}</div><div class="pop-btns">${buttons.map((b, i) => `<button class="hub-btn ${b.primary ? 'primary' : ''}" data-i="${i}">${b.icon || ''}${esc(b.label)}</button>`).join('')}</div></div>`;
    this.el.appendChild(p);
    p.querySelectorAll('.pop-btns button').forEach((x) => {
      x.onclick = () => { this._closePopup(); const b = buttons[+x.dataset.i]; if (b.fn) b.fn(); else this.render(); };
    });
    this.pop = p;
    return p;
  }
  _closePopup() { if (this.pop) { this.pop.remove(); this.pop = null; } }

  _toast(t) {
    const x = h('div', 'hub-toast', esc(t));
    this.el.appendChild(x);
    setTimeout(() => x.remove(), 1800);
  }
}

export { STAT_KEYS };
