// Free kicks and penalties: foul → set-up → run-up → strike on the contact frame.
const out = [];
for (const kind of ['fk', 'fk', 'pen', 'pen', 'fkpass']) {
  startMoment();
  g.moments.current.timer = 60;
  const u = g.user, d = g.defenders[0];
  // put the ball where the foul happens
  const x = kind === 'pen' ? 44 : 30, z = kind === 'pen' ? 3 : 6;
  g.ball.reset(x, z); g.ball.owner = u; u.place(x - 0.5, z, Math.PI / 2); d.place(x - 1.2, z, Math.PI / 2);
  g.onFoul({ by: d, victim: u });
  if (!runUntil(() => g.setPiece && g.setPiece.phase === 'ready', 6)) { out.push({ kind, err: 'no ready' }); continue; }
  const sp = g.setPiece;
  const start = g.user.pos.clone(), ballAt = g.ball.pos.clone();
  if (kind === 'pen') { runUntil(() => sp.meterSize < (out.length % 2 ? 0.5 : 0.15), 3); press('shoot'); }
  else if (kind === 'fkpass') sp.fkAction = 'pass';
  else { sp.fkAction = 'shoot'; run(0.2); sp.fkAction = 'tap'; run(0.2); runUntil(() => Math.abs((sp.fkPower ?? 0) - 0.62) < 0.04, 3); sp.fkAction = 'tap'; }
  let kickT = null, footAtKick = null, ballMovedEarly = false;
  const t0 = g.simTime;
  runUntil(() => {
    const k = g.ball.lastKick;
    if (!kickT && k && (k.type === 'shot' || k.type === 'pass') && k.time >= t0) {
      kickT = +(k.time - t0).toFixed(2);
      const kp = k.by, leg = kp.anim.kickLeg >= 0 ? kp.parts.legR : kp.parts.legL;
      const a = V(leg.ankle); footAtKick = +Math.hypot(a.x - ballAt.x, a.z - ballAt.z).toFixed(2);
    }
    if (!kickT && Math.hypot(g.ball.pos.x - ballAt.x, g.ball.pos.z - ballAt.z) > 0.05) ballMovedEarly = true;
    return kickT && g.simTime - t0 > kickT + 0.3;
  }, 4);
  if (kind === 'fk') snap('fk-after', { side: 1.4 });
  out.push({ kind, ready: true, kickT, footAtKick, ballMovedEarly, ranUp: +start.distanceTo(g.user.pos).toFixed(2), state: g.sm.name });
  runUntil(() => g.sm.is('RESULT'), 6);
  out[out.length - 1].outcome = g.resultOutcome;
}
return out;
