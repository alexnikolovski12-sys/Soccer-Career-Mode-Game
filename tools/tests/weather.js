// Weather looks, the set-piece camera, a penalty taken right at the end of a half, and training.
const out = {};
quickMatch('semipro', 150);
run(1.5);
for (const w of ['rain', 'snow', 'clear']) { g.weather.set(w, 1); run(1); snap(`weather-${w}`); }
// --- penalty for you, in added time
const L = 52.5;
g.weather.set('rain', 1);
const u = g.user, d = g.defenders[0];
g.match.restart = null; g.ball.frozen = false;
u.pos.set(L - 12, 0, 1); g.ball.pos.set(L - 11.4, 0.11, 1); g.ball.owner = u;
d.pos.set(L - 11, 0, 1.5);
g.match.clock = 46 * 60; g.match.added = 1;
g.onFoul({ by: d, victim: u });
out.penSetPiece = !!(g.setPiece && g.setPiece.penalty);
runUntil(() => g.setPiece && g.setPiece.phase === 'ready' && !g.foulRp, 35);
run(0.8);
out.penCam = g.camRig.mode;
snap('penalty-cam');
runUntil(() => g.setPiece && g.setPiece.meterSize < 0.3, 6);
press('shoot');
let endedMidShot = false, outcome = null;
runUntil(() => {
  if (g.sm.is('HALFTIME') && !outcome) { outcome = 'halftime'; return true; }
  if (g.sm.is('GOAL')) { outcome = 'goal'; return true; }
  const k = g.ball.lastKick;
  if (k && (k.type === 'save' || k.type === 'block')) { outcome = k.type; return true; }
  if (g.match.restart) { outcome = 'restart:' + g.match.restart.type; return true; }
  return false;
}, 12);
if (outcome === 'halftime') endedMidShot = true;
out.penOutcome = outcome; out.halfEndedMidShot = endedMidShot;
// let the half end naturally after it
runUntil(() => g.sm.is('HALFTIME'), 40);
out.halftimeReached = g.sm.is('HALFTIME');
g.continueMatch();
runUntil(() => g.sm.is('PLAYING'), 10);
// --- their free kick: camera behind the taker
g.match.restart = null; g.setPiece = null; g.ball.frozen = false;
const a = g.defenders[3];
a.pos.set(-20, 0, 5); g.ball.pos.set(-19.4, 0.11, 5); g.ball.owner = a;
g.user.pos.set(-19, 0, 5.5);
g.onFoul({ by: g.user, victim: a });
runUntil(() => !g.foulRp && g.match.restart && g.match.restart.taker, 25);   // (after the foul replay)
run(0.3);
out.fkCam = g.camRig.mode;
snap('their-freekick-cam');
runUntil(() => !g.match.restart, 10);
run(1.5);
out.afterFkCam = g.camRig.mode;
// --- snow look in play
g.weather.set('snow', 1); run(2); snap('snow-play');
// --- training
g.quitMatch();
run(0.5);
g.ut._training();
runUntil(() => g.sm.is('PLAYING'), 10);
out.trainingDefenders = g.defenders.length;
out.trainingWeather = g.matchWeather;
g.autoplay = true;
run(20);
g.autoplay = false;
out.trainingScore = `${g.match.homeGoals}-${g.match.awayGoals}`;
out.trainingClock = g.match.clockText;
snap('training');
g.quitMatch(); run(0.5);
out.menuAfterTraining = g.sm.is('MENU');
out.utTab = g.ut.tab;
return out;
