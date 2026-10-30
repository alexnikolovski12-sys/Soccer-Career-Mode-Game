# Breakaway: Match Engine Prototype ("Attacking Moment")

A 3D mobile football prototype for iPhone (runs in the browser). You play one
polished **attacking moment**: the core gameplay unit of a future single-player
career mode. All visuals, names and branding are original.

- **Tech:** Three.js r186 (ES modules via an import map, pinned on jsDelivr), vanilla JS, no build step to play.
- **Loop:** fixed 60 Hz simulation with interpolated rendering. Time scale drives the shot freeze and slow-mo.
- **Movement:** real motion capture (CMU database) retargeted onto the players, a locomotion blend tree, foot IK and a light physics layer — see [Movement](#movement-motion-capture--physics).
- **Assets:** bodies are procedural primitives; motion is mocap; sounds are real recordings (see credits).

**Single file for iPhone:** `Breakaway.html` is the whole game in one file (three.js bundled, CSS, mocap and
audio inlined, ~1.5 MB). AirDrop or save it to Files and open it — no server needed. Rebuild with
`npm install && npm run build`.

## Run it

You need Node 18+ (only for the tiny static server; there are no dependencies to install).

```bash
node server.mjs          # or: npm start
```

The server prints two URLs:

```
Desktop:  http://localhost:8080
iPhone:   http://192.168.x.x:8080   (same Wi-Fi)
```

Any static server works too (for example `python3 -m http.server 8080`). The page
loads Three.js and the font from CDNs, so the device needs internet access.

### On your iPhone over Wi-Fi
1. Make sure the computer and the iPhone are on the same Wi-Fi network.
2. Run `node server.mjs` on the computer.
3. On the iPhone, open Safari and type the `iPhone:` URL the server printed.
   If it doesn't load, allow incoming connections for Node in your computer's firewall
   (macOS: System Settings → Network → Firewall).
4. Tap **Tap to Kick Off**. This also unlocks audio, which iOS requires.
5. Rotate to landscape for the best view. Portrait still works.

### Add it to your Home Screen (full-screen app)
1. Open the URL in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Launch it from the new **Breakaway** icon. It runs full-screen with a
   translucent status bar, and the HUD respects the notch, Dynamic Island and home indicator.

## Controls

| Action | Touch | Desktop |
|---|---|---|
| Move | Floating joystick (left half). Small tilt jogs, full tilt runs | WASD / arrows |
| Sprint | Hold **SPRINT** (the ring shows stamina) | Shift |
| Pass / call for the ball | **PASS** (shows **CALL** when a teammate has it) | Space |
| Shoot | **SHOOT** (pulses when you're in range) | F |
| Aim the shot | Pull back anywhere and release. Drag back to the start point to cancel | Mouse drag, Esc cancels |
| Pause | ⏸ (auto-pauses when the app is hidden) | P |
| Debug panel | ⚙ or a **3-finger tap** | ` |
| Result card | Next Moment / Retry | Enter / R |

**The slingshot shot:** tapping SHOOT eases time to a freeze (desaturation,
vignette, whoosh), and the shooter steps into a set-piece stance. The camera frames
the ball and the goal. Then you drag:
- The arrow points **opposite** your drag. Its colour shows power: green (controlled), yellow (strong), red (rocket, which pulses).
- Sideways aims across the goal. Pulling down adds loft. A small vertical pull keeps the shot low and driven.
- The **white circle** is where the ball will cross the line. It comes from the same integrator as the real flight; scripted tests matched to within 1 mm. It wobbles more under pressure, when you're tired, in the red zone, and with lower finishing/composure. A **red ✕** means the shot misses.

## File structure

```
index.html, manifest.json, server.mjs, icons/
src/main.js                 bootstrap, game loop wiring, state machine states
src/config.js               ALL tunable numbers + stat→gameplay formulas
src/core/                   Loop (fixed step), StateMachine, Input (multi-touch), Audio (Web Audio),
                            Quality (adaptive), MathUtil
src/world/                  Pitch (markings, goals, rippling nets, stadium, lights), Camera, Effects
src/entities/               Player (shared body/stats/rig), Ball (pure integrator), Keeper
src/anim/                   Animator (blend tree, transitions, action layers, physics, foot IK),
                            Clips (mocap decoding/sampling), HandPoses (non-mocap moves), clipData (generated)
assets/mocap/clips.json     converted mocap keyframes (same data as src/anim/clipData.js)
tools/mocap/                BVH → game-rig converter (fetch.mjs, convert.mjs, clips.mjs, inspect/survey)
tools/build.mjs             single-file Breakaway.html build (esbuild)
tools/playtest.mjs, tests/  headless Chromium playtests; tools/viewer/ mocap viewer
src/ai/                     TeammateAI, DefenderAI
src/gameplay/               MomentManager, Passing, Shooting, Possession (dribble/receive), Replay
src/ui/                     HUD, Joystick, ShotOverlay, styles.css, safeArea
src/data/playerStats.js     your player's stat object, teams, presets
src/debug/DebugPanel.js     tuning panel
```

A few files go beyond the requested list: `Possession.js` (ball control),
`Replay.js`, `Effects.js`, `Audio.js`, `Quality.js`, `MathUtil.js`, `safeArea.js`
and `styles.css`.

**Built for the future career mode:**
- `Player` appearance comes only from `look` (kit, shorts, socks, skin, hair, height, number), so a skinned model with face morphs and hair can replace `_build()` without touching gameplay.
- All gameplay reads stats through `CONFIG.statMap`.
- `MomentManager` exposes `setup()`, `update()` and `end()`, a per-moment `result` (outcome, rating items) and a `match` object, ready for a MatchManager to chain moments.

## Movement: motion capture + physics

Players move with **real motion capture** from the CMU Graphics Lab Motion Capture Database
(free for games; see [CREDITS.md](CREDITS.md) for the exact clips). The pipeline:

1. `tools/mocap/fetch.mjs` downloads the chosen BVH clips (listed in `tools/mocap/clips.mjs`) from a GitHub mirror.
2. `tools/mocap/convert.mjs` retargets them onto the game rig (pelvis, torso, head, hips, knees, ankles,
   shoulders, elbows): trunk frames from joint positions, limbs aimed along the real bone directions with
   the knee/elbow bend plane for twist, hinges for knees/elbows/ankles. Clips are resampled to 30 fps,
   made facing-relative (root motion stored separately), foot contacts detected, loops closed and
   phase-aligned to the left footfall, left/right mirrored variants generated, kick contact frames found,
   and everything quantised to int16 (71 clips, ~270 KB).

At runtime (`src/anim/Animator.js`):
- **Locomotion blend tree** — idle ↔ walk ↔ jog ↔ run ↔ sprint by real ground speed, plus backpedal and
  side-step groups by the direction of travel (defenders jockey facing the ball). One shared stride phase;
  playback rate = ground speed ÷ stride length, so planted feet don't slide. Above the sprint clip's speed
  the stride lengthens rather than just the cadence. Turn clips blend in by angular velocity.
- **Transitions** — explosive starts (lean to go) and braking stops (sit back) are mapped to the player's
  actual speed; sharp direction changes play a plant-and-push-off cut; slow reversals play a 180° turn.
- **Actions** — each kick variant uses a CMU soccer kick, time-warped so the boot meets the ball exactly
  when the ball is released (passes after `pass.windup`, shots after `shot.strikeWindup`, free kicks and
  penalties after a real run-up). Falls, stumbles, get-ups and celebrations are mocap too. Moves that
  aren't in CMU (step-overs, elasticos, drag-backs, tackles, blocks, knee slide, keeper dive, …) keep their
  hand-made poses, layered over the mocap base with per-joint masks so the rest of the body stays natural.
  All layers cross-fade (no pops).
- **Dribbling** — the run cycle is the base; stride touches are timed to the real footfall of the touching
  foot and that foot reaches the ball with IK. The ball sits ~0.5 m ahead (a bit more when sprinting).
- **Variation** — per-player stride, cadence, arm swing, posture, and 2–3 clip variants per gait.
- **Physics layer** — momentum (turn rate limited by sideways grip from acceleration/dribbling stats, plus
  the existing accel/brake limits), whole-body lean from acceleration and turning, torso/head springs,
  capsule bumps that exchange momentum by mass and stagger both players, tackle impulses, and a
  spring-driven ragdoll-lite for falls (inverted-pendulum topple in the direction of the hit, limbs from the
  fall clip, then the matching get-up clip).
- **Foot IK** — planted feet lock to the grass, feet never sink, touching/kicking feet reach the ball.

Dev tools: `tools/viewer/` shows the rig playing any clip (`/tools/viewer/?clip=run1` or `?speed=6`);
`tools/mocap/inspect.mjs` / `survey.mjs` print clip timelines; `npm test` runs the headless playtests.

## What's in `config.js`

| Section | What it tunes |
|---|---|
| `sim` | 60 Hz step, ball sub-steps |
| `pitch`, `colors` | real dimensions (105×68, 7.32×2.44 goals, boxes, arcs), palette |
| `statMap` | every stat→gameplay formula: speed, acceleration, dribble touch size and error, reach, turn control, first touch, pass error/speed, vision cone, wobble, keeper modifier, shot speed, composure, stamina drain |
| `teamMap` | team overall → reaction, speed, tackling, interceptions, decision time |
| `player`, `dribble`, `ball` | turning, grip (momentum), bumps, jockeying, braking, touch timing, sprint carry, trap, receive reach, drag, Magnus, bounce, friction |
| `pass` | targeting weights, lead, through balls, windup, pressure |
| `shot` | range, freeze timing, pull length, cancel radius, power zones, lateral/height gain, curl, wobble terms, slow-mo, blocks |
| `keeper` | rating, difficulty, reaction, dive speed, reach, save curve, corner penalties |
| `defender`, `teammate` | pressing, jockey and tackle ranges, cooldowns, pokes, marking, support radii, user-pass bias |
| `moment` | 20 s timer, intro time, scenario weights |
| `rating` | per-event match-rating contributions |
| `camera` | landscape/portrait follow settings, crowd/speed zoom, shot framing, shake |
| `quality` | adaptive levels and thresholds |
| `juice` | replay length/speed, confetti, shake |

### Top 5 values to experiment with for game feel
1. **`statMap.touchMult` / `dribble.touchBase`**: how far each dribble touch pushes the ball. This is the biggest lever on "close control vs. heavy touch".
2. **`shot.maxPullFrac` + `shot.lateralGain` / `shot.heightGain`**: slingshot sensitivity. These set how far you pull for full power and how far the aim moves per pull.
3. **`shot.wobbleScale`** (plus `statMap.finishingWobble`, `shot.wobblePressure`, `shot.wobbleRedZone`): how hard it is to hold the target circle steady.
4. **`keeper.reachBase` / `keeper.reachSlope` / `keeper.difficulty`**: the save curve. Weak/central shots are saved about 95% of the time; hard, well-placed shots from inside the box go in about 75–97% of the time.
5. **`defender.tackleEagerness` / `teamMap.tackleSkill`**: how often defenders lunge and win it, which sets the overall difficulty of dribbling.

Close runners-up: `player.turnRateRun`, `camera.landscape.distance/height`, `shot.freezeTime`.

## How it was verified

Headless Chromium (software WebGL) scripted playtests covered these checks:
- **No runtime errors** across all states.
- **Shot prediction:** the predicted circle matched the actual goal-line crossing to within about 1 mm, on four shots (two goals, one over the bar, one wide).
- **Drag-back cancel:** dragging back to the start hides the arrow and circle, releasing there keeps aim mode, and a second pull fires.
- **Cancel, pause and resume:** the Cancel button works, and pause freezes the simulation.
- **Goal sequence:** banner, confetti and net ripple, then the letterboxed slow-mo replay, then the result card.
- **AI play:** one-twos (a teammate returns the ball about 0.4 s after receiving), tackles, pokes and "beat defender" events all happen in normal play.
- **Keeper fairness:** a statistical table across shot types and distances.
- **HUD safe areas:** no overlap with simulated notch and home-bar insets at 375×667, 390×844 and 430×932, in both orientations.
- **Performance budget:** about 190 draw calls (300 with shadows), about 0.02 ms per simulation step, and about 0.5 ms per aim-solve frame.

Movement rebuild (`npm test`, deterministic 60 fps stepping in headless Chromium):
- **Planted feet:** ~0.05 m/s average drift while weight-bearing during dribbling (IK lock), 0.02–0.25 m/s across 1–9 m/s in the viewer.
- **Touches:** the touching foot is ~5 cm from the ball at the touch; ball ~0.45–0.55 m ahead, ~0.6 m when sprinting.
- **Passing:** 40/40 passes reached a teammate (also from the single-file build).
- **Set pieces:** free kicks and penalties run up and release on the kick's contact frame (foot on the ball).
- **Soak:** 14 moments with random input through every state and the replay: no errors, no NaN poses.
- **Cost:** ~0.2 ms of animation CPU per frame for a moment, ~0.6 ms with all 23 bodies (desktop).

**Not verified here:** real-device frame rate, touch feel and audio. Those need a
physical iPhone, and the adaptive quality system steps down automatically if FPS drops.

## Suggested next step: Match Manager

Add `src/gameplay/MatchManager.js` to run a whole match:
- Pick **6–8 moment slots** across 90' (weighted by the team's attacking strength), and simulate the time between them.
- **Simulate the opponent's chances:** a Poisson-style model driven by both team ratings, so the scoreline evolves around your moments ("Northgate equalise, 58'").
- **Feed context into each moment:** score state, fatigue (carry stamina over), and late-game urgency (shorter timer, more risk).
- **Compute the overall match rating:** base 6.0 + Σ moment contributions + a team-result bonus, clamped to 3–10. Then show a full-time screen (moment timeline, goals, rating, man of the match).
- **Emit a `MatchReport`** `{ rating, goals, shots, keyPasses, minutes }`. This is the object the career/player-card system will consume to grow stats.

`MomentManager.setup({ scenario })` and its `match` object are already the hooks this needs.

## Controls (FC-mobile style)

| Button | Tap | Hold / swipe off the button |
|---|---|---|
| **PASS** (blue) | Ground pass to the best teammate, pace scaled to distance | Swipe up or down → lofted pass / cross |
| **THROUGH** (yellow) | Through ball into space in front of a runner, toward goal | — |
| **SHOOT** (orange) | Hold for power (ring fills); auto-aimed away from the keeper | Down → driven (low, fast) · Up → chip · Right → finesse curler · Left → fake shot |
| **SPRINT** (green) | Hold to sprint (no stamina limit) | — |

Quick changes of direction near a defender can wrong-foot him. Skill moves still fire automatically when a defender closes in.

Desktop: WASD move · Shift sprint · Space pass (C lofted) · T through · hold F shoot (G driven, H chip, J finesse, K fake).

## Sound credits

**Stadium recordings (CC0)** — via [joepio/godot-crowd-sound](https://github.com/joepio/godot-crowd-sound) (`samples/CREDITS.md`), built from Freesound CC0 recordings:
goal, roar, surge and cheer loop from the *Sound Of Sankt Pauli* Millerntor Stadium crowd reactions by [itmightgetloud](https://freesound.org/people/itmightgetloud/sounds/829455/); chants by [zedkah](https://freesound.org/people/zedkah/sounds/133833/), [D.jones](https://freesound.org/people/D.jones/sounds/528799/), [felix.blume](https://freesound.org/people/felix.blume/sounds/612131/) and itmightgetloud; "ooh" by [Sandermotions](https://freesound.org/people/Sandermotions/sounds/494362/).

**Crowd ambience (CC BY 4.0, attribution required)** — *Free Crowd Cheering Sounds* by **Gregor Quendel**, https://opengameart.org/content/free-crowd-cheering-sounds , licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Used: stadium bed, murmur, big cheer (via [micahp/gridiron-physics](https://github.com/micahp/gridiron-physics)). Modified: trimmed, mono, resampled, loudness-normalised, re-encoded to MP3.

**Other CC0 clips**: cheer — [SoundsExciting](https://freesound.org/people/SoundsExciting/sounds/365132/); applause — [Bansemer](https://freesound.org/people/Bansemer/sounds/160493/); boo — [freesound](https://freesound.org/people/freesound/sounds/25270/) (via [chloeeeyan/Claude](https://github.com/chloeeeyan/Claude/pull/14)); ball thud — "Beefy Thud 1", [CC0-Public-Domain-Sounds](https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds).

All are embedded in `src/core/sfxData.js` (mono MP3) and mixed live: looping crowd bed, chants, surge on attacks, goal roars, oohs, awws and boos.
