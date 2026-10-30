// Player career: calendar (day by day, stopping at training and match days),
// league fixtures/table, training, match results, messages (coach, agent,
// sponsors, club, country, social), objectives for club and country, the
// shop (agent upgrades, followers, investments), season end and transfers.
// Saved on the device (localStorage).
import { world, club, league, LEAGUE_COUNTRIES, SPONSORS, nation, CLUBS_PER_LEAGUE } from './data.js';

const SAVE_KEY = 'breakaway_career_v1';
const DAY = 86400000;
export const STAT_KEYS = ['pace', 'acceleration', 'dribbling', 'ballControl', 'passing', 'vision', 'finishing', 'shotPower', 'composure', 'stamina'];

const rnd = () => Math.random();
const pick = (a) => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const fmtMoney = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`);
export { fmtMoney };

export const AGENT_TIERS = [
  { name: 'Rookie Agent', cost: 0, offerBonus: 0, sponsor: 0 },
  { name: 'Pro Agent', cost: 40000, offerBonus: 1, sponsor: 0.1 },
  { name: 'Elite Agent', cost: 250000, offerBonus: 2, sponsor: 0.2 },
  { name: 'Super Agent', cost: 1500000, offerBonus: 3, sponsor: 0.32 },
];

export const SHOP = [
  { id: 'agent', kind: 'agent', title: 'Upgrade your agent', desc: 'Better transfer offers and more sponsor interest.' },
  { id: 'pr', kind: 'once', title: 'Hire a social media manager', desc: '+3% followers every week.', cost: 25000, flag: 'pr' },
  { id: 'fans', kind: 'repeat', title: 'Fan meet-and-greet', desc: '+2,000 followers now.', cost: 6000, followers: 2000 },
  { id: 'content', kind: 'repeat', title: 'Training-ground content shoot', desc: '+6% followers now.', cost: 15000, followersPct: 0.06 },
  { id: 'savings', kind: 'invest', title: 'Savings account', desc: 'Put in $20K, earns 1% a week. Safe.', cost: 20000, weekly: 0.01, risk: 0 },
  { id: 'property', kind: 'invest', title: 'Apartment to rent out', desc: 'Costs $150K, pays $2.5K a week.', cost: 150000, weeklyFlat: 2500, risk: 0 },
  { id: 'startup', kind: 'invest', title: 'Back a tech start-up', desc: '$60K stake. At season end it could be worth 0–4×.', cost: 60000, risk: 1 },
];

// ---------------------------------------------------------------- helpers
function roundRobin(ids) {
  // circle method → (n-1) rounds, then mirrored for the second half
  const n = ids.length, arr = ids.slice(), rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const games = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      games.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(games);
    arr.splice(1, 0, arr.pop());
  }
  return rounds.concat(rounds.map((g) => g.map(([a, b]) => [b, a])));
}

function dateOf(ms) { return new Date(ms); }
export function fmtDate(ms) {
  return dateOf(ms).toLocaleDateString('en-AU', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
}

function overallOf(stats) {
  const w = { pace: 1, acceleration: 0.8, dribbling: 1.1, ballControl: 1, passing: 0.7, vision: 0.6, finishing: 1.4, shotPower: 0.9, composure: 0.8, stamina: 0.5 };
  let s = 0, t = 0;
  for (const k of STAT_KEYS) { s += stats[k] * w[k]; t += w[k]; }
  return Math.round(s / t);
}
export { overallOf };

// ---------------------------------------------------------------- the career
export class Career {
  constructor() {
    this.s = null;
    this.listeners = new Set();
  }

  // ---- persistence
  load() {
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) this.s = JSON.parse(raw); } catch (_) { this.s = null; }
    return !!this.s;
  }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (_) { /* storage blocked: still playable */ } }
  wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ } this.s = null; }
  onChange(fn) { this.listeners.add(fn); }
  emit() { this.save(); for (const fn of this.listeners) fn(); }

  // ---- new career
  /** Three starting offers from L3 clubs in different European countries. */
  startingOffers() {
    const W = world();
    const countries = LEAGUE_COUNTRIES.slice().sort(() => rnd() - 0.5).slice(0, 3);
    return countries.map((c) => {
      const ids = W.leagues[`${c.id}3`].clubs;
      const id = pick(ids);
      return { clubId: id, wage: this._wageFor(club(id), 60) };
    });
  }

  create({ name, nationality, clubId, wage }) {
    const stats = {};
    for (const k of STAT_KEYS) stats[k] = 56 + Math.floor(rnd() * 9);
    stats.pace += 4; stats.finishing += 3;
    const start = Date.UTC(2026, 6, 27); // Monday 27 July 2026 — pre-season week
    this.s = {
      v: 1,
      player: {
        name, nationality, age: 18, position: 'ST', stats,
        look: { skin: pick(['#f1c9a5', '#e0ac82', '#c68a5e', '#a86b43', '#7d4a2b', '#5a3420']), hair: pick(['#1a1310', '#2a1c14', '#4a3020', '#7a5a2e', '#c9a35a', '#0e0e0e']) },
      },
      clubId, wage, money: 15000, followers: 1200, agentTier: 0, pr: false, investments: [],
      date: start, seasonNo: 1, year: 2026,
      messages: [], tasks: [], msgId: 1,
      country: { calledUp: false, caps: 0, goals: 0, lastBreak: null },
      form: [], history: [], offersPending: null, seasonOver: false,
    };
    this._newSeason();
    this.message('club', `Welcome to ${club(clubId).name}`, `The manager welcomes you to the squad. Work hard in training, take your chances on matchday, and hit your season objectives to earn a new deal. Check the Club tab for your targets.`);
    this.message('agent', 'Your agent here', `Big moment — your first professional contract. I'll keep an eye on the market. Play well and the bigger clubs will come calling. Upgrade my package in the Shop and I can open more doors.`);
    this.emit();
  }

  // ---- season
  _newSeason() {
    const s = this.s, c = club(s.clubId), L = league(c.league);
    const ids = L.clubs.slice().sort(() => rnd() - 0.5);
    const rounds = roundRobin(ids);
    // matchdays on Saturdays from the second week of August, skipping breaks
    const first = Date.UTC(s.year, 7, 8);
    const breaks = new Set([5, 9, 13, 20, 21, 28]); // international breaks + winter break (week index)
    const days = [];
    let w = 0;
    while (days.length < rounds.length) { if (!breaks.has(w)) days.push(first + w * 7 * DAY); w++; }
    s.season = {
      league: L.id, rounds, matchDays: days, md: 0,
      table: Object.fromEntries(L.clubs.map((id) => [id, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }])),
      results: [], apps: 0, goals: 0, assists: 0, ratings: [], motm: 0,
      intlBreaks: [5, 9, 13, 28].map((wk) => first + wk * 7 * DAY + 2 * DAY),
      end: days[days.length - 1],
      objectives: this._objectivesFor(c),
    };
    s.seasonOver = false;
  }

  _objectivesFor(c) {
    const ovr = overallOf(this.s.player.stats);
    const gap = (ovr - c.rating) / 10; // better than your club → tougher targets
    const goals = Math.max(3, Math.round(6 + gap * 4 + (3 - c.level)));
    return [
      { id: 'apps', label: 'Make 18+ appearances', target: 18 },
      { id: 'goals', label: `Score ${goals} league goals`, target: goals },
      { id: 'avg', label: `Average match rating ${(6.5 + Math.max(0, gap) * 0.3).toFixed(1)}+`, target: +(6.5 + Math.max(0, gap) * 0.3).toFixed(1) },
    ];
  }

  objectiveProgress(o) {
    const S = this.s.season;
    if (o.id === 'apps') return S.apps;
    if (o.id === 'goals') return S.goals;
    if (o.id === 'avg') return S.ratings.length ? +(S.ratings.reduce((a, b) => a + b, 0) / S.ratings.length).toFixed(2) : 0;
    return 0;
  }
  objectiveDone(o) { return this.objectiveProgress(o) >= o.target; }
  allObjectivesDone() { return this.s.season.objectives.every((o) => this.objectiveDone(o)); }

  // ---- national team
  nationObjectives() {
    const s = this.s, n = nation(s.player.nationality), c = club(s.clubId);
    const needLevel = n.tier === 1 ? 1 : n.tier === 2 ? 2 : 3;
    const avgNeed = n.tier === 1 ? 7.2 : n.tier === 2 ? 6.9 : 6.6;
    const goalsNeed = n.tier === 1 ? 8 : n.tier === 2 ? 5 : 3;
    if (s.country.calledUp) {
      return [{ id: 'nstay', label: 'Keep an average rating of 6.2+ for your club', ok: this._avg() >= 6.2 || !s.season.ratings.length, value: this._avg().toFixed(1) }];
    }
    return [
      { id: 'lvl', label: `Play for an L${needLevel}${needLevel > 1 ? ' or higher' : ''} club`, ok: c.level <= needLevel, value: `L${c.level}` },
      { id: 'navg', label: `Average rating ${avgNeed}+ this season`, ok: this._avg() >= avgNeed, value: this._avg().toFixed(1) },
      { id: 'ngoals', label: `Score ${goalsNeed}+ league goals this season`, ok: s.season.goals >= goalsNeed, value: s.season.goals },
    ];
  }
  _avg() { const r = this.s.season.ratings; return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0; }

  // ---- calendar
  get today() { return this.s.date; }
  eventToday() {
    const s = this.s, S = s.season;
    if (s.seasonOver) return { type: 'seasonEnd' };
    const d = s.date;
    if (S.md < S.matchDays.length && S.matchDays[S.md] === d) return { type: 'match', fixture: this.nextFixture() };
    if (dateOf(d).getUTCDay() === 3 && !s.trainedOn?.[d]) return { type: 'training' };
    return null;
  }

  nextFixture() {
    const s = this.s, S = s.season;
    if (S.md >= S.rounds.length) return null;
    const g = S.rounds[S.md].find(([a, b]) => a === s.clubId || b === s.clubId);
    if (!g) return null;
    const home = g[0] === s.clubId;
    return { md: S.md, date: S.matchDays[S.md], homeId: g[0], awayId: g[1], home, oppId: home ? g[1] : g[0] };
  }

  /** Advance one day (returns the event that stops the sim, if any). */
  advanceDay() {
    const s = this.s;
    s.date += DAY;
    const dow = dateOf(s.date).getUTCDay();
    if (dow === 1) this._weekly();
    // international break: national team news
    for (const b of s.season.intlBreaks) if (b === s.date) this._intlBreak();
    // occasional agent chatter
    if (dow === 4 && rnd() < 0.18) this._agentUpdate();
    this.emit();
    return this.eventToday();
  }

  /** Sim day by day until a training or match day (UI animates it with the callback). */
  simToNextEvent(onDay) {
    if (this.eventToday()) return this.eventToday();
    for (let i = 0; i < 40; i++) {
      const e = this.advanceDay();
      if (onDay) onDay();
      if (e) return e;
    }
    return null;
  }

  _weekly() {
    const s = this.s;
    s.money += s.wage;
    for (const sp of s.sponsors || []) { if (sp.weeks > 0) { s.money += sp.weekly; sp.weeks--; } }
    for (const inv of s.investments) {
      if (inv.weekly) inv.value *= 1 + inv.weekly;
      if (inv.weeklyFlat) s.money += inv.weeklyFlat;
    }
    if (s.pr) s.followers = Math.round(s.followers * 1.03);
  }

  // ---- training
  train() {
    const s = this.s, P = s.player;
    s.trainedOn = s.trainedOn || {};
    s.trainedOn[s.date] = true;
    const ageF = P.age < 21 ? 1.25 : P.age < 25 ? 1 : P.age < 29 ? 0.6 : 0.3;
    const grade = rnd();
    const g = grade > 0.82 ? 'A' : grade > 0.4 ? 'B' : 'C';
    const n = g === 'A' ? 3 : g === 'B' ? 2 : 1;
    const gains = {};
    const keys = STAT_KEYS.slice().sort(() => rnd() - 0.5).slice(0, n);
    for (const k of keys) {
      const cap = 95;
      if (P.stats[k] < cap && rnd() < 0.55 * ageF + 0.25) { const v = rnd() < 0.2 * ageF ? 2 : 1; P.stats[k] = Math.min(cap, P.stats[k] + v); gains[k] = v; }
    }
    if (g === 'A' && rnd() < 0.4) this.message('coach', 'Standout training session', `Excellent work out there today. Keep that intensity and you'll keep your place.`);
    if (g === 'C' && rnd() < 0.3) this.message('coach', 'Training', `Below par today. Sharpen up before the weekend.`);
    this.emit();
    return { grade: g, gains, overall: overallOf(P.stats) };
  }

  // ---- matches
  opponentFor(fx) { return club(fx.oppId); }

  _wageFor(c, ovr) {
    const base = c.level === 1 ? 18000 : c.level === 2 ? 5000 : 1500;
    return Math.round((base * (0.6 + c.rating / 100) * (0.7 + ovr / 100)) / 100) * 100;
  }

  /** Quick-sim your own match (no gameplay). */
  simMatch(fx) {
    const P = this.s.player, me = club(this.s.clubId), opp = club(fx.oppId);
    const ovr = overallOf(P.stats);
    const rating = clamp(6.4 + (ovr - me.rating) / 25 + gauss() * 0.75, 4.5, 9.8);
    const goals = Math.max(0, Math.round((rating - 6.2) * 0.9 + gauss() * 0.7));
    const [gf, ga] = this._score(me, opp, fx.home, goals);
    return { gf: Math.max(gf, goals), ga, rating: +rating.toFixed(1), goals, assists: rnd() < 0.25 ? 1 : 0, played: false };
  }

  _score(a, b, aHome, minGoalsA = 0) {
    const d = (a.rating - b.rating) / 12 + (aHome ? 0.25 : -0.1);
    const la = clamp(1.3 + d * 0.6, 0.25, 3.5), lb = clamp(1.3 - d * 0.6, 0.25, 3.5);
    const pois = (l) => { let k = 0, p = 1; const L = Math.exp(-l); do { k++; p *= rnd(); } while (p > L); return k - 1; };
    return [Math.max(minGoalsA, pois(la)), pois(lb)];
  }

  /** Record your match (played or simmed) and the rest of the matchday. */
  recordMatch(fx, r) {
    const s = this.s, S = s.season;
    const meHome = fx.home;
    const hg = meHome ? r.gf : r.ga, ag = meHome ? r.ga : r.gf;
    this._applyResult(fx.homeId, fx.awayId, hg, ag);
    // the rest of the league
    for (const [h, a] of S.rounds[S.md]) {
      if (h === fx.homeId) continue;
      const [x, y] = this._score(club(h), club(a), true);
      this._applyResult(h, a, x, y);
    }
    S.apps++; S.goals += r.goals; S.assists += r.assists || 0; S.ratings.push(r.rating);
    if (r.rating >= 8) S.motm++;
    s.form.push(r.rating); if (s.form.length > 8) s.form.shift();
    S.results.push({ md: S.md, opp: fx.oppId, home: meHome, gf: r.gf, ga: r.ga, rating: r.rating, goals: r.goals });
    // growth from playing
    if (r.rating >= 7.5) { const k = pick(STAT_KEYS); s.player.stats[k] = Math.min(95, s.player.stats[k] + 1); }
    // followers
    const lvlMul = [0, 3, 1.6, 1][club(s.clubId).level];
    s.followers += Math.round((40 + r.goals * 220 + Math.max(0, r.rating - 6) * 260) * lvlMul);
    S.md++;
    this._postMatchMessages(fx, r);
    if (S.md >= S.rounds.length) { s.seasonOver = true; this._seasonEndOffers(); }
    this.emit();
  }

  _applyResult(h, a, hg, ag) {
    const T = this.s.season.table, H = T[h], A = T[a];
    H.p++; A.p++; H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
    if (hg > ag) { H.w++; A.l++; H.pts += 3; } else if (hg < ag) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  }

  table() {
    const T = this.s.season.table;
    return Object.entries(T).map(([id, r]) => ({ id, ...r, gd: r.gf - r.ga }))
      .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
  }
  position() { return this.table().findIndex((r) => r.id === this.s.clubId) + 1; }

  _postMatchMessages(fx, r) {
    const s = this.s, opp = club(fx.oppId);
    const res = r.gf > r.ga ? 'win' : r.gf < r.ga ? 'loss' : 'draw';
    // a social media prompt after every match
    s.tasks.push({
      id: s.msgId++, kind: 'social', title: r.rating >= 7.3 ? 'Great performance — post about it?' : r.rating <= 5.9 ? 'Tough day — say something to the fans?' : 'Post about the match?',
      sub: `${res === 'win' ? 'Won' : res === 'loss' ? 'Lost' : 'Drew'} ${r.gf}–${r.ga} vs ${opp.name} · rating ${r.rating}`,
      ctx: { res, rating: r.rating, goals: r.goals },
    });
    if (r.rating >= 7.8) this.message('coach', 'Superb', `That was a top performance against ${opp.name}. The whole dressing room noticed.`);
    else if (r.rating <= 5.6) this.message('coach', 'We need more', `Not your day against ${opp.name}. I need more from you next week.`);
    // sponsors notice consistent form
    const good = s.form.filter((x) => x >= 7.0).length;
    const chance = good >= 3 ? 0.18 + AGENT_TIERS[s.agentTier].sponsor + Math.min(0.2, s.followers / 2e6) : 0;
    if (rnd() < chance) this._sponsorOffer();
  }

  _sponsorOffer() {
    const s = this.s;
    const brand = pick(SPONSORS);
    const base = Math.round((300 + s.followers * 0.02) * (1 + s.agentTier * 0.5) / 50) * 50;
    const weeks = pick([8, 12, 20]);
    this.message('sponsor', `${brand} want you`, `${brand} would like you as a brand ambassador: ${fmtMoney(base)} a week for ${weeks} weeks. Accept?`,
      [{ label: 'Accept', act: 'sponsor', brand, weekly: base, weeks }, { label: 'Decline', act: 'none' }]);
  }

  _agentUpdate() {
    const s = this.s;
    const avg = s.form.length ? s.form.reduce((a, b) => a + b, 0) / s.form.length : 0;
    const c = club(s.clubId);
    if (avg >= 7.1 && c.level > 1) {
      const better = this._findClubs(c.level - 1, 1)[0];
      this.message('agent', 'Interest in you', `Your form is getting noticed. ${club(better).name} (${league(club(better).league).name}) have been asking about you. I'll push for offers at the end of the season.`);
    } else if (avg && avg < 6.2) {
      this.message('agent', 'Quiet market', `Clubs are watching, but you need better performances before I can get you a move. Focus on the next few games.`);
    } else {
      this.message('agent', 'Market update', `Things are ticking along. Keep hitting your objectives — that's what earns a better contract.`);
    }
  }

  _intlBreak() {
    const s = this.s, n = nation(s.player.nationality);
    const objs = this.nationObjectives();
    if (!s.country.calledUp) {
      if (objs.every((o) => o.ok)) {
        s.country.calledUp = true;
        this.message('country', `Called up by ${n.name}!`, `You've been named in the ${n.name} squad for the upcoming internationals. Congratulations!`);
        s.followers = Math.round(s.followers * 1.15);
      }
    } else {
      const ok = objs.every((o) => o.ok);
      if (!ok) {
        s.country.calledUp = false;
        this.message('country', `Left out of the ${n.name} squad`, `Your club form has dropped, so you weren't picked this time. Get back on track to earn a recall.`);
        return;
      }
      const caps = 1 + (rnd() < 0.6 ? 1 : 0);
      const goals = rnd() < 0.35 ? 1 : 0;
      s.country.caps += caps; s.country.goals += goals;
      this.message('country', `${n.name} duty`, `You won ${caps} cap${caps > 1 ? 's' : ''}${goals ? ' and scored!' : '.'} Total: ${s.country.caps} caps, ${s.country.goals} goals.`);
    }
  }

  // ---- messages & tasks
  message(from, subject, body, actions = null) {
    const s = this.s;
    s.messages.unshift({ id: s.msgId++, from, subject, body, actions, read: false, date: s.date, done: false });
    if (s.messages.length > 60) s.messages.length = 60;
  }
  unread() { return this.s.messages.filter((m) => !m.read).length; }

  act(msgId, i) {
    const s = this.s, m = s.messages.find((x) => x.id === msgId);
    if (!m || m.done) return;
    const a = m.actions[i];
    m.done = true; m.read = true; m.choice = a.label;
    if (a.act === 'sponsor') {
      s.sponsors = s.sponsors || [];
      s.sponsors.push({ brand: a.brand, weekly: a.weekly, weeks: a.weeks });
      s.followers = Math.round(s.followers * 1.04);
    }
    this.emit();
  }

  socialPost(taskId, choice) {
    const s = this.s, t = s.tasks.find((x) => x.id === taskId);
    if (!t) return 0;
    s.tasks = s.tasks.filter((x) => x !== t);
    const base = Math.max(60, s.followers * 0.012);
    const mult = { celebrate: t.ctx.res === 'win' ? 2.2 : 0.6, fans: 1.3, focus: 1.0, hype: t.ctx.rating >= 7 ? 1.7 : 0.8, none: 0 }[choice] ?? 1;
    const gain = Math.round(base * mult * (1 + t.ctx.goals * 0.5));
    s.followers += gain;
    this.emit();
    return gain;
  }

  // ---- shop
  buy(item) {
    const s = this.s;
    if (item.kind === 'agent') {
      const next = AGENT_TIERS[s.agentTier + 1];
      if (!next || s.money < next.cost) return false;
      s.money -= next.cost; s.agentTier++;
      this.message('agent', `${next.name} signed`, `You've upgraded to ${next.name}. Expect better offers and more sponsor interest.`);
    } else {
      if (s.money < item.cost) return false;
      if (item.kind === 'once') { if (s[item.flag]) return false; s[item.flag] = true; }
      s.money -= item.cost;
      if (item.followers) s.followers += item.followers;
      if (item.followersPct) s.followers = Math.round(s.followers * (1 + item.followersPct));
      if (item.kind === 'invest') s.investments.push({ id: item.id, title: item.title, value: item.cost, cost: item.cost, weekly: item.weekly || 0, weeklyFlat: item.weeklyFlat || 0, risk: item.risk });
    }
    this.emit();
    return true;
  }
  cashOut(i) {
    const s = this.s, inv = s.investments[i];
    if (!inv || inv.risk) return;
    s.money += Math.round(inv.value * (inv.weeklyFlat ? 0.85 : 1));
    s.investments.splice(i, 1);
    this.emit();
  }

  // ---- season end & transfers
  _findClubs(level, n, exclude = []) {
    const W = world();
    const pool = Object.values(W.clubs).filter((c) => c.level === level && !exclude.includes(c.id));
    return pool.sort(() => rnd() - 0.5).slice(0, n).map((c) => c.id);
  }

  _seasonEndOffers() {
    const s = this.s, c = club(s.clubId);
    const avg = this._avg(), ovr = overallOf(s.player.stats);
    const offers = [];
    const n = clamp(1 + s.agentTier + (avg >= 7 ? 1 : 0), 1, 4);
    for (let i = 0; i < n; i++) {
      let lv = c.level;
      const up = avg >= 7.2 || (avg >= 6.8 && s.agentTier >= 2) || (s.agentTier >= 3 && avg >= 6.5);
      if (up && rnd() < 0.55 + s.agentTier * 0.12) lv = Math.max(1, c.level - 1);
      else if (avg < 6.2 && rnd() < 0.5) lv = Math.min(3, c.level + 1);
      const [id] = this._findClubs(lv, 1, [s.clubId, ...offers.map((o) => o.clubId)]);
      offers.push({ clubId: id, wage: this._wageFor(club(id), ovr) });
    }
    s.offersPending = offers;
    this.message('agent', 'End of season — offers are in', `The season's over. I've got ${offers.length} offer${offers.length > 1 ? 's' : ''} on the table. Check the season review to decide your future.`);
  }

  /** Choose next season: stay (only if objectives done) or take an offer. */
  chooseNextSeason(offer) {
    const s = this.s, S = s.season, c = club(s.clubId);
    s.history.push({ season: `${s.year}/${String(s.year + 1).slice(2)}`, club: c.name, league: league(c.league).name, apps: S.apps, goals: S.goals, avg: +this._avg().toFixed(2), pos: this.position() });
    // start-up investments resolve
    for (const inv of s.investments) if (inv.risk) inv.value = Math.round(inv.cost * [0, 0, 0.5, 1, 1.5, 2, 4][Math.floor(rnd() * 7)]);
    const old = s.clubId;
    if (offer) { s.clubId = offer.clubId; s.wage = offer.wage; } else { s.wage = Math.round(s.wage * 1.25 / 100) * 100; }
    s.year++; s.seasonNo++; s.player.age++;
    // ageing: young players grow a bit over the summer
    if (s.player.age <= 24) for (const k of STAT_KEYS) if (rnd() < 0.35) s.player.stats[k] = Math.min(95, s.player.stats[k] + 1);
    s.date = Date.UTC(s.year, 6, 27);
    s.offersPending = null;
    this._newSeason();
    const nc = club(s.clubId);
    this.message('club', offer && old !== s.clubId ? `Welcome to ${nc.name}` : 'New contract signed', offer && old !== s.clubId
      ? `You've joined ${nc.name} in ${league(nc.league).name}. New season, new objectives — check the Club tab.`
      : `The club are delighted you're staying. New contract: ${fmtMoney(s.wage)} a week.`);
    this.emit();
  }
}
