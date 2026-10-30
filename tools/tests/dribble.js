// Dribble: run with the ball (jog, run, turns, sprint) and measure ball distance,
// touch/foot alignment and planted-foot slide.
startMoment();
g.config.defender.tackleSuccessMult = 0;
for (const d of g.defenders) d.place(-40, 30, 0);
g.moments.current.timer = 60;
const st = { dist: [], distSprint: [], touches: 0, touchErr: [], slide: [], slideNoIK: [] };
let lastKickT = -1;
const prev = [null, null];
const each = () => {
  const u = g.user, b = g.ball;
  if (b.owner !== u || !g.sm.is('PLAYING')) return;
  const d = Math.hypot(b.pos.x - u.pos.x, b.pos.z - u.pos.z);
  if (u.speed > 2) (u.sprinting ? st.distSprint : st.dist).push(d);
  const k = b.lastKick, legs = [u.parts.legL, u.parts.legR], A = u.animator;
  if (k && k.type === 'dribble' && k.by === u && k.time !== lastKickT) {
    lastKickT = k.time; st.touches++;
    const r = A.reach;
    if (r) { const a = V(legs[r.foot].ankle); st.touchErr.push(Math.hypot(a.x - r.x, a.z - r.z)); }
  }
  for (let i = 0; i < 2; i++) {
    const a = V(legs[i].ankle);
    // weight-bearing: the foot is planted (stance) and its IK lock is fully on
    const planted = A.contact[i] > 0.6 && A.lockW[i] >= 1 && a.y < 0.12;
    if (planted && prev[i]) st.slide.push(Math.hypot(a.x - prev[i].x, a.z - prev[i].z) / FR);
    prev[i] = planted ? a : null;
  }
};
const x0 = g.user.pos.x;
const phases = [[0, 1, 0.4, false, 2], [0, 1, 0.75, false, 2], [0, 1, 1, false, 2], [0.8, 0.6, 1, false, 1.2], [0, 1, 1, true, 2.5], [-0.9, 0.4, 1, false, 1]];
for (const [x, y, m, spr, sec] of phases) { mv.x = x; mv.y = y; mv.mag = m; g.input.held.sprint = spr; run(sec, each); }
return {
  state: g.sm.name, outcome: g.resultOutcome, ran: +(g.user.pos.x - x0).toFixed(1), owner: g.ball.owner && g.ball.owner.id,
  ballDist: avg(st.dist), ballDist95: pct(st.dist, 0.95), ballDistSprint: avg(st.distSprint),
  touches: st.touches, touchFootErr: avg(st.touchErr), touchFootErr90: pct(st.touchErr, 0.9),
  plantedSlide: avg(st.slide), plantedSlide90: pct(st.slide, 0.9), n: st.slide.length,
};
