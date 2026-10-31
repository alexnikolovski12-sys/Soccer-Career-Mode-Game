// Ultimate Team player database: the real squads of the top-flight clubs
// (realdb.js). Each card gets FC-style face stats around its rating, a rarity
// and a generated look (skin tone from the data, hair / face / height made up,
// seeded by the player's name) so he's the same man on the pitch every time.
import { makeRng } from '../core/MathUtil.js';
import { world, LEAGUE_COUNTRIES } from './world.js';
import { cardDB as legacyDB } from './legacy/cards.js';

const DARK = new Set(['SEN', 'NGA', 'GHA', 'CIV', 'CMR', 'MLI', 'COD', 'GUI', 'BFA', 'GAB', 'JAM']);
const MIXED = new Set(['BRA', 'FRA', 'ENG', 'NED', 'BEL', 'POR', 'USA', 'COL', 'MAR', 'CAN']);
const ASIAN = new Set(['JPN', 'KOR']);
const nameSeed = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };
const TALL = { GK: [1.86, 1.99], CB: [1.83, 1.96], ST: [1.76, 1.94], CDM: [1.76, 1.9] };

const SKINS_LIGHT = ['#f6d7bd', '#f1c9a5', '#e0ac82', '#d49a6e'];
const SKINS_MID = ['#c68a5e', '#a86b43', '#b07850'];
const SKINS_DARK = ['#8b5634', '#6e4026', '#5a3420', '#4f2c18'];
const HAIR_COL = ['#0e0e0e', '#1a1310', '#2a1c14', '#4a3020', '#7a5a2e', '#b07a3a', '#c9a35a', '#e4cf8f', '#9a3b1c'];

export const POS_GROUP = { GK: 'GK', LB: 'DEF', RB: 'DEF', CB: 'DEF', LWB: 'DEF', RWB: 'DEF', CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID', LW: 'ATT', RW: 'ATT', ST: 'ATT', CF: 'ATT' };

/** Face stats from an overall + position profile. */
function faceStats(rng, pos, ovr) {
  const P = {
    GK: null,
    CB: [-12, -30, -12, -14, 4, 6], LB: [2, -24, -6, -6, 0, -6], RB: [2, -24, -6, -6, 0, -6],
    CDM: [-10, -16, -2, -6, 2, 4], CM: [-6, -8, 2, -1, -12, -4], CAM: [-2, -2, 2, 4, -34, -14],
    LM: [6, -8, -2, 2, -32, -14], RM: [6, -8, -2, 2, -32, -14], LW: [8, -2, -6, 4, -40, -16], RW: [8, -2, -6, 4, -40, -16],
    ST: [4, 4, -12, -2, -44, -2], CF: [2, 2, -6, 2, -42, -8],
  }[pos];
  const j = () => Math.round(rng.range(-5, 5));
  if (!P) {
    // keepers: DIV HAN KIC REF SPD POS
    return { div: ovr + j(), han: ovr - 2 + j(), kic: ovr - 10 + j(), ref: ovr + 1 + j(), spd: ovr - 25 + j(), pos: ovr - 1 + j() };
  }
  const v = P.map((d) => Math.max(25, Math.min(97, ovr + d + j())));
  return { pac: v[0], sho: v[1], pas: v[2], dri: v[3], def: v[4], phy: v[5] };
}

/** Card face stats → the match engine's stat set. */
export function engineStats(c, chem = 1.5) {
  const b = Math.round((chem - 1.5) * 2);           // chemistry: −3 … +3
  const k = (v) => Math.max(25, Math.min(99, v + b));
  const s = c.stats;
  if (c.pos === 'GK') {
    return { pace: k(s.spd), acceleration: k(s.spd), dribbling: k(40), ballControl: k(45), passing: k(s.kic), vision: k(s.kic - 5),
      finishing: k(30), shotPower: k(s.kic), composure: k(s.pos), stamina: k(60), defending: k(50), diving: k(s.div), reflexes: k(s.ref) };
  }
  return {
    pace: k(s.pac), acceleration: k(s.pac + (s.dri > 80 ? 2 : -2)), dribbling: k(s.dri), ballControl: k(s.dri - 1),
    passing: k(s.pas), vision: k(s.pas + 1), finishing: k(s.sho), shotPower: k(s.sho + 2),
    composure: k(Math.round((s.sho + s.pas + s.dri) / 3)), stamina: k(s.phy), defending: k(s.def), strength: k(s.phy),
  };
}

let DB = null;

function makeLook(rng, nat, real = null) {
  const dark = real ? real.dark || (DARK.has(nat) && !real.mid) : DARK.has(nat) || (MIXED.has(nat) && rng.chance(0.35));
  const asian = ASIAN.has(nat);
  const mid = real ? !dark && real.mid : !dark && (MIXED.has(nat) && rng.chance(0.3));
  const skin = dark ? rng.pick(SKINS_DARK) : mid ? rng.pick(SKINS_MID) : asian ? rng.pick(['#f1c9a5', '#e8bd92', '#e0ac82']) : rng.pick(SKINS_LIGHT);
  const hairColour = dark || asian ? rng.pick(['#0e0e0e', '#1a1310', '#0e0e0e']) : rng.pick(HAIR_COL);
  const styles = dark ? ['buzz', 'buzz', 'fade', 'afro', 'curly', 'crop', 'bald', 'mohawk'] : ['short', 'short', 'crop', 'fade', 'quiff', 'buzz', 'curly', 'receding', 'long', 'mohawk', 'bald'];
  const r = rng.next();
  const facial = r < 0.48 ? 'none' : r < 0.72 ? 'stubble' : r < 0.87 ? 'beard' : r < 0.95 ? 'goatee' : 'moustache';
  const face = {
    african: dark ? 0.6 + rng.next() * 0.4 : mid ? 0.25 + rng.next() * 0.3 : 0,
    asian: asian ? 0.6 + rng.next() * 0.4 : 0,
    muscle: rng.next() * 0.8, slim: rng.next() * 0.6,
    headSquare: rng.next() * 1.1 - 0.3, headRound: rng.next() * 0.6, headFat: rng.next() * 0.35,
    noseWide: rng.chance(0.5) ? rng.next() * 0.9 : 0, noseNarrow: rng.chance(0.4) ? rng.next() * 0.8 : 0,
    noseLong: rng.next() * 0.8 - 0.2, chinStrong: rng.next() * 1.1 - 0.2, chinNarrow: rng.next() * 0.6,
    lips: rng.next() * (dark ? 1 : 0.6), cheeks: rng.next() * 0.8, browLow: rng.next() * 0.8,
  };
  return {
    skin, hairColour, hairStyle: rng.pick(styles), facial, face,
    eyeColour: dark || asian ? '#2a1a10' : rng.pick(['#4a2e1a', '#3a2a1a', '#3b5a7a', '#4f6a3a', '#2a1a10']),
    height: +(rng.range(...(real && TALL[real.pos] || [1.7, 1.88]))).toFixed(2),
    boots: rng.pick(['#111111', '#f2f2f2', '#e8402a', '#1d6ff2', '#f2c21b', '#24d07a', '#ff4fa3', '#7a3cff', '#ff8a1a']),
    sleeves: rng.chance(0.18) ? 'long' : 'short',
  };
}

/** The whole player database (built once). */
export function cardDB() {
  if (DB) return DB;
  const W = world();
  const cards = {};
  const list = [];
  let n = 0;
  for (const c of LEAGUE_COUNTRIES) {
    const L = W.leagues[`${c.id}1`];
    for (const clubId of L.clubs) {
      const club = W.clubs[clubId];
      for (const p of club.squad) {
        const rng = makeRng(nameSeed(p.first + ' ' + p.last));
        const id = `r${n}`;
        const stats = faceStats(rng, p.pos, p.ovr);
        // pace from what's known of the man: rapid, ordinary or not quick
        if (stats.pac) {
          if (p.fast) stats.pac = Math.min(97, Math.max(stats.pac, p.ovr + 6, 89 + rng.int(0, 4)));
          else if (p.slow) stats.pac = Math.min(stats.pac, 58 + rng.int(0, 12));
          else stats.pac = Math.min(stats.pac, 79 + rng.int(0, 9));
        }
        const name = p.first ? `${p.first[0]}. ${p.last}` : p.last;
        const card = {
          id, first: p.first, last: p.last, name, short: p.last.toUpperCase(),
          nation: p.nation, club: clubId, league: L.id, pos: p.pos, ovr: p.ovr,
          rare: p.ovr >= 84 || rng.chance(p.ovr >= 75 ? 0.45 : 0.3),
          stats, look: makeLook(rng, p.nation, p), foot: p.left ? 'L' : 'R',
        };
        cards[id] = card;
        list.push(card);
        n++;
      }
    }
  }
  DB = { cards, list };
  return DB;
}

/** A save made before the real squads: map an old card id to a real player in the same position with a similar rating. */
export function migrateCard(oldId, taken) {
  const db = cardDB();
  if (db.cards[oldId]) return oldId;
  const old = legacyDB().cards[oldId];
  const pos = old ? old.pos : 'CM', ovr = old ? old.ovr : 70;
  const near = (c) => Math.abs(c.ovr - ovr) + (c.pos === pos ? 0 : posFit(c.pos, pos) ? 3 : 12) + (taken.has(c.id) ? 6 : 0);
  let best = db.list[0], bd = 1e9;
  for (const c of db.list) { const d = near(c); if (d < bd) { bd = d; best = c; } }
  taken.add(best.id);
  return best.id;
}

export const card = (id) => cardDB().cards[id];
export const legacyCard = (id) => legacyDB().cards[id];
export const tierOf = (c) => (c.ovr >= 75 ? 'gold' : c.ovr >= 65 ? 'silver' : 'bronze');

/** Quick-sell value. */
export function quickSell(c) {
  const t = tierOf(c);
  const base = t === 'gold' ? 300 + (c.ovr - 75) * 90 : t === 'silver' ? 120 + (c.ovr - 65) * 18 : 40 + (c.ovr - 48) * 5;
  return Math.round(base * (c.rare ? 1.3 : 1) / 10) * 10;
}

/** Market price. */
export function marketPrice(c) {
  const o = c.ovr;
  let p;
  if (o < 65) p = 150 + (o - 48) * 20;
  else if (o < 75) p = 400 + (o - 65) * 60;
  else p = Math.round(900 * Math.pow(1.32, o - 75));
  if (c.rare) p *= 1.35;
  const r = p < 1000 ? 50 : p < 10000 ? 100 : 1000;
  return Math.max(150, Math.round(p / r) * r);
}

/** Position compatibility for chemistry (exact = full, close = ok, else out of position). */
const CLOSE = {
  GK: [], CB: [], LB: ['LWB'], RB: ['RWB'], LWB: ['LB', 'LM'], RWB: ['RB', 'RM'],
  CDM: ['CM'], CM: ['CDM', 'CAM'], CAM: ['CM', 'CF'], LM: ['LW', 'LWB'], RM: ['RW', 'RWB'],
  LW: ['LM', 'LF'], RW: ['RM', 'RF'], ST: ['CF'], CF: ['ST', 'CAM'],
};
export function posFit(cardPos, slotPos) {
  if (cardPos === slotPos) return 2;
  return (CLOSE[slotPos] || []).includes(cardPos) ? 1 : 0;
}

/**
 * Chemistry (FC-style): each player 0–3 from how many of the XI share his club,
 * league and nation; nobody gets chemistry out of position.
 */
export function chemistry(xi, slots) {
  const cnt = (key) => { const m = {}; for (const c of xi) if (c) m[c[key]] = (m[c[key]] || 0) + 1; return m; };
  const clubs = cnt('club'), leagues = cnt('league'), nats = cnt('nation');
  const step = (n, a, b, c) => (n >= c ? 3 : n >= b ? 2 : n >= a ? 1 : 0);
  const per = xi.map((c, i) => {
    if (!c) return 0;
    if (posFit(c.pos, slots[i]) === 0) return 0;
    const p = step(clubs[c.club], 2, 4, 7) + step(leagues[c.league], 3, 5, 8) + step(nats[c.nation], 2, 5, 8);
    return Math.min(3, p);
  });
  return { per, total: per.reduce((a, b) => a + b, 0) };
}

/** Squad rating (FC-style: average, nudged up by the players above it). */
export function squadRating(xi) {
  const r = xi.filter(Boolean).map((c) => c.ovr);
  if (!r.length) return 0;
  const avg = r.reduce((a, b) => a + b, 0) / 11;
  const extra = r.reduce((a, v) => a + Math.max(0, v - avg), 0) / 11;
  return Math.round(avg + extra);
}
