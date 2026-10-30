// One line per clip: footfall times and a coarse speed / hip-height profile.
//   node tools/mocap/survey.mjs <bvh dir> [names...]
import fs from 'node:fs';
import { processClip } from './process.mjs';
const [dir, ...names] = process.argv.slice(2);
const list = names.length ? names : fs.readdirSync(dir).filter((f) => f.endsWith('.bvh')).map((f) => f.slice(0, -4)).sort();
for (const n of list) {
  const { frames } = processClip(`${dir}/${n}.bvh`);
  const ev = [];
  frames.forEach((f, i) => {
    const p = frames[i - 1];
    if (i && f.cL && !p.cL) ev.push('L' + (i / 30).toFixed(2));
    if (i && f.cR && !p.cR) ev.push('R' + (i / 30).toFixed(2));
  });
  const prof = [];
  for (let i = 0; i < frames.length; i += 9) prof.push(`${frames[i].speed.toFixed(1)}/${frames[i].off.y.toFixed(2)}/${(frames[i].yawRate * 57.3).toFixed(0)}`);
  console.log(`${n} ${(frames.length / 30).toFixed(1)}s | ${ev.join(' ')}\n      ${prof.join(' ')}`);
}
