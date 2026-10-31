startMoment();
const u = g.user;
for (const p of g.defenders) p.place(-40, 30, 0);
u.place(0, 0, 0); g.ball.reset(5, 5); g.ball.owner = null;
run(0.6);
const shot = (label, a, d, h, ly) => {
  const cam = g.camRig.camera;
  cam.position.set(u.pos.x + Math.sin(u.heading + a) * d, h, u.pos.z + Math.cos(u.heading + a) * d);
  cam.lookAt(u.pos.x, ly, u.pos.z); cam.fov = 35; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  realRender(g.scene, cam); __shots.push([label, g.renderer.domElement.toDataURL('image/jpeg', 0.85)]);
};
shot('waist', 0.3, 1.5, 1.05, 1.0);
shot('chest', -0.3, 1.3, 1.35, 1.32);
return {};
