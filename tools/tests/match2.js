g.autoplay = true;
quickMatch('semipro', 240);
const log = [];
let k = 0;
run(40, () => {
  k++;
  if (g.sm.is('GOAL') && g.sm.time > 1.5) g._endReplay();
  if (k % 120 === 0) {
    const b = g.ball, o = b.owner;
    log.push(`${g.match.clockText} st=${['KICKOFF','PLAYING','SHOT_FLIGHT','GOAL'].find((s) => g.sm.is(s))} ball(${b.pos.x.toFixed(1)},${b.pos.y.toFixed(2)},${b.pos.z.toFixed(1)}) v=${b.speed.toFixed(1)} fr=${b.frozen} own=${o ? o.id + ':' + o.team : '-'} pass=${b.pass ? (b.pass.to ? b.pass.to.id : 'space') : '-'} R=${g.match.restart ? g.match.restart.type + '/' + g.match.restart.phase : '-'} kH=${g.homeKeeper.state} kA=${g.keeper.state} near=${(() => { let n = 99, w = ''; for (const p of g.players) { const d = Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z); if (d < n) { n = d; w = p.id + ':' + (p.ai.state || '') + (p.stumble > 0 ? '(st)' : ''); } } return w + '@' + n.toFixed(1); })()}`);
  }
  if (k % 600 === 0) snap(`t${k}`);
});
return log;
