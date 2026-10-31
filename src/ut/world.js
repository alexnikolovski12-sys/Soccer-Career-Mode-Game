// Ultimate Team world: countries and leagues. The top flights are real clubs
// with their real squads (realdb.js); the lower divisions are invented.
// Everything is generated from fixed seeds, so the same world comes back on
// every device and every load.
import { makeRng } from '../core/MathUtil.js';
import { REAL_CLUBS, parseSquad } from './realdb.js';

export const CLUBS_PER_LEAGUE = 16;
/** Top-flight names (all invented). */
export const LEAGUE_NAMES = { ENG: 'Albion Premier', ESP: 'Primera Sol', GER: 'Meisterliga', ITA: 'Serie Oro', FRA: 'Ligue Étoile', POR: 'Liga Atlântica', NED: 'Lage Landen Divisie' };

/** Countries with leagues (Europe). flavour = how club names are built. */
export const LEAGUE_COUNTRIES = [
  { id: 'ENG', name: 'England', strength: 1.0, flavour: 'en' },
  { id: 'ESP', name: 'Spain', strength: 0.98, flavour: 'es' },
  { id: 'GER', name: 'Germany', strength: 0.95, flavour: 'de' },
  { id: 'ITA', name: 'Italy', strength: 0.94, flavour: 'it' },
  { id: 'FRA', name: 'France', strength: 0.92, flavour: 'fr' },
  { id: 'POR', name: 'Portugal', strength: 0.86, flavour: 'pt' },
  { id: 'NED', name: 'Netherlands', strength: 0.85, flavour: 'nl' },
];

/** Nationalities you can pick (any of these can earn a national call-up). */
export const NATIONS = [
  ...LEAGUE_COUNTRIES.map((c) => ({ id: c.id, name: c.name, tier: c.strength > 0.93 ? 1 : 2 })),
  { id: 'SCO', name: 'Scotland', tier: 3 }, { id: 'BEL', name: 'Belgium', tier: 2 },
  { id: 'CRO', name: 'Croatia', tier: 2 }, { id: 'IRL', name: 'Ireland', tier: 3 },
  { id: 'BRA', name: 'Brazil', tier: 1 }, { id: 'ARG', name: 'Argentina', tier: 1 },
  { id: 'URU', name: 'Uruguay', tier: 2 }, { id: 'COL', name: 'Colombia', tier: 2 },
  { id: 'USA', name: 'USA', tier: 3 }, { id: 'MEX', name: 'Mexico', tier: 3 },
  { id: 'AUS', name: 'Australia', tier: 3 }, { id: 'JPN', name: 'Japan', tier: 3 },
  { id: 'KOR', name: 'South Korea', tier: 3 }, { id: 'MAR', name: 'Morocco', tier: 2 },
  { id: 'SEN', name: 'Senegal', tier: 2 }, { id: 'NGA', name: 'Nigeria', tier: 2 },
  { id: 'GHA', name: 'Ghana', tier: 3 }, { id: 'CIV', name: "Côte d'Ivoire", tier: 2 },
  { id: 'CAN', name: 'Canada', tier: 3 }, { id: 'POL', name: 'Poland', tier: 3 },
  { id: 'SUI', name: 'Switzerland', tier: 3 }, { id: 'DEN', name: 'Denmark', tier: 2 },
  { id: 'NOR', name: 'Norway', tier: 2 }, { id: 'SWE', name: 'Sweden', tier: 2 }, { id: 'ECU', name: 'Ecuador', tier: 2 },
  { id: 'HUN', name: 'Hungary', tier: 3 }, { id: 'GEO', name: 'Georgia', tier: 3 }, { id: 'UKR', name: 'Ukraine', tier: 2 },
  { id: 'EGY', name: 'Egypt', tier: 2 }, { id: 'ALG', name: 'Algeria', tier: 2 }, { id: 'TUR', name: 'Türkiye', tier: 2 },
  { id: 'CMR', name: 'Cameroon', tier: 2 }, { id: 'SVN', name: 'Slovenia', tier: 3 }, { id: 'MLI', name: 'Mali', tier: 3 },
  { id: 'WAL', name: 'Wales', tier: 3 }, { id: 'AUT', name: 'Austria', tier: 2 }, { id: 'COD', name: 'DR Congo', tier: 3 },
  { id: 'JAM', name: 'Jamaica', tier: 3 }, { id: 'SVK', name: 'Slovakia', tier: 3 }, { id: 'CZE', name: 'Czechia', tier: 3 },
  { id: 'GUI', name: 'Guinea', tier: 3 }, { id: 'BFA', name: 'Burkina Faso', tier: 3 }, { id: 'TUN', name: 'Tunisia', tier: 3 },
  { id: 'ARM', name: 'Armenia', tier: 3 }, { id: 'SRB', name: 'Serbia', tier: 2 }, { id: 'KOS', name: 'Kosovo', tier: 3 },
  { id: 'ALB', name: 'Albania', tier: 3 }, { id: 'BIH', name: 'Bosnia and Herzegovina', tier: 3 }, { id: 'MNE', name: 'Montenegro', tier: 3 },
  { id: 'GAB', name: 'Gabon', tier: 3 }, { id: 'FIN', name: 'Finland', tier: 3 }, { id: 'GRE', name: 'Greece', tier: 3 },
  { id: 'ROU', name: 'Romania', tier: 3 }, { id: 'ISR', name: 'Israel', tier: 3 }, { id: 'ISL', name: 'Iceland', tier: 3 },
  { id: 'VEN', name: 'Venezuela', tier: 3 }, { id: 'PAN', name: 'Panama', tier: 3 }, { id: 'RUS', name: 'Russia', tier: 3 },
];

// ---------------------------------------------------------------- names (all invented)
const NAME_PARTS = {
  en: {
    roots: ['Ash', 'Brook', 'Kings', 'Mill', 'Wex', 'Haver', 'Crest', 'Oak', 'Thorn', 'Ember', 'Silver', 'Hollow', 'Glen', 'Marsh', 'Stone', 'Wold', 'Fen', 'Rook', 'Harrow', 'Cinder', 'Bram', 'Lark', 'Cole', 'Wynd'],
    ends: ['ford', 'ton', 'bury', 'ley', 'mouth', 'field', 'wick', 'dale', 'stead', 'port', 'gate', 'by', 'ham', 'mere', 'combe'],
    style: (t, r) => `${t} ${r.pick(['United', 'City', 'Town', 'Rovers', 'Athletic', 'Wanderers', 'County', 'Rangers', 'Borough', 'Vale'])}`,
  },
  es: {
    roots: ['Villa', 'Monte', 'Río', 'Costa', 'Torre', 'Sierra', 'Campo', 'Puerto', 'Vega', 'Alba', 'Cruz', 'Llano', 'Peña', 'Lomas', 'Ribera', 'Arroyo'],
    ends: ['verde', 'alto', 'rojo', 'blanca', 'dorada', 'nueva', 'clara', 'mayor', 'del Sol', 'serena', 'brava', 'linda'],
    join: (a, b) => (b.startsWith('del') ? `${a} ${b}` : `${a}${b}`),
    style: (t, r) => `${r.pick(['CD', 'UD', 'Racing', 'Deportivo', 'SD', 'CF', 'Unión', 'Atlético'])} ${t}`,
  },
  de: {
    roots: ['Ober', 'Unter', 'Neu', 'Alt', 'Grün', 'Stein', 'Wald', 'Berg', 'Eich', 'Linden', 'Hohen', 'Rosen', 'Falken', 'Kirch', 'Sonnen', 'Fels'],
    ends: ['dorf', 'hausen', 'berg', 'feld', 'stadt', 'bach', 'heim', 'burg', 'au', 'tal', 'brück'],
    style: (t, r) => `${r.pick(['FC', 'SV', 'TSV', 'VfL', 'SC', 'FSV', 'SpVgg', 'TuS'])} ${t}`,
  },
  it: {
    roots: ['Monte', 'Castel', 'Porto', 'Villa', 'Borgo', 'Valle', 'Rocca', 'Fiume', 'Colle', 'Torre', 'Pietra', 'Lago'],
    ends: ['ricco', 'nuovo', 'verde', 'alto', 'sereno', 'fiore', 'luna', 'mare', 'bello', 'chiaro', 'forte'],
    style: (t, r) => `${r.pick(['AC', 'US', 'SS', 'AS', 'Virtus', 'FC', 'Calcio'])} ${t}`,
  },
  fr: {
    roots: ['Mont', 'Beau', 'Val', 'Belle', 'Port', 'Ville', 'Clair', 'Roche', 'Fontaine', 'Pierre', 'Chêne', 'Saint-Aubry'],
    ends: ['mont', 'lieu', 'fort', 'rive', 'champ', 'lac', 'val', 'pré', 'vigne', 'bois', 'sur-Mer'],
    join: (a, b) => (a.endsWith('-Aubry') ? `${a}-${b}` : `${a}${b}`),
    style: (t, r) => `${r.pick(['FC', 'AS', 'Stade', 'US', 'SC', 'RC', 'ES'])} ${t}`,
  },
  pt: {
    roots: ['Vila', 'Porto', 'Santa', 'Rio', 'Monte', 'Torre', 'Serra', 'Costa', 'Ponte', 'Praia', 'Quinta'],
    ends: [' Nova', ' Verde', ' Alta', ' do Mar', ' Branca', ' do Sol', ' Formosa', ' Clara', ' Velha'],
    join: (a, b) => `${a}${b}`,
    style: (t, r) => `${r.pick(['SC', 'FC', 'CD', 'GD', 'União', 'Clube'])} ${t}`,
  },
  nl: {
    roots: ['Wester', 'Ooster', 'Noord', 'Zuid', 'Hoog', 'Lange', 'Grote', 'Zand', 'Berg', 'Water', 'Linde', 'Molen'],
    ends: ['dam', 'veen', 'broek', 'hoven', 'dijk', 'horst', 'wijk', 'stad', 'meer', 'land'],
    style: (t, r) => `${r.pick(['FC', 'SC', 'VV', 'SV', 'VVV', 'RKC'])} ${t}`,
  },
};

// ---------------------------------------------------------------- kits (original designs)
export const KIT_COLOURS = [
  ['#f2f4f8', 'white'], ['#14161c', 'black'], ['#c8283a', 'red'], ['#7a1426', 'maroon'], ['#1d4fd6', 'blue'],
  ['#0d1f4a', 'navy'], ['#5fb6f2', 'sky'], ['#1e8a43', 'green'], ['#0f4d2e', 'forest'], ['#f2c21b', 'yellow'],
  ['#f07a12', 'orange'], ['#6a2bb8', 'purple'], ['#e05aa0', 'pink'], ['#8a8f99', 'grey'], ['#b8925a', 'gold'], ['#16a3a3', 'teal'],
];
export const KIT_PATTERNS = ['plain', 'stripes', 'hoops', 'halves', 'sash', 'chevron', 'pinstripes', 'band', 'sleeves', 'quarters'];

function makeKit(rng, used) {
  for (let i = 0; i < 400; i++) {
    const a = rng.int(0, KIT_COLOURS.length - 1);
    let b = rng.int(0, KIT_COLOURS.length - 1);
    if (b === a) continue;
    const pattern = KIT_PATTERNS[rng.int(0, KIT_PATTERNS.length - 1)];
    const key = `${a}-${b}-${pattern}`;
    if (used.has(key)) continue;
    used.add(key);
    const primary = KIT_COLOURS[a][0], secondary = KIT_COLOURS[b][0];
    const shorts = rng.chance(0.5) ? secondary : primary === '#f2f4f8' ? '#14161c' : '#f2f4f8';
    const socks = rng.chance(0.6) ? primary : secondary;
    return { primary, secondary, pattern, shorts, socks };
  }
  return { primary: '#f2f4f8', secondary: '#14161c', pattern: 'plain', shorts: '#14161c', socks: '#f2f4f8' };
}

function shortName(name) {
  const words = name.replace(/[^A-Za-zÀ-ÿ\s-]/g, '').split(/[\s-]+/).filter((w) => w.length > 2 && !/^(CD|UD|SD|CF|FC|SV|TSV|VfL|SC|FSV|SpVgg|TuS|AC|US|SS|AS|RC|ES|GD|VV|VVV|RKC|del|do|Mar|Sol)$/.test(w));
  const w = words[0] || name;
  return w.slice(0, 3).toUpperCase();
}

let WORLD = null;

/** The whole world of clubs, built once (deterministic). */
export function world() {
  if (WORLD) return WORLD;
  const clubs = {}, leagues = {};
  const used = new Set(), usedNames = new Set();
  LEAGUE_COUNTRIES.forEach((c, ci) => {
    const parts = NAME_PARTS[c.flavour];
    const rng = makeRng(9001 + ci * 131);
    for (let lv = 1; lv <= 3; lv++) {
      const leagueId = `${c.id}${lv}`;
      leagues[leagueId] = { id: leagueId, country: c.id, level: lv, name: lv === 1 ? LEAGUE_NAMES[c.id] : `${c.name} L${lv}`, clubs: [] };
      if (lv === 1) {
        // the top flights are real clubs with their real squads (realdb.js)
        REAL_CLUBS[c.id].forEach(([name, short, k, players], i) => {
          const id = `${leagueId}_${i}`;
          const squad = parseSquad(players);
          const best = squad.map((p) => p.ovr).sort((a, b) => b - a).slice(0, 11);
          const rating = Math.round(best.reduce((a, v) => a + v, 0) / Math.max(1, best.length));
          const kit = { primary: k[0], secondary: k[1], pattern: k[2], shorts: k[3], socks: k[4] };
          clubs[id] = { id, name, short, league: leagueId, country: c.id, level: 1, rating, giant: rating >= 84, kit, squad, real: true };
          leagues[leagueId].clubs.push(id);
          usedNames.add(name);
        });
        continue;
      }
      for (let k = 0; k < CLUBS_PER_LEAGUE; k++) {
        let name;
        for (let tries = 0; tries < 60; tries++) {
          const a = rng.pick(parts.roots), b = rng.pick(parts.ends);
          const town = parts.join ? parts.join(a, b) : `${a}${b}`;
          name = parts.style(town, rng);
          if (!usedNames.has(name)) break;
        }
        usedNames.add(name);
        const id = `${leagueId}_${k}`;
        // strength: the first three in each top flight are the country's giants
        let rating;
        const s = c.strength;
        if (lv === 1) rating = k < 3 ? 82 + rng.int(0, 4) - (k === 2 ? 2 : 0) : 66 + rng.int(0, 11);
        else if (lv === 2) rating = 58 + rng.int(0, 11);
        else rating = 48 + rng.int(0, 12);
        rating = Math.round(rating * (0.9 + 0.1 * s));
        const kit = makeKit(rng, used);
        const club = {
          id, name, short: shortName(name), league: leagueId, country: c.id, level: lv,
          rating, giant: lv === 1 && k < 3, kit,
        };
        clubs[id] = club;
        leagues[leagueId].clubs.push(id);
      }
    }
  });
  // make short codes unique inside each league
  for (const L of Object.values(leagues)) {
    if (L.level === 1) continue;     // real clubs keep their real codes
    const seen = new Set();
    for (const id of L.clubs) {
      const c = clubs[id];
      let s = c.short, n = 1;
      while (seen.has(s)) s = c.short.slice(0, 2) + String.fromCharCode(65 + (n++ % 26));
      c.short = s; seen.add(s);
    }
  }
  WORLD = { clubs, leagues };
  return WORLD;
}

export const club = (id) => world().clubs[id];
export const league = (id) => world().leagues[id];
export const countryOf = (id) => LEAGUE_COUNTRIES.find((c) => c.id === id) || NATIONS.find((n) => n.id === id);
export const nation = (id) => NATIONS.find((n) => n.id === id);

/** Kit as an SVG shirt (for menus). */
export function kitSVG(kit, size = 44) {
  const { primary: p, secondary: s, pattern } = kit;
  const id = `k${Math.random().toString(36).slice(2, 8)}`;
  let fill = '';
  switch (pattern) {
    case 'stripes': fill = [10, 22, 34, 46].map((x) => `<rect x="${x}" y="0" width="6" height="64" fill="${s}"/>`).join(''); break;
    case 'pinstripes': fill = [8, 14, 20, 26, 32, 38, 44, 50].map((x) => `<rect x="${x}" y="0" width="1.4" height="64" fill="${s}"/>`).join(''); break;
    case 'hoops': fill = [16, 28, 40, 52].map((y) => `<rect x="0" y="${y}" width="64" height="6" fill="${s}"/>`).join(''); break;
    case 'halves': fill = `<rect x="32" y="0" width="32" height="64" fill="${s}"/>`; break;
    case 'quarters': fill = `<rect x="32" y="0" width="32" height="32" fill="${s}"/><rect x="0" y="32" width="32" height="32" fill="${s}"/>`; break;
    case 'sash': fill = `<polygon points="6,8 18,8 58,60 46,60" fill="${s}"/>`; break;
    case 'chevron': fill = `<polygon points="10,14 32,30 54,14 54,24 32,40 10,24" fill="${s}"/>`; break;
    case 'centre': fill = `<rect x="24" y="0" width="16" height="64" fill="${s}"/>`; break;
    case 'band': fill = `<rect x="0" y="24" width="64" height="10" fill="${s}"/>`; break;
    case 'sleeves': fill = `<rect x="0" y="0" width="16" height="64" fill="${s}"/><rect x="48" y="0" width="16" height="64" fill="${s}"/>`; break;
    default: fill = '';
  }
  return `<svg class="kit" width="${size}" height="${size}" viewBox="0 0 64 64">
    <defs><clipPath id="${id}"><path d="M20 6 L26 4 Q32 10 38 4 L44 6 L60 16 L54 28 L48 25 L48 60 L16 60 L16 25 L10 28 L4 16 Z"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect width="64" height="64" fill="${p}"/>${fill}</g>
    <path d="M20 6 L26 4 Q32 10 38 4 L44 6 L60 16 L54 28 L48 25 L48 60 L16 60 L16 25 L10 28 L4 16 Z" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="2"/>
  </svg>`;
}

/** Simple club crest (shield in kit colours with the short code). */
export function crestSVG(c, size = 40) {
  const k = c.kit;
  const txt = k.primary === '#f2f4f8' || k.primary === '#f2c21b' ? '#14161c' : '#fff';
  return `<svg class="crest" width="${size}" height="${size}" viewBox="0 0 40 40">
    <path d="M20 2 L36 7 L34 24 Q30 34 20 38 Q10 34 6 24 L4 7 Z" fill="${k.primary}" stroke="${k.secondary}" stroke-width="3"/>
    <text x="20" y="25" text-anchor="middle" font-size="10" font-weight="800" fill="${txt}" font-family="Barlow Condensed, Arial Narrow, sans-serif">${c.short}</text>
  </svg>`;
}

