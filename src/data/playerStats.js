// The user's footballer + team presets. This is the single data object the
// future player-card / career system will read from and write back to.

export const STAT_KEYS = [
  'pace', 'acceleration', 'dribbling', 'ballControl', 'passing',
  'vision', 'finishing', 'shotPower', 'composure', 'stamina',
];

export const STAT_LABELS = {
  pace: 'PAC', acceleration: 'ACC', dribbling: 'DRI', ballControl: 'CTL', passing: 'PAS',
  vision: 'VIS', finishing: 'FIN', shotPower: 'POW', composure: 'COM', stamina: 'STA',
};

/** The user-controlled career player. `look` is the swappable appearance. */
export const USER_PLAYER = {
  id: 'user',
  name: 'R. Vance',
  shortName: 'VANCE',
  position: 'ST',
  look: {
    kitColour: '#f2f4f8', shortsColour: '#1b2a4a', socksColour: '#f2f4f8',
    skinTone: '#c68a5e', hairColour: '#2a1c14', bootColour: '#111111',
    height: 1.8, number: 9,
  },
  stats: {
    pace: 80, acceleration: 82, dribbling: 76, ballControl: 77, passing: 70,
    vision: 72, finishing: 78, shotPower: 76, composure: 72, stamina: 74,
  },
};

/** Quick presets for feeling the difference in the debug panel. */
export const STAT_PRESETS = {
  'Rated 60': uniformStats(60),
  'Rated 75': uniformStats(75),
  'Rated 90': uniformStats(90),
};

export function uniformStats(v) {
  const s = {};
  for (const k of STAT_KEYS) s[k] = v;
  return s;
}

export const TEAMS = {
  home: {
    name: 'Harbour City', short: 'HBC', rating: 68,
    kit: { kitColour: '#f2f4f8', shortsColour: '#1b2a4a', socksColour: '#f2f4f8', accent: '#2c6cf0' },
  },
  away: {
    name: 'Northgate', short: 'NGT', rating: 66,
    kit: { kitColour: '#c8283a', shortsColour: '#16161c', socksColour: '#c8283a', accent: '#c8283a' },
    keeperKit: { kitColour: '#2bd47d', shortsColour: '#16161c', socksColour: '#2bd47d' },
  },
};

const SKIN_TONES = ['#f1c9a5', '#e0ac82', '#c68a5e', '#a86b43', '#7d4a2b', '#5a3420'];
const HAIR = ['#1a1310', '#2a1c14', '#4a3020', '#7a5a2e', '#c9a35a', '#0e0e0e'];

/** Random appearance for an AI player, using the team kit. */
export function randomLook(rng, kit, number) {
  return {
    kitColour: kit.kitColour, shortsColour: kit.shortsColour, socksColour: kit.socksColour,
    skinTone: rng.pick(SKIN_TONES), hairColour: rng.pick(HAIR), bootColour: '#111111',
    height: rng.range(1.72, 1.92), number,
  };
}

/** AI players get stats from a single overall rating with a little jitter. */
export function statsFromRating(rating, rng) {
  const s = {};
  for (const k of STAT_KEYS) s[k] = Math.round(Math.max(30, Math.min(99, rating + rng.range(-5, 5))));
  return s;
}
