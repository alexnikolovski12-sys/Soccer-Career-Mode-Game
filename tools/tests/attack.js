g.autoplay = true;
quickMatch('semipro', 240);
const hist = { home: new Array(10).fill(0), away: new Array(10).fill(0) };
const dec = {};
const origPass = g.passing.requestAIPass.bind(g.passing);
g.passing.requestAIPass = (p, t, kind = 'ground') => { const s = p.team === 'home' ? 1 : -1; const k = `${p.team}:${kind}:${s * (t.pos.x - p.pos.x) > 0 ? 'fwd' : 'back'}`; dec[k] = (dec[k] || 0) + 1; return origPass(p, t, kind); };
let shots = 0, canShoot = 0;
g.events.on('shot', () => shots++);
run(60, () => {
  if (g.sm.is('GOAL') && g.sm.time > 1.5) g._endReplay();
  const o = g.ball.owner;
  if (o && !o.isKeeper) {
    const s = o.team === 'home' ? 1 : -1, fx = (s * o.pos.x) / 52.5;
    hist[o.team][Math.max(0, Math.min(9, Math.floor((fx + 1) * 5)))]++;
    if (g.shooting.aiCanShoot(o)) canShoot++;
  }
});
return { hist, dec, shots, canShoot, score: `${g.match.homeGoals}-${g.match.awayGoals}`, clock: g.match.clockText };
