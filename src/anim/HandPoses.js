// Hand-made poses for the moves that aren't in the CMU database (skill moves,
// tackles, blocks, keeper dives, some celebrations and touch variants).
// They use the original joint-angle keys; Animator converts them to joint
// rotations and layers them over the motion-capture base with per-joint masks,
// so the mocap keeps driving whatever a move doesn't touch.
//
// T starts out filled with NaN: only the keys a move sets are applied.
export const HAND_KEYS = [
  'hipL', 'hipR', 'kneeL', 'kneeR', 'shL', 'shR', 'shLz', 'shRz', 'elL', 'elR',
  'lean', 'roll', 'twist', 'bodyY', 'bodyPitch', 'bodyRoll', 'headPitch',
];

/** Fill T for action `name` at normalised time k. anim = player.anim, out.spinYaw may be set. */
export function handPose(name, k, T, anim, out) {
  const kick = anim.kickLeg >= 0 ? 'R' : 'L';
  const other = kick === 'R' ? 'L' : 'R';
  const ease = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
  switch (name) {
    case 'touch': {
      const v = Math.sin(k * Math.PI);
      const va = anim.variant;
      if (va === 'outside') {
        T['hip' + kick] = 0.2 + v * 0.4; T['knee' + kick] = 0.35 + v * 0.25;
        T.twist = (kick === 'R' ? -1 : 1) * 0.25 * v; T.bodyRoll = (kick === 'R' ? 1 : -1) * 0.08 * v;
      } else if (va === 'laces') {
        // pushed on with the laces, toe pointed, a longer stride
        T['hip' + kick] = 0.25 + v * 0.75; T['knee' + kick] = 0.15 + v * 0.35; T.lean = (T.lean || 0) + 0.06 * v;
      } else if (va === 'sole') {
        T['hip' + kick] = 0.3 * v; T['knee' + kick] = 0.4 + v * 0.7; T.lean = 0.12;
      } else {
        T['hip' + kick] = 0.15 + v * 0.55;
        T['knee' + kick] = 0.3 + v * 0.2;
      }
      break;
    }
    case 'turn': {
      // change of direction with the ball
      const v = Math.sin(k * Math.PI);
      const sd = anim.side || 1;
      const va = anim.variant;
      if (va === 'cut') {
        // plant the outside foot, drop the hips, push off the other way
        T['hip' + kick] = 0.55 * v; T['knee' + kick] = 0.9 * v;
        T['hip' + (kick === 'R' ? 'L' : 'R')] = -0.35 * v; T['knee' + (kick === 'R' ? 'L' : 'R')] = 0.7 * v;
        T.bodyY = -0.16 * v; T.bodyRoll = sd * 0.38 * v; T.twist = sd * 0.5 * v; T.lean = 0.3 * v;
      } else if (va === 'dragback') {
        // sole on the ball, roll it back and pivot
        T['hip' + kick] = 0.5 * v - 0.4 * Math.max(0, k - 0.4); T['knee' + kick] = 0.8 * v;
        T.lean = -0.18 * v; T.bodyY = -0.08 * v; T.twist = sd * 0.5 * v;
      } else if (va === 'hook') {
        // wrap the foot round it and spin off
        T['hip' + kick] = 0.6 * v; T['knee' + kick] = 1.1 * v;
        T.twist = sd * 0.7 * v; T.bodyRoll = sd * 0.25 * v; T.bodyY = -0.1 * v;
      } else if (va === 'outside') {
        T['hip' + kick] = 0.35 * v; T['knee' + kick] = 0.5 * v;
        T.twist = -sd * 0.4 * v; T.bodyRoll = sd * 0.3 * v; T.bodyY = -0.06 * v;
      } else {
        T['hip' + kick] = 0.45 * v; T['knee' + kick] = 0.55 * v;
        T.twist = sd * 0.45 * v; T.bodyRoll = sd * 0.22 * v; T.bodyY = -0.07 * v;
      }
      // a little arm out for balance through the turn, then straight back down
      T.shLz = 0.15 + 0.25 * v; T.shRz = -0.15 - 0.25 * v; T.lean = (T.lean || 0) + 0.15 * v;
      break;
    }
    case 'control': {
      // receiving: cushion with the inside, on the thigh, or chest it down
      const v = Math.sin(k * Math.PI);
      const va = anim.variant;
      if (va === 'chest') {
        T.lean = -0.4 * v; T.headPitch = 0.3 * v; T.shLz = 0.7 * v + 0.1; T.shRz = -0.7 * v - 0.1;
        T.shL = T.shR = 0.5 * v; T.kneeL = T.kneeR = 0.35; T.bodyY = -0.05 * v;
      } else if (va === 'thigh') {
        T['hip' + kick] = 1.1 * v; T['knee' + kick] = 1.3 * v; T.lean = -0.1 * v;
        T.shLz = 0.5; T.shRz = -0.5;
      } else if (va === 'heavy') {
        T.lean = 0.35 * v; T.bodyRoll = 0.2 * v * (anim.side || 1);
        T.shLz = 0.9 * v; T.shRz = -0.9 * v; T['hip' + kick] = 0.6 * v;
      } else {
        T['hip' + kick] = 0.35 * v; T['knee' + kick] = 0.45 * v; T.twist = (kick === 'R' ? 0.3 : -0.3) * v;
        T.lean = 0.1;
      }
      break;
    }
    case 'pass': {
      const va = anim.variant || 'side';
      const sg = kick === 'R' ? 1 : -1;
      const back = k < 0.35;
      const fwd = Math.min(1, (k - 0.35) / 0.3);
      if (va === 'backheel') {
        // heel it backwards: leg swings behind the body
        T['hip' + kick] = back ? ease(0, 0.45, k / 0.35) : ease(0.45, -0.95, fwd);
        T['knee' + kick] = back ? ease(0.2, 0.3, k / 0.35) : ease(0.3, 1.0, fwd);
        T['hip' + other] = 0.05; T['knee' + other] = 0.3;
        T.lean = 0.28; T.headPitch = -0.2; T.shLz = 0.5; T.shRz = -0.5;
      } else if (va === 'outside') {
        // trivela: flick across the body with the outside of the boot
        T['hip' + kick] = back ? ease(0, -0.6, k / 0.35) : ease(-0.6, 0.75, fwd);
        T['knee' + kick] = back ? ease(0.2, 1.3, k / 0.35) : ease(1.3, 0.15, fwd);
        T['hip' + other] = -0.12; T['knee' + other] = 0.3;
        T.twist = -sg * (back ? 0.15 : 0.5 * Math.sin(fwd * Math.PI * 0.5));
        T.bodyRoll = sg * 0.14 * Math.sin(k * Math.PI);
        T.shLz = 0.6; T.shRz = -0.6; T.lean = 0.12;
      } else if (va === 'flick') {
        const v = Math.sin(k * Math.PI);
        T['hip' + kick] = 0.15 + 0.5 * v; T['knee' + kick] = 0.5 * v; T.twist = sg * 0.3 * v; T.lean = 0.1;
      } else if (va === 'lofted' || va === 'chipped') {
        // lean back and get under it; a chipped ball is a short stab
        const top = va === 'chipped' ? 0.65 : 1.55;
        T['hip' + kick] = back ? ease(0, -1.0, k / 0.35) : ease(-1.0, top, fwd);
        T['knee' + kick] = back ? ease(0.2, 1.5, k / 0.35) : ease(1.5, va === 'chipped' ? 0.7 : 0.2, fwd);
        T['hip' + other] = -0.2; T['knee' + other] = 0.5;
        T.lean = back ? 0.0 : -0.28; T.bodyRoll = -sg * 0.18 * Math.sin(k * Math.PI);
        T.shLz = 1.0; T.shRz = -1.0; T.shL = back ? 0.2 : -0.3; T.shR = back ? -0.2 : 0.6;
        T.bodyY = -0.06;
      } else if (va === 'offbalance') {
        T['hip' + kick] = back ? ease(0.1, -0.6, k / 0.35) : ease(-0.6, 0.8, fwd);
        T['knee' + kick] = back ? ease(0.2, 1.2, k / 0.35) : ease(1.2, 0.2, fwd);
        T['hip' + other] = 0.1; T['knee' + other] = 0.5;
        T.bodyRoll = sg * 0.32 * Math.sin(k * Math.PI); T.lean = -0.15;
        T.shL = 1.2 * Math.sin(k * 7); T.shR = -0.5; T.shLz = 1.1; T.shRz = -0.4;
        T.bodyY = 0.06 * Math.sin(k * Math.PI);
      } else {
        // side-foot (and the bigger 'driven' version)
        const big = va === 'driven' ? 1.35 : 1;
        T['hip' + kick] = back ? ease(0.1, -0.85 * big, k / 0.35) : ease(-0.85 * big, 1.05 * big, fwd);
        T['knee' + kick] = back ? ease(0.2, 1.35, k / 0.35) : ease(1.35, 0.1, fwd);
        T['hip' + other] = -0.18; T['knee' + other] = 0.35;
        T.twist = sg * (back ? -0.3 * (k / 0.35) : 0.35 * Math.sin(fwd * Math.PI * 0.5));
        T.shLz = 0.7 * big; T.shRz = -0.7 * big; T.shL = back ? 0.3 : -0.2; T.shR = back ? -0.3 : 0.2;
        T.lean = back ? 0.05 : va === 'driven' ? 0.3 : 0.18;
        T.bodyY = -0.05;
      }
      break;
    }
    case 'shoot': {
      const va = anim.variant || 'laces';
      const sg = kick === 'R' ? 1 : -1;
      const back = k < 0.3;
      const fwd = Math.min(1, (k - 0.3) / 0.28);
      if (va === 'chip') {
        T['hip' + kick] = back ? ease(0, -0.7, k / 0.3) : ease(-0.7, 0.75, Math.min(1, (k - 0.3) / 0.15));
        T['knee' + kick] = back ? ease(0.2, 1.4, k / 0.3) : ease(1.4, 0.8, fwd);
        T['hip' + other] = -0.2; T['knee' + other] = 0.45;
        T.lean = back ? 0.05 : -0.35; T.shLz = 0.9; T.shRz = -0.9; T.headPitch = 0.25;
        break;
      }
      if (va === 'placed') {
        T['hip' + kick] = back ? ease(0, -0.75, k / 0.3) : ease(-0.75, 1.1, fwd);
        T['knee' + kick] = back ? ease(0.2, 1.3, k / 0.3) : ease(1.3, 0.1, fwd);
        T['hip' + other] = -0.15; T['knee' + other] = 0.35;
        T.twist = sg * (back ? -0.25 : 0.55 * Math.sin(fwd * Math.PI * 0.5)); T.lean = 0.15;
        T.shLz = 0.7; T.shRz = -0.7;
        break;
      }
      // power family: laces / driven / finesse / off-balance
      const peak = va === 'driven' ? 1.0 : va === 'finesse' ? 1.5 : 1.85;
      T['hip' + kick] = back ? ease(0, -1.25, k / 0.3) : k < 0.75 ? ease(-1.25, peak, fwd) : ease(peak, 0.2, (k - 0.75) / 0.25);
      T['knee' + kick] = back ? ease(0.2, 1.9, k / 0.3) : ease(1.9, 0.05, Math.min(1, (k - 0.3) / 0.2));
      T['hip' + other] = back ? -0.1 : -0.3; T['knee' + other] = back ? 0.45 : 0.25;
      T.shLz = 1.0; T.shRz = -1.0; T.shL = back ? 0.6 : -0.4; T.shR = back ? -0.6 : 0.5;
      T.lean = back ? 0.25 : k < 0.75 ? -0.2 : 0.05;
      T.twist = sg * (back ? -0.45 * (k / 0.3) : 0.55 * Math.sin(fwd * Math.PI * 0.6));
      T.bodyRoll = -sg * 0.12 * Math.sin(k * Math.PI);
      T.bodyY = k > 0.35 && k < 0.75 ? 0.07 : -0.04;
      if (va === 'driven') {
        // knee over the ball, keep it down
        T.lean = back ? 0.35 : 0.32; T.bodyY = -0.08; T.headPitch = -0.35;
      } else if (va === 'finesse') {
        // open the body, wrap the inside of the foot round it, lean away
        T.twist = sg * (back ? -0.3 : 0.85 * Math.sin(fwd * Math.PI * 0.6));
        T.bodyRoll = sg * 0.28 * Math.sin(k * Math.PI);
        T.shL = back ? 0.4 : 1.4; T.shLz = 1.2; T.lean = back ? 0.15 : -0.1;
      } else if (va === 'offbalance') {
        // snatched at while falling away
        const fall = Math.max(0, (k - 0.5) / 0.5);
        T.bodyRoll = -sg * (0.15 + 0.55 * fall); T.lean = -0.3; T.bodyY = -0.35 * fall;
        T.shL = 1.6 * Math.sin(k * 8); T.shLz = 1.4; T.shRz = -1.2;
      }
      break;
    }
    case 'tackle': {
      if (anim.variant === 'stand') {
        // standing poke: lunge a leg in
        const v = Math.sin(k * Math.PI);
        T.hipR = 1.25 * v; T.kneeR = 0.15; T.hipL = -0.2 * v; T.kneeL = 0.7 * v;
        T.lean = 0.35 * v; T.bodyY = -0.18 * v; T.shLz = 0.8 * v; T.shRz = -0.8 * v;
        break;
      }
      const v = k < 0.25 ? k / 0.25 : k > 0.75 ? (1 - k) / 0.25 : 1;
      T.bodyY = -0.62 * v; T.bodyPitch = -0.75 * v;
      T.hipR = 1.4 * v; T.kneeR = 0.1; T.hipL = 0.5 * v; T.kneeL = 1.3 * v;
      T.shL = -0.6 * v; T.shR = 0.4 * v; T.shLz = 0.9 * v; T.shRz = -0.9 * v;
      T.lean = -0.3 * v;
      break;
    }
    case 'block': {
      // throws himself in front of a shot that never comes
      const v = k < 0.2 ? k / 0.2 : k > 0.7 ? (1 - k) / 0.3 : 1;
      const sd = anim.side || 1;
      T.hipL = 1.0 * v; T.kneeL = 0.2; T.hipR = -0.2; T.kneeR = 0.9 * v;
      T.bodyRoll = sd * 0.5 * v; T.bodyY = -0.3 * v; T.shL = T.shR = -0.4 * v; T.shLz = 0.2; T.shRz = -0.2;
      T.lean = 0.25 * v; T.headPitch = -0.3 * v;
      break;
    }
    // ---- goal celebrations
    case 'kneeslide': {
      const v = Math.min(1, k / 0.12);
      T.bodyY = -0.46 * v; T.hipL = T.hipR = -0.05; T.kneeL = T.kneeR = 1.75 * v;
      T.lean = -0.45 * v; T.headPitch = 0.45 * v;
      T.shL = T.shR = 0.3 + 1.1 * v; T.shLz = 1.25 * v; T.shRz = -1.25 * v; T.elL = T.elR = 0.15;
      if (k > 0.55) { T.shL = T.shR = 2.6; T.shLz = 0.6; T.shRz = -0.6; } // arms up to the crowd
      break;
    }
    case 'airplane': {
      T.shLz = 1.5; T.shRz = -1.5; T.shL = T.shR = 0; T.elL = T.elR = 0.05;
      T.bodyRoll = Math.sin(anim.t * 2.4) * 0.32; T.lean = 0.1; T.headPitch = 0.15;
      break;
    }
    case 'jumpfist': {
      const t = anim.t;
      T.bodyY = Math.abs(Math.sin(t * 5.5)) * 0.38;
      T.shR = 2.95 - Math.abs(Math.sin(t * 5.5)) * 0.4; T.elR = 0.5; T.shRz = -0.2;
      T.shL = 0.4; T.elL = 1.6; T.shLz = 0.3;
      T.kneeL = T.kneeR = 0.3 + Math.abs(Math.cos(t * 5.5)) * 0.6; T.hipL = T.hipR = 0.25; T.headPitch = 0.3;
      break;
    }
    case 'spinjump': {
      const sd = anim.side || 1;
      if (k < 0.55) {
        const j = k / 0.55;
        T.bodyY = Math.sin(j * Math.PI) * 0.55; out.spinYaw = sd * Math.PI * j;
        T.kneeL = T.kneeR = 0.4 + Math.sin(j * Math.PI) * 0.6; T.hipL = T.hipR = 0.35 * Math.sin(j * Math.PI);
        T.shL = T.shR = 1.2; T.shLz = 0.6; T.shRz = -0.6;
      } else {
        out.spinYaw = sd * Math.PI;
        // land wide, arms down and out, chest out
        T.bodyY = -0.12; T.kneeL = T.kneeR = 0.35; T.hipL = 0.25; T.hipR = -0.25;
        T.shL = T.shR = -0.25; T.shLz = 0.75; T.shRz = -0.75; T.elL = T.elR = 0.05; T.lean = -0.2; T.headPitch = 0.25;
      }
      break;
    }
    case 'pointsky': {
      const t = anim.t;
      T.shL = T.shR = 2.95; T.elL = T.elR = 0.05; T.shLz = 0.15; T.shRz = -0.15;
      T.headPitch = 0.55; T.lean = -0.15; T.bodyY = Math.sin(t * 3) * 0.02;
      break;
    }
    case 'teamjump': {
      const t = anim.t + (anim.offset || 0);
      T.bodyY = Math.abs(Math.sin(t * 6.5)) * 0.28;
      T.shL = 2.6 + Math.sin(t * 6.5) * 0.25; T.shR = 2.6 - Math.sin(t * 6.5) * 0.25; T.elL = T.elR = 0.3;
      T.shLz = 0.4; T.shRz = -0.4; T.kneeL = T.kneeR = 0.3 + Math.abs(Math.cos(t * 6.5)) * 0.5; T.headPitch = 0.2;
      break;
    }
    case 'hug': {
      // arms wrapped round the scorer, leaning in, rocking
      const v = Math.min(1, k * 6), b = Math.sin((anim.t + (anim.offset || 0)) * 7) * 0.08;
      T.shL = T.shR = (1.35 + b) * v; T.shLz = -0.3 * v; T.shRz = 0.3 * v; T.elL = T.elR = 1.15 * v;
      T.lean = 0.2 * v; T.headPitch = 0.1 * v; T.bodyY = Math.abs(b) * 0.4;
      break;
    }
    case 'highfive': {
      // slap: reach up, smack, back down
      const v = Math.sin(Math.min(1, k * 1.3) * Math.PI);
      T.shR = 2.75 * v; T.shRz = -0.25 * v; T.elR = 0.25; T.shL = 0.3 * v; T.lean = -0.05 * v; T.headPitch = 0.25 * v;
      T.bodyY = Math.max(0, Math.sin(k * Math.PI)) * 0.18;
      break;
    }
    case 'pointat': {
      T.shR = 1.6; T.shRz = -0.1; T.elR = 0.05; T.shL = 0.4; T.shLz = 0.3; T.headPitch = 0.1;
      break;
    }
    case 'thumbsback': {
      // turns his back to the fans and points at the name on his shirt
      const v = Math.min(1, k * 4);
      T.shL = T.shR = 2.35 * v; T.shLz = 0.75 * v; T.shRz = -0.75 * v; T.elL = T.elR = 2.35 * v;
      T.headPitch = 0.3 * v; T.lean = -0.12 * v;
      break;
    }
    case 'bow': {
      // a slow bow to the crowd
      const v = Math.sin(Math.min(1, k * 1.15) * Math.PI);
      T.lean = 0.85 * v; T.shR = 0.9 * v; T.elR = 1.6 * v; T.shL = -0.35 * v; T.headPitch = -0.3 * v;
      break;
    }
    case 'armsup': {
      T.shL = 2.5; T.shR = 2.5; T.elL = T.elR = 0.2; T.shLz = 0.5; T.shRz = -0.5; T.headPitch = 0.2;
      break;
    }
    case 'stumble': {
      const v = Math.sin(k * Math.PI);
      T.lean = 0.55 * v; T.shLz = 0.9 * v; T.shRz = -0.9 * v; T.shL = 0.8 * v; T.shR = 0.6 * v;
      T.bodyY = -0.12 * v; T.roll = 0.25 * v * (anim.side || 1);
      break;
    }
    case 'fall': {
      const v = k < 0.3 ? k / 0.3 : k > 0.78 ? (1 - k) / 0.22 : 1;
      T.bodyPitch = 1.35 * v; T.bodyY = -0.72 * v;
      T.shL = T.shR = 2.0 * v; T.elL = T.elR = 0.5;
      T.hipL = T.hipR = -0.2 * v; T.kneeL = T.kneeR = 0.6 * v;
      break;
    }
    case 'celebrate': {
      const t = anim.t;
      T.shL = 2.7 + Math.sin(t * 9) * 0.25; T.shR = 2.7 + Math.sin(t * 9 + 1) * 0.25;
      T.shLz = 0.55; T.shRz = -0.55; T.elL = T.elR = 0.2;
      T.bodyY = Math.abs(Math.sin(t * 6)) * 0.22;
      T.kneeL = T.kneeR = 0.4 + Math.abs(Math.cos(t * 6)) * 0.4;
      T.hipL = T.hipR = 0.2; T.lean = -0.15; T.headPitch = 0.35;
      break;
    }
    case 'dive': {
      // keeper dive: take-off, full stretch through the air, land on his side and stay down
      const side = anim.side || 1;
      const roll = Math.max(1.35, anim.roll ?? 1.25);
      const up = Math.min(1, k / 0.18);
      const air = k < 0.55 ? Math.sin(Math.min(1, k / 0.55) * Math.PI) : 0;
      const land = k < 0.5 ? 0 : Math.min(1, (k - 0.5) / 0.2);
      T.bodyRoll = -side * (roll * up + (1.52 - roll) * land);
      T.bodyY = (anim.lift ?? 0.3) * air - 0.72 * land;
      T.shL = T.shR = 2.9 * up; T.shLz = 0.25; T.shRz = -0.25; T.elL = T.elR = 0.1 + 0.4 * land;
      T.hipL = T.hipR = 0.15 + 0.35 * land; T.kneeL = T.kneeR = 0.25 + 0.55 * land;
      T.lean = 0.05; T.headPitch = -0.15 * land;
      break;
    }
    case 'gkup': {
      // from lying on his side (after a dive) back to his feet: roll, knee, stand
      const side = anim.side || 1;
      const e = k * k * (3 - 2 * k);
      T.bodyRoll = -side * 1.52 * (1 - Math.min(1, e * 1.4));
      T.bodyY = -0.72 * (1 - e) - 0.25 * Math.sin(e * Math.PI);
      T.kneeL = T.kneeR = 0.8 + 1.0 * Math.sin(e * Math.PI) - 0.8 * e;
      T.hipL = T.hipR = 0.5 + 0.8 * Math.sin(e * Math.PI) - 0.5 * e;
      T.shL = T.shR = 0.4 * (1 - e); T.shLz = 0.3; T.shRz = -0.3; T.elL = T.elR = 0.6;
      T.lean = 0.45 * Math.sin(e * Math.PI);
      break;
    }
    case 'gkset': {
      // set position: knees bent, weight forward, hands low and out
      const t = anim.t;
      T.kneeL = T.kneeR = 0.55; T.hipL = T.hipR = 0.45; T.bodyY = -0.1;
      T.lean = 0.28; T.shL = T.shR = 0.55; T.shLz = 0.55; T.shRz = -0.55; T.elL = T.elR = 0.5;
      T.headPitch = -0.2; T.bodyRoll = Math.sin(t * 3) * 0.03;
      break;
    }
    case 'smother': {
      // dive forward at the striker's feet, onto the ball
      const v = Math.min(1, k / 0.3);
      T.bodyPitch = 1.35 * v; T.bodyY = -0.7 * v;
      T.shL = T.shR = 2.7 * v; T.shLz = 0.3; T.shRz = -0.3; T.elL = T.elR = 0.5;
      T.hipL = T.hipR = 0.3 * v; T.kneeL = T.kneeR = 0.9 * v; T.headPitch = -0.6 * v;
      break;
    }
    case 'gkthrow': {
      // overarm throw out
      const wind = Math.min(1, k / 0.4), rel = k < 0.4 ? 0 : Math.min(1, (k - 0.4) / 0.25);
      T.shR = 2.6 * wind - 1.0 * rel; T.shRz = -0.3; T.elR = 1.4 * wind - 1.3 * rel;
      T.shL = 0.9; T.shLz = 0.5; T.elL = 0.4;
      T.lean = -0.15 * wind + 0.35 * rel; T.twist = 0.35 * wind - 0.5 * rel;
      break;
    }
    case 'dejected': {
      // hands on head, staring at the grass
      const v = Math.min(1, k * 6);
      T.shL = T.shR = 2.55 * v; T.shLz = 0.95 * v; T.shRz = -0.95 * v; T.elL = T.elR = 2.3 * v;
      T.headPitch = 0.45 * v; T.lean = 0.12 * v;
      break;
    }
    case 'hipshands': {
      const v = Math.min(1, k * 6);
      T.shL = T.shR = 0.35 * v; T.shLz = 0.75 * v; T.shRz = -0.75 * v; T.elL = T.elR = 1.9 * v;
      T.headPitch = 0.55 * v; T.lean = 0.1 * v;
      break;
    }
    case 'sitdown': {
      // sits on the grass, knees up, arms resting on them, head down
      const v = Math.min(1, k * 2.2), e = v * v * (3 - 2 * v);
      T.bodyY = -0.74 * e; T.hipL = T.hipR = 1.45 * e; T.kneeL = T.kneeR = 1.9 * e;
      T.lean = 0.35 * e; T.shL = T.shR = 0.9 * e; T.shLz = 0.15; T.shRz = -0.15; T.elL = T.elR = 0.8 * e;
      T.headPitch = 0.5 * e;
      break;
    }
    case 'crouchsad': {
      const v = Math.min(1, k * 2.5), e = v * v * (3 - 2 * v);
      T.bodyY = -0.42 * e; T.hipL = T.hipR = 1.1 * e; T.kneeL = T.kneeR = 1.9 * e;
      T.lean = 0.5 * e; T.shL = T.shR = 0.6 * e; T.elL = T.elR = 1.2 * e; T.headPitch = 0.6 * e;
      break;
    }
    case 'catch': {
      T.shL = T.shR = 1.35; T.elL = T.elR = 0.9; T.shLz = 0.15; T.shRz = -0.15;
      T.lean = 0.35; T.bodyY = -0.1; T.kneeL = T.kneeR = 0.4;
      break;
    }
    case 'stepover': {
      // swing the leg round the ball, dip the shoulder
      const side = anim.side || 1;
      const v = Math.sin(k * Math.PI);
      T['hip' + kick] = 0.25 + 0.55 * v; T['knee' + kick] = 0.4 + 0.8 * v;
      T.twist = side * 0.45 * Math.sin(k * Math.PI * 2);
      T.bodyRoll = side * 0.18 * v; T.lean = 0.18;
      T.shLz = 0.35; T.shRz = -0.35;
      break;
    }
    case 'feint': {
      const side = anim.side || 1;
      const v = Math.sin(k * Math.PI);
      T.bodyRoll = -side * 0.3 * Math.sin(k * Math.PI * 1.6);
      T.twist = side * 0.3 * v; T.lean = 0.2; T.bodyY = -0.06 * v;
      T.shLz = 0.55 * v + 0.1; T.shRz = -0.55 * v - 0.1;
      break;
    }
    case 'croqueta': {
      // shift the ball foot to foot across the body
      const v = Math.sin(k * Math.PI);
      T.hipL = 0.25 * v; T.hipR = 0.25 * v; T.kneeL = T.kneeR = 0.35;
      T.bodyRoll = (anim.side || 1) * 0.15 * Math.sin(k * Math.PI * 2);
      T.lean = 0.2; T.bodyY = -0.05;
      break;
    }
    case 'spin': {
      // roulette / McGeady / Berba / scoop: the body spins over the ball
      out.spinYaw = (anim.spinAmt || Math.PI * 2) * (k * k * (3 - 2 * k));
      const v = Math.sin(k * Math.PI);
      T.hipL = 0.3 * Math.sin(k * Math.PI * 2); T.hipR = -T.hipL;
      T.kneeL = T.kneeR = 0.4; T.bodyY = -0.06 * v;
      T.shLz = 0.6; T.shRz = -0.6; T.lean = 0.1;
      break;
    }
    case 'dragback': {
      // sole on top of the ball, roll it back and across
      const v = Math.sin(k * Math.PI);
      T['hip' + kick] = 0.45 * v - 0.25 * Math.max(0, k - 0.5); T['knee' + kick] = 0.7 * v;
      T['hip' + other] = -0.1; T.lean = -0.12 * v; T.bodyY = -0.04 * v;
      T.twist = (anim.side || 1) * 0.35 * v;
      T.shLz = 0.5; T.shRz = -0.5;
      break;
    }
    case 'fakeshot': {
      // big shooting wind-up... then chop it the other way instead
      const back = k < 0.4;
      T['hip' + kick] = back ? ease(0, -1.1, k / 0.4) : ease(-1.1, 0.35, Math.min(1, (k - 0.4) / 0.2));
      T['knee' + kick] = back ? ease(0.2, 1.7, k / 0.4) : ease(1.7, 0.5, Math.min(1, (k - 0.4) / 0.2));
      T['hip' + other] = -0.15; T['knee' + other] = 0.35;
      T.shLz = 0.9; T.shRz = -0.9; T.lean = back ? 0.22 : 0.1;
      T.twist = (anim.side || 1) * (back ? -0.35 : 0.45);
      break;
    }
    case 'elastico': {
      const side = anim.side || 1;
      const v = Math.sin(k * Math.PI);
      T['hip' + kick] = 0.35 * v; T['knee' + kick] = 0.5 * v;
      T.twist = side * (k < 0.5 ? -0.5 : 0.6) * v;
      T.bodyRoll = side * 0.25 * (k < 0.5 ? -1 : 1) * v; T.lean = 0.2;
      break;
    }
    case 'flick': {
      // rainbow: heel flicks it up behind and over the head
      if (k < 0.45) {
        const v = Math.sin((k / 0.45) * Math.PI);
        T['hip' + kick] = -0.7 * v; T['knee' + kick] = 1.7 * v;
        T['hip' + other] = 0.15; T.lean = -0.1;
      }
      T.bodyY = k > 0.2 && k < 0.6 ? 0.08 : 0;
      T.shLz = 0.5; T.shRz = -0.5;
      break;
    }
    // ---- first-time finishes from a cross (contact at k ≈ 0.4)
    case 'volley': {
      // lean back, kicking leg swings through at hip height, arms out
      const back = k < 0.35, f = Math.min(1, (k - 0.35) / 0.25);
      T['hip' + kick] = back ? ease(0.2, -0.7, k / 0.35) : k < 0.75 ? ease(-0.7, 1.55, f) : ease(1.55, 0.3, (k - 0.75) / 0.25);
      T['knee' + kick] = back ? ease(0.3, 1.5, k / 0.35) : ease(1.5, 0.08, Math.min(1, (k - 0.35) / 0.18));
      T['hip' + other] = -0.15; T['knee' + other] = 0.4;
      T.lean = back ? 0 : -0.45; T.bodyY = k > 0.3 && k < 0.7 ? 0.12 : 0;
      T.shLz = 1.2; T.shRz = -1.2; T.shL = 0.5; T.shR = 0.5; T.headPitch = -0.2;
      break;
    }
    case 'sidevolley': {
      // body tips right over sideways, the leg whips round horizontally
      const sg = kick === 'R' ? 1 : -1;
      const tilt = Math.sin(Math.min(1, k / 0.6) * Math.PI * 0.5) * (k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1);
      T.bodyRoll = -sg * 1.0 * tilt; T.bodyY = 0.2 * tilt;
      T['hip' + kick] = k < 0.35 ? ease(0.3, -0.4, k / 0.35) : ease(-0.4, 1.6, Math.min(1, (k - 0.35) / 0.2));
      T['knee' + kick] = k < 0.35 ? 1.3 : ease(1.3, 0.1, Math.min(1, (k - 0.35) / 0.15));
      T['hip' + other] = 0.5 * tilt; T['knee' + other] = 0.9 * tilt;
      T.twist = sg * 0.6 * tilt; T.shLz = 1.4; T.shRz = -1.4; T.shL = 0.3; T.shR = 0.3; T.headPitch = -0.3 * tilt;
      break;
    }
    case 'bicycle': {
      // jump, fall back, scissor the legs over the head, land on your back
      const up = Math.min(1, k / 0.45);
      const land = Math.max(0, (k - 0.6) / 0.4);
      T.bodyPitch = -1.9 * Math.sin(up * Math.PI * 0.5) + land * 0.45;
      T.bodyY = Math.sin(Math.min(1, k / 0.55) * Math.PI) * 0.75 - land * 0.55;
      T['hip' + other] = 1.6 * up; T['knee' + other] = 1.4 * up;                 // the leg that swings up first
      T['hip' + kick] = k < 0.38 ? ease(0.2, 0.8, k / 0.38) : ease(0.8, 2.7, Math.min(1, (k - 0.38) / 0.14)); // the strike over the head
      T['knee' + kick] = k < 0.38 ? 1.2 : ease(1.2, 0.1, Math.min(1, (k - 0.38) / 0.12));
      T.shL = T.shR = -0.4 - up * 0.6; T.shLz = 1.0; T.shRz = -1.0; T.elL = T.elR = 0.3; T.headPitch = 0.4 * up;
      break;
    }
    // ---- more celebrations
    case 'cuptheear': {
      // "I can't hear you" — hand cupped to the ear, other arm out to the crowd
      const t = anim.t, v = Math.min(1, k * 6);
      T.shR = 1.65 * v; T.shRz = -1.25 * v; T.elR = 2.3 * v;
      T.shL = 0.4 * v; T.shLz = 1.25 * v; T.elL = 0.2;
      T.bodyRoll = 0.12 * v; T.headPitch = 0.15 + Math.sin(t * 2) * 0.05; T.lean = -0.08 * v;
      break;
    }
    case 'shush': {
      const v = Math.min(1, k * 6);
      T.shR = 1.35 * v; T.shRz = -0.15 * v; T.elR = 2.45 * v; T.shL = 0.1; T.shLz = 0.25; T.elL = 0.3;
      T.headPitch = -0.1 * v; T.lean = 0.04;
      break;
    }
    case 'armscrossed': {
      // stands there, arms folded, chin up — job done
      const v = Math.min(1, k * 5);
      T.shL = T.shR = 0.95 * v; T.shLz = -0.35 * v; T.shRz = 0.35 * v; T.elL = T.elR = 2.05 * v;
      T.headPitch = 0.25 * v; T.lean = -0.1 * v;
      break;
    }
    case 'salute': {
      const v = Math.min(1, k * 6);
      T.shR = 1.45 * v; T.shRz = -1.1 * v; T.elR = 2.4 * v; T.shL = 0.05; T.shLz = 0.12; T.elL = 0.1;
      T.headPitch = 0.12 * v; T.lean = -0.06 * v;
      break;
    }
    case 'calmdown': {
      // palms down, "calm down, calm down"
      const t = anim.t, v = Math.min(1, k * 5), p = Math.sin(t * 6) * 0.22;
      T.shL = T.shR = (0.7 + p) * v; T.shLz = 0.55 * v; T.shRz = -0.55 * v; T.elL = T.elR = 0.35;
      T.lean = 0.12 * v; T.kneeL = T.kneeR = 0.3 * v; T.bodyY = -0.05 * v;
      break;
    }
    case 'heart': {
      const v = Math.min(1, k * 5);
      T.shL = T.shR = 1.35 * v; T.shLz = -0.45 * v; T.shRz = 0.45 * v; T.elL = T.elR = 1.75 * v;
      T.headPitch = 0.1 * v;
      break;
    }
    case 'badgepoint': {
      // grab / point at the badge, other fist up
      const t = anim.t, v = Math.min(1, k * 5);
      T.shR = 1.0 * v; T.shRz = 0.45 * v; T.elR = 1.9 * v;
      T.shL = (2.6 + Math.sin(t * 5) * 0.2) * v; T.shLz = 0.25; T.elL = 0.4;
      T.headPitch = 0.3 * v; T.lean = -0.12 * v;
      break;
    }
    case 'robot': {
      // stiff robot dance, arms clicking between positions
      const t = anim.t, step = Math.floor(t * 3) % 4;
      T.elL = T.elR = 1.57;
      T.shL = step === 0 || step === 3 ? 1.5 : 0.1; T.shR = step === 1 || step === 2 ? 1.5 : 0.1;
      T.shLz = 0.15; T.shRz = -0.15;
      T.twist = [0.3, -0.3, 0.3, -0.3][step]; T.kneeL = T.kneeR = 0.12; T.headPitch = [0.1, -0.1, 0.1, -0.1][step];
      break;
    }
    case 'backflip': {
      // crouch, spring, full backward rotation tucked, land with arms up
      if (k < 0.18) { const c = k / 0.18; T.bodyY = -0.25 * c; T.kneeL = T.kneeR = 1.1 * c; T.hipL = T.hipR = 0.6 * c; T.shL = T.shR = -0.6 * c; }
      else if (k < 0.78) {
        const a = (k - 0.18) / 0.6;
        T.bodyY = Math.sin(a * Math.PI) * 0.95; T.bodyPitch = -Math.PI * 2 * (a * a * (3 - 2 * a));
        T.kneeL = T.kneeR = 1.9 * Math.sin(a * Math.PI); T.hipL = T.hipR = 1.4 * Math.sin(a * Math.PI);
        T.shL = T.shR = 1.0; T.elL = T.elR = 1.2;
      } else { const l = (k - 0.78) / 0.22; T.bodyY = -0.18 * (1 - l); T.kneeL = T.kneeR = 0.8 * (1 - l); T.shL = T.shR = 2.7 * l; T.shLz = 0.4; T.shRz = -0.4; }
      break;
    }
    case 'bellyslide': {
      // dive forward and slide on the front, arms out
      const v = Math.min(1, k / 0.12);
      T.bodyPitch = 1.45 * v; T.bodyY = -0.72 * v;
      T.shL = T.shR = 2.6 * v; T.shLz = 0.9 * v; T.shRz = -0.9 * v; T.elL = T.elR = 0.2;
      T.hipL = T.hipR = -0.15 * v; T.kneeL = T.kneeR = 0.5 * v; T.headPitch = -0.9 * v;
      break;
    }
    // ---- referee
    case 'card': {
      // right arm straight up holding the card, left arm pointing at the spot
      const v = Math.min(1, k / 0.15) * (k > 0.88 ? (1 - k) / 0.12 : 1);
      // stand square and upright, card held straight up, the other arm pointing to the spot
      T.shR = 3.1 * v; T.shRz = -0.05 * v; T.elR = 0.0;
      T.shL = 1.35 * v; T.shLz = 0.2 * v; T.elL = 0.05;
      T.headPitch = -0.05 * v; T.lean = 0; T.bodyRoll = 0; T.twist = 0;
      break;
    }
    case 'point': {
      T.shR = 2.5; T.shRz = -0.3; T.elR = 0.1;
      break;
    }
    default: break;
  }
}
