// You play: chase the carrier when defending (tackle when close, switch now and then), attack goal and shoot.
g.autoplay = false;
quickMatch('semipro', 240);
const ev = { tackles: 0, tackleWins: 0, switches: 0, shots: 0, userShots: 0, passes: 0, goals: [] };
g.events.on('tackleWon', ({ by }) => { if (by && by.team === 'home') ev.tackleWins++; });
g.events.on('shot', ({ shooter }) => { ev.shots++; if (shooter.team === 'home') ev.userShots++; });
g.events.on('pass', ({ from }) => { if (from && from.isUser) ev.passes++; });
const origSwitch = g.switchControl.bind(g); g.switchControl = (...a) => { ev.switches++; return origSwitch(...a); };
const origTk = g.homeAI.startTackle.bind(g.homeAI); g.homeAI.startTackle = (d, c, s) => { if (d.isUser) ev.tackles++; return origTk(d, c, s); };
let k = 0, defFrames = 0;
run(90, () => {
  k++;
  if (g.sm.is('GOAL') && g.sm.time > 1.5) g._endReplay();
  if (g.sm.is('HALFTIME')) g.continueMatch();
  if (g.sm.is('FULLTIME')) return false;
  const u = g.user, b = g.ball;
  const R = g.match.restart;
  if (R && R.team === 'home' && R.taker === u && R.phase === 'ready') { press('pass'); return; }
  if (g.setPiece && g.setPiece.phase === 'ready') { if (g.setPiece.penalty) press('shoot'); else g.setPiece.fkAction = 'pass'; return; }
  const cam = g.camRig, f = cam.forward, rt = cam.right;
  const toStick = (wx, wz) => { const l = Math.hypot(wx, wz) || 1; wx /= l; wz /= l; mv.y = wx * f.x + wz * f.z; mv.x = wx * rt.x + wz * rt.z; mv.mag = 1; };
  if (g._defending()) {
    defFrames++;
    const c = b.owner || (b.pass && b.pass.to) || null;
    const t = c ? c.pos : b.pos;
    toStick(t.x - 1.2 - u.pos.x, t.z - u.pos.z);
    g.input.held.sprint = Math.hypot(t.x - u.pos.x, t.z - u.pos.z) > 4;
    if (c && Math.hypot(c.pos.x - u.pos.x, c.pos.z - u.pos.z) < 1.8 && k % 20 === 0) press('shoot');
    if (k % 240 === 0) press('pass');
  } else if (b.owner === u) {
    toStick(52 - u.pos.x, -u.pos.z * 0.5);
    g.input.held.sprint = false;
    if (g.shooting.inRange(u) && k % 30 === 0) press('shoot', 'tap', 0.5);
    else if (k % 75 === 0) press('pass');
  } else { toStick(b.pos.x - u.pos.x, b.pos.z - u.pos.z); }
});
return { ...ev, defFrames, score: `${g.match.homeGoals}-${g.match.awayGoals}`, clock: g.match.clockText, goals: g.match.goals.map((x) => `${x.team} ${x.name} ${x.minute}'`) };
