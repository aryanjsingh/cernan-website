"""Deterministic, connected branch study. Run with an optional integer seed.

The original make_tree.py and its studies are deliberately preserved. This
version derives the silhouette and signal channels from the same cubic curves.
"""
from pathlib import Path
import math
import random
import sys
import xml.etree.ElementTree as ET
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 31
rng = random.Random(SEED)
W, H = 2880, 1800
NAV = 250
TEXT_X, TEXT_Y = 1250, 700
branches = []


def heading(a):
    """Unwrap atan2's signed result around the leftward heading before clamping."""
    return math.pi + ((a - math.pi + math.pi) % (2 * math.pi) - math.pi)


def point(p, a, length):
    return p[0] + math.cos(a) * length, p[1] + math.sin(a) * length


def sample(curve, t):
    a, b, c, d = curve
    s = 1 - t
    return tuple(s**3*a[i] + 3*s*s*t*b[i] + 3*s*t*t*c[i] + t**3*d[i] for i in (0, 1))


def derivative(curve, t):
    a, b, c, d = curve
    s = 1 - t
    return tuple(3*s*s*(b[i]-a[i]) + 6*s*t*(c[i]-b[i]) + 3*t*t*(d[i]-c[i]) for i in (0, 1))


def radius(b, t):
    # Ease the taper; a small continuous variation avoids mechanical cones.
    blend = t*t*(3 - 2*t)
    width = b['w0']*(1-blend) + b['w1']*blend
    # Meet the parent's ending radius exactly; only then narrow into this limb.
    joint_t = min(1, t/.28)
    joint_blend = joint_t*joint_t*(3-2*joint_t)
    width += (b['joint_w']-b['w0'])*(1-joint_blend)
    return width*.5 * (1 + .025*math.sin(t*math.pi*2))


def allowed(x, y, r):
    return y-r > NAV and y+r < 1470 and x-r > 930 and not (x-r < TEXT_X and y+r > TEXT_Y)


def path(curve):
    a, b, c, d = curve
    return f'M{a[0]:.2f},{a[1]:.2f} C{b[0]:.2f},{b[1]:.2f} {c[0]:.2f},{c[1]:.2f} {d[0]:.2f},{d[1]:.2f}'


def grow(start, angle, target, length, width, depth, parent=None):
    if len(branches) >= 68:
        return
    angle = heading(angle)
    target = max(math.pi - .92, min(math.pi + 1.03, heading(target)))
    # Shared starting tangents make each fork emerge gradually from its parent.
    for attempt in range(8):
        mid = angle*.2 + target*.8
        end = point(start, mid, length)
        curve = (start, point(start, angle, length*.39), point(end, target+math.pi, length*.3), end)
        b = dict(curve=curve, w0=width, joint_w=parent['w1'] if parent else width,
                 w1=width*(.52 if depth < 4 else .12), depth=depth)
        samples = [sample(curve, i/64) for i in range(65)]
        clear = all(allowed(*p, radius(b, i/64)+5) for i, p in enumerate(samples))
        # Keep growing tips out of existing terminal clusters. Nearby ancestors
        # and the new branch's shared start are intentionally exempt.
        crowded = any(math.dist(end, old['curve'][-1]) < (62 if depth > 2 else 95)
                      for old in branches if old is not parent and old['depth'] >= depth)
        if clear and not crowded:
            break
        length *= .88
        target = target*.78 + math.pi*.22
    else:
        return
    if length < 67:
        return
    b.update(id=f'b-{len(branches)}', parent=parent['id'] if parent else '',
             distance=(parent['distance']+parent['length']) if parent else 0,
             length=sum(math.dist(a, z) for a, z in zip(samples, samples[1:])))
    branches.append(b)
    if depth >= 5 or (depth == 4 and rng.random() < .35):
        return
    end_angle = heading(math.atan2(*reversed(derivative(curve, 1))))
    if depth == 0:
        children = [(-.69, .78, .67), (.09, .84, .76), (.86, .70, .57)]
    else:
        side = -1 if rng.random() < .5 else 1
        children = [(rng.uniform(-.13, .17), rng.uniform(.63, .87), .8),
                    (side*rng.uniform(.42, .77), rng.uniform(.47, .78), rng.uniform(.48, .62))]
        if depth == 2 and rng.random() < .5:
            children.append((-side*rng.uniform(.36, .62), .56, .43))
    for offset, scale, taper in children:
        grow(end, end_angle, end_angle+offset, length*scale, b['w1']*taper, depth+1, b)


def outline_points(b):
    left, right = [], []
    for i in range(97):
        t = i/96
        x, y = sample(b['curve'], t)
        dx, dy = derivative(b['curve'], t)
        length = math.hypot(dx, dy)
        r = radius(b, t)
        left.append((x-dy/length*r, y+dx/length*r))
        right.append((x+dy/length*r, y-dx/length*r))
    # Dense samples of an analytic cubic make the visible edges smooth too.
    return left+right[::-1]


def contour_path(points):
    return 'M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in points) + ' Z'


grow((3030, 720), math.pi-.03, math.pi-.12, 620, 300, 0)
assert branches, 'No trunk generated'
lookup = {b['id']: b for b in branches}
parents = {b['parent'] for b in branches if b['parent']}
for b in branches:
    if b['id'] not in parents:
        b['w1'] = .3
for b in branches:
    if b['parent']:
        p = lookup[b['parent']]
        assert b['curve'][0] == p['curve'][-1]
        assert b['depth'] == p['depth']+1
    for i in range(257):
        assert allowed(*sample(b['curve'], i/256), radius(b, i/256)+3)
assert sum(not b['parent'] for b in branches) == 1

# Shapely is already installed locally. Union once during generation, so the
# browser renders real vector edges rather than a raster morphology filter.
silhouette = unary_union([Polygon(outline_points(b)).buffer(0) for b in branches] +
                         [Point(b['curve'][0]).buffer(b['joint_w']*.49, quad_segs=24) for b in branches])
polygons = [silhouette] if silhouette.geom_type == 'Polygon' else list(silhouette.geoms)
shape_path = ' '.join(contour_path(ring.coords) for poly in polygons for ring in [poly.exterior, *poly.interiors])
channels = '\n'.join(f'<path id="{b["id"]}" data-parent="{b["parent"]}" data-depth="{b["depth"]}" data-root-distance="{b["distance"]:.2f}" data-path-length="{b["length"]:.2f}" d="{path(b["curve"])}"/>' for b in branches)
nodes = '\n'.join(f'<circle id="node-{b["id"]}" data-branch="{b["id"]}" data-kind="{"fork" if b["id"] in parents else "tip"}" cx="{b["curve"][-1][0]:.2f}" cy="{b["curve"][-1][1]:.2f}" r="{max(3.5, min(8, b["w1"]*.1)):.2f}"/>' for b in branches)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="tree-title tree-desc">
<title id="tree-title">Cernan — flowing branch structure</title>
<desc id="tree-desc">One tapered branch enters from the right and divides into irregular, smoothly curved limbs. Dashed centre lines connect the forks for a future backpropagation animation. The left and lower-left remain open.</desc>
<path id="branch-shapes" d="{shape_path}" fill="#0b1a2b" fill-opacity=".07" fill-rule="evenodd" stroke="#0b1a2b" stroke-width="2.5" stroke-linejoin="round"/>
<g id="channels" fill="none" stroke="#0b1a2b" stroke-opacity=".38" stroke-width="1.8" stroke-dasharray="6 9" stroke-linecap="round">{channels}</g>
<g id="nodes" fill="#eaf5ff" stroke="#0b1a2b" stroke-width="1.8">{nodes}</g>
</svg>'''
output = Path(__file__).with_name('tree-refined.svg')
output.write_text(svg)
ET.parse(output)
print(f'{output.name}: seed={SEED}, branches={len(branches)}, tips={sum(b["id"] not in parents for b in branches)}, roots=1')
print('Validated XML, connected endpoints, parent/depth metadata and width-aware keepouts.')
