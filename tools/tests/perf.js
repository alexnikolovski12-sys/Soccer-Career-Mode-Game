// CPU cost of animation (blend tree + physics + IK) per rendered frame, all players.
startMoment();
mv.x = 0.3; mv.y = 1; mv.mag = 1;
run(1);
const ps = g.players;
const N = 300;
let tAnim = 0, tSim = 0;
for (let i = 0; i < N; i++) {
  const a = performance.now();
  g.loop.update(g.loop.step);
  const b = performance.now();
  for (const p of ps) p.updateAnimation(1 / 60, g.ball.owner === p);
  for (const p of ps) p.render(1, 0);
  const c = performance.now();
  tSim += b - a; tAnim += c - b;
}
// big celebration: 23 bodies
g.extras = g.extraPool.slice();
for (const p of g.extras) { p.setVisible(true); p.place(0, 0, 0); p.steer(1, 0, 5); }
let tBig = 0;
for (let i = 0; i < 120; i++) {
  const a = performance.now();
  for (const p of [...ps, ...g.extras]) { p.integrate(1 / 60, false); p.updateAnimation(1 / 60, false); p.render(1, 0); }
  tBig += performance.now() - a;
}
return { players: ps.length, animMsPerFrame: +(tAnim / N).toFixed(3), simMsPerStep: +(tSim / N).toFixed(3), with23_msPerFrame: +(tBig / 120).toFixed(3) };
