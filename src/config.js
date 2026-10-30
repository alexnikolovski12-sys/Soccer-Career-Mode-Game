// ============================================================================
// CONFIG — every tunable number in the prototype lives here.
// Units: metres, seconds, radians (unless noted). Stats are 0–99.
// The debug panel mutates this object live, so read values at use-time
// (e.g. CONFIG.shot.wobbleScale) rather than caching them in constructors.
// ============================================================================

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Normalise a 0–99 stat into 0..1 over the useful range (floor → 99). */
export const statT = (s) => clamp((s - CONFIG.stats.floor) / (99 - CONFIG.stats.floor), 0, 1);
/** Map a stat onto [lo, hi] (lo at the floor rating, hi at 99). */
export const sMap = (s, lo, hi) => lerp(lo, hi, statT(s));

export const CONFIG = {
  // --------------------------------------------------------------- simulation
  sim: {
    hz: 60,                 // fixed simulation rate
    maxStepsPerFrame: 5,    // spiral-of-death guard
    ballSubSteps: 2,        // ball integrates at hz * ballSubSteps (prediction uses the same)
  },

  // --------------------------------------------------------------- pitch
  pitch: {
    length: 105, width: 68,
    goalWidth: 7.32, goalHeight: 2.44, goalDepth: 2.0,
    postRadius: 0.06,
    penaltyDepth: 16.5, penaltyWidth: 40.32,
    sixDepth: 5.5, sixWidth: 18.32,
    penaltySpot: 11, arcRadius: 9.15, centreRadius: 9.15,
    lineWidth: 0.12,
    stripes: 20,
  },

  colors: {
    grassA: '#3f8f3a', grassB: '#367f33', lines: '#f4f7f2',
    skyTop: '#0b1530', skyHorizon: '#3d5a86',
    stands: '#232a36', standsTrim: '#3a4352', fog: '#22324d',
    userRing: '#ffe14d', passMarker: '#7cf5ff',
    arrowGreen: '#38e86a', arrowYellow: '#ffd23f', arrowRed: '#ff3b3b',
    targetCircle: '#ffffff', missX: '#ff4b4b',
  },

  // --------------------------------------------------------------- stats → gameplay
  // All stat→number formulas. Each takes the 0–99 stat.
  stats: {
    floor: 30, // stats at or below this map to the worst value
  },
  statMap: {
    sprintSpeed: (pace) => sMap(pace, 6.9, 9.3),          // m/s top speed
    runFactor: 0.8,                                       // full tilt (no sprint) = sprint * runFactor
    jogFactor: 0.45,
    accel: (acc) => sMap(acc, 5.5, 11.5),                 // m/s² towards target speed
    decel: (acc) => sMap(acc, 9, 15),
    dribbleSpeedFactor: (dri) => sMap(dri, 0.84, 0.95),   // speed multiplier while carrying the ball
    touchMult: (dri) => sMap(dri, 1.45, 1.12),            // ball speed after a touch ÷ player speed
    sprintTouchExtra: (dri) => sMap(dri, 0.55, 0.3),      // extra touch push when sprinting
    touchError: (dri) => sMap(dri, 0.14, 0.03),           // radians of random touch deviation
    controlReach: (ctl) => sMap(ctl, 0.55, 0.85),         // how far from the foot the ball can be touched
    turnControl: (ctl) => sMap(ctl, 0.6, 1.0),            // turn-rate multiplier while dribbling
    firstTouch: (ctl) => sMap(ctl, 0.55, 0.95),           // 1 = perfect cushion on receiving
    tackleResist: (ctl, dri) => (sMap(ctl, 0, 0.5) + sMap(dri, 0, 0.5)) * 0.5, // 0..0.5 tackle-success reduction
    passError: (pas) => sMap(pas, 0.11, 0.015),           // radians σ of pass direction error
    passPressureError: (comp) => sMap(comp, 0.09, 0.025), // added σ at full pressure
    passSpeedFactor: (pas) => sMap(pas, 0.92, 1.12),
    visionCone: (vis) => sMap(vis, 0.85, 1.35),           // targeting generosity (angle weight divisor)
    visionRange: (vis) => sMap(vis, 26, 42),              // max pass search range
    visionLaneAwareness: (vis) => sMap(vis, 0.6, 1.4),    // how strongly blocked lanes are avoided
    finishingWobble: (fin) => sMap(fin, 0.75, 0.1),       // metres of base aim wobble
    finishingSaveMod: (fin) => sMap(fin, 0.12, -0.12),    // added to keeper save probability
    maxShotSpeed: (pow) => sMap(pow, 24, 34.5),           // m/s at 100% pull
    composureMult: (comp) => sMap(comp, 1.0, 0.22),       // multiplies pressure wobble
    staminaDrain: (sta) => sMap(sta, 0.2, 0.075),         // per second of sprinting
    staminaRecover: 0.05,                                 // per second when not sprinting
    lowStaminaThreshold: 0.35,
    lowStaminaSpeedPenalty: 0.12,                         // up to −12% speed at 0 stamina
    lowStaminaWobble: 0.35,                               // metres extra wobble at 0 stamina
  },

  // AI teams use a single overall rating, mapped here.
  teamMap: {
    reaction: (r) => sMap(r, 0.6, 0.15),     // seconds before reacting to events
    speedMult: (r) => sMap(r, 0.9, 1.04),    // multiplier on stat-derived speeds
    tackleSkill: (r) => sMap(r, 0.3, 0.65),  // base tackle success
    interceptSkill: (r) => sMap(r, 0.3, 0.75),
    decisionTime: (r) => sMap(r, 1.0, 0.35), // teammate on-ball think time
  },

  // --------------------------------------------------------------- player movement
  player: {
    radius: 0.32,
    separation: 0.8,           // soft collision distance between players (capsule diameter)
    bump: { minSpeed: 1.6, restitution: 0.15, transfer: 0.5, react: 0.9, cooldown: 0.5 }, // shoulder-to-shoulder knocks
    jockeyMaxSpeed: 3.4,       // defenders below this speed keep facing the ball (backpedal / side-step)
    lateralAccel: 15,          // m/s² of sideways grip: caps the turn rate at speed (momentum)
    turnRateStill: 15,         // rad/s when (almost) stationary
    turnRateRun: 4.6,          // rad/s at top speed
    sharpTurnAngle: 0.75,      // radians; turns sharper than this brake the player
    sharpTurnBrake: 0.6,       // braking strength in sharp turns
    headingLerp: 12,           // visual body turn smoothing
    labelHeight: 2.25,
    sprintBoost: 1.2,         // extra pace when holding SPRINT
    cutAngle: 0.95,            // stick change (rad) on the ball that triggers a quick cut
    cutSnap: 0.55,              // fraction of the turn done instantly in a cut
    cutKeepSpeed: 0.8,         // speed kept through the cut
    cutBurstTime: 0.4,         // seconds of extra acceleration after it
    cutBurstAccel: 2.2,
    cutCooldown: 0.28,
  },

  // --------------------------------------------------------------- automatic skill moves
  skills: {
    triggerRange: 4.0,         // a defender this close, in front of the carrier...
    frontDot: 0.25,            // ...within roughly ±75° of facing
    chancePerSecond: 2.6,      // how eagerly skills fire while that's true
    minSpeed: 1.2,
    cooldown: 1.0,
    beatStumble: 0.9,          // how long a beaten defender is wrong-footed
    rainbowLift: 5.0,          // upward speed of the rainbow flick (m/s)
  },

  // --------------------------------------------------------------- jinking (quick changes of direction)
  juke: {
    cutAngle: 0.85,            // a stick change bigger than this (rad, ~50°) counts as a cut
    sharpAngle: 1.9,           // ~110°: one cut this sharp is enough on its own
    window: 1.3,               // two cuts within this many seconds
    range: 3.4,                // defenders this close can be wrong-footed
    base: 0.62,                // base chance they buy it
    stumble: 0.85,             // how long they're stuck
  },

  // --------------------------------------------------------------- free kick shot (aim line + power bar)
  freeKick: {
    aimPeriod: 2.0,            // seconds for the aim line to sweep across the goal and back
    powerPeriod: 1.3,          // seconds for the power marker to go up and back down
    zoneLo: 0.5, zoneHi: 0.74, // the green zone
    curve: 2.0,
  },

  // --------------------------------------------------------------- free kicks / penalties
  setPiece: {
    downTime: 0.9,             // watch the foul before the restart is set up
    setupTime: 1.4,            // pause with the ball placed before play / aiming resumes
    wallDistance: 9.15,
    wallMaxRange: 32,          // build a wall when the free kick is this close to goal
    timerTopUp: 9,             // seconds left on the moment clock after a foul (at least)
  },

  // --------------------------------------------------------------- dribbling / possession
  dribble: {
    footOffset: 0.42,          // foot point ahead of the body centre
    touchCooldown: 0.2,
    touchBase: 0.45,           // added ball speed per touch (m/s)
    redirectAngle: 0.45,        // radians — larger direction change triggers a redirect touch
    redirectReachMult: 1.5,
    trapDamping: 10,
    touchReach: 0.62,          // foot has to be this close to the ball to touch it
    touchAhead: 0.42,
    sprintCarryExtra: 0.5,    // the ball runs this much further ahead when sprinting
    touchWindow: 0.08,         // a stride touch waits until the foot is this close (s) to planting          // take the next touch once the ball is less than this far in front           // ball damping when stopping with the ball
    loseDistance: 4.5,         // safety only — the ball normally never leaves the possession circle
    carryOffset: 0.5,          // possession circle: how far ahead of the body the ball sits (m)
    carrySpeedOffset: 0.03,    // ...plus this much per m/s of running speed
    carryStiffness: 18,        // how quickly the ball follows the feet
    circleMax: 0.95,           // the ball can never be further than this from the carrier
    touchPush: 0.18,           // each touch pushes the ball this far out…
    touchPushPerSpeed: 0.035,  // …plus this per m/s
    pushDecay: 0.9,            // how fast the player catches back up to it
    footSpread: 0.16,          // how far left/right of centre the working foot carries it
    switchFootChance: 0.35,    // chance a touch switches feet
    turnRateForCut: 4.5,       // rad/s of turning that counts as a proper turn (cut/hook/drag-back)
    receiverBonus: 1.4,        // extra reach for the intended receiver of a pass
    stealReach: 0.55,          // an opponent this close to the ball...
    stealTime: 1.0,            // ...for this long wins it
    receiveReach: 0.95,        // ground distance to receive a pass / loose ball
    receiveMaxHeight: 1.3,
    autoChaseWhenIdle: true,   // walk to your own loose touch when joystick is idle
    joyDeadZone: 0.1,
    jogTilt: 0.55,
    autoSprintTilt: 0.92,      // joystick pushed this far = sprint             // joystick magnitude where jog becomes run
  },

  // --------------------------------------------------------------- ball physics
  ball: {
    radius: 0.11,
    gravity: 9.81,
    airDrag: 0.013,            // a = −k·|v|·v
    magnus: 0.016,             // lateral accel = magnus · curve · |v|
    curveDecay: 0.25,          // per second
    restitution: 0.55,         // vertical bounce
    bounceFriction: 0.86,      // horizontal speed kept on bounce
    rollDecel: 0.9,            // m/s² constant rolling friction
    rollLinear: 0.38,          // 1/s linear rolling friction
    settleSpeed: 1.2,          // vertical speed below which the ball stops bouncing
    postRestitution: 0.62,
    netDrag: 6,                // damping inside the net
    netRestitution: 0.12,
  },

  // --------------------------------------------------------------- passing
  pass: {
    arriveSpeed: 14,           // desired speed when reaching the receiver (crisp, fast)
    minSpeed: 14, maxSpeed: 38,
    windup: 0.1,               // button → boot meets the ball (the kick clip's backswing is time-warped into this)
    homing: 3.0,               // rad/s a pass can bend toward where its receiver actually is
    assist: 0.12,              // multiplier on pass error (fully assisted ≈ dead accurate)
    loftHoldMin: 0.18,         // hold PASS at least this long for a lofted ball…
    loftHoldFull: 0.45,        // …and this long for the highest, furthest one
    throughMin: 5,             // through ball: metres in front of the runner…
    throughMax: 11,            // …at most              // seconds between button and kick (marker shows)
    angleWeight: 2.2,          // importance of facing angle
    distWeight: 0.6,
    idealDist: 14,
    laneWeight: 2.2,
    laneClear: 2.6,            // metres — defender further than this from the lane is no threat
    maxAngle: 1.9,             // radians from facing beyond which teammates are ignored
    leadFactor: 1.0,
    throughBallLead: 1.35,     // extra lead for runners on the last line
    spaceDistance: 13,         // blind pass into space when no target
    markerTime: 0.6,
    pressureRadius: 3.5,
    meetDistance: 2.5,         // receivers step this far toward an incoming pass
  },

  // --------------------------------------------------------------- shooting (signature mechanic)
  shot: {
    // ---- penalty timing circle
    penCycle: 1.25,            // seconds for the circle to shrink from big/red to small/green
    penGreen: 0.22,            // circle smaller than this = perfect (scores)
    penYellow: 0.6,            // smaller than this = on target, keeper can still save; bigger = miss
    // ---- hold-to-shoot (current system)
    chargeTime: 0.9,           // seconds of holding SHOOT for full power
    assist: 0.55,              // 0 = raw power, 1 = power always perfect for the distance
    errBase: 0.12,             // metres of aim scatter (very forgiving)…
    errPerMetre: 0.022,        // …plus this per metre beyond 11 m
    errPressure: 0.25,         // …plus this at full defender pressure
    pressureRadius: 3.5,
    finesseCurve: 2.4,         // sidespin on the finesse (swipe right) shot
    fakeRadius: 6,             // defenders this close can fall for a fake shot
    fakeDefenderChance: 0.75,
    fakeKeeperRange: 28,
    fakeKeeperChance: 0.6,
    // ----
    strikeWindup: 0.15,        // SHOOT released → boot meets the ball (kick clip backswing, time-warped)
    runUpTime: 0.75,           // free kick / penalty run-up before the strike
    runUpDistance: 1.3,        // how far behind the ball the taker stands
    rangeMax: 30,              // metres from goal centre for SHOOT to glow
    minGoalAngleDeg: 9,        // angle subtended by the posts must exceed this
    freezeTime: 0.15,          // time-scale ease to 0
    unfreezeTime: 0.2,
    maxPullFrac: 0.34,         // max pull length as a fraction of min(screenW, screenH)
    maxPullMinPx: 110,
    cancelRadiusPx: 15,        // release/drag back inside → cancelled
    cancelRadiusFrac: 0.035,   // …or this fraction of min screen dim, whichever is bigger
    minSpeed: 11,              // m/s at 0% pull
    powerCap: 1.0,             // multiplier on stat max speed (debug)
    powerCurve: 0.9,
    greenMax: 0.55, yellowMax: 0.8,
    lateralGain: 6.2,          // metres of aim across the goal per full horizontal pull
    heightGain: 3.5,           // metres of aim height per full vertical pull
    heightDeadZone: 0.12,      // fraction of pull that still keeps the shot on the ground
    groundHeight: 0.15,
    curvePerLateral: 5.5,      // sidespin from horizontal aim (bends shots naturally)
    wobbleScale: 1.0,          // global wobble multiplier (debug)
    wobblePressureRadius: 4,
    wobblePressure: 0.55,      // metres at full pressure (before composure)
    wobbleRedZone: 0.55,       // metres extra at 100% power
    wobbleDistance: 0.015,     // metres per metre beyond 12 m
    wobbleSpeed: 1.0,
    targetRadius: 0.28,
    slowMoSpeed: 0.5,
    slowMoDistance: 9,         // slow-mo kicks in this close to the goal line on close calls
    closeCallMargin: 0.7,
    blockRadius: 0.55,         // defenders within this of the ball path can block
    blockChance: 0.7,
    predictMaxTime: 3.0,
    runUpBack: 0.6,            // shooter sets up this far behind the ball while aiming…
    runUpSide: 0.75,           // …and this far to its left (right-footed strike)
  },

  // --------------------------------------------------------------- keeper
  keeper: {
    rating: 70,
    difficulty: 1.0,           // debug multiplier on save probability
    reaction: (r) => sMap(r, 0.32, 0.14),
    diveSpeed: (r) => sMap(r, 4.6, 6.4),   // lateral m/s while diving
    standReach: 0.95,          // hands reach without diving
    maxReach: 3.4,             // lateral reach at full stretch
    jumpReach: 2.55,           // max hand height
    lineOffset: 0.6,           // off the line when ball is far
    maxAdvance: 5.5,           // narrowing the angle
    moveSpeed: 5.5,
    claimRadius: 1.4,          // picks up slow loose balls
    claimMaxSpeed: 6,
    reachBase: 0.42,           // save chance when the keeper arrives exactly on time…
    reachSlope: 1.25,          // …plus this per second of spare time
    speedPenalty: 0.022,       // per m/s above 18
    cornerPenalty: 0.28,       // top corner
    lowCornerPenalty: 0.1,
    centralBonus: 0.3,
    catchMaxSpeed: 22,
  },

  // --------------------------------------------------------------- defenders
  defender: {
    pressDistance: 1.6,
    jockeyDistance: 2.6,
    tackleRange: 1.45,
    tackleCooldown: 1.3,
    tackleWindup: 0.22,
    tackleEagerness: 0.9,
    tackleSuccessMult: 0.45,   // scales every tackle's success chance (lower = harder to lose the ball)
    foulBodyMargin: 0.1,       // tackler reaches your body this much before the ball → contact on the man
    foulFromBehind: 0.75,      // chance a tackle through the man is a foul
    foulMistimed: 0.1,         // chance any other tackle is mistimed into a foul      // attempts per second when in range (scaled by rating)
    stumbleTime: 1.0,
    pokeDistance: 1.05,        // ball this far from the carrier can be poked
    pokeChance: 1.4,           // per second
    markDistance: 1.6,
    interceptReach: 1.1,
    reassignInterval: 0.3,
    lineDepthMin: 28, lineDepthMax: 47,
    maxPressers: 1,
    coverWhenClose: 20,        // extra cover defender when ball within this of goal
  },

  // --------------------------------------------------------------- teammates
  teammate: {
    supportRadiusMin: 8, supportRadiusMax: 14,
    retargetInterval: 0.45,
    openDistance: 4.2,
    onsideMargin: 0.5,
    userPassBias: 1.7,         // weight applied when considering passing back to the user
    maxHold: 2.6,
    oneTwoDelay: 0.25,
    callLaneTolerance: 0.9,
  },

  // --------------------------------------------------------------- moment
  moment: {
    duration: 20,
    introTime: 1.7,
    outroDelay: 1.2,
    scenarioWeights: { counter: 1, buildup: 1, wing: 1, edge: 1, oneOnOne: 0.35 },
    minOutfield: 6, maxOutfield: 10,
    startMinute: 8,
  },

  // --------------------------------------------------------------- rating contributions
  rating: {
    base: 6.0,
    goal: 0.6, onTarget: 0.15, post: 0.1, offTarget: -0.05, blocked: 0,
    keyPass: 0.1, completedPass: 0.02, beatDefender: 0.05,
    turnover: -0.2, teammateTurnover: -0.05, timeUp: -0.05,
    min: 3, max: 10,
  },

  // --------------------------------------------------------------- camera
  camera: {
    landscape: { distance: 10.5, height: 6.6, fov: 50, lookAhead: 6, lookHeight: 0.8, goalBias: 0.3 },
    portrait:  { distance: 14.5, height: 11.5, fov: 62, lookAhead: 8, lookHeight: 0.4, goalBias: 0.7 },
    distanceMult: 1.0, heightMult: 1.0,           // debug
    posDamping: 4.5, lookDamping: 6,
    crowdZoom: 0.18,           // extra distance fraction when crowded
    crowdRadius: 14,
    speedZoom: 0.12,
    // ballNdc / goalNdc: how far below / above screen centre the ball and goal sit (0..1)
    shot: { back: 3.6, height: 1.6, side: 0.6, minFov: 22, maxFov: 62, ballNdc: 0.74, goalNdc: 0.42, damping: 9, ghost: 0.85 },
    flight: { damping: 4 },
    shakeDecay: 3.2,
  },

  // --------------------------------------------------------------- quality / performance
  quality: {
    maxPixelRatio: 2,
    // levels from best (3) to worst (0)
    levels: [
      { name: 'Low',    shadows: false, resScale: 0.6,  crowd: 'simple' },
      { name: 'Medium', shadows: false, resScale: 0.78, crowd: 'simple' },
      { name: 'High',   shadows: false, resScale: 1.0,  crowd: 'full' },
      { name: 'Ultra',  shadows: true,  resScale: 1.0,  crowd: 'full' },
    ],
    startLevel: 3,
    downFps: 50, downTime: 2,
    upFps: 58, upTime: 6,
    shadowMapSize: 1024,
  },

  // --------------------------------------------------------------- juice
  career: {
    momentsPerMatch: 6,        // attacking moments you play in each career match
  },

  juice: {
    celebrateTime: 4.2,        // seconds of celebration before the replay
    replaySeconds: 3.2,
    replayTail: 0.7,
    replaySpeed: 0.45,
    confettiCount: 220,
    goalShake: 0.35,
    shotShake: 0.12,
  },
};
