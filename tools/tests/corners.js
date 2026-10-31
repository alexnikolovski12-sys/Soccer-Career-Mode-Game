// Your corners: hold CROSS → high ball → header / bicycle / volley; a tap → driven low → auto finish.
quickMatch('semipro', 150);
const out = [];
for (const held of [0.8, 0.8, 0.8, 0.5, 0.1, 0.1]) {
  runUntil(() => g.sm.is('PLAYING') && !g.setPiece, 10);
  if (g.sm.is('GOAL')) { g._endReplay && g._endReplay(); runUntil(() => g.sm.is('PLAYING'), 8); }
  g.match.restart = null; g.passing.reset(); g.ball.owner = null;
  g.match.startRestart('corner', 'home', 52.5 - 0.6, 34 - 0.6);
  runUntil(() => g.match.restart && g.match.restart.phase === 'ready', 6);
  const before = g.match.homeGoals;
  press('pass', 'tap', held);
  let fin = null;
  runUntil(() => { if (g.finishing && !fin) fin = g.finishing.type; return g.sm.is('GOAL') || (g.match.restart && g.match.restart.type !== 'corner'); }, 8);
  out.push({ held, finish: fin, goal: g.match.homeGoals > before, state: g.sm.current && g.sm.current.name || String(g.sm.state) });
  runUntil(() => !g.sm.is('GOAL'), 15);
}
return out;
