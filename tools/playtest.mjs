// Headless playtest helper: node tools/playtest.mjs <script.js> — runs the script in the game page.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [script, url = 'http://localhost:8080/'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
pg.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack));
// the page pins three on jsDelivr; serve it from node_modules so tests run offline
await pg.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, (route) => {
  const rel = route.request().url().replace(/^.*three@[^/]+\//, '');
  route.fulfill({ path: new URL(`../node_modules/three/${rel}`, import.meta.url).pathname, contentType: 'text/javascript' });
});
await pg.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ body: '', contentType: 'text/css' }));
await pg.goto(url);
await pg.waitForFunction(() => window.game && window.game.sm, null, { timeout: 30000 });
const fn = fs.readFileSync(new URL('./tests/_lib.js', import.meta.url), 'utf8') + '\n' + fs.readFileSync(script, 'utf8');
const res = await pg.evaluate(`(async () => { const __r = await (async () => { ${fn} })(); return { r: __r, shots: window.__shots || [] }; })()`);
const outDir = process.env.SHOTS;
if (outDir && res.shots.length) {
  fs.mkdirSync(outDir, { recursive: true });
  res.shots.forEach(([label, url], i) => fs.writeFileSync(`${outDir}/${String(i).padStart(2, '0')}-${label}.jpg`, Buffer.from(url.split(',')[1], 'base64')));
  console.log(`${res.shots.length} screenshots → ${outDir}`);
}
console.log(JSON.stringify(res.r, null, 1));
if (errors.length) console.log('ERRORS:\n' + errors.slice(0, 10).join('\n'));
await b.close();
