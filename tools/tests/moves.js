// Hand-made moves layered over the mocap base: skill moves, tackles, keeper dive.
startMoment();
g.moments.current.timer = 60;
g.config.defender.tackleSuccessMult = 0;
mv.x = 0; mv.y = 1; mv.mag = 0.8;
run(1);
const u = g.user;
for (const sk of ['stepover', 'elastico', 'dragback']) {
  u.playAction(sk, 0.5, { side: 1, kickLeg: 1 });
  run(0.22); snap(`skill-${sk}`, { side: 1.9 });
  run(0.4);
}
const d = g.defenders[0];
d.place(u.pos.x + 2, u.pos.z + 1, -Math.PI / 2);
d.playAction('tackle', 0.55, { variant: 'slide' });
run(0.25); snap('tackle-slide', { p: d, side: 1.6 });
const k = g.keeperPlayer;
k.playAction('dive', 1.0, { side: 1, roll: 1.2, lift: 0.3 });
run(0.35); snap('keeper-dive', { p: k, side: Math.PI, dist: 5 });
return { ok: true };
