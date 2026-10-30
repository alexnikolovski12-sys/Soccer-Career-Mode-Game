// Sprint carries with turns: how often you keep it, how far ahead it runs; plus customise scroll retention.
const out = { kept: 0, lost: 0, ahead: [] };
for (let k = 0; k < 8; k++) {
  startMoment();
  g.moments.current.timer = 60;
  for (const d of g.defenders) d.place(-45, 30, 0);
  g.user.place(-20, 0, Math.PI / 2); g.ball.reset(-19.4, 0); g.ball.owner = g.user;
  let t = 0, lost = false;
  run(5, () => {
    t += 1 / 60;
    const ang = Math.sin(t * (0.8 + k * 0.15)) * 0.9;   // weaving
    mv.x = Math.cos(ang); mv.y = Math.sin(ang); mv.mag = 1;
    g.input.held.sprint = true;
    if (g.ball.owner !== g.user) { lost = true; (out.why = out.why || []).push({ t: +t.toFixed(2), owner: g.ball.owner ? g.ball.owner.id : null, state: g.sm.current?.name, d: +Math.hypot(g.ball.pos.x - g.user.pos.x, g.ball.pos.z - g.user.pos.z).toFixed(2), x: +g.user.pos.x.toFixed(1), spd: +g.user.speed.toFixed(1) }); return false; }
    out.ahead.push(Math.hypot(g.ball.pos.x - g.user.pos.x, g.ball.pos.z - g.user.pos.z));
  });
  lost ? out.lost++ : out.kept++;
}
out.aheadAvg = avg(out.ahead); out.ahead95 = pct(out.ahead, 0.95); delete out.ahead;
return out;
