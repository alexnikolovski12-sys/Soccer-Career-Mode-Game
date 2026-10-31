# Build the footballer body from the MakeHuman base mesh (CC0, see mh/LICENSE.ASSETS.md).
#   python3 tools/human/build_human.py   → tools/human/out/human_full.json (full-res, for pack_human.mjs)
# Output is in metres, 1.80 m tall, facing +z, left = +x, in the game's bind pose
# (MakeHuman's A-pose). Skin weights are MakeHuman's own, folded onto the game's
# 11-bone rig: body, torso, head, shL/R, elL/R, hipL/R, kneeL/R, ankleL/R.
import json, os
import numpy as np
from mh_load import load_obj, apply, delta, skel, weights, joint_pos

OUT = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)

V0, G = load_obj()
N = len(V0)

# ---------------------------------------------------------------- shape: athletic young male
BASE = [
    ('macrodetails/caucasian-male-young', 1.0),
    ('macrodetails/universal-male-young-maxmuscle-averageweight', .3),
    ('macrodetails/universal-male-young-averagemuscle-minweight', .15),
    ('macrodetails/universal-male-young-maxmuscle-minweight', .15),
    ('macrodetails/proportions/male-young-averagemuscle-averageweight-idealproportions', .55),
    ('macrodetails/proportions/male-young-maxmuscle-averageweight-idealproportions', .45),
    ('torso/torso-vshape-incr', .35),
]
V = V0.copy()
for n, w in BASE: V = apply(V, n, w)

# morph targets for variety (deltas on top of the base), name → [(target, weight)]
MORPHS = {
    'african': [('macrodetails/african-male-young', 1), ('macrodetails/caucasian-male-young', -1)],
    'asian': [('macrodetails/asian-male-young', 1), ('macrodetails/caucasian-male-young', -1)],
    'muscle': [('macrodetails/universal-male-young-maxmuscle-averageweight', .5), ('macrodetails/universal-male-young-maxmuscle-minweight', .2)],
    'slim': [('macrodetails/universal-male-young-averagemuscle-minweight', .6)],
    'headSquare': [('head/head-square', 1), ('head/head-oval', -.6)],
    'headRound': [('head/head-round', 1)],
    'headFat': [('head/head-fat-incr', 1)],
    'noseWide': [('nose/nose-scale-horiz-incr', 1), ('nose/nose-volume-incr', .5)],
    'noseNarrow': [('nose/nose-scale-horiz-decr', 1)],
    'noseLong': [('nose/nose-scale-vert-incr', 1), ('nose/nose-hump-incr', .4)],
    'chinStrong': [('chin/chin-prominent-incr', 1), ('chin/chin-width-incr', .8)],
    'chinNarrow': [('chin/chin-width-decr', 1)],
    'lips': [('mouth/mouth-upperlip-volume-incr', 1), ('mouth/mouth-lowerlip-volume-incr', 1), ('mouth/mouth-scale-horiz-incr', .4)],
    'cheeks': [('cheek/l-cheek-bones-incr', 1), ('cheek/r-cheek-bones-incr', 1)],
    'browLow': [('eyebrows/eyebrows-trans-down', 1)],
}
MD = {}
for k, parts in MORPHS.items():
    d = np.zeros((N, 3))
    for n, w in parts: d += delta(N, n, w)
    MD[k] = d

# ---------------------------------------------------------------- scale to metres, feet on the ground
bodyF = G['body']
bodyV = sorted({i for f in bodyF for i in f})
ground = V[bodyV, 1].min()
S = 1.80 / (V[bodyV, 1].max() - ground)
def toM(p): return (p - np.array([0, ground, 0])) * S
P = toM(V)
for k in MD: MD[k] = MD[k] * S

sk = skel()
J = lambda name: toM(joint_pos(V, sk, name))

# ---------------------------------------------------------------- the game's rig (shared with Player.js)
hip = J('upperleg01.L____head'); knee = J('lowerleg01.L____head'); ank = J('foot.L____head')
shJ = J('upperarm01.L____head'); elJ = J('lowerarm01.L____head'); wrJ = J('wrist.L____head')
torsoP = J('spine04____head'); headP = J('neck03____head')
bodyY = hip[1] + 0.04
RIG = {
    'bodyY': round(float(bodyY), 4),
    'hip': [round(float(hip[0]), 4), -0.04, round(float(hip[2]), 4)],
    'thigh': round(float(np.linalg.norm(knee - hip)), 4),
    'shin': round(float(np.linalg.norm(ank - knee)), 4),
    'ankleH': round(float(ank[1]), 4),
    'torso': [0, round(float(torsoP[1] - bodyY), 4), round(float(torsoP[2]), 4)],
    'sh': [round(float(shJ[0]), 4), round(float(shJ[1] - torsoP[1]), 4), round(float(shJ[2] - torsoP[2]), 4)],
    'upperArm': round(float(np.linalg.norm(elJ - shJ)), 4),
    'foreArm': round(float(np.linalg.norm(wrJ - elJ)), 4),
    'head': [0, round(float(headP[1] - torsoP[1]), 4), round(float(headP[2] - torsoP[2]), 4)],
}
# bind directions (MakeHuman A-pose) for the limb bones, world space, left side
BIND = {
    'thigh': (knee - hip).tolist(), 'shin': (ank - knee).tolist(),
    'upperArm': (elJ - shJ).tolist(), 'foreArm': (wrJ - elJ).tolist(),
}
print('RIG', json.dumps(RIG))

# ---------------------------------------------------------------- weights → 11 bones
BONES = ['body', 'torso', 'head', 'shL', 'elL', 'shR', 'elR', 'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR']
def bone_of(mh):
    side = 'L' if mh.endswith('.L') else 'R' if mh.endswith('.R') else ''
    b = mh.split('.')[0]
    if b in ('root', 'pelvis', 'spine05'): return {'body': 1}
    if b == 'spine04': return {'body': .5, 'torso': .5}
    if b in ('spine03', 'spine02', 'spine01', 'clavicle', 'breast'): return {'torso': 1}
    if b == 'shoulder01': return {'torso': .55, 'sh' + side: .45}
    if b == 'neck01': return {'torso': .6, 'head': .4}
    if b == 'neck02': return {'torso': .2, 'head': .8}
    if b.startswith('upperarm'): return {'sh' + side: 1}
    if b.startswith(('lowerarm', 'wrist', 'metacarpal', 'finger')): return {'el' + side: 1}
    if b.startswith('upperleg'): return {'hip' + side: 1}
    if b.startswith('lowerleg'): return {'knee' + side: 1}
    if b.startswith(('foot', 'toe')): return {'ankle' + side: 1}
    return {'head': 1}   # neck03, head, jaw, face muscles, eyes, tongue, special*
W = np.zeros((N, len(BONES)))
for mh, lst in weights().items():
    m = bone_of(mh)
    for vi, w in lst:
        for b, f in m.items(): W[vi, BONES.index(b)] += w * f
# eyes are rigid with the head
eyeV = {s: sorted({i for f in G[f'helper-{s}-eye'] for i in f}) for s in 'lr'}
for s in 'lr': W[eyeV[s]] = 0; W[eyeV[s], BONES.index('head')] = 1
W /= np.maximum(W.sum(1, keepdims=True), 1e-9)

# ---------------------------------------------------------------- per-vertex attributes for kit / face / hair
def seg_param(p, a, b):
    d = b - a; return float(np.dot(p - a, d) / np.dot(d, d))
limb = np.full(N, -1.0)
for i in range(N):
    w = W[i]; bi = int(np.argmax(w)); name = BONES[bi]
    p = P[i]
    sx = 1 if p[0] >= 0 else -1
    if name.startswith(('sh', 'el')):
        s_, e_, w_ = shJ * [sx, 1, 1], elJ * [sx, 1, 1], wrJ * [sx, 1, 1]
        t = seg_param(p, s_, e_)
        limb[i] = t if t < 1 else 1 + seg_param(p, e_, w_)
    elif name.startswith(('hip', 'knee', 'ankle')):
        h_, k_, a_ = hip * [sx, 1, 1], knee * [sx, 1, 1], ank * [sx, 1, 1]
        t = seg_param(p, h_, k_)
        limb[i] = 10 + (t if t < 1 else 1 + seg_param(p, k_, a_))
        if name.startswith('ankle'): limb[i] = max(limb[i], 12.0)
# hair mask: height above a hairline that runs forehead → temples → over the ears → nape
# (units: 1 = 5 cm above the line; negative = below it)
hairA = np.full(N, -2.0)
for i in bodyV:
    p = P[i]
    if p[1] < 1.55: continue
    az = np.arctan2(p[0], p[2] - 0.065)                # 0 = front, ±pi = back
    f = (np.cos(az) + 1) / 2
    line = 1.62 + (1.748 - 1.62) * f ** 1.4
    line += 0.055 * np.exp(-((abs(az) - 1.55) ** 2) / 0.09) * (p[1] > 1.6)   # round the ears
    hairA[i] = (p[1] - line) / 0.05
eyeFlag = np.zeros(N)
eyeFlag[eyeV['l']] = 1; eyeFlag[eyeV['r']] = 1
eyeC = {s: P[eyeV[s]].mean(0) for s in 'lr'}
eyeR = float(np.mean([np.linalg.norm(P[eyeV['l']] - eyeC['l'], axis=1).mean()]))

# face masks from MakeHuman's face-muscle weights: lips, eyebrows, eyelids
face = np.zeros((N, 3))
MW = weights()
for bn, lst in MW.items():
    b = bn.split('.')[0]
    col = 0 if b.startswith('oris') else 1 if b == 'oculi01' else 2 if b in ('orbicularis03', 'orbicularis04') else -1
    if col < 0: continue
    for vi, w in lst: face[vi, col] = max(face[vi, col], w)
face[eyeV['l']] = 0; face[eyeV['r']] = 0

# ---------------------------------------------------------------- triangles: body + eyes
def tris(faces):
    out = []
    for f in faces:
        for k in range(1, len(f) - 1): out.append([f[0], f[k], f[k + 1]])
    return out
T = tris(bodyF) + tris(G['helper-l-eye']) + tris(G['helper-r-eye'])
used = sorted({i for t in T for i in t})

json.dump({
    'positions': P[used].round(5).tolist(),
    'tris': T, 'used': used,
    'weights': W[used].round(4).tolist(), 'bones': BONES,
    'limb': limb[used].round(4).tolist(), 'hair': hairA[used].round(4).tolist(), 'eye': eyeFlag[used].tolist(), 'face': face[used].round(3).tolist(),
    'morphs': {k: MD[k][used].round(5).tolist() for k in MD},
    'rig': RIG, 'bind': BIND,
    'landmarks': {'eyeL': eyeC['l'].round(4).tolist(), 'eyeR': eyeC['r'].round(4).tolist(), 'eyeRadius': round(eyeR, 4),
                  'jaw': J('jaw____tail').round(4).tolist(), 'neck': J('neck01____head').round(4).tolist(),
                  'shoulder': shJ.round(4).tolist(), 'hip': hip.round(4).tolist(), 'wrist': wrJ.round(4).tolist()},
}, open(os.path.join(OUT, 'human_full.json'), 'w'))
print('verts', len(used), 'tris', len(T))
