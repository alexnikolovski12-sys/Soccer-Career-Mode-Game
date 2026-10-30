# Credits

## Motion capture — CMU Graphics Lab Motion Capture Database

The player movement is driven by motion capture from the
**CMU Graphics Lab Motion Capture Database**, http://mocap.cs.cmu.edu/ —
"The data used in this project was obtained from mocap.cs.cmu.edu.
The database was created with funding from NSF EIA-0196217."

The database is free to use, including in commercial games; the raw data may
not be resold. We use the BVH conversion by **Bruce Hahne** (cgspeed.com,
"MotionBuilder-friendly" 2010 release), fetched from the GitHub mirror
[una-dinosauria/cmu-mocap](https://github.com/una-dinosauria/cmu-mocap).
Only retargeted, resampled (30 fps) and quantised keyframes for this game's rig
are shipped (`assets/mocap/clips.json`, `src/anim/clipData.js`); the raw BVH
files are not redistributed.

Clips used (CMU subject_trial → what it drives in the game):

| Clip | CMU description | Used for |
|---|---|---|
| 136_25, 136_26 | normal walk backwards (standing start) | idles, backpedal |
| 77_03 | ready stance | keeper / defender ready stance |
| 35_01, 16_15, 02_01 | walk | walk cycles (3 variants) |
| 35_17, 35_18, 16_36 | run/jog | jog cycles (3 variants) |
| 16_46, 16_45, 127_07 | run/jog, run | run cycles (3 variants) |
| 141_01, 141_03 | run (fast) | sprint cycles, sprint start |
| 76_11 | quick large steps backwards | backpedal |
| 102_27 | basketball defensive side-to-side | jockey / side-step (mirrored for the other side) |
| 16_38, 16_48, 16_50 | run/jog veer left/right | running turns (mirrored) |
| 102_30, 127_04 | drive from stop, walk to run | accelerations |
| 16_57, 127_19, 16_08 | run sudden stop / quick stop | decelerations |
| 102_13, 102_14, 127_13 | basketball go left/right, run side step | cuts and side-steps (mirrored) |
| 16_51 | run 90° turn | 90° turns |
| 142_08 | walk with 180° turns | 180° turns |
| 10_01, 10_02, 10_03, 10_05, 10_06, 11_01 | soccer — kick ball | passes, shots, long balls, free-kick / penalty run-ups (mirrored for the left foot) |
| 22_12, 104_13 | stumbles into B, stumble walk | stumbles |
| 90_17, 90_18, 127_23 | banana-peel slip, rug-pull fall, run dive | falls, forward dive |
| 140_01, 140_03, 140_08 | get up face down / side / on back | get-ups |
| 13_39, 49_02, 141_05 | jump, jump up and down, jump sideways | celebration jumps, keeper push-off |
| 79_69, 80_43 | very happy, happy | celebration |

Sound credits are listed in the README.
