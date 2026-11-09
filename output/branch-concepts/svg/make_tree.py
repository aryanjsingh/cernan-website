"""Rough SVG outline of the branch structure.

Canvas matches the site background (2880x1800). A limb enters from the right
edge and forks irregularly toward the left, widening into a canopy.
Outputs:
  tree.svg          outline of the branch silhouette + channels + fork nodes
  Each centre line is a <path id="b-..."> so it can be animated later.
"""
import math, random, sys

SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 7
random.seed(SEED)
W, H = 2880, 1800
NAV_Y = 230                     # keep clear of nav
TEXT_BOX = (0, 700, 1250, 1800)  # keep clear for headline
MAXD = 6

branches = []   # dicts: pts(list of (x,y)), w0, w1, depth, id, parent
nodes = []      # (x, y, r, depth)


def in_keepout(x, y):
    if y < NAV_Y:
        return True
    x0, y0, x1, y1 = TEXT_BOX
    return x0 <= x <= x1 and y0 <= y <= y1


def grow(x, y, ang, length, w0, depth, pid):
    """Grow one branch as a gently bending curve, then fork."""
    steps = 14
    pts = [(x, y)]
    bend = random.uniform(-0.5, 0.5) / steps
    a = ang
    seg = length / steps
    for i in range(steps):
        a += bend + random.uniform(-0.05, 0.05)
        # heading stays leftward; thin limbs lift a little toward the light
        a += 0.006 * depth
        a = min(max(a, math.pi - 0.75), math.pi + 1.15)
        nx, ny = pts[-1][0] + math.cos(a) * seg, pts[-1][1] + math.sin(a) * seg
        if in_keepout(nx, ny) or nx < 900 or ny > 1450:
            break
        pts.append((nx, ny))
    if len(pts) < 4:
        return
    w1 = w0 * random.uniform(0.58, 0.72)
    bid = f"b-{len(branches)}"
    branches.append(dict(pts=pts, w0=w0, w1=w1, depth=depth, id=bid, parent=pid))
    ex, ey = pts[-1]
    if depth >= MAXD:
        nodes.append((ex, ey, 4.5, depth))
        return
    nodes.append((ex, ey, min(16, 6 + w1 * 0.06), depth))
    k = random.choice([2, 2, 3]) if depth < 3 else random.choice([1, 2, 2, 3])
    spread = random.uniform(0.55, 1.05)
    end_ang = math.atan2(pts[-1][1] - pts[-2][1], pts[-1][0] - pts[-2][0])
    for i in range(k):
        off = (i - (k - 1) / 2) * spread / max(1, k - 1) * 2 if k > 1 else random.uniform(-0.2, 0.2)
        off += random.uniform(-0.25, 0.25)
        # bias the canopy upward-left and away from the text box
        child_ang = end_ang + off + random.uniform(-0.1, 0.2)
        child_len = length * random.uniform(0.5, 0.82)
        cw = w1 * (random.uniform(0.7, 0.9) if i == 0 else random.uniform(0.45, 0.7))
        grow(ex, ey, child_ang, child_len, cw, depth + 1, bid)


# input limb: enters from off-screen right
grow(W + 80, random.uniform(430, 560), math.pi + random.uniform(-0.12, 0.05), 760, 340, 0, None)
# a second limb entering lower down, partly hidden behind — gives natural asymmetry
grow(W + 80, random.uniform(620, 720), math.pi - random.uniform(0.15, 0.3), 520, 190, 1, None)


def outline(b):
    """Tapered polygon around the centre line."""
    pts, n = b["pts"], len(b["pts"])
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        j0, j1 = max(0, i - 1), min(n - 1, i + 1)
        dx, dy = pts[j1][0] - pts[j0][0], pts[j1][1] - pts[j0][1]
        l = math.hypot(dx, dy) or 1
        nx, ny = -dy / l, dx / l
        t = i / (n - 1)
        w = (b["w0"] + (b["w1"] - b["w0"]) * t) / 2
        w *= 1 + random.uniform(-0.04, 0.04)    # slight irregular bark edge
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    poly = left + right[::-1]
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in poly) + " Z"


def smooth(pts):
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for i in range(1, len(pts) - 1):
        mx, my = (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2
        d += f" Q{pts[i][0]:.1f},{pts[i][1]:.1f} {mx:.1f},{my:.1f}"
    d += f" L{pts[-1][0]:.1f},{pts[-1][1]:.1f}"
    return d


shapes = "\n    ".join(f'<path d="{outline(b)}"/>' for b in branches)
joints = "\n    ".join(f'<circle cx="{b["pts"][0][0]:.1f}" cy="{b["pts"][0][1]:.1f}" r="{b["w0"]/2*1.05:.1f}"/>' for b in branches)
channels = "\n    ".join(
    f'<path id="{b["id"]}" data-depth="{b["depth"]}" data-parent="{b["parent"] or ""}" d="{smooth(b["pts"])}"/>' for b in branches)
dots = "\n    ".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}"/>' for x, y, r, d in nodes)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <defs>
    <!-- turns the union of all branch shapes into one clean outline -->
    <filter id="outline" x="-5%" y="-5%" width="110%" height="110%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="fat"/>
      <feComposite in="fat" in2="SourceAlpha" operator="out" result="edge"/>
      <feFlood flood-color="#0b1a2b"/>
      <feComposite in2="edge" operator="in"/>
    </filter>
  </defs>
  <!-- silhouette (very light fill) -->
  <g fill="#0b1a2b" opacity="0.1">
    {shapes}
    {joints}
  </g>
  <!-- outline of the silhouette -->
  <g filter="url(#outline)" fill="#000">
    {shapes}
    {joints}
  </g>
  <!-- centre lines: the channels signals will travel along -->
  <g id="channels" fill="none" stroke="#0b1a2b" stroke-opacity="0.45" stroke-width="2" stroke-dasharray="6 8" stroke-linecap="round">
    {channels}
  </g>
  <!-- fork nodes / outputs -->
  <g id="nodes" fill="#ffffff" stroke="#0b1a2b" stroke-width="2.5">
    {dots}
  </g>
</svg>
'''
open(f"tree-{SEED}.svg", "w").write(svg)
print(f"tree-{SEED}.svg  branches={len(branches)} nodes={len(nodes)}")
