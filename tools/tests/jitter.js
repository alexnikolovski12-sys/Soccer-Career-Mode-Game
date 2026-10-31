// Leg jitter: second difference of ankle positions while a player holds a pose / celebration.
g.autoplay = true;
quickMatch();
const p = g.teammates[3];
const out = {};
for (const act of ['jumpfist', 'armsup', 'pointsky', 'cuptheear', 'robot', 'kneeslide', 'celebrate', 'teamjump', 'dejected', 'hipshands', 'sitdown', 'crouchsad', 'gkset', 'idle']) {
  g.match.restart = { type: 'freekick', team: 'home', phase: 'dead', t: 99 };
  p.place(0, 0, 0); p.steer(0, 0, 0);
  if (act !== 'idle') p.playAction(act, 9, { loop: act !== 'kneeslide' && act !== 'sitdown' && act !== 'crouchsad', hold: ['kneeslide', 'sitdown', 'crouchsad'].includes(act) });
  const prev = [];
  let acc = 0, n = 0, below = 0;
  for (let i = 0; i < 90; i++) {
    p.savePrev(); p.integrate(1 / 60, false); if (act === 'kneeslide') { p.pos.x += 4 * Math.exp(-i / 50) / 60; }
    p.updateAnimation(1 / 60, false); p.render(1, 0);
    const a = [V(p.parts.legL.ankle), V(p.parts.legR.ankle)];
    if (prev.length >= 2 && i > 30) {
      for (let k = 0; k < 2; k++) { const d2 = a[k].clone().sub(prev[1][k].clone().multiplyScalar(2)).add(prev[0][k]); acc += d2.length(); n++; }
    }
    for (const q of a) if (q.y < 0.04) below++;
    prev.push(a); if (prev.length > 2) prev.shift();
  }
  out[act] = { jitter_mm: +((acc / Math.max(1, n)) * 1000).toFixed(2), belowGround: below };
}
g.match.restart = null;
return out;
