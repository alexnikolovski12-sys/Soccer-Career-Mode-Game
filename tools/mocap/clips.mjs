// Which CMU motion-capture clips the game uses, and which part of each.
// cycle: a looping stride picked around `at` (seconds), rotated to start on the left footfall
// loop: a fixed range cross-faded into a loop (idles)
// once: a one-shot range [a, b]; kick: also finds the strike frame
// mirror: build the left↔right mirrored version as well (name + suffix)
export const SPEC = [
  // ---- locomotion cycles
  { name: 'idle1', file: '136_25', type: 'loop', a: 0.1, b: 1.6 },
  { name: 'idle2', file: '136_26', type: 'loop', a: 0.1, b: 2.3 },
  { name: 'ready', file: '77_03', type: 'loop', a: 3.0, b: 7.0 },
  { name: 'walk1', file: '35_01', type: 'cycle', at: 1.4 },
  { name: 'walk2', file: '16_15', type: 'cycle', at: 1.8 },
  { name: 'walk3', file: '02_01', type: 'cycle', at: 1.6 },
  { name: 'jog1', file: '35_17', type: 'cycle', at: 0.6 },
  { name: 'jog2', file: '35_18', type: 'cycle', at: 0.6 },
  { name: 'jog3', file: '16_36', type: 'cycle', at: 0.7 },
  { name: 'run1', file: '16_46', type: 'cycle', at: 0.45 },
  { name: 'run2', file: '16_45', type: 'cycle', at: 0.45 },
  { name: 'run3', file: '127_07', type: 'cycle', at: 0.6 },
  { name: 'sprint1', file: '141_01', type: 'cycle', at: 0.35 },
  { name: 'sprint2', file: '141_03', type: 'cycle', at: 1.45 },
  { name: 'back1', file: '136_26', type: 'cycle', at: 7.0 },
  { name: 'back2', file: '76_11', type: 'cycle', at: 1.8 },
  { name: 'strafeR', file: '102_27', type: 'cycle', at: 0.95, mirror: 'strafeL' },
  { name: 'jogTurnL', file: '16_38', type: 'cycle', at: 0.6, mirror: 'jogTurnR' },
  { name: 'runTurnL', file: '16_48', type: 'cycle', at: 0.45, mirror: 'runTurnR' },
  { name: 'runTurnR2', file: '16_50', type: 'cycle', at: 0.45, mirror: 'runTurnL2' },
  // ---- starts, stops, cuts, turns
  { name: 'start1', file: '102_30', type: 'once', a: 0.25, b: 1.75 },
  { name: 'start2', file: '141_03', type: 'once', a: 0.65, b: 1.9 },
  { name: 'start3', file: '127_04', type: 'once', a: 1.6, b: 3.65 },
  { name: 'stop1', file: '16_57', type: 'once', a: 0.0, b: 1.9 },
  { name: 'stop2', file: '127_19', type: 'once', a: 0.3, b: 1.9 },
  { name: 'stop3', file: '16_08', type: 'once', a: 0.6, b: 1.95 },
  { name: 'cutR', file: '102_13', type: 'once', a: 0.15, b: 1.25, mirror: 'cutL' },
  { name: 'cutL2', file: '102_14', type: 'once', a: 0.25, b: 1.5, mirror: 'cutR2' },
  { name: 'sidestepL', file: '127_13', type: 'once', a: 0.0, b: 1.0, mirror: 'sidestepR' },
  { name: 'turn90L', file: '16_51', type: 'once', a: 0.0, b: 1.45, mirror: 'turn90R' },
  { name: 'turn180', file: '142_08', type: 'once', a: 5.6, b: 7.4, mirror: 'turn180m' },
  // ---- kicks (right foot; mirrored for the left)
  { name: 'kickPass', file: '10_05', type: 'kick', a: 1.95, b: 3.25, mirror: 'kickPassL' },
  { name: 'kickPass2', file: '10_06', type: 'kick', a: 0, b: 0, mirror: 'kickPass2L', auto: 0.55 },
  { name: 'kickShot', file: '10_02', type: 'kick', a: 2.3, b: 3.75, mirror: 'kickShotL' },
  { name: 'kickLong', file: '11_01', type: 'kick', a: 2.75, b: 4.2, mirror: 'kickLongL' },
  { name: 'kickShot2', file: '10_03', type: 'kick', a: 0, b: 0, mirror: 'kickShot2L', auto: 0.6 },
  { name: 'kickRunup', file: '10_02', type: 'kick', a: 1.6, b: 3.8, mirror: 'kickRunupL' },
  { name: 'kickRunup2', file: '10_01', type: 'kick', a: 0, b: 0, mirror: 'kickRunup2L', auto: 1.3 },
  // ---- falls, stumbles, get-ups
  { name: 'stumble1', file: '22_12', type: 'once', a: 0.0, b: 1.6, mirror: 'stumble1m' },
  { name: 'stumble2', file: '104_13', type: 'once', a: 1.4, b: 2.6, mirror: 'stumble2m' },
  { name: 'fallBack', file: '90_18', type: 'once', a: 0.75, b: 2.1 },
  { name: 'fallSlip', file: '90_17', type: 'once', a: 2.6, b: 4.3 },
  { name: 'fallFwd', file: '127_23', type: 'once', a: 0.55, b: 1.55 },
  { name: 'getupFront', file: '140_01', type: 'once', a: 1.8, b: 5.0 },
  { name: 'getupBack', file: '140_08', type: 'once', a: 2.4, b: 5.9 },
  { name: 'getupSide', file: '140_03', type: 'once', a: 3.4, b: 6.6 },
  // ---- jumps, celebrations, dives
  { name: 'jump', file: '13_39', type: 'once', a: 0.4, b: 2.5 },
  { name: 'jumpLoop', file: '49_02', type: 'loop', a: 1.2, b: 3.4 },
  { name: 'happy1', file: '79_69', type: 'loop', a: 2.6, b: 6.6 },
  { name: 'happy2', file: '80_43', type: 'loop', a: 2.4, b: 5.6 },
  { name: 'diveFwd', file: '127_23', type: 'once', a: 0.7, b: 1.7 },
  { name: 'jumpSide', file: '141_05', type: 'once', a: 0.4, b: 1.8, mirror: 'jumpSideM' },
];

