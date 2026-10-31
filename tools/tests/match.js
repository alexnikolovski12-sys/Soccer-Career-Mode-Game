// A whole match, AI v AI (you idle): flow, restarts, goals, no errors.
g.autoplay = true;
const ok = quickMatch('semipro', 120);
const out = { started: ok, states: {}, restarts: {}, owners: { home: 0, away: 0 }, swaps: 0, shots: 0, maxPlayerDist: 0 };
let lastOwnerTeam = null, lastState = '';
g.events.on('shot', () => out.shots++);
const origStart = g.match.startRestart.bind(g.match);
g.match.startRestart = (type, team, x, z, o) => { if (!g.match.restart) out.restarts[type] = (out.restarts[type] || 0) + 1; return origStart(type, team, x, z, o); };
// the user's player just follows the ball loosely so he isn't dead weight
run(150, () => {
  const s = g.sm.current ? g.sm.current : g.sm.state;
  const name = typeof s === 'string' ? s : (g.sm.name || '');
  const st = ['KICKOFF', 'PLAYING', 'SHOT_FLIGHT', 'GOAL', 'HALFTIME', 'FULLTIME', 'MENU'].find((k) => g.sm.is(k)) || '?';
  out.states[st] = (out.states[st] || 0) + 1;
  if (g.sm.is('HALFTIME')) { g.continueMatch(); }
  if (g.sm.is('FULLTIME')) { out.result = g.match.result(); return false; }
  if (g.sm.is('GOAL') && g.sm.time > 1.5) g._endReplay();
  const o = g.ball.owner;
  if (o) { out.owners[o.team]++; if (lastOwnerTeam && lastOwnerTeam !== o.team) out.swaps++; lastOwnerTeam = o.team; }

});
out.clock = g.match.clockText; out.half = g.match.half;
out.score = `${g.match.homeGoals}-${g.match.awayGoals}`;
out.goals = g.match.goals;
out.stats = g.match.stats;
return out;
