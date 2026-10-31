// Mid-match: you get the ball, press PASS in various stick directions; does a teammate receive it?
quickMatch();

let gained = null;
g.events.on('gain', (e) => { gained = e; });
const res = { ok: 0, bad: 0, why: {}, fails: [] };
for (let trial = 0; trial < 30; trial++) {
  runUntil(() => g.sm.is('PLAYING') && !g.match.restart && !g.setPiece, 8);
  if (g.sm.is('GOAL')) { g._endReplay(); runUntil(() => g.sm.is('PLAYING'), 4); }
  const u = g.user;
  g.ball.reset(u.pos.x + Math.sin(u.heading) * 0.6, u.pos.z + Math.cos(u.heading) * 0.6);
  g.possession.gain(u);
  const a = trial * 0.9;
  mv.x = Math.sin(a); mv.y = Math.cos(a); mv.mag = 0.7;
  run(0.3);
  if (g.ball.owner !== u) { res.why.lostFirst = (res.why.lostFirst || 0) + 1; continue; }
  gained = null;
  press('pass');
  run(0.05);
  const pend = g.passing.pending;
  const target = pend && pend.target;
  mv.mag = 0;
  const t0 = g.simTime;
  const got = runUntil(() => gained || g.match.restart || !g.sm.is('PLAYING', 'SHOT_FLIGHT'), 5);
  if (gained && gained.player.team === 'home' && gained.player !== u) res.ok++;
  else {
    res.bad++;
    const k = !got ? 'timeout' : g.match.restart ? 'out:' + g.match.restart.type : gained ? (gained.player.team === 'away' ? 'intercepted' : 'self') : 'state';
    res.why[k] = (res.why[k] || 0) + 1;
    if (res.fails.length < 6) res.fails.push({ k, pending: !!pend, target: target && target.id, ballOwner: g.ball.owner && g.ball.owner.id, pass: g.ball.pass && g.ball.pass.to && g.ball.pass.to.id, ballV: +g.ball.speed.toFixed(1), dt: +(g.simTime - t0).toFixed(1), restart: g.match.restart && g.match.restart.type, setPiece: !!g.setPiece });
  }
}
res.pct = +(100 * res.ok / Math.max(1, res.ok + res.bad)).toFixed(1);
return res;
