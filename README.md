# Breakaway: Match Engine Prototype ("Attacking Moment")

A 3D mobile football prototype for iPhone (runs in the browser). You play one
polished **attacking moment**: the core gameplay unit of a future single-player
career mode. All visuals, names and branding are original.

- **Tech:** Three.js r186 (ES modules via an import map, pinned on jsDelivr), vanilla JS, no build step.
- **Loop:** fixed 60 Hz simulation with interpolated rendering. Time scale drives the shot freeze and slow-mo.
- **Assets:** everything is procedural (primitives, canvas textures, Web Audio).

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
src/entities/               Player (shared body/anim/stats), Ball (pure integrator), Keeper
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

## What's in `config.js`

| Section | What it tunes |
|---|---|
| `sim` | 60 Hz step, ball sub-steps |
| `pitch`, `colors` | real dimensions (105×68, 7.32×2.44 goals, boxes, arcs), palette |
| `statMap` | every stat→gameplay formula: speed, acceleration, dribble touch size and error, reach, turn control, first touch, pass error/speed, vision cone, wobble, keeper modifier, shot speed, composure, stamina drain |
| `teamMap` | team overall → reaction, speed, tackling, interceptions, decision time |
| `player`, `dribble`, `ball` | turning, braking, touch timing, trap, receive reach, drag, Magnus, bounce, friction |
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
