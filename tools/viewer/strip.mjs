// Contact sheet of the viewer: node tools/viewer/strip.mjs "clip=run1&side=side" out.png 0.1,0.2,...
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // pre-installed globally
import fs from 'node:fs';
const [q, out, ts] = process.argv.slice(2);
const times = (ts || '0.05,0.15,0.25,0.35,0.45,0.55').split(',').map(Number);
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 360, height: 420 } });
pg.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto(`http://localhost:8080/tools/viewer/?${q}`);
await pg.waitForFunction(() => window.ready, null, { timeout: 20000 });
const shots = [];
for (const t of times) { await pg.evaluate((t) => window.frame(t), t); shots.push(await pg.screenshot()); }
await b.close();
// stitch with a second page
const b2 = await chromium.launch();
const p2 = await b2.newPage({ viewport: { width: 360 * shots.length, height: 420 } });
await p2.setContent(`<body style="margin:0;display:flex">${shots.map((s) => `<img src="data:image/png;base64,${s.toString('base64')}">`).join('')}</body>`);
await p2.screenshot({ path: out });
await b2.close();
