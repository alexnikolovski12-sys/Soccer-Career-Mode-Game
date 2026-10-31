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
import { Social, directory, userById } from './social.js';
import { clashes } from './kits.js';

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
const GEM = '<svg class="gemc" viewBox="0 0 24 24"><path d="M12 1L23 12 12 23 1 12z" fill="#7fe0c0"/><path d="M12 1L23 12H12z" fill="#b8f5e2"/><path d="M12 1L1 12h11z" fill="#5cc9a6"/><path d="M1 12l11 11V12z" fill="#2f8f72"/><path d="M23 12L12 23V12z" fill="#49b391"/></svg>';
const coinIcon = GEM;
/** 8.25K style amounts. */
const fmtK = (n) => (n < 1000 ? String(n) : n < 10000 ? `${(n / 1000).toFixed(2).replace(/\.?0+$/, '')}K` : n < 1e6 ? `${(n / 1000).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '')}K` : `${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`);
const money = (n) => `<span class="money">${fmtK(n)}${GEM}</span>`;
/** The dark price pill above a card (FC style). */
const pill = (n) => `<div class="ppill">${fmtK(n)}${GEM}</div>`;
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

const RIVALS_PROMOTE = 12;
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
    this.social = new Social(this);
    this.tab = 'home';
    this.load();
    // the "server" answers friend requests while you're on the menus
    setInterval(() => {
      if (!this.s || !this.el.classList.contains('show') || this.packing) return;
      const before = this.social.unread();
      if (this.social.tick() && this.social.unread() > before) {
        const n = this.social.s.notes[0], u = userById(n.from);
        this._toast(n.type === 'request' ? `${u.name} sent you a friend request` : `${u.name} ${n.answer} your friend request`);
        if (['home', 'friends', 'inbox'].includes(this.tab)) this.render();
        else { const b = this.el.querySelector('.tbi.mail'); if (b && !b.querySelector('.badge')) b.insertAdjacentHTML('beforeend', `<i class="badge">${this.social.unread()}</i>`); }
      }
    }, 3000);
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
    this.s.squad.bench = owned.filter((o) => !xi.includes(o.uid)).sort((a, b) => b.c.ovr - a.c.ovr).slice(0, 5).map((o) => o.uid);
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
        v: 1, clubName: name, short, kit, kit2: KIT_PRESETS.find((k) => clashes(k, kit)) ? KIT_PRESETS.find((k) => !clashes(k, kit)) : KIT_PRESETS[1], coins: 5000, owned: [], nextUid: 1,
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
    if (!s.kit2) s.kit2 = KIT_PRESETS[1];
    if (!s.squad.bench || s.squad.bench.length !== 5) s.squad.bench = [...(s.squad.bench || []), null, null, null, null, null].slice(0, 5);
    clearInterval(this._heroT);
    el.innerHTML = '';
    el.classList.toggle('hub', this.tab === 'home');
    const pend = this._claimable(), free = (s.freePacks || []).length, unread = this.social.unread();
    const rk = this._rank();
    const titles = { modes: 'Play', play: 'Vs AI', rivals: 'Division Rivals', friendly: 'Vs a Friend', squad: 'Squad', store: 'Store', market: 'Market', obj: 'Quests', friends: 'Friends', inbox: 'Notifications', profile: 'Club' };
    const top = h('div', 'ut-top');
    top.innerHTML = `
      <button class="tb-club">${crestSVG({ short: s.short, kit: s.kit }, 38)}<div><b>${esc(s.clubName)}</b><span class="lvl"><i>${rk.level}</i>${fmt(rk.into)}/${fmt(rk.need)} PTS</span></div></button>
      ${this.tab !== 'home' ? `<button class="tb-back">&lsaquo; HOME</button><div class="tb-title">${titles[this.tab] || ''}</div>` : `<button class="tb-news">${ICON.news(26)}<span>NEWS</span></button>`}
      <div class="tb-right">
        <button class="cur" data-go="store">${money(s.coins)}<i class="plus">+</i></button>
        <button class="tbi" data-go="friends">${ICON.people(28)}</button>
        <button class="tbi mail" data-go="inbox">${ICON.mail(28)}${unread ? `<i class="badge">${unread}</i>` : ''}</button>
        <button class="tbi set">${ICON.gear(28)}</button>
      </div>`;
    el.appendChild(top);
    top.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => this.go(b.dataset.go); });
    top.querySelector('.set').onclick = () => this._settings();
    const back = top.querySelector('.tb-back'); if (back) back.onclick = () => this.go(['play', 'rivals', 'friendly'].includes(this.tab) ? 'modes' : 'home');
    const news = top.querySelector('.tb-news'); if (news) news.onclick = () => this._news();
    top.querySelector('.tb-club').onclick = () => this.go('profile');

    const body = h('div', `ut-body t-${this.tab}`);
    el.appendChild(body);
    this[`_tab_${this.tab}`](body);
    this._faces(body);

    const today = new Date().toDateString();
    const nav = h('div', 'ut-nav');
    const items = [['obj', ICON.quest(26), 'QUESTS', pend], ['market', ICON.signing(26), 'MARKET', 0], ['store', ICON.cart(26), 'STORE', free || (s.daily !== today ? 1 : 0)]];
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
      <p><b>Squad Battles is live.</b> Climb from Bronze to Elite — tougher difficulties pay more gems and points.</p>
      <p><b>Walkouts.</b> Pull an 84+ and he walks out: nation, position, club, then the card.</p>
      <p><b>Chemistry.</b> Players from the same club, league or nation link up — 33 is perfect.</p>
      <p><b>Skills.</b> Hold SPRINT &amp; SKILL and swipe: up rainbow flick, down drag back, left roulette, right elastico.</p>
      <button class="ut-btn primary ok">Got it</button></div>`);
    m.querySelector('.ok').onclick = () => m.remove();
  }

  _settings() {
    const s = this.s;
    const m = this._modal(`<div class="news"><h3>Settings</h3>
      <p>Edit your club name and kits by tapping your badge (top left).</p>
      <div class="cd-btns"><button class="ut-btn primary sv">Close</button><button class="ut-btn rs">Start a new club</button></div></div>`);
    m.querySelector('.sv').onclick = () => m.remove();
    m.querySelector('.rs').onclick = () => {
      const c = this._modal(`<div class="confirm">Start again? Your club, cards and gems will be gone.<div class="cd-btns"><button class="ut-btn no">Cancel</button><button class="ut-btn primary yes">Start again</button></div></div>`);
      c.querySelector('.no').onclick = () => c.remove();
      c.querySelector('.yes').onclick = () => { try { localStorage.removeItem(SAVE); } catch (_) { /* ignore */ } this.s = null; c.remove(); m.remove(); this._setup(); };
    };
  }

  _toast(t) {
    const d = h('div', 'ut-toast', esc(t));
    this.el.appendChild(d);
    setTimeout(() => d.remove(), 2600);
  }

  _modal(html, cls = '', title = '') {
    const m = h('div', `ut-modal ${cls}`, `<div class="ut-mbox ut-scroll">${title ? `<div class="mh"><b>${esc(title)}</b><button class="mx">&times;</button></div>` : ''}${html}</div>`);
    const x = m.querySelector('.mx'); if (x) x.onclick = () => m.remove();
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
      { kick: 'DIVISION RIVALS', title: 'CLIMB THE DIVISIONS', sub: `Division ${(s.rivals || { div: 10 }).div} — win to move up`, go: 'rivals' },
      { kick: 'SQUAD BATTLES', title: 'WEEKEND LEAGUE', sub: `${rk.name} · ${fmt(s.sb.points)} pts — climb to Elite`, go: 'play' },
      { kick: 'STORE', title: 'ULTIMATE PACK', sub: '30 rare gold players and a guaranteed 85+', go: 'store' },
      { kick: 'MARKET', title: 'EVERY PLAYER', sub: 'Search all 1,800 players and sign the stars', go: 'market' },
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
      promoEl.querySelector('.pk-art span').innerHTML = `${pk.name.toUpperCase()}<br>${money(pk.price)}`;
      promoEl.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === this.hi % promos.length));
      promoEl.onclick = () => this.go(P.go);
      heroEl.classList.remove('swap'); void heroEl.offsetWidth; heroEl.classList.add('swap');
    };
    show();
    this._heroT = setInterval(() => { if (!this.el.isConnected || this.tab !== 'home') { clearInterval(this._heroT); return; } this.hi++; show(); }, 5000);
    heroEl.querySelectorAll('.dots i').forEach((d) => { d.onclick = (e) => { e.stopPropagation(); this.hi = +d.dataset.i; show(); }; });
    body.querySelector('.club-tile').onclick = () => this.go('squad');
    body.querySelector('.play-tile').onclick = () => this.go('modes');
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

  // ------------------------------------------------------------ play
  /** PLAY: choose a mode. */
  _tab_modes(body) {
    const s = this.s, rv = s.rivals || { div: 10, pts: 0 };
    const nf = this.social.s.friends.length;
    body.innerHTML = `<div class="modes">
      <button class="mode m-train" data-m="training"><div class="m-ic">${ICON.target(40)}</div><b>TRAINING</b><span>Free play on your own — practise skills, shooting and set pieces</span></button>
      <button class="mode m-ai" data-m="play"><div class="m-ic">${ICON.ball(40)}</div><b>VS AI</b><span>Squad Battles · ${rankOf(s.sb.points)} · pick a difficulty</span></button>
      <button class="mode m-rivals" data-m="rivals"><div class="m-ic">${ICON.shieldStar(40)}</div><b>DIVISION RIVALS</b><span>Division ${rv.div} · ${rv.pts}/${RIVALS_PROMOTE} pts to promotion</span></button>
      <button class="mode m-friend" data-m="friendly"><div class="m-ic">${ICON.people(40)}</div><b>VS A FRIEND</b><span>${nf ? `${nf} friend${nf > 1 ? 's' : ''} to play` : 'Add friends to play them'}</span></button>
    </div>
    <div class="play-foot">Match length ${[[120, '4 min'], [150, '5 min'], [240, '8 min'], [360, '12 min']].map(([v, l]) => `<button class="chip len ${(s.len || 150) === v ? 'on' : ''}" data-l="${v}">${l}</button>`).join('')}</div>`;
    body.querySelectorAll('.len').forEach((b) => { b.onclick = () => { s.len = +b.dataset.l; this.save(); this.render(); }; });
    body.querySelectorAll('.mode').forEach((b) => {
      b.onclick = () => (b.dataset.m === 'training' ? this._training() : this.go(b.dataset.m));
    });
  }

  _tab_play(body) {
    const s = this.s;
    const diff = s.diff || 'semipro';
    const opps = this._opponents();
    body.innerHTML = `<div class="play-head"><div><div class="ut-sub">SQUAD BATTLES · ${rankOf(s.sb.points)} · ${fmt(s.sb.points)} pts</div><h2>Choose an opponent</h2></div>
      <div class="diffs">${DIFFICULTIES.map((d) => `<button class="chip ${d.id === diff ? 'on' : ''}" data-d="${d.id}">${d.name}</button>`).join('')}</div></div>
      <div class="opps">${opps.map((o, i) => { const c = club(o.club); const d = DIFFICULTIES.find((x) => x.id === diff); return `<button class="opp" data-i="${i}">${crestSVG(c, 52)}<div class="o-name">${esc(c.name)}</div><div class="o-lg">${esc(league(c.league).name)}</div><div class="o-rate"><b>${Math.max(50, Math.min(95, o.rating + d.off))}</b> OVR</div><div class="o-kit">${kitSVG(c.kit, 34)}</div><div class="o-rw">${money(Math.round(900 * d.mult))}+ · ${d.pts} pts</div></button>`; }).join('')}</div>`;
    body.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => { s.diff = b.dataset.d; this.save(); this.render(); }; });
    body.querySelectorAll('.opp').forEach((b) => {
      b.onclick = () => { const o = opps[+b.dataset.i], d = DIFFICULTIES.find((x) => x.id === (s.diff || 'semipro')); this._kickOff({ mode: 'sb', club: club(o.club), rating: o.rating + d.off, diff: d.id }); };
    });
  }

  /** Division Rivals: online-style ladder against other managers' squads. */
  _tab_rivals(body) {
    const s = this.s, rv = s.rivals || (s.rivals = { div: 10, pts: 0, w: 0, d: 0, l: 0 });
    body.innerHTML = `<div class="rivals">
      <div class="rv-badge"><small>DIVISION</small><b>${rv.div}</b></div>
      <div class="rv-info"><h2>Division Rivals</h2>
        <div class="rv-bar"><i style="width:${Math.min(100, (rv.pts / RIVALS_PROMOTE) * 100)}%"></i><em>${rv.pts}/${RIVALS_PROMOTE} pts</em></div>
        <p>Win 3 pts · Draw 1 pt. Reach ${RIVALS_PROMOTE} to go up a division${rv.div === 1 ? ' (you\'re in the top division — stay there!)' : ''}. Opponents get tougher each division.</p>
        <div class="rv-rec">W ${rv.w || 0} · D ${rv.d || 0} · L ${rv.l || 0}</div>
        <button class="ut-btn primary find">${ICON.play(16)} Find a match</button></div></div>`;
    body.querySelector('.find').onclick = () => this._matchmake();
  }

  _matchmake() {
    const s = this.s, rv = s.rivals;
    const pool = directory().filter((u) => Math.abs(u.div - rv.div) <= 1);
    const u = pick(pool.length ? pool : directory());
    const m = this._modal(`<div class="mm"><div class="mm-spin"></div><div class="mm-t">Searching for an opponent…</div></div>`, 'mmodal');
    setTimeout(() => {
      const oc = club(u.club), rating = Math.max(58, Math.min(90, 60 + (10 - rv.div) * 3 + Math.round(rnd() * 3)));
      m.querySelector('.ut-mbox').innerHTML = `<div class="mm found"><div class="mm-k">OPPONENT FOUND</div>${crestSVG(oc, 64)}<b>${esc(u.name)}</b><span>${esc(oc.name)} · ${rating} OVR · Division ${u.div}</span></div>`;
      setTimeout(() => { m.remove(); this._kickOff({ mode: 'rivals', club: oc, rating, user: u }); }, 1500);
    }, 1400 + rnd() * 1200);
  }

  /** Vs a Friend: pick one of your friends and play his squad. */
  _tab_friendly(body) {
    const fr = this.social.s.friends.map(userById).filter(Boolean);
    body.innerHTML = fr.length ? `<div class="ut-sub">CHOOSE A FRIEND</div><div class="flist">${fr.map((u) => `<button class="frow" data-u="${u.id}">${crestSVG(club(u.club), 40)}<div><b>${esc(u.name)}</b><span>${esc(club(u.club).name)} · ${u.rating} OVR</span></div><i class="${u.online ? 'on' : ''}">${u.online ? 'Online' : 'Offline'}</i><em>${ICON.play(16)} Play</em></button>`).join('')}</div>`
      : `<div class="empty-state"><div>${ICON.people(54)}</div><b>No friends yet</b><span>Find other managers and send them a friend request.</span><button class="ut-btn primary add">Find friends</button></div>`;
    const add = body.querySelector('.add'); if (add) add.onclick = () => this.go('friends');
    body.querySelectorAll('.frow').forEach((b) => { b.onclick = () => { const u = userById(b.dataset.u); this._kickOff({ mode: 'friendly', club: club(u.club), rating: u.rating, user: u }); }; });
  }

  /** Training: your team, no opposition outfield, no clock. */
  _training() {
    this._kickOff({ mode: 'training', club: club(Object.keys(world().clubs)[0]), rating: 60 });
  }

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

  /** Build both teams and hand them to the match engine. o: { mode, club, rating, diff?, user? } */
  _kickOff(o) {
    const s = this.s;
    if (typeof o.club === 'string') { // a Squad Battles opponent entry { club: id, rating }
      const d = DIFFICULTIES.find((x) => x.id === (s.diff || 'semipro'));
      o = { mode: 'sb', club: club(o.club), rating: o.rating + d.off, diff: d.id };
    }
    if (this.s.squad.xi.some((u) => u == null)) { this._toast('Your squad needs 11 players'); this.tab = 'squad'; this.render(); return; }
    const xi = this.xiCards(), ch = this.chem();
    const oc = o.club;
    // your away kit when your home kit clashes with theirs
    const homeKit = clashes(s.kit, oc.kit) && !clashes(s.kit2, oc.kit) ? s.kit2 : s.kit;
    const okit = awayKit(homeKit, oc.kit);
    const home = {
      name: s.clubName, short: s.short, rating: this.rating(), formation: s.squad.formation,
      kit: kitLook(homeKit, s.clubName), keeperKit: keeperKit(homeKit, okit), players: xi.map((c, i) => this._matchPlayer(c, ch.per[i], 0)),
    };
    const away = {
      name: o.user ? o.user.name : oc.name, short: o.user ? o.user.name.slice(0, 3).toUpperCase() : oc.short, rating: o.rating,
      formation: pick(['4-3-3', '4-4-2', '4-2-3-1', '4-1-2-1-2', '3-5-2', '5-3-2', '4-3-3 (2)', '4-5-1']),
      kit: kitLook(okit, oc.name), keeperKit: keeperKit(okit, homeKit), players: this._oppXI(oc, o.rating),
    };
    this.pending = { ...o, chem: ch.total };
    const training = o.mode === 'training';
    this.game.startMatch(home, away, { halfSeconds: training ? 1e6 : (s.len || 150) / 2, difficulty: o.diff || 'pro', training });
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

  /** Back from a match: rewards for the mode you played. */
  onMatchEnd(res) {
    const s = this.s, p = this.pending || {};
    this.pending = null;
    if (!s) return;
    if (p.mode === 'training') { this.tab = 'modes'; this.render(); this._toast('Training session over'); return; }
    if (res.abandoned) { this.tab = 'home'; this.render(); this._toast('Match abandoned — no rewards'); return; }
    const win = res.gf > res.ga, draw = res.gf === res.ga;
    const pr = s.prog;
    pr.goals += res.gf;
    if (res.ga === 0) pr.clean++;
    if (p.chem >= 33) pr.chem33 = 1;
    let rows = '', label = '', gems = 0;
    if (p.mode === 'sb') {
      const d = DIFFICULTIES.find((x) => x.id === p.diff) || DIFFICULTIES[2];
      gems = Math.round((win ? 1200 : draw ? 500 : 250) * d.mult) + res.gf * 50;
      const pts = win ? d.pts : draw ? Math.round(d.pts * 0.4) : 2;
      s.sb.points += pts; s.sb.played++;
      if (win) s.sb.wins++; else if (draw) s.sb.draws++; else s.sb.losses++;
      if (win) { pr.wins++; if (['pro', 'world', 'legend'].includes(d.id)) pr.proWins++; if (['world', 'legend'].includes(d.id)) pr.worldWins++; }
      s.opps = null;
      label = `Squad Battles · ${d.name}`;
      rows = `<div class="rw-row"><b>+${pts}</b> Squad Battles points · ${rankOf(s.sb.points)}</div>`;
    } else if (p.mode === 'rivals') {
      const rv = s.rivals;
      const got = win ? 3 : draw ? 1 : 0;
      rv.pts += got; if (win) rv.w = (rv.w || 0) + 1; else if (draw) rv.d = (rv.d || 0) + 1; else rv.l = (rv.l || 0) + 1;
      gems = (win ? 1500 : draw ? 700 : 300) + (10 - rv.div) * 150 + res.gf * 50;
      if (win) pr.wins++;
      let promo = '';
      if (rv.pts >= RIVALS_PROMOTE && rv.div > 1) { rv.div--; rv.pts = 0; promo = `<div class="rw-row gold">PROMOTED to Division ${rv.div}!</div>`; (s.freePacks || (s.freePacks = [])).push('rare'); }
      label = `Division Rivals · Division ${rv.div}`;
      rows = `<div class="rw-row"><b>+${got}</b> pts · ${rv.pts}/${RIVALS_PROMOTE}</div>${promo}`;
    } else {
      gems = 300 + res.gf * 50;
      label = `Friendly vs ${p.user ? esc(p.user.name) : ''}`;
    }
    s.coins += gems;
    this.save();
    this.tab = 'home';
    this.render();
    const oname = p.user ? p.user.name : p.club ? p.club.name : '';
    const m = this._modal(`<div class="rw">
      <div class="rw-k">${win ? 'VICTORY' : draw ? 'DRAW' : 'DEFEAT'} · ${label}</div>
      <div class="rw-score"><span>${esc(s.clubName)}</span><b>${res.gf} – ${res.ga}</b><span>${esc(oname)}</span></div>
      <div class="rw-row"><b>+${money(gems)}</b></div>${rows}
      <div class="rw-row">Your rating <b>${res.rating.toFixed(1)}</b> · Possession ${res.possession}%</div>
      ${this._claimable() ? `<div class="rw-row gold">Objectives complete — claim your rewards</div>` : ''}
      <button class="ut-btn primary ok">Continue</button></div>`, 'reward');
    m.querySelector('.ok').onclick = () => m.remove();
  }

  // ------------------------------------------------------------ friends & notifications
  _tab_friends(body) {
    const S = this.social, so = S.s;
    const fr = so.friends.map(userById).filter(Boolean);
    const q = this.fq || '';
    const res = S.search(q);
    const row = (u, right) => `<div class="frow">${crestSVG(club(u.club), 40)}<div><b>${esc(u.name)}</b><span>${esc(club(u.club).name)} · ${u.rating} OVR · Div ${u.div}</span></div>${right}</div>`;
    body.innerHTML = `<div class="fr-cols">
      <div class="fr-col"><div class="ut-sub">YOUR FRIENDS (${fr.length})</div>
        ${fr.length ? `<div class="flist">${fr.map((u) => row(u, `<i class="${u.online ? 'on' : ''}">${u.online ? 'Online' : 'Offline'}</i><button class="ut-btn small play" data-u="${u.id}">Play</button>`)).join('')}</div>`
          : `<div class="empty-state small"><div>${ICON.people(44)}</div><b>No friends yet</b><span>Search for a manager and send a request.</span></div>`}
        ${so.outgoing.length ? `<div class="ut-sub">SENT REQUESTS</div><div class="flist">${so.outgoing.map((o) => row(userById(o.id), '<i>Pending…</i>')).join('')}</div>` : ''}
      </div>
      <div class="fr-col"><div class="ut-sub">FIND MANAGERS</div>
        <div class="srch-box">${ICON.target(18)}<input class="fq" placeholder="Search by username" value="${esc(q)}" autocomplete="off" autocapitalize="off"></div>
        <div class="flist">${q.length < 2 ? '<div class="hint">Type at least 2 letters — try “Striker”, “Golden” or “Nonchalant”.</div>' : res.length ? res.map((u) => {
          const st = S.status(u.id);
          const btn = st === 'friend' ? '<i class="on">Friends</i>' : st === 'sent' ? '<i>Requested</i>' : st === 'incoming' ? `<button class="ut-btn small primary acc" data-u="${u.id}">Accept</button>` : `<button class="ut-btn small primary req" data-u="${u.id}">Add friend</button>`;
          return row(u, btn);
        }).join('') : '<div class="hint">No managers found.</div>'}</div>
      </div></div>`;
    const inp = body.querySelector('.fq');
    inp.oninput = () => { this.fq = inp.value; clearTimeout(this._fqT); this._fqT = setTimeout(() => { this.render(); const i = this.el.querySelector('.fq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
    body.querySelectorAll('.req').forEach((b) => { b.onclick = () => { S.request(b.dataset.u); this._toast(`Friend request sent to ${userById(b.dataset.u).name}`); this.render(); }; });
    body.querySelectorAll('.acc').forEach((b) => { b.onclick = () => { S.respond(b.dataset.u, true); this.render(); }; });
    body.querySelectorAll('.play').forEach((b) => { b.onclick = () => { const u = userById(b.dataset.u); this._kickOff({ mode: 'friendly', club: club(u.club), rating: u.rating, user: u }); }; });
  }

  _tab_inbox(body) {
    const S = this.social, notes = S.s.notes;
    body.innerHTML = notes.length ? `<div class="notes">${notes.map((n, i) => {
      const u = userById(n.from) || { name: '?' };
      const when = Math.max(1, Math.round((Date.now() - n.at) / 60000));
      const ago = when < 60 ? `${when}m ago` : `${Math.round(when / 60)}h ago`;
      if (n.type === 'request') {
        return `<div class="note ${n.read ? '' : 'new'}">${ICON.people(26)}<div><b>${esc(u.name)}</b> sent you a friend request<span>${ago}</span></div>
          ${n.done ? `<i>${n.answer === 'accepted' ? 'Accepted' : 'Declined'}</i>` : `<button class="ut-btn small primary yes" data-u="${n.from}">Accept</button><button class="ut-btn small no" data-u="${n.from}">Decline</button>`}</div>`;
      }
      return `<div class="note ${n.read ? '' : 'new'} ${n.answer}">${ICON.mail(26)}<div><b>${esc(u.name)}</b> ${n.answer} your friend request<span>${ago}</span></div></div>`;
    }).join('')}</div>` : `<div class="empty-state"><div>${ICON.mail(54)}</div><b>No notifications</b><span>Friend requests and replies show up here.</span></div>`;
    body.querySelectorAll('.yes').forEach((b) => { b.onclick = () => { S.respond(b.dataset.u, true); this._toast(`You and ${userById(b.dataset.u).name} are now friends`); this.render(); }; });
    body.querySelectorAll('.no').forEach((b) => { b.onclick = () => { S.respond(b.dataset.u, false); this.render(); }; });
    setTimeout(() => { S.markRead(); const bd = this.el.querySelector('.tbi.mail .badge'); if (bd) bd.remove(); }, 600);
  }

  // ------------------------------------------------------------ club profile
  _tab_profile(body) {
    const s = this.s;
    body.innerHTML = `<div class="profile">
      <div class="pf-crest">${crestSVG({ short: s.short, kit: s.kit }, 110)}</div>
      <div class="pf-form">
        <label class="ut-field">Club name<input class="nm" maxlength="20" value="${esc(s.clubName)}"></label>
        <label class="ut-field">Short name (3 letters)<input class="sh" maxlength="3" value="${esc(s.short)}"></label>
        <div class="ut-sub">Home kit</div>
        <div class="kits">${KIT_PRESETS.map((k, i) => `<button class="kitb k1 ${JSON.stringify(k) === JSON.stringify(s.kit) ? 'on' : ''}" data-i="${i}">${kitSVG(k, 40)}</button>`).join('')}</div>
        <div class="ut-sub">Away kit <small>used when your home kit clashes</small></div>
        <div class="kits">${KIT_PRESETS.map((k, i) => `<button class="kitb k2 ${JSON.stringify(k) === JSON.stringify(s.kit2) ? 'on' : ''}" data-i="${i}">${kitSVG(k, 40)}</button>`).join('')}</div>
        <button class="ut-btn primary sv">Save</button>
      </div></div>`;
    body.querySelectorAll('.k1').forEach((b) => { b.onclick = () => { s.kit = KIT_PRESETS[+b.dataset.i]; this.save(); this.render(); }; });
    body.querySelectorAll('.k2').forEach((b) => { b.onclick = () => { s.kit2 = KIT_PRESETS[+b.dataset.i]; this.save(); this.render(); }; });
    body.querySelector('.sv').onclick = () => {
      s.clubName = body.querySelector('.nm').value.trim() || s.clubName;
      s.short = (body.querySelector('.sh').value.trim().toUpperCase().replace(/[^A-Z]/g, '') || s.short).slice(0, 3);
      this.save(); this.render(); this._toast('Club saved');
    };
  }

  // ------------------------------------------------------------ squad
  _tab_squad(body) {
    const s = this.s, q = s.squad, slots = this.slots(), xi = this.xiCards(), ch = this.chem();
    const F = FORMATIONS[q.formation];
    const others = s.owned.map((o) => ({ uid: o.uid, c: card(o.cid) })).filter((o) => !q.xi.includes(o.uid) && !q.bench.includes(o.uid)).sort((a, b) => b.c.ovr - a.c.ovr);
    body.innerHTML = `<div class="sq-side">
        <div class="sq-stats"><div><b>${this.rating()}</b><span>RATING</span></div><div><b>${ch.total}</b><span>CHEMISTRY</span></div></div>
        <button class="fsel"><span>FORMATION</span><b>${q.formation}</b>${ICON.chevron(16)}</button>
        <button class="ut-btn auto">Auto-build best XI</button>
        <div class="sq-kits"><button class="kk" data-go="profile">${kitSVG(s.kit, 30)}<span>HOME</span></button><button class="kk" data-go="profile">${kitSVG(s.kit2, 30)}<span>AWAY</span></button></div>
        <div class="ut-sub">PLAYERS · ${others.length}</div>
        <div class="plist">${others.map((o) => `<button class="pl" data-u="${o.uid}"><b class="${tierOf(o.c)}">${o.c.ovr}</b><i>${o.c.pos}</i><span>${esc(o.c.short)}</span></button>`).join('') || '<div class="hint">Everyone is in your XI or on the bench.</div>'}</div>
      </div>
      <div class="sq-main">
        <div class="pitch">${F.map((f, i) => {
          const c = xi[i];
          const x = 50 + f[1] * 42, y = 90 - ((f[0] + 1) / 2) * 88;
          return `<div class="slot" data-k="x${i}" style="left:${x}%;top:${y}%">${c ? this.cardHTML(c, { size: 'sm', chem: ch.per[i], slot: slots[i], oop: posFit(c.pos, slots[i]) === 0 }) : `<div class="empty">+<span>${slots[i]}</span></div>`}</div>`;
        }).join('')}</div>
        <div class="benchrow"><div class="br-l">BENCH</div>${q.bench.map((u, k) => { const c = this.cardOf(u); return `<div class="bslot" data-k="b${k}">${c ? this.cardHTML(c, { size: 'sm' }) : '<div class="empty">+<span>SUB</span></div>'}</div>`; }).join('')}</div>
        <div class="sq-tip">Drag a player onto another to swap · tap to change</div>
      </div>`;
    body.querySelector('.fsel').onclick = () => this._pickFormation();
    body.querySelector('.auto').onclick = () => { this.autoBuild(); this.render(); this._toast('Best XI picked'); };
    body.querySelectorAll('.kk').forEach((b) => { b.onclick = () => this.go('profile'); });
    body.querySelectorAll('.pl').forEach((b) => { b.onclick = () => this._cardDetail(+b.dataset.u); });
    this._dragSwap(body);
  }

  /** Drag-to-swap between pitch slots and the bench (pointer events, works with touch). A tap opens the picker. */
  _dragSwap(body) {
    const q = this.s.squad;
    const get = (k) => (k[0] === 'x' ? q.xi : q.bench)[+k.slice(1)];
    const set = (k, v) => { (k[0] === 'x' ? q.xi : q.bench)[+k.slice(1)] = v; };
    body.querySelectorAll('.slot, .bslot').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const k = el.dataset.k, sx = e.clientX, sy = e.clientY;
        let ghost = null, over = null;
        const move = (ev) => {
          if (!ghost) {
            if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8 || get(k) == null) return;
            const r = el.getBoundingClientRect();
            ghost = el.cloneNode(true); ghost.className = 'drag-ghost'; ghost.style.width = r.width + 'px';
            document.body.appendChild(ghost); el.classList.add('dragging');
          }
          ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
          ghost.style.display = 'none';
          const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.slot, .bslot');
          ghost.style.display = '';
          if (over && over !== t) over.classList.remove('drop');
          over = t && t !== el ? t : null;
          if (over) over.classList.add('drop');
        };
        const up = () => {
          window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
          if (!ghost) { // a tap
            if (k[0] === 'x') this._pickFor(+k.slice(1)); else this._pickBench(+k.slice(1));
            return;
          }
          ghost.remove(); el.classList.remove('dragging');
          if (over) {
            const k2 = over.dataset.k, a = get(k), b = get(k2);
            set(k, b); set(k2, a);
            this.save(); this.render();
          }
        };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      });
    });
  }

  /** Bench card tapped: bring in any club player who isn't already in the XI or on the bench. */
  _pickBench(k) {
    const s = this.s, q = s.squad, cur = q.bench[k];
    const list = s.owned.map((o) => ({ uid: o.uid, c: card(o.cid) })).filter((o) => !q.xi.includes(o.uid) && !q.bench.includes(o.uid)).sort((a, b) => b.c.ovr - a.c.ovr);
    const m = this._modal(list.length ? `<div class="pick">${list.map((o) => `<button class="pk" data-u="${o.uid}">${this.cardHTML(o.c, { size: 'sm' })}</button>`).join('')}</div>`
      : '<div class="hint">No other players in your club — buy some on the Market.</div>', 'wide', cur != null ? `Replace ${esc(this.cardOf(cur).short)} on the bench` : 'Add a substitute');
    this._faces(m);
    m.querySelectorAll('.pk').forEach((b) => { b.onclick = () => { q.bench[k] = +b.dataset.u; this.save(); m.remove(); this.render(); }; });
  }

  /** Formation picker: a mini pitch for every shape. */
  _pickFormation() {
    const s = this.s;
    const mini = (F) => `<svg viewBox="0 0 60 80"><rect x="1" y="1" width="58" height="78" rx="3"/><path d="M1 40h58M22 79v-10h16v10"/><circle cx="30" cy="40" r="7"/>${F.map((f) => `<circle class="d" cx="${30 + f[1] * 26}" cy="${74 - ((f[0] + 1) / 2) * 68}" r="3.6"/>`).join('')}</svg>`;
    const m = this._modal(`<div class="forms">${Object.keys(FORMATIONS).map((f) => `<button class="fm ${f === s.squad.formation ? 'on' : ''}" data-f="${f}">${mini(FORMATIONS[f])}<b>${f}</b></button>`).join('')}</div>`, 'wide', 'Formation');
    m.querySelectorAll('.fm').forEach((b) => { b.onclick = () => { s.squad.formation = b.dataset.f; this.save(); m.remove(); this.render(); this._toast(`Formation ${b.dataset.f}`); }; });
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
        if (j >= 0) q.xi[j] = cur; else { const k = q.bench.indexOf(u); if (k >= 0) q.bench[k] = cur; }
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
      <div class="packs">${PACKS.map((p) => `<button class="pack ${p.id}" data-p="${p.id}" ${s.coins < p.price ? 'disabled' : ''}><div class="pk-art"><span>${p.name.toUpperCase()}</span></div><div class="pk-n">${esc(p.name)}</div><div class="pk-d">${p.desc}</div><div class="pk-p">${money(p.price)}</div></button>`).join('')}</div>`;
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
        <div class="po-grid ut-scroll">${ids.map((id, k) => `<div class="po-item ${owned.has(id) ? 'dupe' : ''}" style="animation-delay:${k * 45}ms">${this.cardHTML(card(id), { size: 'sm' })}${owned.has(id) ? `<span class="dupe-tag">DUPLICATE · ${money(quickSell(card(id)))}</span>` : ''}</div>`).join('')}</div>
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
        if (coins) this._toast(`+${fmt(coins)} gems from duplicates`);
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
        <button class="ut-btn sell" ${inSq ? 'disabled' : ''}>Sell on market ${money(mk)}</button>
        <button class="ut-btn qs" ${inSq ? 'disabled' : ''}>Quick sell ${money(qs)}</button>
      </div>${inSq ? '<div class="cd-note">In your squad — swap him out to sell</div>' : ''}</div></div>`);
    this._faces(m);
    const sell = (v, label) => { this.removeCard(uid); this.s.coins += v; this.save(); m.remove(); this.render(); this._toast(`${label} ${c.short} for ${fmtK(v)} gems`); };
    m.querySelector('.qs').onclick = () => { if (!inSq) sell(qs, 'Quick sold'); };
    m.querySelector('.sell').onclick = () => { if (!inSq) sell(mk, 'Sold'); };
  }

  // ------------------------------------------------------------ transfer market
  /** Every player in the game, searchable, with the price above each card. */
  _tab_market(body) {
    const f = this.mf || (this.mf = { q: '', g: 'ALL', min: 0, lg: 'ALL', sort: 'ovr' });
    const chips = (key, opts) => opts.map(([v, l]) => `<button class="chip ${f[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${l}</button>`).join('');
    body.innerHTML = `<div class="mk-bar">
        <div class="srch-box">${ICON.target(18)}<input class="mq" placeholder="Search ${fmt(cardDB().list.length)} players" value="${esc(f.q)}" autocomplete="off" autocapitalize="off"></div>
        <div class="mk-chips">${chips('g', [['ALL', 'All'], ['GK', 'GK'], ['DEF', 'DEF'], ['MID', 'MID'], ['ATT', 'ATT']])}<span class="sep"></span>${chips('min', [[0, 'Any'], [75, '75+'], [80, '80+'], [85, '85+']])}<span class="sep"></span>${chips('sort', [['ovr', 'Best'], ['lo', 'Cheapest'], ['hi', 'Priciest']])}</div>
        <div class="mk-chips lg">${chips('lg', [['ALL', 'All leagues'], ...LEAGUE_COUNTRIES.map((c) => [c.id + '1', league(c.id + '1').name])])}</div>
      </div>
      <div class="mk-count"></div>
      <div class="club-grid mk-grid"></div>
      <button class="ut-btn more">Show more</button>`;
    body.querySelectorAll('.chip[data-k]').forEach((b) => { b.onclick = () => { const v = b.dataset.v; f[b.dataset.k] = isNaN(+v) || v === '' ? v : +v; this.render(); }; });
    const inp = body.querySelector('.mq');
    inp.oninput = () => { f.q = inp.value; clearTimeout(this._mqT); this._mqT = setTimeout(() => this._marketList(body, true), 200); };
    body.querySelector('.more').onclick = () => this._marketList(body, false);
    this._marketList(body, true);
  }

  _marketList(body, reset) {
    const s = this.s, f = this.mf;
    if (reset) {
      const q = f.q.trim().toLowerCase();
      let list = cardDB().list.filter((c) => c.ovr >= f.min && (f.g === 'ALL' || (POS_GROUP[c.pos] || c.pos) === f.g) && (f.lg === 'ALL' || c.league === f.lg)
        && (!q || `${c.first} ${c.last} ${c.short}`.toLowerCase().includes(q) || club(c.club).name.toLowerCase().includes(q)));
      list.sort(f.sort === 'lo' ? (a, b) => marketPrice(a) - marketPrice(b) : f.sort === 'hi' ? (a, b) => marketPrice(b) - marketPrice(a) : (a, b) => b.ovr - a.ovr);
      this.results = list; this.mShown = 0;
      body.querySelector('.mk-grid').innerHTML = '';
      body.querySelector('.mk-count').textContent = `${fmt(list.length)} player${list.length === 1 ? '' : 's'}`;
    }
    const grid = body.querySelector('.mk-grid');
    const owned = new Set(s.owned.map((o) => o.cid));
    const chunk = this.results.slice(this.mShown, this.mShown + 40);
    this.mShown += chunk.length;
    const wrap = h('div');
    wrap.innerHTML = chunk.map((c) => `<button class="cg buy" data-c="${c.id}">${pill(marketPrice(c))}${this.cardHTML(c, { size: 'sm' })}${owned.has(c.id) ? '<span class="in-tag">OWNED</span>' : ''}</button>`).join('');
    if (!this.results.length) wrap.innerHTML = '<div class="none">No players found</div>';
    [...wrap.children].forEach((n) => grid.appendChild(n));
    body.querySelector('.more').style.display = this.mShown < this.results.length ? '' : 'none';
    this._faces(grid);
    grid.querySelectorAll('.buy:not([data-b])').forEach((b) => {
      b.dataset.b = 1;
      b.onclick = () => {
        const c = card(b.dataset.c), price = marketPrice(c);
        const can = s.coins >= price;
        const m = this._modal(`<div class="cd">${this.cardHTML(c, { size: 'lg' })}<div class="cd-info">
          <h3>${esc(c.first)} ${esc(c.last)}</h3>
          <div class="cd-row">${flag(c.nation, 20)} ${esc(nation(c.nation)?.name || c.nation)}</div>
          <div class="cd-row">${crestSVG(club(c.club), 20)} ${esc(club(c.club).name)} · ${esc(league(c.league).name)}</div>
          <div class="cd-price">${pill(price)}</div>
          <div class="cd-btns"><button class="ut-btn no">Cancel</button><button class="ut-btn primary yes" ${can ? '' : 'disabled'}>${can ? 'Buy now' : 'Not enough gems'}</button></div></div></div>`, '', 'Transfer Market');
        this._faces(m);
        m.querySelector('.no').onclick = () => m.remove();
        m.querySelector('.yes').onclick = () => {
          if (s.coins < price) return;
          s.coins -= price; this.addCard(c.id); this.save(); m.remove();
          const cur = this.el.querySelector('.cur'); if (cur) cur.innerHTML = `${money(s.coins)}<i class="plus">+</i>`;
          if (!b.querySelector('.in-tag')) b.insertAdjacentHTML('beforeend', '<span class="in-tag">OWNED</span>');
          this._toast(`${c.short} joined your club`);
        };
      };
    });
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
      const rw = o.reward.pack ? PACKS.find((p) => p.id === o.reward.pack).name : `${fmtK(o.reward.coins)} gems`;
      return `<div class="obj ${got ? 'got' : done ? 'done' : ''}"><div><b>${esc(o.name)}</b><span>${esc(o.desc)}</span></div>
        <div class="o-bar"><i style="width:${(v / o.need) * 100}%"></i><em>${v}/${o.need}</em></div>
        <div class="o-rw">${esc(rw)}</div>${done && !got ? `<button class="ut-btn primary small claim" data-o="${o.id}">Claim</button>` : got ? '<span class="o-ok">Claimed</span>' : ''}</div>`;
    }).join('')}</div>`;
    body.querySelectorAll('.claim').forEach((b) => {
      b.onclick = () => {
        const o = OBJECTIVES.find((x) => x.id === b.dataset.o);
        s.claimed[o.id] = true;
        if (o.reward.coins) { s.coins += o.reward.coins; this.save(); this.render(); this._toast(`+${fmtK(o.reward.coins)} gems`); return; }
        (s.freePacks || (s.freePacks = [])).push(o.reward.pack);
        this.save(); this.render(); this._toast(`${PACKS.find((p) => p.id === o.reward.pack).name} added to the Store`);
      };
    });
  }
}
