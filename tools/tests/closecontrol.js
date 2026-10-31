// Sprint, then turn back hard, again and again: the ball stays at his feet (no loose balls on his own).
quickMatch();
const out = { lost: 0, maxDist: 0, distSprint: [], stops: 0, trials: 0 };
for (let k = 0; k < 8; k++) {
  runUntil(() => g.sm.is('PLAYING') && !g.match.restart && !g.setPiece, 8);
  if (g.sm.is('GOAL')) { g._endReplay(); runUntil(() => g.sm.is('PLAYING'), 4); }
  for (const d of g.defenders) d.place(-45 + d.slot.fx * 5, d.slot.fz * 30, 0);   // keep them out of the way
  const u = g.user; u.place(-10, 0, Math.PI / 2);
  g.passing.reset(); g.ball.reset(-9.4, 0); g.possession.gain(u);
  out.trials++;
  const f = g.camRig.forward, rt = g.camRig.right;
  const stick = (wx, wz) => { mv.y = wx * f.x + wz * f.z; mv.x = wx * rt.x + wz * rt.z; mv.mag = 1; };
  g.input.held.sprint = true;
  let dir = 1, t = 0;
  const ok = run(5, () => {
    t += 1 / 60;
    if (t > 1.2) { dir = -dir; t = 0; }
    stick(dir, k % 2 ? 0.3 : -0.3);
    if (u.drib && u.drib.stop && !u.drib._c) { u.drib._c = 1; out.stops++; } else if (u.drib && !u.drib.stop) u.drib._c = 0;
    if (g.ball.owner !== u) { out.lost++; return false; }
    const d = Math.hypot(g.ball.pos.x - u.pos.x, g.ball.pos.z - u.pos.z);
    out.maxDist = Math.max(out.maxDist, d);
    if (u.speed > 5) out.distSprint.push(d);
  });
  g.input.held.sprint = false; mv.mag = 0;
}
out.avgSprint = avg(out.distSprint); out.p95Sprint = pct(out.distSprint, 0.95); delete out.distSprint;
out.maxDist = +out.maxDist.toFixed(2);
return out;
