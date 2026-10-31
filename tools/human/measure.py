import numpy as np
from mh_load import *
V0, G = load_obj()
def athlete(V):
    V = apply(V, 'macrodetails/caucasian-male-young')
    for n, w in [('macrodetails/universal-male-young-maxmuscle-averageweight', .3),
                 ('macrodetails/universal-male-young-averagemuscle-minweight', .15), ('macrodetails/universal-male-young-maxmuscle-minweight', .15),
                 ('macrodetails/proportions/male-young-averagemuscle-averageweight-idealproportions', .55), ('macrodetails/proportions/male-young-maxmuscle-averageweight-idealproportions', .45),
                 ('torso/torso-vshape-incr', .35)]:
        V = apply(V, n, w)
    return V
V = athlete(V0)
body = sorted({i for f in G['body'] for i in f})
yb = V[body, 1]
print('body verts', len(body), 'y', yb.min(), yb.max(), 'x', V[body,0].min(), V[body,0].max(), 'z', V[body,2].min(), V[body,2].max())
sk = skel()
h = yb.max() - yb.min(); s = 1.80 / h; ground = yb.min()
for j in ['upperleg01.L____head', 'lowerleg01.L____head', 'foot.L____head', 'toe1-1.L____head', 'root____head', 'spine05____head', 'spine03____head', 'spine01____head', 'neck01____head', 'head____head', 'head____tail', 'upperarm01.L____head', 'lowerarm01.L____head', 'wrist.L____head', 'finger3-1.L____head', 'clavicle.L____head', 'eye.L____head']:
    p = (joint_pos(V, sk, j) - [0, ground, 0]) * s
    print(f'{j:28s} {p.round(3)}')
