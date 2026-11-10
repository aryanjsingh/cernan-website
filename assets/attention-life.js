/* Illustrative loss specimen and detritus, driven by the attention scene's clock. */
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
  const colors = ['#235482','#3989c6','#56b7e8','#38bd87','#72e8ab','#d0f4ff','#91d8ff'];

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

  const ASH = ['#40556b','#536f88','#6b8ba4','#85a7bc','#a6c3d3','#c5dae5','#96b4c7'];
  const crushColors = Array.from({length:17},(_,step) => colors.map((color,index) => {
    const from=parseInt(color.slice(1),16), to=parseInt(ASH[index].slice(1),16);
    const mix=step/16;
    const channels=[16,8,0].map(shift => Math.round(((from>>shift)&255)*(1-mix)+((to>>shift)&255)*mix));
    return `rgb(${channels.join(',')})`;
  }));
  const MAX_DUST = 2400;
  // Three reusable fields: no particle RNG, anatomy allocation or per-pixel trig in draw.
  const presets=['curled-updraft','shearing-veil','low-eddy'].map((name,presetIndex) => {
    const seed=presetIndex*7, frequency=[1.6,1.15,2.6][presetIndex];
    const pile=anatomy.map((p,i) => {
      const x=p.x*.68+(random(i*31+seed+40)-.5)*4;
      const y=15.4-(1-Math.min(1,Math.abs(x)/17))*(1.2+random(i*43+seed+9)*4.2);
      return {x,y};
    });
    const particles=Array.from({length:MAX_DUST},(_,i) => {
      const id=seed*103+i*17, source=pile[Math.floor(i/MAX_DUST*anatomy.length)];
      const release=random(id+1)*.50, curl=random(id+3)*TAU;
      return {
        x:source.x, y:source.y, release,
        drift:(random(id+2)-.48)*17, lift:random(id+4), jitter:(random(id+5)-.5)*.8,
        size:.25+random(id+6)*.55, alpha:.41+random(id+7)*.36,
        color:ASH[1+Math.floor(random(id+8)*4)],
        curlSin:Math.sin(curl), curlCos:Math.cos(curl),
        flowSin:Math.sin(curl-release*frequency), flowCos:Math.cos(curl-release*frequency),
        slowSin:Math.sin(curl-release), slowCos:Math.cos(curl-release),
      };
    });
    return {name,index:presetIndex,seed,frequency,pile,particles,
      flapRate:4.25+random(seed+1)*.9, flapPhase:random(seed+2)*TAU,
      landOffset:random(seed+7)-.35, direction:presetIndex===1?-1:1};
  });

  function pose(age, preset) {
    // The flap decelerates into contact instead of snapping to a landing pose.
    const flight=Math.min(age,4), settle=smooth((flight-3.25)/.75);
    const phase=(flight-.30*settle)*preset.flapRate*TAU+preset.flapPhase;
    const fold=(.15+(1+Math.sin(phase))*.58)*(1-settle)+.22*settle;
    const bank=(.17+Math.sin(flight*1.75+preset.seed)*.25)*(1-settle);
    const yaw=.27+Math.sin(flight*.83+preset.seed)*.14, pitch=-.13+Math.sin(flight*1.1)*.05;
    const asymmetry=.075*Math.sin(phase+.5);
    return {
      bankCos:Math.cos(bank), bankSin:Math.sin(bank),
      yawCos:Math.cos(yaw), yawSin:Math.sin(yaw),
      pitchCos:Math.cos(pitch), pitchSin:Math.sin(pitch),
      leftCos:Math.cos(fold-asymmetry), leftSin:Math.sin(fold-asymmetry),
      rightCos:Math.cos(fold+asymmetry), rightSin:Math.sin(fold+asymmetry),
    };
  }

  function specimen(ctx, origin, age, preset, unit, compression) {
    const opacity=smooth(age/.34), o=pose(age,preset), palette=crushColors[Math.round(smooth(compression)*16)];
    const pixelSize=unit>.8?1:.8;
    for (let i=0;i<anatomy.length;i++) {
      const p=anatomy[i], pile=preset.pile[i];
      const x=p.side?p.x*(p.side<0?o.leftCos:o.rightCos):p.x;
      const z=p.side?Math.abs(p.x)*(p.side<0?o.leftSin:o.rightSin):p.z;
      const xx=x*o.yawCos+z*o.yawSin, zz=-x*o.yawSin+z*o.yawCos;
      const yy=p.y*o.pitchCos-zz*o.pitchSin;
      const bx=xx*o.bankCos-yy*o.bankSin, by=xx*o.bankSin+yy*o.bankCos;
      const px=bx+(pile.x-bx)*compression, py=by+(pile.y-by)*compression;
      ctx.globalAlpha=opacity*(p.side===-1?.71:.95);
      ctx.fillStyle=palette[p.color];
      ctx.fillRect(Math.round(origin[0]+px*unit),Math.round(origin[1]+py*unit),pixelSize,pixelSize);
    }
  }

  function dust(ctx, origin, age, preset, unit, width, height) {
    const density=Math.round(clamp(width*3-300,800,MAX_DUST));
    const flowSin=Math.sin(age*preset.frequency), flowCos=Math.cos(age*preset.frequency);
    const slowSin=Math.sin(age), slowCos=Math.cos(age);
    let visible=0;
    for (let i=0;i<density;i++) {
      const p=preset.particles[Math.floor(i*MAX_DUST/density)];
      const elapsed=Math.max(0,age-p.release), fade=1-smooth((elapsed-.47)/1.46);
      if(fade<=0)continue;
      const curl=elapsed>0?flowSin*p.flowCos+flowCos*p.flowSin-p.curlSin:0;
      const curlCos=elapsed>0?flowCos*p.flowCos-flowSin*p.flowSin-p.curlCos:0;
      const slow=elapsed>0?slowSin*p.slowCos+slowCos*p.slowSin:0;
      let dx=0,dy=0;
      if(preset.index===0) {
        // A narrow column curls upwards and gently widens into suspended ash.
        dx=p.drift*elapsed*elapsed*.55+curl*(1+elapsed*4.5);
        dy=-elapsed*(8+p.lift*14)-elapsed*elapsed*3+slow*elapsed*1.3;
      } else if(preset.index===1) {
        // A low crosswind shears the pile into a fine, slightly lifting veil.
        dx=preset.direction*elapsed*(11+p.lift*18)+p.drift*elapsed*.45+curl*elapsed*3;
        dy=-elapsed*(4+p.lift*8)+curl*elapsed*2;
      } else {
        // A shallow eddy rolls close to contact before the last grains disappear.
        dx=curl*(3+elapsed*8)+p.drift*elapsed*.3;
        dy=-elapsed*(2+p.lift*5)-Math.abs(curlCos)*(3+elapsed*4);
      }
      const x=Math.round((origin[0]+p.x*unit+p.jitter+dx)*4)/4;
      const y=Math.round((origin[1]+p.y*unit+dy)*4)/4;
      if(x<0||x+p.size>width||y<0||y+p.size>height)continue;
      ctx.globalAlpha=p.alpha*fade;ctx.fillStyle=p.color;
      ctx.fillRect(x,y,p.size,p.size);
      visible++;
    }
    return visible;
  }

  function tracking(ctx, origin, age, unit, width) {
    const alpha=smooth(age/.34)*(1-smooth((age-4)/.35));
    if(alpha<=0)return;
    const half=24*unit+3, left=origin[0]-half, right=origin[0]+half;
    const top=origin[1]-24*unit, bottom=origin[1]+21*unit, corner=5;
    // Four isolated camera corners; no strokes connect along the sides.
    ctx.globalAlpha=alpha*.9;ctx.strokeStyle='#86caff';ctx.lineWidth=.85;
    ctx.setLineDash([]);ctx.beginPath();
    ctx.moveTo(left,top+corner);ctx.lineTo(left,top);ctx.lineTo(left+corner,top);
    ctx.moveTo(right-corner,top);ctx.lineTo(right,top);ctx.lineTo(right,top+corner);
    ctx.moveTo(left,bottom-corner);ctx.lineTo(left,bottom);ctx.lineTo(left+corner,bottom);
    ctx.moveTo(right-corner,bottom);ctx.lineTo(right,bottom);ctx.lineTo(right,bottom-corner);ctx.stroke();
    const x=clamp(right+5,8,width-104);
    ctx.globalAlpha=alpha*.9;ctx.font='7.5px "Geist Mono", monospace';ctx.fillStyle='#b9d4e8';
    ctx.fillText('LOSS / illustrative',x,top+5);
  }

  const detritus=Array.from({length:23},(_,i) => {
    const seed=i*73+19, period=7.2+random(seed)*2.2;
    return {seed,period,life:3.5+random(seed+1)*1.5,offset:random(seed+2)*period,
      x:(random(seed+3)-.5)*38,drift:(random(seed+4)-.5)*12,
      fall:21+random(seed+5)*13,alpha:.29+random(seed+6)*.29};
  });

  const starts = [[960,200,-70],[580,180,-90],[1080,270,20]];
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
      ctx.fillStyle=i%6===0?'#7cf0a6':i%3===0?'#81ceff':'#478ab8';
      const size=i%7===0?1.4:1;
      ctx.fillRect(Math.round(screen[0]),Math.round(screen[1]),size,size);
      counts.particles++;
    }

    // An illustrative loss motif, not a measurement of the attention model.
    // One descent, contact and disintegration, followed by a long quiet interval.
    const period=13.6, cycle=Math.floor(time/period), age=time-cycle*period-.7;
    if(age>=0&&age<6.9) {
      const preset=presets[cycle%presets.length], seed=preset.seed, unit=clamp(scale*2.05,.58,1);
      counts.pattern=preset.name;
      const projected=project(starts[cycle%starts.length]);
      const start=[clamp(projected[0],26,frame.width-26),clamp(projected[1],30,frame.height-110)];
      const ground=frame.height-26;
      const landX=clamp(start[0]+preset.landOffset*frame.width*.14,35,frame.width-35);
      const t=clamp(age/4,0,1), fall=smooth(t), sway=Math.sin(t*Math.PI);
      const origin=[start[0]+(landX-start[0])*fall+
        (Math.sin(age*2.05+seed)*11+Math.sin(age*.8)*9)*sway,
        start[1]+(ground-16*unit-start[1])*fall+Math.sin(age*2.2)*2*sway];
      if(age<4.55) {
        const compression=smooth((age-4)/.55);
        specimen(ctx,origin,age,preset,unit,compression);
        counts.butterflies=1;
        counts.phase=age<4?'descent':'compression';
      } else {
        counts.dust=dust(ctx,origin,age-4.55,preset,unit,frame.width,frame.height);
        counts.phase='dissolve';
      }
      tracking(ctx,origin,age,unit,frame.width);
    }
    ctx.restore();
    return counts;
  }
  window.AttentionLife=Object.freeze({draw});
})();
