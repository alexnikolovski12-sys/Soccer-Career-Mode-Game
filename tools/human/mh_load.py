# Load the MakeHuman base mesh (CC0), apply targets, compute joints & weights.
import json, os, re
import numpy as np
D = os.path.join(os.path.dirname(__file__), 'mh')

def load_obj():
    V, groups, cur = [], {}, None
    for line in open(os.path.join(D, 'base.obj')):
        if line.startswith('v '):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('g '):
            cur = line.split()[1]; groups.setdefault(cur, [])
        elif line.startswith('f '):
            groups[cur].append([int(t.split('/')[0]) - 1 for t in line.split()[1:]])
    return np.array(V, dtype=np.float64), groups

def target(name):
    p = os.path.join(D, 'targets', name.replace('/', '_') + '.target')
    idx, d = [], []
    for line in open(p):
        if line.startswith('#') or not line.strip(): continue
        a = line.split(); idx.append(int(a[0])); d.append([float(x) for x in a[1:4]])
    return np.array(idx, dtype=np.int64), np.array(d, dtype=np.float64).reshape(-1, 3)

def apply(V, name, w=1.0):
    i, d = target(name)
    V = V.copy(); V[i] += d * w
    return V

def delta(nV, name, w=1.0):
    out = np.zeros((nV, 3)); i, d = target(name); out[i] += d * w; return out

def skel():
    return json.load(open(os.path.join(D, 'default.mhskel')))

def weights():
    txt = open(os.path.join(D, 'default_weights.mhw')).read()
    return json.loads(txt)['weights']

def joint_pos(V, sk, name):
    return V[sk['joints'][name]].mean(axis=0)
