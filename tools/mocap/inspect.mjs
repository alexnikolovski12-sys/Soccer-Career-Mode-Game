// Print a 30 fps timeline of a BVH clip to pick segments:
//   node tools/mocap/inspect.mjs <bvh dir> 16_45 [every=2]
import { processClip } from './process.mjs';
const [dir, name, every = 2] = process.argv.slice(2);
const { frames } = processClip(`${dir}/${name}.bvh`);
console.log("  t     v   yaw°/s  hipY  cL cR   hL    hR   vL   vR   fwd  lat");
frames.forEach((f, i) => {
  if (i % every) return;
  console.log(`${(i / 30).toFixed(2).padStart(5)} ${f.speed.toFixed(2).padStart(5)} ${(f.yawRate * 57.3).toFixed(0).padStart(6)}  ${f.off.y.toFixed(2)}  ${f.cL ? 'L' : '.'}  ${f.cR ? 'R' : '.'}  ${f.hL.toFixed(2)} ${f.hR.toFixed(2)} ${f.vmaxL.toFixed(1).padStart(4)} ${f.vmaxR.toFixed(1).padStart(4)} ${(f.dz*30).toFixed(1).padStart(5)} ${(f.dx*30).toFixed(1).padStart(5)}`);
});
