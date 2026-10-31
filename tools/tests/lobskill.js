quickMatch();
let gained = null;
g.events.on('gain', (e) => { gained = e; });
const res = { lob: { ok: 0, bad: 0, dist: [] }, skills: {} };
const prep = () => {
  runUntil(() => g.sm.is('PLAYING') && !g.match.restart && !g.setPiece, 8);
  if (g.sm.is('GOAL')) { g._endReplay(); runUntil(() => g.sm.is('PLAYING'), 4); }
  const u = g.user;
  g.ball.reset(u.pos.x + Math.sin(u.heading) * 0.6, u.pos.z + Math.cos(u.heading) * 0.6);
  g.possession.gain(u);
  return u;
};
for (let i = 0; i < 16; i++) {
  const u = prep();
  mv.x = Math.sin(i), mv.y = 0.8, mv.mag = 0.6; run(0.3); mv.mag = 0;
  if (g.ball.owner !== u) continue;
  const from = u.pos.clone();
  gained = null;
  press('pass', 'up', 0.3 + (i % 4) * 0.4);
  runUntil(() => gained || g.match.restart, 6);
  if (gained && gained.player.team === 'home' && gained.player !== u) { res.lob.ok++; res.lob.dist.push(+Math.hypot(gained.player.pos.x - from.x, gained.player.pos.z - from.z).toFixed(1)); }
  else { res.lob.bad++; (res.lob.fails = res.lob.fails || []).push({ by: gained ? gained.player.id + ':' + gained.player.team : null, restart: g.match.restart && g.match.restart.type, to: g.ball.pass && g.ball.pass.to && g.ball.pass.to.id, y: +g.ball.pos.y.toFixed(2), owner: g.ball.owner && g.ball.owner.id, kick: g.ball.lastKick && g.ball.lastKick.type }); }
}
return res;