quickMatch('semipro', 150);
g.match.restart = null;
for (const q of g.players) q.setVisible(false);
const p = g.homeSquad[5]; p.setVisible(true);
const A = p.animator; const cam = g.camRig.camera;
p.pos.set(0, 0, 0); p.prevPos.set(0, 0, 0); p.heading = 0; p.prevHeading = 0; p.vel.set(0, 0, 0);
for (const v of [6.5, 9.3]) for (const ph of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]) {
  A.debugGait = ph; A.debugGaitV = v; p.updateAnimation(1 / 60, false); p.render(1, 0);
  cam.position.set(4.2, 1.0, 0); cam.lookAt(0, 0.9, 0); cam.fov = 38; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const nr = g.renderer.render; g.renderer.render = realRender; g.renderFrame(cam); g.renderer.render = nr;
  __shots.push([`v${v}-${ph}`, g.renderer.domElement.toDataURL('image/jpeg', 0.8)]);
}
return 1;
