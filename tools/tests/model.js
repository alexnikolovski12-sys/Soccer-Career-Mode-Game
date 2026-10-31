// Close-ups of the new body: front, side, back, face; then a running frame.
startMoment();
const u = g.user;
for (const p of g.defenders) p.place(-40, 30, 0);
u.place(0, 0, 0); g.ball.reset(5, 5); g.ball.owner = null;
run(0.6);
const shot = (label, a, d, h, ly = 0.95) => {
  const cam = g.camRig.camera;
  cam.position.set(u.pos.x + Math.sin(u.heading + a) * d, h, u.pos.z + Math.cos(u.heading + a) * d);
  cam.lookAt(u.pos.x, ly, u.pos.z); cam.fov = 35; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  realRender(g.scene, cam); __shots.push([label, g.renderer.domElement.toDataURL('image/jpeg', 0.85)]);
};
shot('front', 0, 4.2, 1.2); shot('side', Math.PI / 2, 4.2, 1.2); shot('back', Math.PI, 4.2, 1.2);
shot('face', 0.35, 0.9, 1.68, 1.66);
const d = g.defenders[0]; d.place(1.5, 0, 0); run(0.3);
u.place(0, 0, 0);
mv.x = 0; mv.y = 1; mv.mag = 1; run(1.2); mv.mag = 0;
shot('run', Math.PI / 2, 5, 1.3);
return { verts: u.mesh.geometry.attributes.position.count, morphs: u.mesh.morphTargetInfluences.length, hair: u._hairStyle };
