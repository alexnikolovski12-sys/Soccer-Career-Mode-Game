// Side-on frames through one stride at a few speeds (look check).
quickMatch('semipro', 150);
g.match.restart = null;
for (const q of g.players) q.setVisible(q === g.homeSquad[5]);
const p = g.homeSquad[5];
p.setVisible(true);
const A = p.animator;
const cam = g.camRig.camera;
const out = [];
for (const v of [3.5, 6.5, 9.3]) {
  for (let i = 0; i < 120; i++) {
    p.vel.set(0, 0, v); p.prevPos.copy(p.pos); p.pos.set(0, 0, ((p.pos.z + v / 60 + 20) % 40) - 20); p.heading = 0; p.prevHeading = 0;
    p.updateAnimation(1 / 60, false);
  }
  const per = 1 / A.phaseRate;
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < Math.round(per * 60 / 4); i++) { p.vel.set(0, 0, v); p.prevPos.copy(p.pos); p.pos.z += v / 60; p.updateAnimation(1 / 60, false); }
    p.render(1, g.realTime);
    cam.position.set(p.pos.x + 4.2, 1.1, p.pos.z); cam.lookAt(p.pos.x, 0.95, p.pos.z); cam.fov = 40; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const nr = g.renderer.render; g.renderer.render = realRender; g.renderFrame(cam); g.renderer.render = nr;
    __shots.push([`v${v}-${k}`, g.renderer.domElement.toDataURL("image/jpeg", 0.8)]); out.push({ v, k, ph: +A.phase.toFixed(2), lean: [+A.lean.x.toFixed(2), +A.lean.y.toFixed(2)], sec: +A.sec.x.toFixed(2), c: A.contact.map((x) => +x.toFixed(2)), lock: A.lockW.map((x) => +x.toFixed(1)), gw: +(A.gaitW || 0).toFixed(2), ov: A.overlay ? A.overlay.kind : null, act: p.anim.action });
  }
  out.push({ v, sps: +(A.phaseRate * 2).toFixed(2), extra: +(A.strideExtra || 1).toFixed(2) });
}
return out;
