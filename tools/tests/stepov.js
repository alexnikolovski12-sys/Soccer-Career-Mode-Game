const out = {};
// market scroll check (before the match)
const ut = g.ut;
if (!ut.s) { ut._setup(); document.querySelector('.ut-setup .nm').value = 'Test FC'; document.querySelector('.ut-setup .go').click(); const ov = document.querySelector('.pack-open'); if (ov) { ov.click(); const k = document.querySelector('.pack-open .keep'); if (k) k.click(); } }
ut.go('market');
const b = document.querySelector('.ut-body');
out.market = { sh: b.scrollHeight, ch: b.clientHeight, ov: getComputedStyle(b).overflowY, nav: !!document.querySelector('.ut-nav') };
b.scrollTop = 400; out.market.after = b.scrollTop;
ut.go('home'); out.navHome = !!document.querySelector('.ut-nav');
quickMatch('semipro', 150);
for (const q of g.players) q.setVisible(q === g.user);
const u = g.user; g.match.restart = null; g.passing.reset(); g.skills.reset(); g.skills.cooldown = 0;
u.place(0, 0, Math.PI / 2); g.ball.reset(0.35, 0); g.possession.gain(u); mv.mag = 0; run(0.3);
g.skills.perform(u, 'right');
const cam = g.camRig.camera;
for (let f = 0; f < 72; f++) {
  run(1 / 60);
  if (f % 9 === 4) {
    u.render(1, 0);
    cam.position.set(u.pos.x + 3.2, 1.0, u.pos.z + 0.4); cam.lookAt(u.pos.x, 0.6, u.pos.z); cam.fov = 40; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const nr = g.renderer.render; g.renderer.render = realRender; g.renderFrame(cam); g.renderer.render = nr;
    __shots.push([`s${String(f).padStart(2, '0')}`, g.renderer.domElement.toDataURL('image/jpeg', 0.75)]);
  }
}
return out;
