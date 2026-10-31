quickMatch('semipro', 150);
g.match.restart = null;
const r = g.ref; r.pos.set(0, 0, 0); r.prevPos.copy(r.pos); r.heading = 0.4; r.prevHeading = 0.4; r.vel.set(0,0,0);
r.playAction('card', 2.0, { kickLeg: 1 });
g.cardMesh.visible = true;
for (let i = 0; i < 40; i++) { r.updateAnimation(1 / 60, false); r.render(1, 0); g._cardFrame(); }
const cam = g.camRig.camera;
for (const [lab, a] of [['front', 0.4], ['side', 0.4 + 1.57]]) {
  cam.position.set(Math.sin(a) * 4, 1.5, Math.cos(a) * 4); cam.lookAt(0, 1.2, 0); cam.fov = 40; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  g.cardMesh.lookAt(cam.position);
  const nr = g.renderer.render; g.renderer.render = realRender; g.renderFrame(cam); g.renderer.render = nr;
  __shots.push([lab, g.renderer.domElement.toDataURL('image/jpeg', 0.8)]);
}
return 1;
