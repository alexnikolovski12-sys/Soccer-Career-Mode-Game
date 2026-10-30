// Visual pass: screenshots of dribbling, a shot, a pass and the celebration.
startMoment();
g.config.defender.tackleSuccessMult = 0;
g.moments.current.timer = 60;
mv.x = 0; mv.y = 1; mv.mag = 1;
run(1.2); snap('dribble-run', {});
g.input.held.sprint = true; run(1.0); snap('dribble-sprint', {}); run(0.13); snap('dribble-sprint2', {});
g.input.held.sprint = false;
mv.x = 0.9; mv.y = 0.3; run(0.25); snap('cut', { side: 2.2 });
mv.x = 0; mv.y = 1;
runUntil(() => g.shooting.inRange(g.user) || g.ball.owner !== g.user, 8);
press('shoot', 'tap', 0.6);
run(0.1); snap('shot-windup', { side: 1.2 }); run(0.06); snap('shot-contact', { side: 1.2 }); run(0.2); snap('shot-follow', { side: 1.2 });
runUntil(() => g.sm.is('RESULT'), 6);
run(1.5); snap('result-1'); snap('result-1c', { side: 2.5, dist: 5 }); run(1.5); snap('result-2', { side: 2.5, dist: 5 });
return { outcome: g.resultOutcome, cel: g.celebration && g.celebration.type };
