// Each scripted skill: frames from the side, ball path checked.
quickMatch('semipro', 150);
const out = {};
const cam = g.camRig.camera;
for (const key of ['rainbow', 'roulette', 'elastico', 'dragback']) {
  g.match.restart = null; g.setPiece = null; g.passing.reset(); g.skills.reset(); g.skills.cooldown = 0;
  for (const d of g.defenders) d.place(-45 + d.slot.fx * 5, d.slot.fz * 30, 0);
  const u = g.user; u.place(0, 0, Math.PI / 2); g.ball.reset(0.35, 0); g.possession.gain(u);
  mv.mag = 0; run(0.3);
  const ok = g.skills.perform(u, { rainbow: 'up', roulette: 'left', elastico: 'right', dragback: 'down' }[key]);
  const path = []; let maxY = 0, lost = false;
  for (let f = 0; f < 70; f++) {
    run(1 / 60);
    maxY = Math.max(maxY, g.ball.pos.y);
    if (f % 12 === 6) {
      path.push([+(g.ball.pos.x - u.pos.x).toFixed(2), +(g.ball.pos.z - u.pos.z).toFixed(2), +g.ball.pos.y.toFixed(2)]);
      u.render(1, 0);
      cam.position.set(u.pos.x + 0.5, 1.3, u.pos.z + 4.5); cam.lookAt(u.pos.x + 0.4, 0.8, u.pos.z); cam.fov = 45; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      const nr = g.renderer.render; g.renderer.render = realRender; g.renderFrame(cam); g.renderer.render = nr;
      __shots.push([`${key}-${f}`, g.renderer.domElement.toDataURL('image/jpeg', 0.75)]);
    }
  }
  run(0.6);
  out[key] = { ok, maxY: +maxY.toFixed(2), owner: g.ball.owner === u, path };
}
return out;
