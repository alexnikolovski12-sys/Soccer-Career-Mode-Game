// Ball distance ahead of the feet: straight sprint vs. gentle steering vs. jogging.
quickMatch();
const out = {};
const runCase = (label, sprint, wob, mag) => {
  runUntil(() => g.sm.is('PLAYING') && !g.match.restart && !g.setPiece, 8);
  for (const d of g.defenders) d.place(-45 + d.slot.fx * 5, d.slot.fz * 30, 0);
  const u = g.user; u.place(-20, 0, Math.PI / 2);
  g.passing.reset(); g.ball.reset(-19.5, 0); g.possession.gain(u);
  const f = g.camRig.forward, rt = g.camRig.right;
  g.input.held.sprint = sprint;
  const ds = []; let t = 0, lost = 0;
  run(4, () => {
    t += 1 / 60;
    const a = Math.sin(t * 1.6) * wob;
    const wx = Math.cos(a), wz = Math.sin(a);
    mv.y = wx * f.x + wz * f.z; mv.x = wx * rt.x + wz * rt.z; mv.mag = mag;
    if (g.ball.owner !== u) { lost++; return false; }
    if (t > 1) ds.push(Math.hypot(g.ball.pos.x - u.pos.x, g.ball.pos.z - u.pos.z));
  });
  g.input.held.sprint = false; mv.mag = 0;
  ds.sort((a, b) => a - b);
  out[label] = { min: +ds[0].toFixed(2), med: +ds[ds.length >> 1].toFixed(2), max: +ds[ds.length - 1].toFixed(2), lost };
};
runCase('sprintStraight', true, 0, 1);
runCase('sprintSteer', true, 0.6, 1);
runCase('jog', false, 0, 0.7);
runCase('jogSteer', false, 0.6, 0.7);
return out;
