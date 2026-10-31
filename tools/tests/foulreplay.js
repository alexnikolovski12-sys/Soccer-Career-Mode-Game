// A foul each way: after a beat the TV replay plays (match frozen), then play
// carries on into the set piece. Also checks the squads are the real ones.
g.autoplay = true;
quickMatch('semipro', 240);
const out = [];
const shotAt = (lab) => { const nr = g.renderer.render; g.renderer.render = realRender; g.renderFrame(g.camRig.camera); g.renderer.render = nr; __shots.push([lab, g.renderer.domElement.toDataURL('image/jpeg', 0.75)]); };
for (const [name, by, victim] of [['on you', () => g.defenders[3], () => g.user], ['by you', () => g.user, () => g.defenders[3]]]) {
  const free = () => g.sm.is('PLAYING') && !g.match.restart && !g.setPiece && !g.foulRp;
  for (let k = 0; k < 6; k++) { runUntil(free, 25); run(3); if (free()) break; }   // some open play to replay
  const v = victim(), b = by();
  b.pos.set(v.pos.x - 0.8, 0, v.pos.z); b.prevPos.copy(b.pos);
  g.onFoul({ by: b, victim: v });
  const clock0 = g.match.clock;
  let started = runUntil(() => g.foulRp && g.foulRp.on, 3);
  const clockOn = g.match.clock;
  let frozen = true, frames = 0, shot = false;
  const ok = runUntil(() => {
    if (!g.foulRp) return true;
    frames++;
    if (g.foulRp.on && g.match.clock !== clockOn) frozen = false;
    if (!shot && g.foulRp.age > 1.2) { shotAt(name); shot = true; }
    return false;
  }, 15);
  const tag = document.querySelector('.replay-tag, .replaytag');
  const after = runUntil(() => g.sm.is('PLAYING') && !g.match.restart && !g.setPiece, 25);
  out.push({ name, started, ended: ok, replaySec: +(frames / 60).toFixed(1), frozen, mode: g.camRig.mode, resumed: after, body: document.body.className });
}
const W = g.ut;
const opp = W._opponents().map((o) => o.club);
return { out, opponents: opp, xi: g.awaySquad.slice(0, 11).map((p) => p.name).join(', ') };
