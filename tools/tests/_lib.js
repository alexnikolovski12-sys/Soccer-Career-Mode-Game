// Shared helpers prepended to every test: deterministic stepping at 60 fps (no rAF),
// rendering skipped unless asked (animation + IK still run in Player.render).
const g = window.game;
g.loop.stop();
const realRender = g.renderer.render.bind(g.renderer);
g.renderer.render = () => {};
const FR = 1 / 60;
let acc = 0;
const tick = () => {
  acc += FR * g.loop.timeScale;
  let n = 0;
  while (acc >= g.loop.step && n < 5) { g.loop.update(g.loop.step); g.loop.simTime += g.loop.step; acc -= g.loop.step; n++; }
  g.frame(acc / g.loop.step, FR, FR * g.loop.timeScale);
};
const run = (sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { tick(); if (each && each() === false) return false; } return true; };
const runUntil = (f, maxSec = 20) => { for (let i = 0; i < maxSec * 60; i++) { if (f()) return true; tick(); } return false; };
const mv = { x: 0, y: 0, mag: 0 };
g.input.poll = () => mv;
const press = (name, dir = 'tap', held = 0, dy = 0) => { g.input.gestures[name] = { dir, held, dy }; };
const avg = (a) => (a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3) : null);
const pct = (a, p) => (a.length ? +a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(3) : null);
const V = (o) => { const v = new o.position.constructor(); o.getWorldPosition(v); return v; };
// a full match against a Squad Battles opponent (creates a club if there isn't one)
const quickMatch = (diff = 'semipro', len = 150) => {
  const ut = g.ut;
  if (!ut.s) { ut._setup(); document.querySelector('.ut-setup .nm').value = 'Test FC'; document.querySelector('.ut-setup .go').click();
    const ov = document.querySelector('.pack-open'); if (ov) { ov.click(); const k = document.querySelector('.pack-open .keep'); if (k) k.click(); } }
  ut.s.diff = diff; ut.s.len = len;
  ut._kickOff(ut._opponents()[1]);
  return runUntil(() => g.sm.is('PLAYING'), 10);
};
// older tests: a match in progress, play stopped where the test sets it up
const startMoment = () => { if (!g.sm.is('PLAYING')) quickMatch(); g.match.restart = null; g.ball.frozen = false; return true; };
// deterministic Math.random for repeatable runs (set SEED in a test to vary)
let _seed = 12345;
Math.random = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };
const seed = (s) => { _seed = s >>> 0; g.rng = g.rng.constructor ? g.rng : g.rng; };
// screenshots: snap(label) renders the frame and keeps a JPEG (playtest.mjs writes them out)
const __shots = (window.__shots = []);
const snap = (label, close = null) => {
  const cam = g.camRig.camera;
  if (close) {
    // close-up from the side of a player: close = { p, side, dist, h }
    const p = close.p || g.user, d = close.dist || 4, a = p.heading + (close.side ?? Math.PI / 2);
    cam.position.set(p.pos.x + Math.sin(a) * d, close.h || 1.3, p.pos.z + Math.cos(a) * d);
    cam.lookAt(p.pos.x, 0.8, p.pos.z);
    cam.updateMatrixWorld();
  }
  realRender(g.scene, cam); __shots.push([label, g.renderer.domElement.toDataURL('image/jpeg', 0.75)]); };
