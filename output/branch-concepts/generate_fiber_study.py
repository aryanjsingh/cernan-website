"""Generate the fibrous Cernan neural branch.

The artwork is deliberately constructed as a field of fine strands rather than
a filled tube.  Shapely is used at authoring time to make one clipping shape;
the browser receives a standalone SVG and needs no geometry dependency.

Run: python3 assets/generate_neural_branch.py
"""
from pathlib import Path
import math
import random
import xml.etree.ElementTree as ET

from shapely.geometry import Point, Polygon
from shapely.ops import unary_union


R = random.Random(1147)
branches = []


def point(curve, t):
    a, b, c, d = curve
    s = 1 - t
    return tuple(s**3*a[i] + 3*s*s*t*b[i] + 3*s*t*t*c[i] + t**3*d[i] for i in (0, 1))


def tangent(curve, t):
    a, b, c, d = curve
    s = 1 - t
    dx, dy = (3*s*s*(b[i]-a[i]) + 6*s*t*(c[i]-b[i]) + 3*t*t*(d[i]-c[i]) for i in (0, 1))
    length = math.hypot(dx, dy) or 1
    return dx/length, dy/length


def radius(branch, t):
    # The slow undulation makes a grown, loaded limb instead of a perfect cone.
    eased = t*t*(3-2*t)
    base = branch['w0']*(1-eased) + branch['w1']*eased
    grain = 1 + .055*math.sin(t*7.4 + branch['phase']) + .022*math.sin(t*19.1 + branch['phase']*.4)
    return max(.28, base*.5*grain)


def add(parent, controls, widths, plane='mid'):
    start = branches[parent]['curve'][-1] if parent is not None else (1595, 466)
    curve = (start, *controls)
    samples = [point(curve, i/96) for i in range(97)]
    length = sum(math.dist(a, b) for a, b in zip(samples, samples[1:]))
    branch = {
        'id': f'edge-{len(branches)}', 'parent': parent, 'curve': curve,
        'w0': widths[0], 'w1': widths[1], 'plane': plane,
        'depth': branches[parent]['depth']+1 if parent is not None else 0,
        'distance': branches[parent]['distance']+branches[parent]['length'] if parent is not None else 0,
        'length': length, 'phase': R.random()*math.tau,
    }
    branches.append(branch)
    return len(branches)-1


# One heavy bough, broken into sections so side systems emerge at different ages.
r0 = add(None, ((1510, 453), (1415, 485), (1324, 463)), (196, 154), 'front')
r1 = add(r0, ((1235, 440), (1174, 424), (1081, 426)), (154, 120), 'front')
r2 = add(r1, ((982, 430), (924, 387), (835, 390)), (120, 91), 'mid')
r3 = add(r2, ((740, 385), (687, 326), (594, 325)), (91, 62), 'mid')
r4 = add(r3, ((512, 322), (468, 286), (388, 293)), (62, 37), 'mid')
r5 = add(r4, ((326, 300), (283, 274), (221, 292)), (37, 13), 'mid')
r6 = add(r5, ((177, 307), (146, 341), (112, 327)), (13, .5), 'mid')

# Upper system: lifted, lighter, partially behind the main bough.
u0 = add(r1, ((1034, 379), (1043, 289), (966, 247)), (72, 51), 'rear')
u1 = add(u0, ((892, 205), (824, 183), (746, 190)), (51, 35), 'rear')
u2 = add(u1, ((664, 197), (613, 145), (529, 153)), (35, 22), 'rear')
u3 = add(u2, ((458, 161), (421, 126), (347, 141)), (22, 8), 'rear')
u4 = add(u3, ((297, 151), (268, 185), (216, 169)), (8, .45), 'rear')

# A short high fork intersects the upper haze rather than forming a radial fan.
uh0 = add(u0, ((930, 226), (921, 158), (863, 130)), (28, 18), 'back')
uh1 = add(uh0, ((807, 107), (765, 121), (719, 104)), (18, .5), 'back')

# Mid-low system bends beneath the trunk and comes forward at the end.
m0 = add(r2, ((807, 445), (799, 516), (716, 531)), (57, 39), 'mid')
m1 = add(m0, ((636, 550), (589, 602), (505, 588)), (39, 24), 'front')
m2 = add(m1, ((432, 578), (387, 622), (315, 611)), (24, 10), 'front')
m3 = add(m2, ((260, 603), (229, 626), (181, 615)), (10, .45), 'front')

# Lower system carries weight, then rises subtly toward its distal twigs.
l0 = add(r0, ((1260, 527), (1235, 610), (1138, 625)), (112, 78), 'front')
l1 = add(l0, ((1035, 640), (985, 714), (884, 706)), (78, 53), 'front')
l2 = add(l1, ((785, 700), (724, 753), (632, 733)), (53, 33), 'front')
l3 = add(l2, ((548, 716), (501, 754), (422, 740)), (33, 16), 'front')
l4 = add(l3, ((358, 729), (320, 756), (261, 744)), (16, .55), 'front')

# Unequal secondary boughs create the complex openings found in mature trees.
s0 = add(r3, ((573, 355), (560, 432), (489, 449)), (39, 22), 'mid')
s1 = add(s0, ((424, 464), (384, 502), (320, 495)), (22, 9), 'mid')
s2 = add(s1, ((267, 491), (232, 517), (190, 507)), (9, .4), 'mid')

v0 = add(l1, ((865, 742), (859, 801), (793, 818)), (28, 16), 'front')
v1 = add(v0, ((735, 831), (695, 806), (640, 818)), (16, .4), 'front')

b0 = add(r4, ((377, 265), (365, 220), (316, 205)), (19, 10), 'back')
b1 = add(b0, ((271, 191), (241, 212), (198, 200)), (10, .4), 'back')


def twig(parent, angle_offset, length, width=.36, plane=None):
    branch = branches[parent]
    x, y = branch['curve'][-1]
    dx, dy = tangent(branch['curve'], 1)
    angle = math.atan2(dy, dx) + angle_offset
    end = (x + math.cos(angle)*length, y + math.sin(angle)*length)
    if end[0] < 84 or end[1] < 68 or end[1] > 875:
        return None
    c1 = (x + dx*length*.28, y + dy*length*.28)
    bend = angle + R.uniform(-.18, .18)
    c2 = (end[0] - math.cos(bend)*length*.29, end[1] - math.sin(bend)*length*.29)
    return add(parent, (c1, c2, end), (max(.75, branch['w1']*.94), width), plane or branch['plane'])


# Finely divided outer crowns. They are intentionally lopsided and leave broad sky holes.
terminal_seeds = [u4, uh1, r6, m3, l4, s2, v1, b1]
for index, seed in enumerate(terminal_seeds):
    primary = twig(seed, R.uniform(-.22, .18), R.uniform(42, 72), 1.15)
    side = twig(seed, (-1 if index % 3 else 1)*R.uniform(.42, .72), R.uniform(30, 59), .7)
    for stem, polarity in ((primary, 1), (side, -1)):
        if stem is None:
            continue
        continuation = twig(stem, R.uniform(-.14, .13), R.uniform(29, 53), .35)
        twig(stem, polarity*R.uniform(.36, .65), R.uniform(21, 40), .3)
        if continuation is not None and index in (0, 1, 3, 4, 6):
            twig(continuation, R.uniform(-.1, .1), R.uniform(18, 36), .2)
            twig(continuation, -polarity*R.uniform(.33, .53), R.uniform(14, 29), .2)

# Sparse inner shoots disrupt the smooth hose reading without filling every opening.
for seed, offset, length in [
    (u1, -.55, 82), (u2, .48, 58), (r3, -.52, 68), (r4, .48, 62),
    (m0, -.47, 58), (m1, .55, 63), (l1, -.6, 71), (l2, .52, 64),
    (s0, -.52, 48), (l3, -.45, 43),
]:
    shoot = twig(seed, offset, length, 1.0)
    if shoot is not None and R.random() < .8:
        twig(shoot, R.uniform(-.2, .18), R.uniform(19, 37), .25)
        twig(shoot, -math.copysign(R.uniform(.34, .58), offset), R.uniform(15, 30), .2)


def outline(branch):
    left, right = [], []
    for i in range(97):
        t = i/96
        x, y = point(branch['curve'], t)
        dx, dy = tangent(branch['curve'], t)
        rad = radius(branch, t)
        left.append((x-dy*rad, y+dx*rad))
        right.append((x+dy*rad, y-dx*rad))
    return Polygon(left+right[::-1]).buffer(0)


def polygon_path(poly):
    polygons = [poly] if poly.geom_type == 'Polygon' else list(poly.geoms)
    chunks = []
    for item in polygons:
        for ring in [item.exterior, *item.interiors]:
            chunks.append('M'+' L'.join(f'{x:.2f},{y:.2f}' for x, y in ring.coords)+' Z')
    return ' '.join(chunks)


def cubic_path(curve):
    a, b, c, d = curve
    return f'M{a[0]:.2f},{a[1]:.2f} C{b[0]:.2f},{b[1]:.2f} {c[0]:.2f},{c[1]:.2f} {d[0]:.2f},{d[1]:.2f}'


def strand_path(branch, fraction, start=0, end=1, phase=0, points=38, end_fraction=None, roughness=.035):
    if end_fraction is None:
        end_fraction = fraction
    values = []
    for i in range(points):
        t = start + (end-start)*i/(points-1)
        x, y = point(branch['curve'], t)
        dx, dy = tangent(branch['curve'], t)
        local = i/(points-1)
        blend = local*local*(3-2*local)
        base = fraction*(1-blend) + end_fraction*blend
        envelope = math.sin(math.pi*local)**.32
        micro = (roughness*math.sin(t*13+phase) + roughness*.44*math.sin(t*37+phase*.37))*envelope
        offset = radius(branch, t)*(base+micro)
        x -= dy*offset
        y += dx*offset
        values.append((x, y))
    return 'M'+' L'.join(f'{x:.2f},{y:.2f}' for x, y in values)


union = unary_union([outline(branch) for branch in branches] + [
    Point(*branch['curve'][0]).buffer(branch['w0']*.49) for branch in branches
]).buffer(0)
assert union.is_valid and union.geom_type == 'Polygon'
silhouette = polygon_path(union)

# Cavities expose the sky through the material and keep the branch from reading
# as a solid vector hose. They follow the grain and gather near older limbs.
voids = []
for branch in branches:
    if branch['w0'] < 40:
        continue
    for cavity in range(max(1, int(branch['length']/115))):
        t = R.uniform(.18, .84)
        x, y = point(branch['curve'], t)
        dx, dy = tangent(branch['curve'], t)
        rad = radius(branch, t)
        offset = R.uniform(-.42, .42)*rad
        x -= dy*offset
        y += dx*offset
        angle = math.degrees(math.atan2(dy, dx))
        rx = R.uniform(.12, .31)*rad
        ry = R.uniform(8, 23)
        voids.append(f'<ellipse cx="{x:.2f}" cy="{y:.2f}" rx="{ry:.2f}" ry="{rx:.2f}" transform="rotate({angle:.2f} {x:.2f} {y:.2f})" fill="#000" opacity="{R.uniform(.72,.96):.2f}"/>')

parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000" role="img" aria-labelledby="branch-title branch-art-description">
<title id="branch-title">A fibrous neural bough</title>
<desc id="branch-art-description">A mature bough enters from the right and divides into irregular bundles of graphite fibers. Sage moss and hanging filaments gather in its creases. Fine embedded paths carry a learning signal through the grown structure.</desc>
<defs>
  <clipPath id="branch-clip"><path d="{silhouette}"/></clipPath>
  <mask id="material-mask" maskUnits="userSpaceOnUse" x="70" y="50" width="1530" height="850">
    <path d="{silhouette}" fill="#fff"/>
    {''.join(voids)}
  </mask>
  <linearGradient id="branch-underpaint" gradientUnits="userSpaceOnUse" x1="1500" y1="720" x2="210" y2="135">
    <stop stop-color="#071c28" stop-opacity=".93"/>
    <stop offset=".48" stop-color="#102d38" stop-opacity=".82"/>
    <stop offset="1" stop-color="#52717a" stop-opacity=".46"/>
  </linearGradient>
</defs>
<g id="branch-sculpture">
  <g id="material-fibers" fill="none" stroke-linecap="round">''']

plane_color = {
    'back': ('#9ab9b9', .32), 'rear': ('#6f9397', .38),
    'mid': ('#274e5b', .48), 'front': ('#082734', .60),
}
for branch_index, branch in enumerate(branches):
    color, base_alpha = plane_color[branch['plane']]
    # Only part of the cross-section is occupied. Open sky between bundles is
    # the primary material cue; uniform coverage immediately becomes a pipe.
    count = max(3, min(34, int(4 + branch['w0']*.145)))
    for strand_index in range(count):
        center = R.choice([-.58, -.19, .19, .58])
        fraction = max(-.94, min(.94, R.gauss(center, .11)))
        end_fraction = max(-.96, min(.96, fraction+R.gauss(0, .19)))
        start = 0 if strand_index % 3 else R.uniform(0, .19)
        end = 1 if strand_index % 4 else R.uniform(.68, .96)
        if fraction < -.56:
            stroke = '#041b28'
            alpha = min(.84, base_alpha+.13)
        elif fraction > .54:
            stroke = '#b0c9c2'
            alpha = base_alpha*.84
        else:
            stroke = color
            alpha = base_alpha+R.uniform(-.08, .1)
        width = R.uniform(.62, 1.65) * (1.18 if branch['plane'] == 'front' else 1)
        parts.append(f'<path d="{strand_path(branch, fraction, start, end, branch["phase"]+strand_index*.37, 42, end_fraction, .055)}" stroke="{stroke}" stroke-opacity="{max(.13,alpha):.3f}" stroke-width="{width:.2f}"/>')
        # A dim companion strand makes local braids without filling the gap.
        if strand_index % 4 == 0 and branch['w0'] > 12:
            companion = max(-.97, min(.97, fraction+R.choice([-1,1])*R.uniform(.035,.08)))
            parts.append(f'<path d="{strand_path(branch, companion, start, end, branch["phase"]+strand_index*.29, 42, end_fraction, .07)}" stroke="#9db8b2" stroke-opacity=".18" stroke-width=".45"/>')

parts.append('</g>')

# Subtle transverse growth lines bind the long fibers into real material.
parts.append('<g id="growth-lines" clip-path="url(#branch-clip)" fill="none" stroke="#b9ccc4" stroke-opacity=".20" stroke-width=".55">')
for branch in branches:
    if branch['w0'] < 18:
        continue
    for ring in range(max(1, int(branch['length']/105))):
        t = (ring+1)/(max(1, int(branch['length']/105))+1) + R.uniform(-.05, .05)
        x, y = point(branch['curve'], t)
        dx, dy = tangent(branch['curve'], t)
        rad = radius(branch, t)*R.uniform(.72, .98)
        parts.append(f'<path d="M{x-dy*rad:.2f},{y+dx*rad:.2f} Q{x-dy*rad*.05+dx*2:.2f},{y+dx*rad*.05+dy*2:.2f} {x+dy*rad:.2f},{y-dx*rad:.2f}"/>')
parts.append('</g>')

# Moss appears as coherent colonies of many hairlines, concentrated at old junctions.
moss_sites = [(r0,.14,.55),(r1,.25,.64),(r3,.30,.63),(u0,.22,.58),(u2,.36,.72),(m0,.28,.57),(l0,.34,.69),(l1,.18,.48),(s0,.28,.56)]
parts.append('<g id="branch-moss" fill="none" stroke-linecap="round">')
for branch_id, t0, t1 in moss_sites:
    branch = branches[branch_id]
    amount = int(max(40, (t1-t0)*branch['length']*2.5))
    center = (t0+t1)*.5
    for filament in range(amount):
        t = max(t0, min(t1, R.gauss(center, (t1-t0)*.19)))
        x, y = point(branch['curve'], t)
        dx, dy = tangent(branch['curve'], t)
        # Colonies sit mostly on the upper plane and spill into creases.
        offset = radius(branch, t)*R.uniform(.55, 1.02)
        x -= dy*offset
        y += dx*offset
        height = R.gammavariate(1.8, 2.5) + 1
        drift = R.uniform(-4, 4)
        color = R.choice(['#3d5b50','#526b58','#65775e','#7e8c6c','#9aa47d'])
        parts.append(f'<path d="M{x:.2f},{y:.2f} q{drift*.35:.2f},{-height*.58:.2f} {drift:.2f},{-height:.2f}" stroke="{color}" stroke-opacity="{R.uniform(.28,.72):.2f}" stroke-width="{R.uniform(.3,1.05):.2f}"/>')

# Long descending filaments are sparse enough to read as growth, not a curtain effect.
for branch_id, t, amount in [(r1,.42,14),(r3,.51,11),(u0,.41,9),(l0,.52,13),(m0,.47,8)]:
    branch = branches[branch_id]
    for strand in range(amount):
        tt = t+R.uniform(-.045,.045)
        x, y = point(branch['curve'], tt)
        dx, dy = tangent(branch['curve'], tt)
        rad = radius(branch, tt)
        x += dy*rad*.82
        y -= dx*rad*.82
        length = R.uniform(24, 104)
        sway = R.uniform(-12, 12)
        parts.append(f'<path d="M{x:.2f},{y:.2f} C{x+sway:.2f},{y+length*.32:.2f} {x-sway*.4:.2f},{y+length*.72:.2f} {x+sway*.2:.2f},{y+length:.2f}" stroke="#456458" stroke-opacity="{R.uniform(.28,.55):.2f}" stroke-width="{R.uniform(.35,.85):.2f}"/>')
parts.append('</g>')

# Resting neural fibers are part of the weave. The runtime can illuminate them together.
parts.append('<g id="signal-channels" clip-path="url(#branch-clip)" fill="none" stroke-linecap="round">')
for branch in branches:
    parent = branches[branch['parent']]['id'] if branch['parent'] is not None else ''
    parts.append(f'<path class="signal-path" id="{branch["id"]}" data-parent="{parent}" data-depth="{branch["depth"]}" data-distance="{branch["distance"]:.3f}" data-length="{branch["length"]:.3f}" d="{cubic_path(branch["curve"])}" stroke="#b4dfe0" stroke-opacity=".055" stroke-width=".7"/>')
    if branch['w0'] > 18:
        for fiber_index, fraction in enumerate((-.30,-.12,.09,.27)):
            parts.append(f'<path class="signal-fiber" data-edge="{branch["id"]}" data-fiber="{fiber_index}" d="{strand_path(branch, fraction, .01, .99, branch["phase"]+fiber_index, 44)}" stroke="#a8d4d1" stroke-opacity=".09" stroke-width=".46"/>')
parts.append('</g>')

parents = {branch['parent'] for branch in branches if branch['parent'] is not None}
parts.append('<g id="signal-outputs" fill="#c5dedb" opacity=".16">')
for branch_index, branch in enumerate(branches):
    if branch_index in parents:
        continue
    x, y = branch['curve'][-1]
    parts.append(f'<circle class="signal-tip" data-edge="{branch["id"]}" cx="{x:.2f}" cy="{y:.2f}" r="1.1"/>')
parts.append('</g></g></svg>')

output = Path(__file__).with_name('neural-branch.svg')
output.write_text('\n'.join(parts))
root = ET.parse(output).getroot()
assert len(branches) >= 55
assert sum(branch['parent'] is None for branch in branches) == 1
for branch in branches:
    if branch['parent'] is None:
        continue
    parent = branches[branch['parent']]
    assert branch['curve'][0] == parent['curve'][-1]
    assert abs(branch['distance'] - parent['distance'] - parent['length']) < 1e-6
print(f'Generated {output.name}: {len(branches)} signal edges, {len(branches)-len(parents)} outputs, {output.stat().st_size:,} bytes')
