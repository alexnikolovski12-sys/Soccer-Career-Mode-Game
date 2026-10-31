// Close-ups: grass blades, wear after play, kit stains and fabric.
quickMatch('semipro', 150);
g.setLook('day', 'clear');
g.autoplay = true;
run(4);
// a sliding player gets dirty and scars the turf
const p = g.homeSquad[4];
p.dirt = 0.9;
for (let i = 0; i < 40; i++) g.pitch.wear.add(p.pos.x + i * 0.05, p.pos.z, 0.05, 0.5);
for (let k = 0; k < 60; k++) g.pitch.wear.add(-3 + Math.random() * 6, Math.random() * 4 - 2, 0.15, 0.4);
g.pitch.wear.flush();
const cam = g.camRig.camera;
const view = (label, pos, at, fov) => {
  g.camRig.camera.position.set(...pos); g.camRig.look.set(...at); g.camRig.pos.set(...pos);
  g.frame(0, 1 / 60, 1 / 60);
  cam.position.set(...pos); cam.lookAt(...at); cam.fov = fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  g.pitch.shells.position.set(at[0], 0, at[2]); g.pitch.shells.visible = true; g.pitch.lines.position.y = 0.032;
  const nr = g.renderer.render; g.renderer.render = realRender; g.renderFrame(cam); g.renderer.render = nr;
  __shots.push([label, g.renderer.domElement.toDataURL('image/jpeg', 0.85)]);
};
view('blades-low', [1, 0.3, 2.2], [0, 0.0, -0.5], 45);
view('wear', [0, 3, 6], [0, 0, 0], 50);
const q = p.pos;
view('dirty-kit', [q.x + 1.6, 1.0, q.z + 1.6], [q.x, 0.7, q.z], 40);
return 1;
