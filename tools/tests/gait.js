// Gait check: cadence (steps/s) and step length at each speed vs. real-world numbers.
quickMatch('semipro', 150);
g.match.restart = null;
const p = g.homeSquad[5];
const A = p.animator;
const res = [];
for (const v of [1.4, 2.5, 3.5, 5, 6.5, 8, 9.3, 10.3]) {
  for (let i = 0; i < 150; i++) {
    p.vel.set(0, 0, v); p.prevPos.copy(p.pos); p.pos.z = ((p.pos.z + v / 60 + 30) % 60) - 30; p.heading = 0; p.moveSpeed = v / 9; p.moveDir.set(0, 0, 1);
    p.updateAnimation(1 / 60, false);
  }
  const sps = A.phaseRate * 2;
  res.push({ v, stepsPerSec: +sps.toFixed(2), stepLen: +(v / sps).toFixed(2) });
}
return res;
