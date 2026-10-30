// Soak: many moments with random stick / buttons through every state; checks for NaN poses.
const seen = {}, outcomes = {};
let nan = 0, frames = 0, moments = 0;
const bad = (p) => { const q = p.parts.body.quaternion, b = p.parts.body.position, r = p.parts.root.position; return !(Number.isFinite(q.x + q.w + b.y + r.x + r.z + p.parts.legL.hip.quaternion.x)); };
for (let m = 0; m < 14; m++) {
  startMoment(); moments++;
  let t = 0;
  runUntil(() => {
    t++; frames++;
    seen[g.sm.name] = (seen[g.sm.name] || 0) + 1;
    if (t % 30 === 0) { const a = Math.random() * 6.28; mv.x = Math.sin(a); mv.y = Math.abs(Math.cos(a)) * 0.8 + 0.2; mv.mag = Math.random(); g.input.held.sprint = Math.random() < 0.3; }
    if (t % 47 === 0) { const r = Math.random(); press(r < 0.4 ? 'pass' : r < 0.7 ? 'shoot' : 'through', ['tap', 'up', 'down', 'left', 'right'][Math.floor(Math.random() * 5)], Math.random()); }
    if (g.setPiece && g.setPiece.phase === 'ready') { if (g.setPiece.penalty) press('shoot'); else g.setPiece.fkAction = g.setPiece.fk === 'choose' ? (Math.random() < 0.5 ? 'shoot' : 'pass') : 'tap'; }
    for (const p of [...g.players, ...g.extras]) if (bad(p)) nan++;
    return g.sm.is('RESULT') && g.sm.time > 6;
  }, 40);
  outcomes[g.resultOutcome] = (outcomes[g.resultOutcome] || 0) + 1;
}
return { moments, frames, nan, seen, outcomes };
