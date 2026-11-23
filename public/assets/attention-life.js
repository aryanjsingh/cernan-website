/* Living butterfly specimen and canopy detritus, driven by the attention scene's clock. */
(() => {
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const random = n => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  };
  const smooth = x => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
  const forewing = [[1,2],[2,-5],[5,-12],[10,-17],[16,-20],[19,-18],[20,-14],[18,-9],[15,-4],[10,1],[4,4]];
  const hindwing = [[2,0],[8,0],[13,3],[16,7],[16,10],[13,13],[12,16],[9,15],[8,13],[5,12],[3,8],[1,4]];
  const veins = [[4,-11],[10,-17],[18,-15],[15,-5],[11,2],[14,9],[11,14],[6,10]];
  const colors = ['#062d16','#0d5427','#16863c','#2aac4b','#53d867','#9be99a','#5ddba0'];

  function inside(x, y, polygon) {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) hit = !hit;
    }
    return hit;
  }
  function distanceToSegment(x, y, a, b) {
    const dx = b[0]-a[0], dy = b[1]-a[1];
    const t = clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy || 1), 0, 1);
    return Math.hypot(x-a[0]-t*dx, y-a[1]-t*dy);
  }

  // Rasterized wing lobes preserve venation, scalloped edges and tiny ocelli.
  // Fixed occupancy avoids twinkling; motion comes from wing foreshortening.
  const wing = [];
  for (let y = -20; y <= 16; y+=1.25) for (let x = 1; x <= 20; x+=1.25) {
    const upper = inside(x+.5, y+.5, forewing), lower = inside(x+.5, y+.5, hindwing);
    if (!upper && !lower) continue;
    const polygon = upper ? forewing : hindwing;
    const edge = Math.min(...polygon.map((p,i) => distanceToSegment(x+.5,y+.5,p,polygon[(i+1)%polygon.length])));
    const vein = Math.min(...veins.map(p => distanceToSegment(x+.5,y+.5,[1,3],p)));
    const grain = random(x * 71 + y * 137);
    const eye = Math.hypot(x-(upper ? 13 : 11), y-(upper ? -10 : 8));
    if (edge < .7 && grain < .18) continue;
    if (vein > .65 && edge > 1 && eye > 3 && grain < .20) continue;
    let color = vein < .6 ? 0 : grain < .3 ? 1 : grain < .6 ? 2 : 3;
    if (edge < 1.25) color = grain > .58 ? 4 : 1;
    if (eye < 2.7) color = eye < 1.1 ? 0 : eye < 1.8 ? 6 : 2;
    if (grain > .96 && vein > 1.2 && edge > 2) color = 5;
    wing.push({x:x+.5, y:y+.5, color});
  }

  const anatomy = [];
  for (const side of [-1,1]) for (const p of wing) anatomy.push({...p, x:side*p.x, z:0, side});
  for (let y=-6;y<=10;y++) {
    anatomy.push({x:0,y,z:2,color:y<0?1:y%3===0?4:0,side:0});
    if (y>-4&&y<4) anatomy.push({x:1,y,z:2.2,color:y%2?2:0,side:0});
  }
  anatomy.push({x:-1,y:-5,z:2.5,color:5,side:0},{x:1,y:-5,z:2.5,color:4,side:0});
  for (const side of [-1,1]) for (let i=0;i<=7;i++) {
    const t=i/7;
    anatomy.push({x:side*(.5+3.5*t*t),y:-6-6*t,z:1.5,color:i===7?4:0,side:0});
  }

  function pose(age, vx, vy) {
    const phase = age * 4.45 * TAU + Math.sin(age * 0.85) * 0.7;
    const fold = 0.16 + (1 + Math.sin(phase)) * 0.58;
    const bank = clamp(vx * 0.0022, -0.34, 0.34) + Math.sin(age * 1.45) * 0.12;
    const yaw = 0.24 + clamp(vx * 0.0016, -0.22, 0.22) + Math.sin(age * 0.73) * 0.12;
    const pitch = -0.11 + clamp(vy * 0.0018, -0.12, 0.12) + Math.sin(age * 1.05) * 0.04;
    const asymmetry = 0.075 * Math.sin(phase + 0.5);
    return {
      phase,
      bankCos: Math.cos(bank), bankSin: Math.sin(bank),
      yawCos: Math.cos(yaw), yawSin: Math.sin(yaw),
      pitchCos: Math.cos(pitch), pitchSin: Math.sin(pitch),
      leftCos: Math.cos(fold - asymmetry), leftSin: Math.sin(fold - asymmetry),
      rightCos: Math.cos(fold + asymmetry), rightSin: Math.sin(fold + asymmetry),
    };
  }

  function specimen(ctx, origin, age, vx, vy, unit) {
    const opacity = smooth(age / 0.5), o = pose(age, vx, vy);
    const bob = -Math.sin(o.phase) * 1.4 * unit;
    const pixelSize = unit > 0.8 ? 1 : 0.8;
    for (let i = 0; i < anatomy.length; i++) {
      const p = anatomy[i];
      const x = p.side ? p.x * (p.side < 0 ? o.leftCos : o.rightCos) : p.x;
      const z = p.side ? Math.abs(p.x) * (p.side < 0 ? o.leftSin : o.rightSin) : p.z;
      const xx = x * o.yawCos + z * o.yawSin, zz = -x * o.yawSin + z * o.yawCos;
      const yy = p.y * o.pitchCos - zz * o.pitchSin;
      const bx = xx * o.bankCos - yy * o.bankSin, by = xx * o.bankSin + yy * o.bankCos;
      ctx.globalAlpha = opacity * (p.side === -1 ? 0.71 : 0.95);
      ctx.fillStyle = colors[p.color];
      ctx.fillRect(Math.round(origin[0] + bx * unit), Math.round(origin[1] + by * unit + bob), pixelSize, pixelSize);
    }
  }

  function tracking(ctx, origin, age, unit) {
    const alpha = smooth(age / 0.5);
    if (alpha <= 0) return;
    const half = 24 * unit + 3, left = origin[0] - half, right = origin[0] + half;
    const top = origin[1] - 24 * unit, bottom = origin[1] + 21 * unit, corner = 5;
    // Four isolated camera corners; no strokes connect along the sides.
    ctx.globalAlpha = alpha * 0.72; ctx.strokeStyle = '#287844'; ctx.lineWidth = 0.75;
    ctx.setLineDash([]); ctx.beginPath();
    ctx.moveTo(left, top + corner); ctx.lineTo(left, top); ctx.lineTo(left + corner, top);
    ctx.moveTo(right - corner, top); ctx.lineTo(right, top); ctx.lineTo(right, top + corner);
    ctx.moveTo(left, bottom - corner); ctx.lineTo(left, bottom); ctx.lineTo(left + corner, bottom);
    ctx.moveTo(right - corner, bottom); ctx.lineTo(right, bottom); ctx.lineTo(right, bottom - corner); ctx.stroke();
  }

  const detritus=Array.from({length:23},(_,i) => {
    const seed=i*73+19, period=7.2+random(seed)*2.2;
    return {seed,period,life:3.5+random(seed+1)*1.5,offset:random(seed+2)*period,
      x:(random(seed+3)-.5)*38,drift:(random(seed+4)-.5)*12,
      fall:21+random(seed+5)*13,alpha:.29+random(seed+6)*.29};
  });

  function flightWorld(t) {
    return [
      860 + Math.sin(t * 0.37) * 180 + Math.cos(t * 0.19) * 70,
      230 + Math.sin(t * 0.61) * 55 + Math.cos(t * 0.29) * 35,
      -45 + Math.sin(t * 0.23) * 50,
    ];
  }

  function draw(ctx, frame) {
    const counts = {butterflies:0, particles:0, dust:0, phase:'quiet', pattern:null};
    if (frame.reduced || (frame.introProgress !== undefined && frame.introProgress < 1) || !Number.isFinite(frame.time) || frame.width<=0 || frame.height<=0) return counts;
    const time=Math.max(0,frame.time), project=frame.project, scale=frame.scale;
    ctx.save();ctx.beginPath();ctx.rect(0,0,frame.width,frame.height);ctx.clip();

    // Each detritus slot has a fixed schedule and a bounded drift.
    const sources=frame.anchors.filter(a=>a.p[1]>420&&a.p[0]>450);
    for (let i=0;i<23&&sources.length;i++) {
      const d=detritus[i], life=d.life;
      const age=(time+d.offset)%d.period;
      if(age>=life)continue;
      const p=sources[i%sources.length].p, progress=age/life;
      const world=[p[0]+d.x+Math.sin(age*.8+d.seed)*13+age*d.drift,
        p[1]+13+age*d.fall+age*age*5.8,p[2]-15];
      const screen=project(world);
      if(screen[0]<0||screen[0]>frame.width||screen[1]<0||screen[1]>frame.height)continue;
      ctx.globalAlpha=smooth(age/.22)*Math.pow(1-progress,1.65)*d.alpha;
      ctx.fillStyle=i%6===0?'#52c467':i%3===0?'#268f40':'#17622e';
      const size=i%7===0?1.4:1;
      ctx.fillRect(Math.round(screen[0]),Math.round(screen[1]),size,size);
      counts.particles++;
    }

    // Continuous gentle flight around the canopy.
    const age = time - 0.7;
    if (age >= 0) {
      const unit = clamp(scale * 2.05, 0.58, 1);
      const curr = project(flightWorld(age));
      const prev = project(flightWorld(Math.max(0, age - 0.05)));
      const origin = [
        clamp(curr[0], 32, frame.width - 32),
        clamp(curr[1], 32, frame.height - 64),
      ];
      const vx = (curr[0] - prev[0]) / 0.05;
      const vy = (curr[1] - prev[1]) / 0.05;
      specimen(ctx, origin, age, vx, vy, unit);
      tracking(ctx, origin, age, unit);
      counts.butterflies = 1;
      counts.phase = 'flight';
      counts.pattern = 'continuous';
    }
    ctx.restore();
    return counts;
  }
  window.AttentionLife=Object.freeze({draw});
})();
