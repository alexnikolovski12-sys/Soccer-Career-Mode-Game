// Every restart type for both teams: it gets taken and play goes on.
g.autoplay = true;
quickMatch('semipro', 240);
const out = [];
const cases = [
  ['throw home', () => { g.ball.reset(10, 34.6); g.ball.lastTouch = g.defenders[0]; }],
  ['throw away', () => { g.ball.reset(-10, -34.6); g.ball.lastTouch = g.user; }],
  ['corner home', () => { g.ball.reset(53, 10); g.ball.vel.set(3, 0, 0); g.ball.lastTouch = g.defenders[1]; }],
  ['goalkick away', () => { g.ball.reset(53, 10); g.ball.vel.set(3, 0, 0); g.ball.lastTouch = g.user; }],
  ['corner away', () => { g.ball.reset(-53, -10); g.ball.vel.set(-3, 0, 0); g.ball.lastTouch = g.teammates[0]; }],
  ['goalkick home', () => { g.ball.reset(-53, -10); g.ball.vel.set(-3, 0, 0); g.ball.lastTouch = g.defenders[2]; }],
  ['pen away', () => { g.match.startRestart('penalty', 'away', -52.5 + 11, 0); }],
];
for (const [name, set] of cases) {
  runUntil(() => g.sm.is('PLAYING') && !g.match.restart && !g.setPiece, 8);
  g.ball.owner = null; g.ball.pass = null; g.ball.frozen = false;
  set();
  let saw = null;
  const ok = runUntil(() => { if (g.match.restart) saw = saw || g.match.restart.type + '/' + g.match.restart.team; return saw && !g.match.restart; }, 12);
  run(1.0);
  out.push({ name, saw, taken: ok, owner: g.ball.owner ? g.ball.owner.team : null, state: ['PLAYING', 'GOAL', 'KICKOFF', 'SHOT_FLIGHT'].find((s) => g.sm.is(s)), score: `${g.match.homeGoals}-${g.match.awayGoals}` });
  if (g.sm.is('GOAL')) { runUntil(() => g.sm.time > 1.6, 4); g._endReplay(); }
}
return out;
