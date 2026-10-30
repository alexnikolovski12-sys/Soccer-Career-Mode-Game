// Every celebration type + a big late-goal pile-on, and a fall with its get-up.
const out = [];
for (const type of ['kneeslide', 'bellyslide', 'airplane', 'jumpfist', 'spinjump', 'pointsky', 'cuptheear', 'shush', 'armscrossed', 'salute', 'calmdown', 'heart', 'badgepoint', 'robot', 'backflip', 'celebrate']) {
  // score for real (keeper switched off), then pick the celebration
  startMoment();
  g.config.keeper.difficulty = 0;
  g.moments.current.timer = 60;
  for (const d of g.defenders) d.place(-40, 30, 0);
  g.user.place(41, 4, Math.PI / 2);
  g.ball.reset(41.5, 4); g.ball.owner = g.user;
  run(0.1);
  press('shoot', 'down', 0.5);
  if (!runUntil(() => g.sm.is('RESULT'), 6) || g.resultOutcome !== 'GOAL') { out.push({ type, err: g.resultOutcome }); continue; }
  g.celebration.type = type;
  run(2.4); snap(`cel-${type}-a`, { side: 2.4, dist: 4.5 });
  run(1.0); snap(`cel-${type}-b`, { side: 2.4, dist: 4.5 });
  const L = g.user.animator.layers.map((l) => `${l.name}:${l.w.toFixed(2)}${l.c ? '(' + l.c.name + ')' : ''}`);
  out.push({ type, action: g.user.anim.action, layers: L.join(' ') });
}
// fall + get-up
startMoment();
const d = g.defenders[0];
d.place(g.user.pos.x + 3, g.user.pos.z, -Math.PI / 2);
d.hit(1, 0.3, 4);
d.playAction('fall', 1.1, { side: 1 });
const seq = [];
for (const t of [0.25, 0.5, 0.8, 1.2, 1.6]) { run(t - (seq.length ? seq[seq.length - 1] : 0)); seq.push(t); snap(`fall-${t}`, { p: d, side: 1.6, dist: 4 }); }
out.push({ fallAction: d.anim.action, rag: !!d.animator.rag });
run(1); out.push({ afterFall: d.anim.action, rag: !!d.animator.rag });
return out;
