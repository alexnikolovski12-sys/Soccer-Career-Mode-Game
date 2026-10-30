// Minimal BVH reader + forward kinematics (CMU / cgspeed "MotionBuilder-friendly" files).
import fs from 'node:fs';
import * as THREE from 'three';

export function parseBVH(file) {
  const text = fs.readFileSync(file, 'utf8');
  const tok = text.split(/\s+/).filter(Boolean);
  let i = 0;
  const joints = [];
  const next = () => tok[i++];
  function readJoint(name, parent) {
    const j = { name, parent, offset: [0, 0, 0], channels: [], children: [], index: joints.length };
    joints.push(j);
    if (next() !== '{') throw new Error('expected {');
    for (;;) {
      const t = next();
      if (t === 'OFFSET') j.offset = [+next(), +next(), +next()];
      else if (t === 'CHANNELS') { const n = +next(); for (let k = 0; k < n; k++) j.channels.push(next()); }
      else if (t === 'JOINT') j.children.push(readJoint(next(), j));
      else if (t === 'End') {
        next(); // Site
        const e = { name: name + '_End', parent: j, offset: [0, 0, 0], channels: [], children: [], index: joints.length, end: true };
        joints.push(e);
        next(); // {
        next(); e.offset = [+next(), +next(), +next()];
        next(); // }
        j.children.push(e);
      } else if (t === '}') return j;
      else throw new Error('bad token ' + t);
    }
  }
  if (next() !== 'HIERARCHY') throw new Error('not bvh');
  next(); // ROOT
  readJoint(next(), null);
  while (tok[i] !== 'MOTION') i++;
  i++;
  next(); const frames = +next();
  next(); next(); const frameTime = +next();
  const nch = joints.reduce((s, j) => s + j.channels.length, 0);
  const data = new Float32Array(frames * nch);
  for (let k = 0; k < frames * nch; k++) data[k] = +tok[i++];
  return { joints, frames, frameTime, nch, data, byName: Object.fromEntries(joints.map((j) => [j.name, j])) };
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const AX = { Xrotation: new THREE.Vector3(1, 0, 0), Yrotation: new THREE.Vector3(0, 1, 0), Zrotation: new THREE.Vector3(0, 0, 1) };

/** World positions + world quaternions of every joint for one frame. */
export function fk(bvh, f) {
  const { joints, nch, data } = bvh;
  let c = f * nch;
  const pos = [], rot = [];
  for (const j of joints) {
    const local = new THREE.Quaternion();
    const off = new THREE.Vector3(...j.offset);
    for (const ch of j.channels) {
      const v = data[c++];
      if (ch === 'Xposition') off.x = v; else if (ch === 'Yposition') off.y = v; else if (ch === 'Zposition') off.z = v;
      else { _q.setFromAxisAngle(AX[ch], (v * Math.PI) / 180); local.multiply(_q); }
    }
    if (!j.parent) { pos[j.index] = off; rot[j.index] = local; continue; }
    const pq = rot[j.parent.index];
    pos[j.index] = off.applyQuaternion(pq).add(pos[j.parent.index]);
    rot[j.index] = pq.clone().multiply(local);
  }
  return { pos, rot };
}
void _e;
