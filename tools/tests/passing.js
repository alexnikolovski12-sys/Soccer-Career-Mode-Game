// Passing: from a variety of moments, press PASS and check the ball reaches a teammate.
let ok = 0, bad = 0, none = 0;
const why = {};
let gained = null;
g.events.on('gain', (e) => { gained = e; });
for (let trial = 0; trial < 40; trial++) {
  startMoment();
  if (!runUntil(() => g.ball.owner === g.user, 3)) { none++; continue; }
  // dribble a moment first (sometimes), then pass in a random-ish direction
  const a = trial * 2.4;
  mv.x = Math.sin(a) * 0.6; mv.y = 0.6 + Math.cos(a) * 0.4; mv.mag = 0.8;
  run(0.4 + (trial % 3) * 0.3);
  if (g.ball.owner !== g.user) { none++; continue; }
  const from = g.user;
  gained = null;
  press('pass', trial % 7 === 6 ? 'up' : 'tap', 0, trial % 7 === 6 ? -40 : 0);
  run(0.05);
  const target = g.passing.pending && g.passing.pending.target;
  if (!runUntil(() => gained || !g.sm.is('PLAYING', 'SHOT_FLIGHT'), 5)) { why.timeout = (why.timeout || 0) + 1; bad++; continue; }
  if (gained && gained.player.team === 'home' && gained.player !== from) ok++;
  else { bad++; const k = gained ? (gained.player.team === 'away' ? 'intercepted' : 'self') : g.sm.name; why[k] = (why[k] || 0) + 1; }
  mv.mag = 0; mv.x = mv.y = 0;
}
return { ok, bad, none, pct: +(100 * ok / Math.max(1, ok + bad)).toFixed(1), why };
