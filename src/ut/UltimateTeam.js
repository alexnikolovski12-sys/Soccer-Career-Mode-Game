// Ultimate Team: your club, cards, squad + chemistry, packs, the transfer
// market, objectives and Squad Battles. Everything is saved on the device.
import { cardDB, card, tierOf, quickSell, marketPrice, chemistry, squadRating, posFit, engineStats, POS_GROUP } from './cards.js';
import { world, club, league, nation, crestSVG, kitSVG, KIT_COLOURS, LEAGUE_COUNTRIES } from './world.js';
import { flag, ICON } from './icons.js';
import { FORMATIONS } from '../ai/TeamAI.js';
import { kitLook, awayKit, keeperKit } from './kits.js';
import { Portraits } from './Portrait.js';
import { makeRng } from '../core/MathUtil.js';
import { UT_CSS } from './utStyles.js';

const SAVE = 'breakaway_ut_v1';

/** A big shiny football (our own art) — gold for the hero, white for PLAY. */
function goldBallSVG(kind = 'gold') {
  const id = 'gb' + Math.random().toString(36).slice(2, 7);
  const [a, b, c, line] = kind === 'white' ? ['#ffffff', '#d9dde3', '#8d949e', '#1b2230'] : ['#fff2b8', '#d9a53a', '#5a3a0a', '#3a2504'];
  // a truncated-icosahedron-ish panel pattern
  const pents = [[100, 100, 26], [100, 38, 18], [158, 82, 18], [136, 152, 18], [64, 152, 18], [42, 82, 18]];
  const pent = (x, y, r, rot = -90) => Array.from({ length: 5 }, (_, i) => { const t = (rot + i * 72) * Math.PI / 180; return `${(x + Math.cos(t) * r).toFixed(1)},${(y + Math.sin(t) * r).toFixed(1)}`; }).join(' ');
  return `<svg viewBox="0 0 200 200" class="gball ${kind}"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs>
    <circle cx="100" cy="100" r="96" fill="url(#${id})"/>
    ${pents.map(([x, y, r], i) => `<polygon points="${pent(x, y, r, i ? -90 + i * 36 : -90)}" fill="${line}" opacity="${kind === 'white' ? 0.9 : 0.55}"/>`).join('')}
    <g stroke="${line}" stroke-width="2" opacity=".45" fill="none"><path d="M100 74 L100 56M125 92 L141 86M115 121 L126 138M85 121 L74 138M75 92 L59 86"/></g>
    <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/></svg>`;
}
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => n.toLocaleString('en-AU');
const coinIcon = '<i class="coin"></i>';
const rnd = () => Math.random();
const pick = (a) => a[Math.floor(rnd() * a.length)];

export const DIFFICULTIES = [
  { id: 'beginner', name: 'Beginner', off: -10, mult: 0.6, pts: 10 },
  { id: 'amateur', name: 'Amateur', off: -6, mult: 0.8, pts: 20 },
  { id: 'semipro', name: 'Semi-Pro', off: -3, mult: 1, pts: 35 },
  { id: 'pro', name: 'Professional', off: 0, mult: 1.25, pts: 55 },
  { id: 'world', name: 'World Class', off: 4, mult: 1.6, pts: 80 },
  { id: 'legend', name: 'Legendary', off: 8, mult: 2.1, pts: 110 },
];

export const PACKS = [
  { id: 'bronze', name: 'Bronze Pack', price: 400, n: 12, tier: 'bronze', rares: 1, desc: '12 bronze players' },
  { id: 'silver', name: 'Silver Pack', price: 2500, n: 12, tier: 'silver', rares: 1, desc: '12 silver players' },
  { id: 'gold', name: 'Gold Pack', price: 5000, n: 12, tier: 'gold', rares: 1, desc: '12 gold players, 1 rare' },
  { id: 'premium', name: 'Premium Gold', price: 7500, n: 12, tier: 'gold', rares: 3, desc: '12 gold players, 3 rares' },
  { id: 'rare', name: 'Rare Players', price: 25000, n: 12, tier: 'gold', rares: 12, desc: '12 rare gold players' },
  { id: 'jumbo', name: 'Jumbo Premium', price: 40000, n: 24, tier: 'gold', rares: 8, desc: '24 gold players, 8 rares' },
  { id: 'ultimate', name: 'Ultimate Pack', price: 100000, n: 30, tier: 'gold', rares: 30, desc: '30 rare gold, one 85+', guarantee: 85 },
];

const OBJECTIVES = [
  { id: 'win1', name: 'First win', desc: 'Win a Squad Battles match', need: 1, key: 'wins', reward: { pack: 'gold' } },
  { id: 'goals10', name: 'Goal machine', desc: 'Score 10 goals', need: 10, key: 'goals', reward: { coins: 5000 } },
  { id: 'win5', name: 'On a run', desc: 'Win 5 matches', need: 5, key: 'wins', reward: { pack: 'premium' } },
  { id: 'clean3', name: 'Shut out', desc: 'Keep 3 clean sheets', need: 3, key: 'clean', reward: { pack: 'premium' } },
  { id: 'pro3', name: 'Step up', desc: 'Win 3 on Professional or harder', need: 3, key: 'proWins', reward: { pack: 'rare' } },
  { id: 'chem33', name: 'Perfect chemistry', desc: 'Play a match with 33 chemistry', need: 1, key: 'chem33', reward: { coins: 10000 } },
  { id: 'world5', name: 'World class', desc: 'Win 5 on World Class or harder', need: 5, key: 'worldWins', reward: { pack: 'jumbo' } },
  { id: 'goals50', name: 'Prolific', desc: 'Score 50 goals', need: 50, key: 'goals', reward: { pack: 'rare' } },
];

const RANKS = [[0, 'Bronze 3'], [150, 'Bronze 2'], [350, 'Bronze 1'], [600, 'Silver 3'], [900, 'Silver 2'], [1300, 'Silver 1'], [1800, 'Gold 3'], [2400, 'Gold 2'], [3100, 'Gold 1'], [4000, 'Elite 3'], [5000, 'Elite 2'], [6200, 'Elite 1']];
const rankOf = (pts) => RANKS.filter((r) => pts >= r[0]).pop()[1];

const KIT_PRESETS = [
  { primary: '#f2f4f8', secondary: '#1d4fd6', pattern: 'plain', shorts: '#0d1f4a', socks: '#f2f4f8' },
  { primary: '#c8283a', secondary: '#f2f4f8', pattern: 'plain', shorts: '#f2f4f8', socks: '#c8283a' },
  { primary: '#1d4fd6', secondary: '#f2f4f8', pattern: 'hoops', shorts: '#f2f4f8', socks: '#1d4fd6' },
  { primary: '#14161c', secondary: '#f2c21b', pattern: 'stripes', shorts: '#14161c', socks: '#f2c21b' },
  { primary: '#1e8a43', secondary: '#f2f4f8', pattern: 'sash', shorts: '#f2f4f8', socks: '#1e8a43' },
  { primary: '#6a2bb8', secondary: '#f2c21b', pattern: 'halves', shorts: '#14161c', socks: '#6a2bb8' },
  { primary: '#f07a12', secondary: '#14161c', pattern: 'pinstripes', shorts: '#14161c', socks: '#f07a12' },
  { primary: '#5fb6f2', secondary: '#0d1f4a', pattern: 'sleeves', shorts: '#0d1f4a', socks: '#5fb6f2' },
];

export class UltimateTeam {
  constructor(root, game) {
    this.game = game;
    const st = document.createElement('style'); st.textContent = UT_CSS; document.head.appendChild(st);
    this.el = h('div', 'ut');
    root.appendChild(this.el);
    this.portraits = new Portraits();
    this.tab = 'home';
    this.load();
  }

  // ------------------------------------------------------------ save
  load() {
    try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s && s.v === 1) this.s = s; } catch (_) { /* fresh */ }
    return !!this.s;
  }
  save() { try { localStorage.setItem(SAVE, JSON.stringify(this.s)); } catch (_) { /* full / private */ } }

  open() { this.el.classList.add('show'); if (!this.s) this._setup(); else this.render(); }
  close() { this.el.classList.remove('show'); }

  // ------------------------------------------------------------ owned cards
  own(uid) { return this.s.owned.find((o) => o.uid === uid); }
  cardOf(uid) { const o = this.own(uid); return o ? card(o.cid) : null; }
  addCard(cid) { const uid = this.s.nextUid++; this.s.owned.push({ uid, cid }); return uid; }
  removeCard(uid) {
    this.s.owned = this.s.owned.filter((o) => o.uid !== uid);
    const q = this.s.squad;
    q.xi = q.xi.map((u) => (u === uid ? null : u));
    q.bench = q.bench.filter((u) => u !== uid);
  }
  inSquad(uid) { return this.s.squad.xi.includes(uid) || this.s.squad.bench.includes(uid); }
  slots() { return (FORMATIONS[this.s.squad.formation] || FORMATIONS['4-3-3']).map((f) => f[2]); }
  xiCards() { return this.s.squad.xi.map((u) => (u == null ? null : this.cardOf(u))); }
  chem() { return chemistry(this.xiCards(), this.slots()); }
  rating() { return squadRating(this.xiCards()); }

  // ------------------------------------------------------------ pack generation
  _rollPack(p) {
    const db = cardDB().list;
    const pool = db.filter((c) => tierOf(c) === p.tier);
    const out = [];
    for (let i = 0; i < p.n; i++) {
      const wantRare = i < p.rares;
      let c;
      for (let k = 0; k < 40; k++) {
        c = pick(pool);
        if (wantRare && !c.rare) continue;
        // high ratings are rare pulls
        const o = c.ovr, keep = o >= 86 ? 0.06 : o >= 83 ? 0.18 : o >= 80 ? 0.45 : 1;
        if (rnd() < keep) break;
      }
      out.push(c.id);
    }
    if (p.guarantee) {
      const big = db.filter((c) => c.ovr >= p.guarantee);
      if (big.length) out[0] = pick(big).id;
    }
    return out.sort((a, b) => card(b).ovr - card(a).ovr);
  }

  /** The starter squad: a full, playable XI + bench around 63–67. */
  _starter() {
    const db = cardDB().list;
    const L = LEAGUE_COUNTRIES[Math.floor(rnd() * LEAGUE_COUNTRIES.length)].id + '1';
    const need = ['GK', 'GK', 'LB', 'RB', 'CB', 'CB', 'CB', 'CDM', 'CM', 'CM', 'CAM', 'LW', 'RW', 'LM', 'RM', 'ST', 'ST', 'CF', 'CM', 'CB', 'ST', 'LB', 'RB'];
    return need.map((pos) => {
      const pool = db.filter((c) => c.pos === pos && c.ovr >= 58 && c.ovr <= 69 && (rnd() < 0.7 ? c.league === L : true));
      return pick(pool.length ? pool : db.filter((c) => c.pos === pos)).id;
    });
  }

  /** Best XI from the club for a formation (rating + chemistry, a few greedy passes). */
  autoBuild() {
    const slots = this.slots();
    const owned = this.s.owned.map((o) => ({ uid: o.uid, c: card(o.cid) }));
    const xi = new Array(11).fill(null), used = new Set();
    const order = [...slots.keys()].sort((a, b) => (slots[a] === 'GK' ? -1 : 0) - (slots[b] === 'GK' ? -1 : 0));
    for (const i of order) {
      let best = null, bs = -1;
      for (const o of owned) {
        if (used.has(o.uid) || used.has('c' + o.c.id)) continue;
        const fit = posFit(o.c.pos, slots[i]);
        if (slots[i] === 'GK' ? o.c.pos !== 'GK' : o.c.pos === 'GK') continue;
        const s = o.c.ovr + fit * 6;
        if (s > bs) { bs = s; best = o; }
      }
      if (best) { xi[i] = best.uid; used.add(best.uid); used.add('c' + best.c.id); }
    }
    // improve chemistry: try swapping in same-league / same-nation players
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 11; i++) {
        const cur = chemistry(xi.map((u) => (u == null ? null : this.cardOf(u))), slots);
        let bestScore = this.rating() * 0 + cur.total * 1.2 + squadRating(xi.map((u) => (u == null ? null : this.cardOf(u)))), bestU = xi[i];
        for (const o of owned) {
          if (xi.includes(o.uid) || posFit(o.c.pos, slots[i]) === 0) continue;
          if (xi.some((u) => u != null && this.cardOf(u).id === o.c.id)) continue;
          const t = xi.slice(); t[i] = o.uid;
          const cs = t.map((u) => (u == null ? null : this.cardOf(u)));
          const sc = chemistry(cs, slots).total * 1.2 + squadRating(cs);
          if (sc > bestScore + 0.5) { bestScore = sc; bestU = o.uid; }
        }
        xi[i] = bestU;
      }
    }
    this.s.squad.xi = xi;
    this.s.squad.bench = owned.filter((o) => !xi.includes(o.uid)).sort((a, b) => b.c.ovr - a.c.ovr).slice(0, 7).map((o) => o.uid);
    this.save();
  }

  // ------------------------------------------------------------ card view
  cardHTML(c, opts = {}) {
    const t = tierOf(c), cl = club(c.club);
    const st = c.stats;
    const labels = c.pos === 'GK' ? [['DIV', st.div], ['HAN', st.han], ['KIC', st.kic], ['REF', st.ref], ['SPD', st.spd], ['POS', st.pos]]
      : [['PAC', st.pac], ['SHO', st.sho], ['PAS', st.pas], ['DRI', st.dri], ['DEF', st.def], ['PHY', st.phy]];
    const chemDots = opts.chem != null ? `<div class="chem c${opts.chem}">${'<i></i>'.repeat(3)}</div>` : '';
    const oop = opts.oop ? '<div class="oop">OUT OF POS</div>' : '';
    return `<div class="card ${t}${c.rare ? ' rare' : ''} ${opts.size || ''}" data-cid="${c.id}">
      <div class="c-top"><b class="c-ovr">${c.ovr}</b><span class="c-pos">${opts.slot || c.pos}</span><span class="c-flag">${flag(c.nation, 18)}</span><span class="c-crest">${crestSVG(cl, 18)}</span></div>
      <img class="c-face" data-pid="${c.id}" alt="">
      <div class="c-name">${esc(c.short)}</div>
      <div class="c-stats">${labels.map(([l, v]) => `<span><b>${v}</b>${l}</span>`).join('')}</div>
      ${chemDots}${oop}
    </div>`;
  }

  _faces(scope) {
    scope.querySelectorAll('img.c-face[data-pid]').forEach((img) => this.portraits.into(img, card(img.dataset.pid)));
  }

  // ------------------------------------------------------------ setup (first time)
  _setup() {
    let kit = KIT_PRESETS[0];
    const el = this.el;
    el.innerHTML = '';
    const w = h('div', 'ut-setup ut-scroll');
    w.innerHTML = `<div class="ut-brand">BREAKAWAY <b>ULTIMATE TEAM</b></div>
      <h1>Create your club</h1>
      <label class="ut-field">Club name<input class="nm" maxlength="20" placeholder="e.g. Harbour City FC"></label>
      <div class="ut-sub">Home kit</div>
      <div class="kits">${KIT_PRESETS.map((k, i) => `<button class="kitb ${i === 0 ? 'on' : ''}" data-i="${i}">${kitSVG(k, 46)}</button>`).join('')}</div>
      <button class="ut-btn primary go">Create club &amp; open starter pack</button>`;
    el.appendChild(w);
    w.querySelectorAll('.kitb').forEach((b) => { b.onclick = () => { kit = KIT_PRESETS[+b.dataset.i]; w.querySelectorAll('.kitb').forEach((x) => x.classList.toggle('on', x === b)); }; });
    w.querySelector('.go').onclick = () => {
      const name = w.querySelector('.nm').value.trim() || 'Breakaway FC';
      const short = name.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter((x) => x.length > 2 && !/^(FC|AFC|CF|SC)$/i.test(x))[0]?.slice(0, 3).toUpperCase() || 'BRK';
      this.s = {
        v: 1, clubName: name, short, kit, coins: 5000, owned: [], nextUid: 1,
        squad: { formation: '4-3-3', xi: new Array(11).fill(null), bench: [] },
        sb: { points: 0, played: 0, wins: 0, draws: 0, losses: 0 },
        prog: { wins: 0, goals: 0, clean: 0, proWins: 0, worldWins: 0, chem33: 0 }, claimed: {},
        daily: null, market: null,
      };
      const ids = this._starter();
      this.save();
      this._openPack({ name: 'Starter Pack', id: 'starter' }, ids, () => {
        this.autoBuild();
        this.s.freePacks = ['premium'];
        this.save();
        this.render();
        this._toast('A free Premium Gold pack is waiting in the Store');
      });
    };
  }

  // ------------------------------------------------------------ main render
  /** The hub: club + currencies on top, quick buttons down the left, a hero banner, featured / CLUB / PLAY tiles, bottom nav. */
  render() {
    if (this.packing) return;
    const s = this.s, el = this.el;
    clearInterval(this._heroT);
    el.innerHTML = '';
    el.classList.toggle('hub', this.tab === 'home');
    const pend = this._claimable(), free = (s.freePacks || []).length;
    const rk = this._rank();
    const top = h('div', 'ut-top');
    top.innerHTML = `
      <button class="tb-club">${crestSVG({ short: s.short, kit: s.kit }, 38)}<div><b>${esc(s.clubName)}</b><span class="lvl"><i>${rk.level}</i>${fmt(rk.into)}/${fmt(rk.need)} PTS</span></div></button>
      ${this.tab !== 'home' ? `<button class="tb-back">&lsaquo; HOME</button><div class="tb-title">${{ play: 'Leagues', squad: 'Squad', store: 'Store', club: 'Exchange', market: 'Signings', obj: 'Quests' }[this.tab] || ''}</div>` : `<button class="tb-news">${ICON.news(26)}<span>NEWS</span></button>`}
      <div class="tb-right">
        <button class="cur" data-go="store">${coinIcon}<b>${fmt(s.coins)}</b><i class="plus">+</i></button>
        <button class="cur" data-go="play"><i class="gem"></i><b>${fmt(s.sb.points)}</b><i class="plus">+</i></button>
        <button class="tbi" data-go="squad">${ICON.people(28)}</button>
        <button class="tbi" data-go="obj">${ICON.mail(28)}${pend ? `<i class="badge">${pend}</i>` : ''}</button>
        <button class="tbi set">${ICON.gear(28)}</button>
      </div>`;
    el.appendChild(top);
    top.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => this.go(b.dataset.go); });
    top.querySelector('.set').onclick = () => this._settings();
    const back = top.querySelector('.tb-back'); if (back) back.onclick = () => this.go('home');
    const news = top.querySelector('.tb-news'); if (news) news.onclick = () => this._news();
    top.querySelector('.tb-club').onclick = () => this.go('squad');

    const body = h('div', `ut-body t-${this.tab}`);
    el.appendChild(body);
    this[`_tab_${this.tab}`](body);
    this._faces(body);

    const today = new Date().toDateString();
    const nav = h('div', 'ut-nav');
    const items = [['obj', ICON.quest(26), 'QUESTS', pend], ['play', ICON.shieldStar(26), 'LEAGUES', 0], ['market', ICON.signing(26), 'SIGNINGS', 0],
      ['club', ICON.exchange(26), 'EXCHANGE', 0], ['store', ICON.cart(26), 'STORE', free || (s.daily !== today ? 1 : 0)]];
    nav.innerHTML = items.map(([k, ic, l, n]) => `<button class="${this.tab === k ? 'on' : ''} ${k === 'store' ? 'store' : ''}" data-go="${k}">${ic}<span>${l}</span>${n ? '<i class="ndot"></i>' : ''}</button>`).join('');
    el.appendChild(nav);
    nav.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => this.go(b.dataset.go); });
  }

  go(tab) { this.tab = tab; this.render(); }

  /** Squad Battles rank as a level + progress (top bar). */
  _rank() {
    const p = this.s.sb.points;
    let i = 0;
    while (i + 1 < RANKS.length && p >= RANKS[i + 1][0]) i++;
    const lo = RANKS[i][0], hi = RANKS[i + 1] ? RANKS[i + 1][0] : lo + 1500;
    return { level: i + 1, name: RANKS[i][1], into: p - lo, need: hi - lo };
  }

  _news() {
    const m = this._modal(`<div class="news"><h3>News</h3>
      <p><b>Squad Battles is live.</b> Climb from Bronze to Elite — tougher difficulties pay more coins and points.</p>
      <p><b>Walkouts.</b> Pull an 84+ and he walks out: nation, position, club, then the card.</p>
      <p><b>Chemistry.</b> Players from the same club, league or nation link up — 33 is perfect.</p>
      <p><b>Skills.</b> Hold SPRINT &amp; SKILL and swipe: up rainbow flick, down drag back, left roulette, right elastico.</p>
      <button class="ut-btn primary ok">Got it</button></div>`);
    m.querySelector('.ok').onclick = () => m.remove();
  }

  _settings() {
    const s = this.s;
    const m = this._modal(`<div class="news"><h3>Settings</h3>
      <label class="ut-field">Club name<input class="nm" maxlength="20" value="${esc(s.clubName)}"></label>
      <div class="cd-btns"><button class="ut-btn primary sv">Save</button><button class="ut-btn rs">Start a new club</button></div></div>`);
    m.querySelector('.sv').onclick = () => { s.clubName = m.querySelector('.nm').value.trim() || s.clubName; this.save(); m.remove(); this.render(); };
    m.querySelector('.rs').onclick = () => {
      const c = this._modal(`<div class="confirm">Start again? Your club, cards and coins will be gone.<div class="cd-btns"><button class="ut-btn no">Cancel</button><button class="ut-btn primary yes">Start again</button></div></div>`);
      c.querySelector('.no').onclick = () => c.remove();
      c.querySelector('.yes').onclick = () => { try { localStorage.removeItem(SAVE); } catch (_) { /* ignore */ } this.s = null; c.remove(); m.remove(); this._setup(); };
    };
  }

  _toast(t) {
    const d = h('div', 'ut-toast', esc(t));
    this.el.appendChild(d);
    setTimeout(() => d.remove(), 2600);
  }

  _modal(html, cls = '') {
    const m = h('div', `ut-modal ${cls}`, `<div class="ut-mbox ut-scroll">${html}</div>`);
    this.el.appendChild(m);
    m.addEventListener('pointerdown', (e) => { if (e.target === m) m.remove(); });
    return m;
  }

  // ------------------------------------------------------------ home
  _tab_home(body) {
    const s = this.s, today = new Date().toDateString();
    const xi = this.xiCards().filter(Boolean).sort((a, b) => b.ovr - a.ovr);
    const star = xi[0];
    const free = (s.freePacks || []).length;
    const rk = this._rank();
    const heroes = [
      { kick: 'SQUAD BATTLES', title: 'WEEKEND LEAGUE', sub: `${rk.name} · ${fmt(s.sb.points)} pts — climb to Elite`, go: 'play' },
      { kick: 'STORE', title: 'ULTIMATE PACK', sub: '30 rare gold players and a guaranteed 85+', go: 'store' },
      { kick: 'SIGNINGS', title: 'TRANSFER MARKET', sub: 'Sign the stars your squad is missing', go: 'market' },
    ];
    const promos = [
      { title: 'PACK OF THE DAY', pack: 'premium', go: 'store' },
      { title: 'RARE PLAYERS', pack: 'rare', go: 'store' },
      { title: 'JUMBO PREMIUM', pack: 'jumbo', go: 'store' },
    ];
    this.hi = this.hi || 0;
    body.innerHTML = `
      <div class="hub-left">
        <button class="sq" data-a="daily">${ICON.gift(34)}<span>DAILY GIFT</span>${s.daily !== today ? '<i class="gbadge">!</i>' : ''}</button>
        <button class="sq" data-a="free">${ICON.star(34)}<span>FREE PACKS</span>${free ? `<i class="gbadge">${free}</i>` : ''}</button>
        <button class="sq" data-a="quests">${ICON.quest(34)}<span>OBJECTIVES</span>${this._claimable() ? '<i class="rdot"></i>' : ''}</button>
        <button class="sq" data-a="squad">${ICON.people(34)}<span>SQUAD</span></button>
      </div>
      <div class="hub-hero">
        <div class="gold-ball">${goldBallSVG()}</div>
        <div class="hero-star">${star ? `<img class="c-face" data-pid="${star.id}" alt="">` : ''}</div>
        <div class="hero-txt"><div class="h-kick"></div><div class="h-title"></div><div class="h-sub"></div></div>
        <button class="go-now">GO NOW</button>
        <div class="dots">${heroes.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>
      </div>
      <div class="hub-right">
        <button class="promo"><div class="p-title"></div><div class="p-art"><div class="pk-art big"><span></span></div>${goldBallSVG('mini')}</div><div class="dots">${promos.map(() => '<i></i>').join('')}</div></button>
        <div class="duo">
          <button class="club-tile"><b>CLUB</b><div class="ovr-shield"><small>OVR</small><em>${this.rating()}</em></div><div class="ct-crest">${crestSVG({ short: s.short, kit: s.kit }, 46)}</div><span class="ct-chem">${this.chem().total} CHEM</span></button>
          <button class="play-tile"><b>PLAY</b><div class="pt-ball">${goldBallSVG('white')}</div></button>
        </div>
      </div>`;
    const heroEl = body.querySelector('.hub-hero'), promoEl = body.querySelector('.promo');
    const show = () => {
      const H = heroes[this.hi % heroes.length], P = promos[this.hi % promos.length];
      heroEl.querySelector('.h-kick').textContent = H.kick;
      heroEl.querySelector('.h-title').textContent = H.title;
      heroEl.querySelector('.h-sub').textContent = H.sub;
      heroEl.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === this.hi % heroes.length));
      heroEl.querySelector('.go-now').onclick = () => this.go(H.go);
      const pk = PACKS.find((x) => x.id === P.pack);
      promoEl.querySelector('.p-title').textContent = P.title;
      promoEl.querySelector('.pk-art').className = `pk-art big ${pk.id}`;
      promoEl.querySelector('.pk-art span').innerHTML = `${pk.name.toUpperCase()}<br>${coinIcon}${fmt(pk.price)}`;
      promoEl.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === this.hi % promos.length));
      promoEl.onclick = () => this.go(P.go);
      heroEl.classList.remove('swap'); void heroEl.offsetWidth; heroEl.classList.add('swap');
    };
    show();
    this._heroT = setInterval(() => { if (!this.el.isConnected || this.tab !== 'home') { clearInterval(this._heroT); return; } this.hi++; show(); }, 5000);
    heroEl.querySelectorAll('.dots i').forEach((d) => { d.onclick = (e) => { e.stopPropagation(); this.hi = +d.dataset.i; show(); }; });
    body.querySelector('.club-tile').onclick = () => this.go('squad');
    body.querySelector('.play-tile').onclick = () => this.go('play');
    body.querySelector('[data-a="squad"]').onclick = () => this.go('squad');
    body.querySelector('[data-a="quests"]').onclick = () => this.go('obj');
    body.querySelector('[data-a="free"]').onclick = () => this.go('store');
    body.querySelector('[data-a="daily"]').onclick = () => {
      if (s.daily === today) { this._toast('Come back tomorrow for another gift'); return; }
      s.daily = today;
      const p = rnd() < 0.25 ? PACKS[3] : rnd() < 0.6 ? PACKS[2] : PACKS[1];
      this._openPack(p, this._rollPack(p), () => this.render());
    };
  }

  // ------------------------------------------------------------ play (Squad Battles)
  _opponents() {
    const s = this.s;
    if (!s.opps || s.opps.forRating !== this.rating()) {
      const W = world(), all = Object.values(W.clubs).filter((c) => c.level === 1);
      const r = this.rating();
      const opts = all.slice().sort(() => rnd() - 0.5).slice(0, 4);
      s.opps = { forRating: r, list: opts.map((c, i) => ({ club: c.id, rating: Math.max(55, Math.min(91, r + [-4, 0, 3, 6][i] + Math.round(rnd() * 2))) })) };
      this.save();
    }
    return s.opps.list;
  }

  _tab_play(body) {
    const s = this.s;
    const diff = s.diff || 'semipro';
    const opps = this._opponents();
    body.innerHTML = `<div class="play-head"><div><div class="ut-sub">SQUAD BATTLES · ${rankOf(s.sb.points)} · ${fmt(s.sb.points)} pts</div><h2>Choose an opponent</h2></div>
      <div class="diffs">${DIFFICULTIES.map((d) => `<button class="chip ${d.id === diff ? 'on' : ''}" data-d="${d.id}">${d.name}</button>`).join('')}</div></div>
      <div class="opps">${opps.map((o, i) => { const c = club(o.club); const d = DIFFICULTIES.find((x) => x.id === diff); return `<button class="opp" data-i="${i}">${crestSVG(c, 52)}<div class="o-name">${esc(c.name)}</div><div class="o-lg">${esc(league(c.league).name)}</div><div class="o-rate"><b>${Math.max(50, Math.min(95, o.rating + d.off))}</b> OVR</div><div class="o-kit">${kitSVG(c.kit, 34)}</div><div class="o-rw">${coinIcon}${fmt(Math.round(900 * d.mult))}+ · ${d.pts} pts</div></button>`; }).join('')}</div>
      <div class="play-foot">Match length <button class="chip len ${s.len === 120 ? 'on' : ''}" data-l="120">4 min</button><button class="chip len ${!s.len || s.len === 150 ? 'on' : ''}" data-l="150">5 min</button><button class="chip len ${s.len === 240 ? 'on' : ''}" data-l="240">8 min</button><button class="chip len ${s.len === 360 ? 'on' : ''}" data-l="360">12 min</button></div>`;
    body.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => { s.diff = b.dataset.d; this.save(); this.render(); }; });
    body.querySelectorAll('.len').forEach((b) => { b.onclick = () => { s.len = +b.dataset.l; this.save(); this.render(); }; });
    body.querySelectorAll('.opp').forEach((b) => { b.onclick = () => this._kickOff(opps[+b.dataset.i]); });
  }

  /** Build both teams and hand them to the match engine. */
  _kickOff(o) {
    const s = this.s;
    if (this.s.squad.xi.some((u) => u == null)) { this._toast('Your squad needs 11 players'); this.tab = 'squad'; this.render(); return; }
    const d = DIFFICULTIES.find((x) => x.id === (s.diff || 'semipro'));
    const slots = this.slots(), xi = this.xiCards(), ch = this.chem();
    const homeKit = s.kit;
    const home = {
      name: s.clubName, short: s.short, rating: this.rating(), formation: s.squad.formation,
      kit: kitLook(homeKit, s.clubName), players: xi.map((c, i) => this._matchPlayer(c, ch.per[i], 0)),
    };
    const oc = club(o.club);
    const okit = awayKit(homeKit, oc.kit);
    const oxi = this._oppXI(oc, o.rating + d.off);
    home.keeperKit = keeperKit(homeKit, okit);
    const away = {
      name: oc.name, short: oc.short, rating: o.rating + d.off, formation: pick(Object.keys(FORMATIONS)),
      kit: kitLook(okit, oc.name), keeperKit: keeperKit(okit, homeKit), players: oxi,
    };
    this.pending = { opp: o, diff: d.id, chem: ch.total };
    this.game.startMatch(home, away, { halfSeconds: (s.len || 150) / 2, difficulty: d.id });
  }

  _matchPlayer(c, chem, ratingOff) {
    return { name: c.short, pos: c.pos, rating: Math.max(40, Math.min(99, c.ovr + ratingOff + Math.round((chem - 1.5) * 1.5))), stats: engineStats(c, chem), look: c.look, number: null };
  }

  /** The opponent's XI from his club's squad, scaled to the target rating. */
  _oppXI(oc, target) {
    const squad = cardDB().list.filter((c) => c.club === oc.id);
    const F = FORMATIONS['4-3-3'].map((f) => f[2]);
    const used = new Set();
    const xi = F.map((pos) => {
      const c = squad.filter((x) => !used.has(x.id)).sort((a, b) => (posFit(b.pos, pos) * 10 + b.ovr) - (posFit(a.pos, pos) * 10 + a.ovr))[0];
      used.add(c.id);
      return c;
    });
    const avg = xi.reduce((a, c) => a + c.ovr, 0) / 11;
    const off = Math.round(target - avg);
    return xi.map((c) => this._matchPlayer(c, 2, off));
  }

  /** Back from a match: rewards, objectives, Squad Battles points. */
  onMatchEnd(res) {
    const s = this.s, p = this.pending || {};
    this.pending = null;
    if (!s) return;
    if (res.abandoned) { this.tab = 'home'; this.render(); this._toast('Match abandoned — no rewards'); return; }
    const d = DIFFICULTIES.find((x) => x.id === p.diff) || DIFFICULTIES[2];
    const win = res.gf > res.ga, draw = res.gf === res.ga;
    let coins = Math.round((win ? 1200 : draw ? 500 : 250) * d.mult) + res.gf * 50;
    const pts = win ? d.pts : draw ? Math.round(d.pts * 0.4) : 2;
    s.coins += coins;
    s.sb.points += pts; s.sb.played++;
    if (win) s.sb.wins++; else if (draw) s.sb.draws++; else s.sb.losses++;
    const pr = s.prog;
    pr.goals += res.gf;
    if (win) { pr.wins++; if (['pro', 'world', 'legend'].includes(d.id)) pr.proWins++; if (['world', 'legend'].includes(d.id)) pr.worldWins++; }
    if (res.ga === 0) pr.clean++;
    if (p.chem >= 33) pr.chem33 = 1;
    s.opps = null;
    this.save();
    this.tab = 'home';
    this.render();
    const oc = p.opp ? club(p.opp.club) : null;
    const m = this._modal(`<div class="rw">
      <div class="rw-k">${win ? 'VICTORY' : draw ? 'DRAW' : 'DEFEAT'} · ${d.name}</div>
      <div class="rw-score"><span>${esc(s.clubName)}</span><b>${res.gf} – ${res.ga}</b><span>${oc ? esc(oc.name) : ''}</span></div>
      <div class="rw-row">${coinIcon}<b>+${fmt(coins)}</b> coins</div>
      <div class="rw-row"><b>+${pts}</b> Squad Battles points · ${rankOf(s.sb.points)}</div>
      <div class="rw-row">Your rating <b>${res.rating.toFixed(1)}</b> · Possession ${res.possession}%</div>
      ${this._claimable() ? `<div class="rw-row gold">Objectives complete — claim your rewards</div>` : ''}
      <button class="ut-btn primary ok">Continue</button></div>`);
    m.querySelector('.ok').onclick = () => m.remove();
  }

  // ------------------------------------------------------------ squad
  _tab_squad(body) {
    const s = this.s, slots = this.slots(), xi = this.xiCards(), ch = this.chem();
    const F = FORMATIONS[s.squad.formation];
    body.innerHTML = `<div class="sq-side">
        <div class="sq-stats"><div><b>${this.rating()}</b><span>RATING</span></div><div><b>${ch.total}</b><span>CHEMISTRY</span></div></div>
        <label class="ut-field small">Formation<select class="form">${Object.keys(FORMATIONS).map((f) => `<option ${f === s.squad.formation ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <button class="ut-btn auto">Auto-build best XI</button>
        <div class="ut-sub">Kit</div>
        <div class="kits mini">${KIT_PRESETS.map((k, i) => `<button class="kitb ${JSON.stringify(k) === JSON.stringify(s.kit) ? 'on' : ''}" data-i="${i}">${kitSVG(k, 30)}</button>`).join('')}</div>
        <div class="ut-sub">Bench</div>
        <div class="bench">${s.squad.bench.map((u) => { const c = this.cardOf(u); return c ? `<button class="bn" data-u="${u}"><b>${c.ovr}</b> ${c.pos} ${esc(c.short)}</button>` : ''; }).join('')}</div>
      </div>
      <div class="pitch">${F.map((f, i) => {
        const c = xi[i];
        const x = 50 + f[1] * 42, y = 92 - ((f[0] + 1) / 2) * 92;
        return `<button class="slot" data-i="${i}" style="left:${x}%;top:${y}%">${c ? this.cardHTML(c, { size: 'sm', chem: ch.per[i], slot: slots[i], oop: posFit(c.pos, slots[i]) === 0 }) : `<div class="empty">+<span>${slots[i]}</span></div>`}</button>`;
      }).join('')}</div>`;
    body.querySelector('.form').onchange = (e) => { s.squad.formation = e.target.value; this.save(); this.render(); };
    body.querySelector('.auto').onclick = () => { this.autoBuild(); this.render(); this._toast('Best XI picked'); };
    body.querySelectorAll('.kitb').forEach((b) => { b.onclick = () => { s.kit = KIT_PRESETS[+b.dataset.i]; this.save(); this.render(); }; });
    body.querySelectorAll('.slot').forEach((b) => { b.onclick = () => this._pickFor(+b.dataset.i); });
    body.querySelectorAll('.bn').forEach((b) => { b.onclick = () => this._cardDetail(+b.dataset.u); });
  }

  /** Choose who plays in slot i (club cards, best fit first, with the chemistry he'd bring). */
  _pickFor(i) {
    const s = this.s, slots = this.slots(), pos = slots[i];
    const cur = s.squad.xi[i];
    const list = s.owned.map((o) => ({ uid: o.uid, c: card(o.cid) }))
      .filter((o) => o.uid !== cur && (pos === 'GK' ? o.c.pos === 'GK' : o.c.pos !== 'GK'))
      .sort((a, b) => (posFit(b.c.pos, pos) * 8 + b.c.ovr) - (posFit(a.c.pos, pos) * 8 + a.c.ovr)).slice(0, 40);
    const m = this._modal(`<div class="pick-h">Choose your ${pos}</div><div class="pick">${list.map((o) => {
      const t = s.squad.xi.slice(); const j = t.indexOf(o.uid); if (j >= 0) t[j] = cur; t[i] = o.uid;
      const c2 = chemistry(t.map((u) => (u == null ? null : this.cardOf(u))), slots);
      const inXI = s.squad.xi.includes(o.uid);
      return `<button class="pk" data-u="${o.uid}">${this.cardHTML(o.c, { size: 'sm', chem: c2.per[i], oop: posFit(o.c.pos, pos) === 0 })}<span class="pk-chem">Team chem ${c2.total}${inXI ? ' · swap' : ''}</span></button>`;
    }).join('')}</div>`, 'wide');
    this._faces(m);
    m.querySelectorAll('.pk').forEach((b) => {
      b.onclick = () => {
        const u = +b.dataset.u, q = s.squad;
        const j = q.xi.indexOf(u);
        if (j >= 0) q.xi[j] = cur; else { q.bench = q.bench.filter((x) => x !== u); if (cur != null) q.bench.unshift(cur); q.bench = q.bench.slice(0, 7); }
        q.xi[i] = u;
        this.save(); m.remove(); this.render();
      };
    });
  }

  // ------------------------------------------------------------ store & packs
  _tab_store(body) {
    const s = this.s;
    const free = s.freePacks || [];
    body.innerHTML = `${free.length ? `<div class="ut-sub">FREE PACKS</div><div class="packs">${free.map((id, k) => { const p = PACKS.find((x) => x.id === id); return `<button class="pack ${p.id} free" data-free="${k}"><div class="pk-art"><span>${p.name.toUpperCase()}</span></div><div class="pk-n">${esc(p.name)}</div><div class="pk-d">${p.desc}</div><div class="pk-p">OPEN</div></button>`; }).join('')}</div>` : ''}
      <div class="ut-sub">PACKS</div>
      <div class="packs">${PACKS.map((p) => `<button class="pack ${p.id}" data-p="${p.id}" ${s.coins < p.price ? 'disabled' : ''}><div class="pk-art"><span>${p.name.toUpperCase()}</span></div><div class="pk-n">${esc(p.name)}</div><div class="pk-d">${p.desc}</div><div class="pk-p">${coinIcon}${fmt(p.price)}</div></button>`).join('')}</div>`;
    body.querySelectorAll('[data-p]').forEach((b) => {
      b.onclick = () => {
        const p = PACKS.find((x) => x.id === b.dataset.p);
        if (s.coins < p.price) return;
        s.coins -= p.price; this.save();
        this._openPack(p, this._rollPack(p), () => this.render());
      };
    });
    body.querySelectorAll('[data-free]').forEach((b) => {
      b.onclick = () => {
        const id = free.splice(+b.dataset.free, 1)[0]; this.save();
        const p = PACKS.find((x) => x.id === id);
        this._openPack(p, this._rollPack(p), () => this.render());
      };
    });
  }

  /** Pack opening: a walkout for the big ones, then everything you got. */
  _openPack(p, ids, done) {
    this.packing = true;
    const best = card(ids[0]);
    const ov = h('div', 'pack-open');
    this.el.appendChild(ov);
    const finish = () => { this.packing = false; ov.remove(); done && done(); };
    const listing = () => {
      const owned = new Set(this.s.owned.map((o) => o.cid));
      ov.className = 'pack-open list';
      ov.innerHTML = `<div class="po-head"><b>${esc(p.name)}</b><span>${ids.length} players</span></div>
        <div class="po-grid ut-scroll">${ids.map((id, k) => `<div class="po-item ${owned.has(id) ? 'dupe' : ''}" style="animation-delay:${k * 45}ms">${this.cardHTML(card(id), { size: 'sm' })}${owned.has(id) ? `<span class="dupe-tag">DUPLICATE · ${coinIcon}${quickSell(card(id))}</span>` : ''}</div>`).join('')}</div>
        <div class="po-btns"><button class="ut-btn qs">Quick sell duplicates</button><button class="ut-btn primary keep">Send all to club</button></div>`;
      this._faces(ov);
      const keepAll = (sellDupes) => {
        let coins = 0;
        for (const id of ids) {
          if (sellDupes && owned.has(id)) { coins += quickSell(card(id)); continue; }
          this.addCard(id);
          owned.add(id);
        }
        this.s.coins += coins;
        this.save();
        if (coins) this._toast(`+${fmt(coins)} coins from duplicates`);
        finish();
      };
      ov.querySelector('.qs').onclick = () => keepAll(true);
      ov.querySelector('.keep').onclick = () => keepAll(false);
    };
    if (best.ovr >= 84) {
      // walkout: nation → position → club → the card
      const cl = club(best.club);
      ov.className = 'pack-open walkout';
      const stage = (html, ms, next) => { ov.innerHTML = `<div class="wo-stage">${html}</div><div class="wo-skip">tap to skip</div>`; this._woT = setTimeout(next, ms); };
      ov.onclick = () => { clearTimeout(this._woT); ov.onclick = null; listing(); };
      this.game.audio && this.game.audio.unlock && this.game.audio.unlock();
      stage(`<div class="wo-flag">${flag(best.nation, 150)}</div><div class="wo-cap">${esc(nation(best.nation)?.name || best.nation)}</div>`, 1300, () =>
        stage(`<div class="wo-pos">${best.pos}</div>`, 1000, () =>
          stage(`<div class="wo-crest">${crestSVG(cl, 150)}</div><div class="wo-cap">${esc(cl.name)}</div>`, 1300, () => {
            ov.innerHTML = `<div class="wo-stage reveal">${this.cardHTML(best, { size: 'lg' })}<div class="wo-cap">${esc(best.first)} ${esc(best.last)}</div></div><div class="wo-skip">tap to continue</div>`;
            this._faces(ov);
            this.game.audio && this.game.audio.cheer && this.game.audio.cheer(1);
            ov.onclick = () => { ov.onclick = null; listing(); };
          })));
    } else {
      ov.className = 'pack-open';
      ov.innerHTML = `<div class="wo-stage reveal">${this.cardHTML(best, { size: 'lg' })}</div><div class="wo-skip">tap to continue</div>`;
      this._faces(ov);
      ov.onclick = () => { ov.onclick = null; listing(); };
    }
  }

  // ------------------------------------------------------------ club
  _tab_club(body) {
    const s = this.s;
    const f = this.clubFilter || (this.clubFilter = { g: 'ALL', sort: 'ovr' });
    let list = s.owned.map((o) => ({ uid: o.uid, c: card(o.cid) }));
    if (f.g !== 'ALL') list = list.filter((o) => (POS_GROUP[o.c.pos] || o.c.pos) === f.g);
    list.sort((a, b) => (f.sort === 'ovr' ? b.c.ovr - a.c.ovr : a.c.short.localeCompare(b.c.short)));
    body.innerHTML = `<div class="club-bar">${['ALL', 'GK', 'DEF', 'MID', 'ATT'].map((g) => `<button class="chip ${f.g === g ? 'on' : ''}" data-g="${g}">${g}</button>`).join('')}<span class="club-n">${s.owned.length} players</span></div>
      <div class="club-grid ut-scroll">${list.map((o) => `<button class="cg ${this.inSquad(o.uid) ? 'in' : ''}" data-u="${o.uid}">${this.cardHTML(o.c, { size: 'sm' })}${this.inSquad(o.uid) ? '<span class="in-tag">IN SQUAD</span>' : ''}</button>`).join('')}</div>`;
    body.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => { f.g = b.dataset.g; this.render(); }; });
    body.querySelectorAll('.cg').forEach((b) => { b.onclick = () => this._cardDetail(+b.dataset.u); });
  }

  _cardDetail(uid) {
    const c = this.cardOf(uid);
    if (!c) return;
    const cl = club(c.club), qs = quickSell(c), mk = Math.round(marketPrice(c) * 0.9 / 50) * 50;
    const inSq = this.inSquad(uid);
    const m = this._modal(`<div class="cd">${this.cardHTML(c, { size: 'lg' })}<div class="cd-info">
      <h3>${esc(c.first)} ${esc(c.last)}</h3>
      <div class="cd-row">${flag(c.nation, 20)} ${esc(nation(c.nation)?.name || c.nation)}</div>
      <div class="cd-row">${crestSVG(cl, 20)} ${esc(cl.name)} · ${esc(league(c.league).name)}</div>
      <div class="cd-row">${c.foot === 'R' ? 'Right' : 'Left'} foot · ${c.look.height.toFixed(2)} m · ${c.rare ? 'Rare' : 'Common'} ${tierOf(c)}</div>
      <div class="cd-btns">
        <button class="ut-btn sell" ${inSq ? 'disabled' : ''}>Sell on market ${coinIcon}${fmt(mk)}</button>
        <button class="ut-btn qs" ${inSq ? 'disabled' : ''}>Quick sell ${coinIcon}${fmt(qs)}</button>
      </div>${inSq ? '<div class="cd-note">In your squad — swap him out to sell</div>' : ''}</div></div>`);
    this._faces(m);
    const sell = (v, label) => { this.removeCard(uid); this.s.coins += v; this.save(); m.remove(); this.render(); this._toast(`${label} ${c.short} for ${fmt(v)} coins`); };
    m.querySelector('.qs').onclick = () => { if (!inSq) sell(qs, 'Quick sold'); };
    m.querySelector('.sell').onclick = () => { if (!inSq) sell(mk, 'Sold'); };
  }

  // ------------------------------------------------------------ transfer market
  _tab_market(body) {
    const s = this.s;
    const f = this.mf || (this.mf = { g: 'ALL', min: 75, lg: 'ALL' });
    if (!this.results) this._search();
    body.innerHTML = `<div class="club-bar">${['ALL', 'GK', 'DEF', 'MID', 'ATT'].map((g) => `<button class="chip ${f.g === g ? 'on' : ''}" data-g="${g}">${g}</button>`).join('')}
      <select class="mmin">${[50, 60, 65, 70, 75, 78, 80, 82, 84, 86].map((v) => `<option value="${v}" ${f.min === v ? 'selected' : ''}>${v}+</option>`).join('')}</select>
      <select class="mlg"><option value="ALL">All leagues</option>${LEAGUE_COUNTRIES.map((c) => `<option value="${c.id}1" ${f.lg === c.id + '1' ? 'selected' : ''}>${esc(league(c.id + '1').name)}</option>`).join('')}</select>
      <button class="ut-btn small srch">Search</button></div>
      <div class="club-grid ut-scroll">${this.results.map((c) => `<button class="cg buy" data-c="${c.id}" ${s.coins < marketPrice(c) ? 'disabled' : ''}>${this.cardHTML(c, { size: 'sm' })}<span class="price">${coinIcon}${fmt(marketPrice(c))}</span></button>`).join('') || '<div class="none">No players found</div>'}</div>`;
    body.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => { f.g = b.dataset.g; this._search(); this.render(); }; });
    body.querySelector('.mmin').onchange = (e) => { f.min = +e.target.value; };
    body.querySelector('.mlg').onchange = (e) => { f.lg = e.target.value; };
    body.querySelector('.srch').onclick = () => { this._search(); this.render(); };
    body.querySelectorAll('.buy').forEach((b) => {
      b.onclick = () => {
        const c = card(b.dataset.c), price = marketPrice(c);
        if (s.coins < price) return;
        const m = this._modal(`<div class="confirm">Buy <b>${esc(c.first)} ${esc(c.last)}</b> (${c.ovr} ${c.pos}) for ${coinIcon}<b>${fmt(price)}</b>?<div class="cd-btns"><button class="ut-btn no">Cancel</button><button class="ut-btn primary yes">Buy now</button></div></div>`);
        m.querySelector('.no').onclick = () => m.remove();
        m.querySelector('.yes').onclick = () => {
          s.coins -= price; this.addCard(c.id); this.save(); m.remove();
          this.results = this.results.filter((x) => x !== c);
          this.render(); this._toast(`${c.short} joined your club`);
        };
      };
    });
  }

  _search() {
    const f = this.mf;
    let list = cardDB().list.filter((c) => c.ovr >= f.min && (f.g === 'ALL' || (POS_GROUP[c.pos] || c.pos) === f.g) && (f.lg === 'ALL' || c.league === f.lg));
    list = list.sort(() => rnd() - 0.5).slice(0, 24).sort((a, b) => b.ovr - a.ovr);
    this.results = list;
  }

  // ------------------------------------------------------------ objectives
  _claimable() {
    if (!this.s) return 0;
    return OBJECTIVES.filter((o) => !this.s.claimed[o.id] && (this.s.prog[o.key] || 0) >= o.need).length;
  }

  _tab_obj(body) {
    const s = this.s;
    body.innerHTML = `<div class="objs ut-scroll">${OBJECTIVES.map((o) => {
      const v = Math.min(o.need, s.prog[o.key] || 0), done = v >= o.need, got = s.claimed[o.id];
      const rw = o.reward.pack ? PACKS.find((p) => p.id === o.reward.pack).name : `${fmt(o.reward.coins)} coins`;
      return `<div class="obj ${got ? 'got' : done ? 'done' : ''}"><div><b>${esc(o.name)}</b><span>${esc(o.desc)}</span></div>
        <div class="o-bar"><i style="width:${(v / o.need) * 100}%"></i><em>${v}/${o.need}</em></div>
        <div class="o-rw">${esc(rw)}</div>${done && !got ? `<button class="ut-btn primary small claim" data-o="${o.id}">Claim</button>` : got ? '<span class="o-ok">Claimed</span>' : ''}</div>`;
    }).join('')}</div>`;
    body.querySelectorAll('.claim').forEach((b) => {
      b.onclick = () => {
        const o = OBJECTIVES.find((x) => x.id === b.dataset.o);
        s.claimed[o.id] = true;
        if (o.reward.coins) { s.coins += o.reward.coins; this.save(); this.render(); this._toast(`+${fmt(o.reward.coins)} coins`); return; }
        (s.freePacks || (s.freePacks = [])).push(o.reward.pack);
        this.save(); this.render(); this._toast(`${PACKS.find((p) => p.id === o.reward.pack).name} added to the Store`);
      };
    });
  }
}
