// Stepovers at full sprint: speed kept, ball kept, ends with him still on it.
quickMatch();
runUntil(() => g.sm.is('PLAYING') && !g.match.restart, 8);
for (const d of g.defenders) d.place(-45 + d.slot.fx * 5, d.slot.fz * 30, 0);
const u = g.user; u.place(-25, 0, Math.PI / 2); g.passing.reset(); g.ball.reset(-24.5, 0); g.possession.gain(u);
const f = g.camRig.forward, rt = g.camRig.right;
const stick = () => { mv.y = f.x; mv.x = rt.x; mv.mag = 1; };
g.input.held.sprint = true;
run(2.5, stick);
const v0 = u.speed;
g.skills.cooldown = 0;
const ok = g.skills.perform(u, 'right');
const sp = []; let lost = 0, maxD = 0;
run(1.4, () => { stick(); sp.push(u.speed); if (g.ball.owner !== u) lost++; maxD = Math.max(maxD, Math.hypot(g.ball.pos.x - u.pos.x, g.ball.pos.z - u.pos.z)); });
g.input.held.sprint = false; mv.mag = 0;
return { ok, v0: +v0.toFixed(2), minSpeed: +Math.min(...sp).toFixed(2), avgSpeed: +(sp.reduce((a, b) => a + b, 0) / sp.length).toFixed(2), lost, maxD: +maxD.toFixed(2), owner: g.ball.owner === u };
