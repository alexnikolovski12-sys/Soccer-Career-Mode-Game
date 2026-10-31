// Goal celebration frames through the game's own cameras.
quickMatch('semipro', 150);
const out = {};
g.match.restart = null;
const u = g.user;
u.pos.set(45, 0, 6); g.ball.pos.set(46, 0.11, 6); g.ball.owner = null;
g.scorer = u;
g.onGoal('home', u);
const snapGame = (label) => { g.frame(0, 1 / 60, 1 / 60); const nr = g.renderer.render; g.renderer.render = realRender; g.renderFrame(g.camRig.camera); g.renderer.render = nr; __shots.push([label, g.renderer.domElement.toDataURL('image/jpeg', 0.8)]); };
out.type = g.celebration && g.celebration.type;
for (const t of [1.0, 2.5, 4.0, 5.5, 7.0]) {
  runUntil(() => g.sm.time >= t || !g.sm.is('GOAL'), 12);
  snapGame(`t${t}`);
}
out.roles = g.homeSquad.map((p) => p.celRole || '-').join(',');
out.cam = g.camRig.mode;
return out;
