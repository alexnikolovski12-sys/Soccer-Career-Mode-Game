// Planted-foot slide per speed (no gameplay): node tools/viewer/slide.mjs [ik=1]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const ik = process.argv[2] !== '0';
const b = await chromium.launch();
const pg = await b.newPage();
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:8080/tools/viewer/?speed=0');
await pg.waitForFunction(() => window.ready);
const res = await pg.evaluate((ik) => {
  const out = {};
  const p = window.p, st = window.st;
  if (!ik) p.animator.solveIK = () => {};
  for (const sp of [1, 2, 3, 4, 5, 6, 7.5, 9]) {
    st.speed = sp;
    const t0 = st.t;
    window.frame(t0 + 1.5);
    const sl = [], prev = [null, null];
    for (let i = 0; i < 120; i++) {
      window.frame(st.t + 1 / 60);
      for (let k = 0; k < 2; k++) {
        const leg = k ? p.parts.legR : p.parts.legL;
        const v = new leg.ankle.position.constructor(); leg.ankle.getWorldPosition(v);
        const planted = p.animator.contact[k] > 0.6 && v.y < 0.12;
        if (planted && prev[k]) sl.push(Math.hypot(v.x - prev[k].x, v.z - prev[k].z) * 60);
        prev[k] = planted ? v : null;
      }
    }
    sl.sort((a, b) => a - b);
    out[sp] = { avg: +(sl.reduce((a, b) => a + b, 0) / (sl.length || 1)).toFixed(2), p90: +(sl[Math.floor(sl.length * 0.9)] || 0).toFixed(2), n: sl.length };
  }
  return out;
}, ik);
console.log(JSON.stringify(res));
await b.close();
