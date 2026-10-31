// Club kit (menu format) → in-game kit look (shader uniforms), and change-strip logic.
const PATTERN = { plain: 0, stripes: 1, hoops: 2, halves: 3, sash: 4, chevron: 4, pinstripes: 6, band: 2, sleeves: 5, quarters: 3, centre: 7 };

function hash(s) { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

export function kitLook(k, sponsorKey = '') {
  return {
    kitColour: k.primary, kitColour2: k.secondary, accent: k.secondary,
    shortsColour: k.shorts, socksColour: k.socks,
    pattern: PATTERN[k.pattern] ?? 0, sponsor: sponsorKey === null ? -1 : hash(sponsorKey || k.primary + k.secondary) % 8,
  };
}

const rgb = (h) => { const x = parseInt(h.slice(1), 16); return [(x >> 16) & 255, (x >> 8) & 255, x & 255]; };
const dist = (a, b) => { const p = rgb(a), q = rgb(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

/** Away side's kit: their home kit unless it clashes, then a change strip. */
export function awayKit(home, away) {
  if (dist(home.primary, away.primary) > 120 && dist(home.shorts, away.shorts) + dist(home.primary, away.primary) > 150) return away;
  const alt = { primary: away.secondary, secondary: away.primary, pattern: 'plain', shorts: away.primary, socks: away.secondary };
  if (dist(home.primary, alt.primary) > 120) return alt;
  const white = home.primary === '#f2f4f8' || dist(home.primary, '#f2f4f8') < 120;
  return { primary: white ? '#14161c' : '#f2f4f8', secondary: away.primary, pattern: 'plain', shorts: white ? '#14161c' : '#f2f4f8', socks: away.primary };
}

/** A keeper kit that clashes with neither side. */
export function keeperKit(a, b) {
  const opts = ['#2bd47d', '#f2c21b', '#ff7ab6', '#5fb6f2', '#9b5cff', '#ff8a1a'];
  const c = opts.find((o) => dist(o, a.primary) > 110 && dist(o, b.primary) > 110) || '#2bd47d';
  return { kitColour: c, kitColour2: '#16161c', accent: '#16161c', shortsColour: '#16161c', socksColour: c, pattern: 0, sponsor: -1, gloveColour: '#f2f2f2' };
}

/** Two kits too alike to play against each other. */
export function clashes(a, b) { return dist(a.primary, b.primary) < 120 || (dist(a.primary, b.primary) + dist(a.shorts, b.shorts) < 170); }
