// The goal TV package: three replay angles then the crowd, then kick-off. Also a chance replay and a cutaway.
g.autoplay = true;
quickMatch('semipro', 240);
run(6);
const shot = (lab) => { const nr = g.renderer.render; g.renderer.render = realRender; g.renderFrame(g.camRig.camera); g.renderer.render = nr; __shots.push([lab, g.renderer.domElement.toDataURL('image/jpeg', 0.75)]); };
g.ball.reset(50, 0); g.match.homeGoals++; g.onGoal('home', g.user); run(2.5); shot('live-' + g.camRig.mode);
const seen = []; let last = '', t = 0, shotFor = {};
runUntil(() => {
  t += 1 / 60;
  const key = g.goalPhase + ':' + (g.goalClip ?? '') + ':' + g.camRig.mode;
  if (key !== last) { seen.push(`${t.toFixed(1)} ${key}`); last = key; }
  if ((g.goalPhase === 'replay' || g.goalPhase === 'cut') && !shotFor[key] && g.sm.time > 0) { shotFor[key] = 1; run(0.8); shot(key.replace(/[:]/g, '-')); }
  return g.sm.is('KICKOFF') || g.sm.is('PLAYING');
}, 60);
// chance replay
runUntil(() => g.sm.is('PLAYING') && !g.match.restart && !g.foulRp, 20);
g.lastShot = { t: g.simTime - 1, team: 'home' };
g.ball.reset(53, 10); g.ball.vel.set(3, 0, 0); g.ball.lastTouch = g.defenders[1];
const tv = runUntil(() => g.foulRp && g.foulRp.on, 8);
run(1.5); shot('chance-' + g.camRig.mode + '-' + (g.camRig.opts.angle || 'side'));
return { seen, chanceReplay: tv, clips: g.foulRp && g.foulRp.clips.length };
