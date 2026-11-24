"""Deterministic vector branch sculpture, with a connected signal graph.

Run: python3 assets/generate_neural_branch.py
Shapely is used only at authoring time to unite tapered vector limbs.
"""
from pathlib import Path
import math
import random
import xml.etree.ElementTree as ET
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

R = random.Random(714)
branches = []


def pt(curve, t):
    a, b, c, d = curve
    s = 1-t
    return tuple(s**3*a[i]+3*s*s*t*b[i]+3*s*t*t*c[i]+t**3*d[i] for i in (0, 1))


def tangent(curve, t):
    a, b, c, d = curve
    s = 1-t
    dx, dy = (3*s*s*(b[i]-a[i])+6*s*t*(c[i]-b[i])+3*t*t*(d[i]-c[i]) for i in (0, 1))
    l = math.hypot(dx, dy)
    return dx/l, dy/l


def radius(b, t):
    return .5*(b['w0']*(1-t)**.94+b['w1']*t)*(1+.035*math.sin(t*8+b['phase'])*math.sin(math.pi*t))


def add(parent, controls, widths):
    start = branches[parent]['curve'][-1] if parent is not None else (1590, 490)
    curve = (start, *controls)
    samples = [pt(curve, i/64) for i in range(65)]
    length = sum(math.dist(a,b) for a,b in zip(samples,samples[1:]))
    b = dict(id=f'edge-{len(branches)}', parent=parent, curve=curve, w0=widths[0], w1=widths[1],
             depth=branches[parent]['depth']+1 if parent is not None else 0,
             distance=branches[parent]['distance']+branches[parent]['length'] if parent is not None else 0,
             length=length, phase=R.random()*6)
    branches.append(b)
    return len(branches)-1


# A leaning spine; side limbs attach at different positions, never one radial fork.
e0 = add(None, ((1500,498),(1480,577),(1370,570)), (148,114))
e1 = add(e0, ((1300,568),(1230,530),(1160,518)), (114,85))
e2 = add(e1, ((1050,500),(984,516),(900,470)), (85,65))
e3 = add(e2, ((820,425),(759,440),(686,426)), (65,43))
e4 = add(e3, ((590,412),(510,375),(432,391)), (43,22))
e5 = add(e4, ((345,409),(275,355),(205,373)), (22,1.1))

# Tall upper sweep: an old bent limb with an open window below it.
a0 = add(e1, ((1090,493),(1091,359),(1002,316)), (64,43))
a1 = add(a0, ((908,270),(848,215),(747,201)), (43,28))
a2 = add(a1, ((655,188),(565,136),(476,148)), (28,14))
a3 = add(a2, ((399,156),(344,196),(273,178)), (14,.8))

# Middle upper limb threads behind the tall sweep.
b0 = add(e3, ((617,395),(615,314),(542,282)), (34,22))
b1 = add(b0, ((462,246),(403,249),(343,230)), (22,9))
b2 = add(b1, ((287,211),(248,241),(194,220)), (9,.7))

# Long sagging lower limb, offset from the upper attachment.
c0 = add(e0, ((1252,594),(1231,681),(1122,707)), (85,58))
c1 = add(c0, ((1015,731),(971,790),(861,773)), (58,36))
c2 = add(c1, ((772,760),(735,723),(650,750)), (36,16))
c3 = add(c2, ((601,766),(560,803),(501,791)), (16,.9))

# A lighter lowered limb creates a second unequal opening.
d0 = add(e2, ((834,489),(818,585),(734,604)), (44,27))
d1 = add(d0, ((649,626),(582,659),(503,646)), (27,14))
d2 = add(d1, ((431,634),(375,669),(328,651)), (14,.8))

# Smaller shoots have independent lengths, sag and bends.
offshoot_specs = [
 (a0,((970,275),(939,257),(916,212)),(19,6)),
 (a1,((688,190),(653,238),(588,232)),(16,5)),
 (a2,((453,104),(403,93),(361,112)),(8,.7)),
 (e2,((850,425),(824,386),(756,367)),(26,8)),
 (e4,((408,353),(376,341),(357,300)),(13,4)),
 (e3,((630,439),(574,482),(500,461)),(25,8)),
 (c0,((1081,672),(1056,674),(1028,640)),(23,7)),
 (c1,((828,815),(773,845),(720,831)),(20,5)),
 (c2,((629,704),(607,676),(559,678)),(13,4)),
 (d0,((704,570),(664,537),(615,549)),(16,5)),
 (d1,((481,689),(434,712),(383,704)),(9,2)),
 (b0,((509,316),(463,326),(424,313)),(13,4)),
 (b1,((339,182),(318,161),(276,164)),(8,2)),
]
offshoots = [add(p,c,w) for p,c,w in offshoot_specs]

# Small fork clusters break up the isolated antler-like points.
def twig(parent, offset, length, endwidth):
    b = branches[parent]
    x,y = b['curve'][-1]
    dx,dy = tangent(b['curve'],1)
    ang=math.atan2(dy,dx)+offset
    end=(x+math.cos(ang)*length,y+math.sin(ang)*length)
    if end[1]<83 or end[1]>882 or end[0]<105: return None
    control1=(x+dx*length*.25,y+dy*length*.25)
    control2=(end[0]-math.cos(ang+R.uniform(-.15,.15))*length*.24,end[1]-math.sin(ang)*length*.24)
    return add(parent,(control1,control2,end),(max(.6,b['w1']*.95),endwidth))


for k,parent in enumerate(offshoots):
    if k in [0,1,3,4,6,8,9,11]:
        first=twig(parent,R.uniform(-.28,.2),R.uniform(42,72),1.4)
        twig(parent,R.choice([-1,1])*R.uniform(.4,.65),R.uniform(29,55),.3)
        if first is not None:
            twig(first,R.uniform(-.1,.15),R.uniform(25,47),.2)
            twig(first,R.choice([-1,1])*R.uniform(.35,.6),R.uniform(17,33),.2)
    else:
        twig(parent,R.uniform(-.3,.3),R.uniform(26,69),.2)

# A few terminal twigs remain delicate and broken, with no regular canopy wall.
for parent in [e5,b2,d2]:
    twig(parent,-.2, R.uniform(23,47),.2)
    twig(parent,.55, R.uniform(19,34),.2)


def outline(b, offset=0, scale=1):
    left,right=[],[]
    for i in range(65):
        t=i/64; x,y=pt(b['curve'],t); dx,dy=tangent(b['curve'],t); r=radius(b,t)
        left.append((x-dy*r*(offset+scale),y+dx*r*(offset+scale)))
        right.append((x-dy*r*(offset-scale),y+dx*r*(offset-scale)))
    return Polygon(left+right[::-1]).buffer(0)


def polygon_path(poly):
    rings=[poly.exterior,*poly.interiors] if poly.geom_type=='Polygon' else []
    if not rings: return ' '.join(polygon_path(p) for p in poly.geoms)
    return ' '.join('M'+' L'.join(f'{x:.2f},{y:.2f}' for x,y in ring.coords)+' Z' for ring in rings)


def curve_path(curve):
    a,b,c,d=curve
    return f'M{a[0]:.2f},{a[1]:.2f} C{b[0]:.2f},{b[1]:.2f} {c[0]:.2f},{c[1]:.2f} {d[0]:.2f},{d[1]:.2f}'


def offset_line(b, start, end, fraction, wiggle=0):
    points=[]
    for i in range(32):
        t=start+(end-start)*i/31
        x,y=pt(b['curve'],t); dx,dy=tangent(b['curve'],t)
        off=radius(b,t)*(fraction+wiggle*math.sin(t*16+b['phase']))
        points.append((x-dy*off,y+dx*off))
    return 'M'+' L'.join(f'{x:.2f},{y:.2f}' for x,y in points)


union=unary_union([outline(b) for b in branches]+[Point(*b['curve'][0]).buffer(b['w0']*.48) for b in branches]).buffer(0)
assert union.is_valid and union.geom_type=='Polygon'
silhouette=polygon_path(union)
parts=[]
parts.append(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000" role="img" aria-labelledby="branch-title branch-art-description">
<title id="branch-title">A living neural branch</title>
<desc id="branch-art-description">An asymmetric graphite branch grows inward from the right. Fine moss rests on its ridges. Connected light channels run inside its limbs, carrying a forward signal outward and an error signal back.</desc>
<defs>
  <linearGradient id="branch-material" x1=".1" y1="0" x2=".7" y2="1"><stop stop-color="#5d747b"/><stop offset=".28" stop-color="#334d57"/><stop offset=".52" stop-color="#1a333e"/><stop offset=".78" stop-color="#233a42"/><stop offset="1" stop-color="#102734"/></linearGradient>
  <linearGradient id="branch-rear" gradientUnits="userSpaceOnUse" x1="1160" y1="518" x2="747" y2="201"><stop stop-color="#99b7c3" stop-opacity="0"/><stop offset=".3" stop-color="#99b7c3" stop-opacity=".2"/><stop offset="1" stop-color="#99b7c3" stop-opacity=".35"/></linearGradient>
  <linearGradient id="branch-front" gradientUnits="userSpaceOnUse" x1="1370" y1="570" x2="861" y2="773"><stop stop-color="#061b27" stop-opacity="0"/><stop offset=".5" stop-color="#061b27" stop-opacity=".3"/><stop offset="1" stop-color="#061b27" stop-opacity=".36"/></linearGradient>
  <clipPath id="branch-clip"><path d="{silhouette}"/></clipPath>
  <filter id="signal-bloom" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.4"/></filter>
</defs>
<g id="branch-sculpture">
<path d="{silhouette}" fill="url(#branch-material)"/>
<g clip-path="url(#branch-clip)">''')

# Tonal planes are smoothly faded into the root, without rectangular ridge bands.
def descends(index, ancestor):
    while index is not None:
        if index==ancestor: return True
        index=branches[index]['parent']
    return False


for i,b in enumerate(branches):
    tone='branch-rear' if descends(i,a0) else 'branch-front' if descends(i,c0) else None
    if tone:
        parts.append(f'<path d="{polygon_path(outline(b))}" fill="url(#{tone})"/>')
for b in branches:
    if b['w0']<8: continue
    parts.append(f'<path d="{offset_line(b,.04,.96,.86,.025)}" fill="none" stroke="#b8cecc" stroke-opacity=".28" stroke-width=".8"/>')
    parts.append(f'<path d="{offset_line(b,.02,.98,-.75,.05)}" fill="none" stroke="#071e2c" stroke-opacity=".22" stroke-width="{max(.6,b["w0"]*.022):.2f}"/>')
    for k in range(max(2,int(b['w0']/11))):
        fraction=R.uniform(-.85,.85)
        start=R.uniform(.03,.45); end=min(.98,start+R.uniform(.24,.58))
        color=R.choice(['#91aaa6','#abc2ba','#071e2c','#152e38'])
        parts.append(f'<path d="{offset_line(b,start,end,fraction,.06)}" fill="none" stroke="{color}" stroke-opacity="{R.uniform(.13,.34):.2f}" stroke-width="{R.uniform(.35,1.1):.2f}"/>')

# Three subtle longitudinal fibers make the channels feel embedded in the wood.
for b in branches:
    if b['w0']<20: continue
    for off in [-.16,.13]:
        parts.append(f'<path d="{offset_line(b,.02,.98,off,.015)}" fill="none" stroke="#0b202b" stroke-width="3.5" opacity=".6"/>')
        parts.append(f'<path d="{offset_line(b,.02,.98,off,.015)}" fill="none" stroke="#91c4c8" stroke-width=".65" opacity=".4"/>')
parts.append('</g>')

# Moss grows in discontinuous top-edge mats, with localized curtains in creases.
moss_sites=[(e0,.28,.68),(e1,.23,.64),(e3,.22,.55),(e4,.33,.58),(a0,.28,.49),(a1,.43,.73),(c0,.38,.62),(c1,.18,.47),(d1,.22,.38)]
parts.append('<g id="branch-moss" fill="none" stroke-linecap="round">')
for idx,t0,t1 in moss_sites:
    b=branches[idx]
    # A continuous broken mat of fine strokes, not scattered dots or leaves.
    for k in range(int((t1-t0)*b['length']*1.8)):
        t=max(0,min(1,R.gauss((t0+t1)*.5,(t1-t0)*.22))); x,y=pt(b['curve'],t); dx,dy=tangent(b['curve'],t); r=radius(b,t)
        off=r*R.uniform(.25,1.02)
        x-=dy*off; y+=dx*off
        length=R.uniform(1.5,5)*(1 if b['w0']>25 else .7)
        ex=x+R.uniform(-5,5);ey=y+R.uniform(-length,length*.25)
        color=R.choice(['#566b57','#667b61','#82906e','#405b4e'])
        parts.append(f'<path d="M{x:.2f},{y:.2f} Q{x+R.uniform(-3,3):.2f},{y-length*.65:.2f} {ex:.2f},{ey:.2f}" stroke="{color}" stroke-width="{R.uniform(.6,2):.2f}" opacity="{R.uniform(.4,.85):.2f}"/>')
    # Sparse hanging lichen: several clusters rather than uniform curtains.
    if idx in [e1,e3,a0,c0]:
        mid=(t0+t1)*.5
        for k in range(9):
            t=mid+R.uniform(-.07,.08); x,y=pt(b['curve'],t);dx,dy=tangent(b['curve'],t);r=radius(b,t)
            x+=dy*r*.75; y-=dx*r*.75
            length=R.uniform(19,64); bend=R.uniform(-9,10)
            parts.append(f'<path d="M{x:.2f},{y:.2f} C{x+bend:.2f},{y+length*.3:.2f} {x-bend:.2f},{y+length*.7:.2f} {x+bend*.3:.2f},{y+length:.2f}" stroke="#526e5a" stroke-width="{R.uniform(.6,1.6):.2f}" opacity=".65"/>')
parts.append('</g>')

# Four airy fern pockets grow from creases, not a repeated leaf canopy.
parts.append('<g id="branch-ferns" fill="none" stroke="#526f5b" stroke-linecap="round" opacity=".85">')
for idx,t in [(a1,.65),(e4,.56),(d1,.4),(c2,.52)]:
    b=branches[idx]; ox,oy=pt(b['curve'],t);dx,dy=tangent(b['curve'],t);r=radius(b,t)
    ox-=dy*r*.65;oy+=dx*r*.65
    for frond in range(4):
        angle=-math.pi/2+R.uniform(-1.15,1.05)
        length=R.uniform(24,48)
        tx,ty=ox+math.cos(angle)*length,oy+math.sin(angle)*length
        parts.append(f'<path d="M{ox:.2f},{oy:.2f} Q{ox+math.cos(angle)*length*.6+4:.2f},{oy+math.sin(angle)*length*.4:.2f} {tx:.2f},{ty:.2f}" stroke-width=".65"/>')
        for leaf in range(2,9):
            f=leaf/10;px=ox+(tx-ox)*f;py=oy+(ty-oy)*f
            ll=(1-f)*R.uniform(5,10)
            for side in [-1,1]:
                la=angle+side*.9
                ex=px+math.cos(la)*ll;ey=py+math.sin(la)*ll
                parts.append(f'<path d="M{px:.2f},{py:.2f} Q{ex+side:.2f},{ey+2:.2f} {ex:.2f},{ey:.2f}" stroke-width="1.1"/>')
parts.append('</g>')

# Signal channels are above the material, continuous and intentionally dim at rest.
parts.append('<g id="signal-channels" fill="none" stroke="#a6d8da" stroke-opacity=".22" stroke-width="1.15" stroke-linecap="round">')
for b in branches:
    parent=branches[b['parent']]['id'] if b['parent'] is not None else ''
    parts.append(f'<path class="signal-path" id="{b["id"]}" data-parent="{parent}" data-depth="{b["depth"]}" data-distance="{b["distance"]:.3f}" data-length="{b["length"]:.3f}" d="{curve_path(b["curve"])}"/>')
parts.append('</g>')
parents={b['parent'] for b in branches}
parts.append('<g id="signal-outputs" fill="#b9d7d8" opacity=".55">')
for i,b in enumerate(branches):
    if i in parents: continue
    x,y=b['curve'][-1]
    parts.append(f'<circle class="signal-tip" data-edge="{b["id"]}" cx="{x:.2f}" cy="{y:.2f}" r="1.4"/>')
parts.append('</g></g></svg>')
output=Path(__file__).with_name('neural-branch.svg')
output.write_text('\n'.join(parts))
root=ET.parse(output).getroot()
assert len(branches)>=40
assert sum(b['parent'] is None for b in branches)==1
for b in branches:
    if b['parent'] is not None:
        parent=branches[b['parent']]
        assert b['curve'][0]==parent['curve'][-1]
        assert abs(b['distance']-parent['distance']-parent['length'])<1e-6
print(f'Generated {output.name}: {len(branches)} connected paths, {len(branches)-len(parents)+1} terminal outputs, {output.stat().st_size:,} bytes')
