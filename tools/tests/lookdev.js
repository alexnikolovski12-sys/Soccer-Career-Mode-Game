// Look-dev: the same shots every time, to compare the match look before / after changes.
// LOOK = { weather, time } can be set by the caller (window.LOOK) before the test runs.
const out = {};
const look = window.LOOK || { time: (typeof LOOK_TIME !== 'undefined' ? LOOK_TIME : 'night'), weather: (typeof LOOK_WEATHER !== 'undefined' ? LOOK_WEATHER : 'clear') };
quickMatch('semipro', 150);
if (g.setLook) g.setLook(look.time || 'night', look.weather || 'clear');
else if (g.weather) g.weather.set(look.weather || 'clear', 1);
g.autoplay = true;
run(6);
const cam = g.camRig.camera;
const view = (label, pos, at, fov = 45) => {
  cam.position.set(pos[0], pos[1], pos[2]);
  cam.lookAt(at[0], at[1], at[2]);
  cam.fov = fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const nr = g.renderer.render; g.renderer.render = realRender;
  if (g.renderFrame) g.renderFrame(cam); else realRender(g.scene, cam);
  g.renderer.render = nr;
  __shots.push([label, g.renderer.domElement.toDataURL('image/jpeg', 0.85)]);
};
// 1. the broadcast camera as the game uses it
g.frame(0, 1 / 60, 1 / 60);
const c0 = cam.position.clone(), l0 = g.camRig.look.clone();
view('broadcast', [c0.x, c0.y, c0.z], [l0.x, l0.y, l0.z], cam.fov);
// 2. close on a running player
const p = g.homeSquad.slice(1).reduce((b, q) => (q.speed > b.speed ? q : b), g.homeSquad[1]);
const h = p.heading;
view('player-close', [p.pos.x + Math.sin(h + 1.2) * 3.2, 1.45, p.pos.z + Math.cos(h + 1.2) * 3.2], [p.pos.x, 1.0, p.pos.z], 40);
// 3. low angle down the touchline toward the stands / floodlights
view('stadium-low', [-30, 1.6, -36], [10, 8, 20], 60);
// 4. behind the goal, high
view('behind-goal', [-62, 9, 0], [0, 0, 0], 50);
// 5. ball close-up
const b = g.ball.pos;
view('ball-close', [b.x + 1.2, 0.6, b.z + 1.2], [b.x, 0.12, b.z], 35);
out.players = g.players.length;
out.fps = null;
return out;
