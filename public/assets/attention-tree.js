/* Pixel specimen: spatial branches, all-to-all transformer self-attention. */
(() => {
  const stage = document.getElementById('attention-stage');
  if (!stage || !window.SelfAttentionModel) return;
  const canvas = stage.querySelector('.attention-pixels');
  const overlay = stage.querySelector('.attention-overlay');
  const ctx = overlay.getContext('2d');
  const model = SelfAttentionModel.create();
  const pauseButton = document.getElementById('attention-pause');
  const headButtons = [...document.querySelectorAll('[data-attention-head]')];
  const status = document.getElementById('attention-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const random = n => { const f = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return f - Math.floor(f); };
  const normalize = v => { const l = Math.hypot(...v) || 1; return v.map(n => n / l); };
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const branches = [];
  function branch(points, r0, r1, depth = 0) {
    const id = branches.length;
    branches.push({ points, r0, r1, depth, id });
    return id;
  }
  function at(b, t) {
    const s = 1-t, p = b.points;
    return [0,1,2].map(k => s*s*s*p[0][k] + 3*s*s*t*p[1][k] + 3*s*t*t*p[2][k] + t*t*t*p[3][k]);
  }
  function radius(b, t) { return mix(b.r0, b.r1, Math.pow(t, b.r1 < 1 ? .8 : 1))*.72; }
  // The silhouette is built independently of the attention graph.
  branch([[1690,490,0],[1500,545,15],[1320,485,0],[1170,445,20]],126,83);
  branch([[1170,445,20],[990,430,30],[860,365,50],[700,390,45]],83,48);
  branch([[700,390,45],[535,380,35],[420,315,55],[230,355,80]],48,14);
  branch([[230,355,80],[150,350,95],[110,300,110],[45,315,120]],14,0);
  branch([[1170,445,20],[1110,320,-30],[1060,190,-100],[900,195,-115]],62,35);
  branch([[900,195,-115],[735,165,-130],[590,200,-130],[490,130,-140]],35,13);
  branch([[490,130,-140],[410,95,-160],[360,130,-140],[300,80,-130]],13,0);
  branch([[900,195,-115],[880,120,-80],[750,70,-40],[680,85,-15]],20,0);
  branch([[700,390,45],[640,490,90],[480,500,125],[350,460,135]],31,12);
  branch([[350,460,135],[260,450,120],[180,495,115],[100,450,100]],12,0);
  branch([[1350,495,10],[1250,600,30],[1060,675,65],[910,640,70]],72,39);
  branch([[910,640,70],[790,640,95],[640,710,135],[480,655,145]],39,17);
  branch([[480,655,145],[370,620,155],[230,690,125],[160,620,100]],17,0);
  branch([[910,640,70],[820,750,10],[730,795,-60],[560,760,-90]],27,10);
  branch([[560,760,-90],[470,740,-120],[420,825,-145],[330,790,-160]],10,0);
  branch([[930,415,30],[880,490,-25],[775,560,-75],[650,540,-90]],28,9);
  branch([[650,540,-90],[565,530,-120],[535,600,-100],[450,565,-100]],9,0);
  const coreCount = branches.length;
  for (let i = 1; i < coreCount; i++) {
    const parent = branches[i];
    for (let twig = 0; twig < (parent.r0 > 25 ? 3 : 2); twig++) {
      const key = i*17+twig*23, t = .24+twig*.24+random(key)*.1;
      const start = at(parent,t), end = at(parent,Math.min(1,t+.03));
      const direction = normalize(end.map((n,k)=>n-start[k]));
      const side = twig%2 ? 1 : -1, angle = Math.atan2(direction[1],direction[0])+side*(.38+random(key+3)*.55);
      const length = 60+random(key+7)*105, dx = Math.cos(angle)*length, dy = Math.sin(angle)*length;
      const z = (random(key+9)-.5)*105;
      branch([start,[start[0]+direction[0]*length*.3,start[1]+direction[1]*length*.3,start[2]+z*.25],
        [start[0]+dx*.64,start[1]+dy*.92,start[2]+z*.8],[start[0]+dx,start[1]+dy,start[2]+z]],
        Math.min(13,radius(parent,t)*.32),0,1);
    }
  }
  const sites = [[0,.58],[4,.6],[11,.65],[8,.55],[6,.48],[2,.42],[14,.55],[5,.52],[3,.36],[10,.5],
    [9,.48],[4,.21],[0,.88],[11,.22],[2,.85],[7,.55],[13,.7],[1,.47],[12,.5],[15,.6]];
  const anchors = sites.map(([id,t],index) => {
    const b = branches[id], p = at(b,t); p[2] += radius(b,t)*.82;
    return { p, ...model.tokens[index], index };
  });
  const data = [], points = [];
  for (const b of branches) {
    const samples = Array.from({length:41},(_,i)=>at(b,i/40));
    const length = samples.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...p.map((n,k)=>n-samples[i][k])),0);
    const steps = Math.ceil(length/3.6);
    for (let i=0;i<=steps;i++) {
      const t=i/steps, p=at(b,t), before=at(b,Math.max(0,t-.003)), after=at(b,Math.min(1,t+.003));
      const tangent=normalize(after.map((n,k)=>n-before[k]));
      const side=normalize([-tangent[1],tangent[0],0]), front=normalize(cross(tangent,side));
      const r=radius(b,t), count=Math.max(3,Math.ceil(TAU*r/3.4));
      for (let j=0;j<count;j++) {
        const seed=b.id*10331+i*271+j*13;
        if(random(seed)<.12+(b.depth?.09:0))continue;
        if(r<2&&random(seed+17)>.55)continue;
        const angle=(j+random(i+b.id)*.8)/count*TAU;
        const n=side.map((v,k)=>v*Math.cos(angle)+front[k]*Math.sin(angle));
        const edgeNoise=1+.065*Math.sin(i*.31+angle*6)+.035*Math.sin(i*.87-angle*3);
        const dust=random(seed+1)>.974;
        const rr=r*edgeNoise*(dust?1.15+random(seed+2)*.23:1);
        const pos=p.map((v,k)=>v+n[k]*rr);
        let token=0, nearest=Infinity;
        anchors.forEach((a,k)=>{const d=(a.p[0]-pos[0])**2+(a.p[1]-pos[1])**2+(a.p[2]-pos[2])**2*.2;
          if(d<nearest){nearest=d;token=k;}});
        const grain=random(seed+5);
        data.push(...pos,...n,token,dust?grain*.23:grain,Math.exp(-nearest/10500));
        points.push({p:pos,n,token,grain,dust});
      }
    }
  }
  const vertexSource = `
    attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aMeta;
    uniform vec2 uViewport; uniform vec3 uFrame; uniform vec2 uAngles;
    uniform vec2 uBuffer; uniform float uGrid; uniform float uTime; uniform float uQuery;
    uniform float uWeights[20]; uniform float uPeak; uniform float uAttention; uniform float uIntro;
    varying vec3 vColor; varying float vIntensity; varying float vCell; varying float vAppear;
    vec3 turn(vec3 p){float flex=1.-clamp(p.x/1650.,0.,1.);
      float drift=sin(uTime*.8+p.x*.004+p.y*.006);
      p+=vec3(drift*4.,sin(uTime*.75+p.x*.005)*8.,sin(uTime*.9+p.y*.009)*12.)*flex;
      float a=uAngles.x,b=uAngles.y; p-=vec3(1000.,460.,0.);
      p=vec3(p.x*cos(a)+p.z*sin(a),p.y,-p.x*sin(a)+p.z*cos(a));
      p=vec3(p.x,p.y*cos(b)-p.z*sin(b),p.y*sin(b)+p.z*cos(b));return p+vec3(1000.,460.,0.);}
    void main(){vec3 p=turn(aPosition); vec2 px=p.xy*uFrame.x+uFrame.yz;
      float arrival=(1.-clamp(px.x/uViewport.x,0.,1.))*.84+aMeta.y*.10;
      vAppear=smoothstep(arrival,arrival+.06,uIntro);
      px+=vec2(18.+aMeta.y*42.,(aMeta.y-.5)*22.)*(1.-vAppear);
      vec2 pixelRatio=uBuffer/uViewport;
      vec2 cell=floor(px*pixelRatio/uGrid);vCell=fract(52.9829189*fract(dot(cell,vec2(.06711056,.00583715))));
      px=(cell+.5)*uGrid/pixelRatio;
      gl_Position=vec4(px.x/uViewport.x*2.-1.,1.-px.y/uViewport.y*2.,-p.z/900.,1.);
      float selected=1.-step(.1,abs(aMeta.x-uQuery));
      gl_PointSize=max(1.,floor(uGrid*(.65+clamp(p.z/700.+.12,.0,.16))*(1.+selected*aMeta.z*.2)+.5));
      float face=clamp(dot(normalize(aNormal),normalize(vec3(-.28,-.62,.84))),0.,1.);
      float hue=clamp(.42+p.z/430.+.14*sin(aPosition.y*.008),0.,1.);
      vec3 forest=vec3(.012,.17,.035),jade=vec3(.025,.39,.085),lime=vec3(.13,.62,.15);
      vec3 body=mix(vec3(.006,.065,.015),mix(forest,jade,hue),smoothstep(-210.,85.,p.z));
      body=mix(body,lime,smoothstep(100.,260.,p.z)*.40);
      float shade=.12+pow(face,1.7)*1.32+aMeta.y*.32;
      vec3 color=body*shade;
      float depth=clamp((-p.z+35.)/570.,0.,.42);
      color=mix(color,vec3(.12,.30,.16),depth);
      float w=uWeights[int(aMeta.x)]/max(.001,uPeak);
      float wave=.72+.28*sin(aPosition.x*.024+aPosition.y*.018-uTime*1.4);
      vec3 lit=mix(vec3(.025,.68,.13),vec3(.24,.94,.29),hue);
      float emphasis=pow(w,2.25)*uAttention*wave*aMeta.z;
      color=mix(color,lit*(.5+face*.65),emphasis*.96);
      color=mix(color,vec3(.15,.88,.26)*(.65+face*.5),selected*aMeta.z*.76);
      float scan=pow(max(0.,cos(aPosition.x*.012+aPosition.y*.007-uTime*1.45)),19.);
      color+=vec3(.035,.19,.045)*scan*(.28+face*.72);
      color+=vec3(.08,.40,.12)*4.*vAppear*(1.-vAppear);
      vColor=color;vIntensity=emphasis;
    }`;
  const fragmentSource = `precision mediump float;varying vec3 vColor;varying float vIntensity;varying float vCell;varying float vAppear;
    void main(){if(vCell<.115||vAppear<.30)discard;vec2 p=gl_PointCoord;float upper=step(p.y,.19)+step(p.x,.15);
      float lower=step(.84,p.x)+step(.83,p.y);
      vec3 color=vColor+vec3(.018,.06,.022)*upper*(.6+vIntensity)-lower*.045;
      gl_FragColor=vec4(color,1.);}`;
  let gl, program, buffer, uniforms, glReady=false;
  function initGL() {
    gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false});
    if(!gl) return;
    function compile(kind,source) {
      const shader=gl.createShader(kind);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    const vertex=compile(gl.VERTEX_SHADER,vertexSource), fragment=compile(gl.FRAGMENT_SHADER,fragmentSource);
    program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
    for(const [name,size,offset] of [['aPosition',3,0],['aNormal',3,12],['aMeta',3,24]]) {
      const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,36,offset);
    }
    uniforms=Object.fromEntries(['uViewport','uFrame','uAngles','uBuffer','uGrid','uTime','uQuery','uWeights[0]','uPeak','uAttention','uIntro'].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);glReady=true;stage.dataset.renderer='webgl';
  }
  try { initGL(); } catch(error) { console.warn('Using the static pixel fallback:',error.message); }
  if(!glReady)stage.dataset.renderer='canvas';
  let width=1,height=1,dpr=1,scale=1,offsetX=0,offsetY=0,visibleLeft=0,visibleRight=1;
  let labelBounds=[];
  let fallbackPoints;
  let elapsed=0,cycleStart=0,last=0,lastPaint=0,raf=0,paused=false,query=2,head=0,hover=-1;
  let holdUntil=0,manualHead=false,pointer=[0,0],angles=[0,0];
  let attention=model.attend(query,head), top=[];
  const palette=['#087d2d','#219e35','#0c6832','#48a426'];
  const matrices=Array.from({length:4},(_,h)=>Array.from({length:20},(_,q)=>model.attend(q,h).weights));
  const matrixColors=matrices.map(matrix=>matrix.map(row=>row.map(w=>`rgba(4,108,35,${.08+clamp(w/.35,0,1)*.82})`)));
  const assemblyPixels=points.filter((_,i)=>i%251===0);
  let metrics={};
  function select(index, nextHead=head, manual=false) {
    query=(index+20)%20;head=nextHead;attention=model.attend(query,head);
    top=attention.weights.map((weight,i)=>({weight,i})).filter(item=>item.i!==query).sort((a,b)=>b.weight-a.weight).slice(0,4);
    metrics={
      entropy:-attention.weights.reduce((sum,w)=>sum+w*Math.log2(w),0),
      top3:[...attention.weights].sort((a,b)=>b-a).slice(0,3).reduce((sum,w)=>sum+w,0),
      qNorm:Math.hypot(...attention.query),contextNorm:Math.hypot(...attention.context),
      logitSpan:Math.max(...attention.keyScores)-Math.min(...attention.keyScores)
    };
    stage.dataset.query=String(query);stage.dataset.head=String(head);
    stage.dataset.weightSum=attention.weights.reduce((sum,n)=>sum+n,0).toFixed(6);
    stage.dataset.context=attention.context.map(n=>n.toFixed(4)).join(',');
    headButtons.forEach((button,i)=>button.setAttribute('aria-pressed',String(head===i)));
    status.textContent=`Query “${model.tokens[query].label}” · head ${String(head+1).padStart(2,'0')} · strongest other key “${model.tokens[top[0].i].label}” ${attention.weights[top[0].i].toFixed(2)}`;
    cycleStart=elapsed;if(manual)holdUntil=elapsed+12;
    draw();
  }
  function project(p) {
    const time=reduced.matches?0:elapsed,flex=1-clamp(p[0]/1650,0,1);
    const drift=Math.sin(time*.8+p[0]*.004+p[1]*.006);
    const x=p[0]+drift*4*flex-1000,y=p[1]+Math.sin(time*.75+p[0]*.005)*8*flex-460,z=p[2]+Math.sin(time*.9+p[1]*.009)*12*flex;
    const a=angles[0],b=angles[1];
    const xx=x*Math.cos(a)+z*Math.sin(a),zz=-x*Math.sin(a)+z*Math.cos(a);
    return [(xx+1000)*scale+offsetX,(y*Math.cos(b)-zz*Math.sin(b)+460)*scale+offsetY];
  }
  function resize() {
    const bounds=stage.getBoundingClientRect();width=bounds.width;height=bounds.height;dpr=Math.min(devicePixelRatio||1,1.7);
    visibleLeft=Math.max(0,-bounds.left);visibleRight=Math.min(width,innerWidth-bounds.left);
    scale=Math.min(width/1600,height/960);offsetX=width-1600*scale;offsetY=(height-960*scale)/2;
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    // Fine dust and type use the display's resolution; the tree keeps its pixel grid.
    const detailDpr=Math.min(devicePixelRatio||1,3);
    overlay.width=Math.round(width*detailDpr);overlay.height=Math.round(height*detailDpr);
    ctx.setTransform(detailDpr,0,0,detailDpr,0,0);draw();
  }
  function bracket(p,size,color,alpha=1) {
    ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=.8;
    const x=Math.round(p[0])+.5,y=Math.round(p[1])+.5,s=size/2,k=size*.28;
    ctx.beginPath();
    for(const dx of [-1,1])for(const dy of [-1,1]){
      ctx.moveTo(x+dx*s,y+dy*(s-k));ctx.lineTo(x+dx*s,y+dy*s);ctx.lineTo(x+dx*(s-k),y+dy*s);
    }ctx.stroke();ctx.globalAlpha=1;
  }
  function label(text,p,color='#184d2b',background=true) {
    ctx.font='9px "JetBrains Mono", monospace';const measure=ctx.measureText(text).width;
    const x=clamp(p[0],visibleLeft+6,visibleRight-measure-8);
    let y=clamp(p[1],14,height-8);
    if(background) {
      const initialY=y;
      for(const offset of [0,16,-16,32,-32,48,-48]) {
        y=clamp(initialY+offset,14,height-8);
        if(!labelBounds.some(b=>x<b.x+b.w+5&&x+measure+5>b.x&&y-11<b.y+15&&y+4>b.y))break;
      }
      labelBounds.push({x,y:y-11,w:measure});
    }
    if(background){ctx.fillStyle='rgba(219,242,227,.66)';ctx.fillRect(x-3,y-9,measure+6,13);}
    ctx.fillStyle=color;ctx.fillText(text,x,y);
  }
  function draw() {
    if(!width||!height)return;
    const time=reduced.matches?0:elapsed;
    const intro=reduced.matches?1:clamp(elapsed/.82,0,1);
    stage.dataset.intro=intro<1?'assembling':'ready';
    angles=[pointer[0]*.07+Math.sin(time*.34)*.055,pointer[1]*.035+Math.cos(time*.28)*.033];
    const age=elapsed-cycleStart, activity=(paused||reduced.matches)?1:clamp(age/1.1,0,1);
    if(glReady) {
      gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);gl.uniform2f(uniforms.uViewport,width,height);gl.uniform3f(uniforms.uFrame,scale,offsetX,offsetY);
      gl.uniform2f(uniforms.uAngles,...angles);gl.uniform2f(uniforms.uBuffer,canvas.width,canvas.height);
      gl.uniform1f(uniforms.uGrid,Math.round((width<650?2.1:2.9)*dpr));
      gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uQuery,query);
      gl.uniform1f(uniforms.uIntro,intro);
      gl.uniform1fv(uniforms['uWeights[0]'],attention.weights);gl.uniform1f(uniforms.uPeak,Math.max(...attention.weights));
      gl.uniform1f(uniforms.uAttention,activity);gl.drawArrays(gl.POINTS,0,data.length/9);
    }
    ctx.clearRect(0,0,width,height);
    labelBounds=[];
    if(!glReady) {
      fallbackPoints ??= points.filter((_,i)=>i%3===0).sort((a,b)=>a.p[2]-b.p[2]);
      fallbackPoints.forEach(p=>{
        const xy=project(p.p),arrival=(1-clamp(xy[0]/width,0,1))*.84+p.grain*.10;
        if(intro<arrival+.02)return;
        ctx.fillStyle=p.n[2]>.3?'#176d32':'#063415';ctx.fillRect(Math.round(xy[0]/3)*3,Math.round(xy[1]/3)*3,2.3,2.3);
      });
    }
    if(intro<1) {
      stage.dataset.butterflies='0';stage.dataset.particles='0';stage.dataset.dust='0';stage.dataset.lossPhase='quiet';
      for(const p of assemblyPixels) {
        const xy=project(p.p),arrival=(1-clamp(xy[0]/width,0,1))*.84+p.grain*.10;
        const phase=(intro-arrival)/.12;
        if(phase<0||phase>1)continue;
        ctx.globalAlpha=(1-phase)*.7;ctx.fillStyle='#28a64a';
        ctx.fillRect(Math.round(xy[0]+(1-phase)*(15+p.grain*38)),Math.round(xy[1]+(1-phase)*(p.grain-.5)*40),1.2,1.2);
      }
      ctx.globalAlpha=1;return;
    }
    // A sparse instrument grid, confined to the specimen's occupied area.
    ctx.strokeStyle='rgba(15,100,44,.055)';ctx.lineWidth=.5;
    const grid=64,left=Math.max(0,offsetX+120*scale),topY=offsetY+65*scale,bottom=offsetY+845*scale;
    ctx.beginPath();for(let x=Math.ceil(left/grid)*grid;x<width;x+=grid){ctx.moveTo(x,topY);ctx.lineTo(x,bottom);}
    for(let y=Math.ceil(topY/grid)*grid;y<bottom;y+=grid){ctx.moveTo(left,y);ctx.lineTo(width,y);}ctx.stroke();
    const positions=anchors.map(a=>project(a.p)),q=positions[query],accent=palette[head];
    // All tokens participate in softmax; only the strongest four links are drawn.
    top.forEach(({i,weight},rank)=>{
      const p=positions[i], strength=weight/Math.max(...attention.weights),alpha=activity*(.34+strength*.40);
      ctx.globalAlpha=alpha;ctx.strokeStyle='#07562a';ctx.lineWidth=.65+strength*.55;ctx.setLineDash([2,4]);
      ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();ctx.setLineDash([]);
      if(!reduced.matches&&age>1) {
        const progress=((age-1)*.42+rank*.21)%1, x=mix(p[0],q[0],progress), y=mix(p[1],q[1],progress);
        ctx.globalAlpha=.9;ctx.fillStyle=accent;ctx.fillRect(Math.round(x)-1.5,Math.round(y)-1.5,3,3);
      }
      ctx.globalAlpha=1;bracket(p,12+strength*9,accent,.45+strength*.5);
      if(i!==hover&&rank<(width<650?2:3))label(`K${String(i).padStart(2,'0')} α${weight.toFixed(3)}`,[p[0]+13,p[1]-13],accent);
      if(i!==hover&&rank===0&&width>650)label(`s=${attention.keyScores[i].toFixed(2)}`,[p[0]+13,p[1]+3],'#27683c');
    });
    positions.forEach((p,i)=>{if(i===query||top.some(t=>t.i===i))return;
      ctx.strokeStyle='rgba(15,85,39,.62)';ctx.lineWidth=.7;ctx.strokeRect(Math.round(p[0])-3.5,Math.round(p[1])-3.5,7,7);
      ctx.fillStyle='rgba(14,105,44,.64)';ctx.fillRect(Math.round(p[0])-1,Math.round(p[1])-1,2,2);
    });
    bracket(q,30,'#094521');bracket(q,22,accent,.8);
    if(hover!==query) {
      label(`Q${String(query).padStart(2,'0')} ${model.tokens[query].label.toUpperCase()}`,[q[0]+22,q[1]-18]);
      label(age<1&&!paused&&!reduced.matches?'ACQUIRING':'CONTEXT',[q[0]+22,q[1]+1],accent);
    }
    if(window.AttentionLife) {
      const life=AttentionLife.draw(ctx,{time:Math.max(0,time-.82),project,anchors,scale,width,height,reduced:reduced.matches,introProgress:intro});
      stage.dataset.butterflies=String(life.butterflies);stage.dataset.particles=String(life.particles);
      stage.dataset.lossPhase=life.phase||'idle';stage.dataset.dust=String(life.dust||0);
      stage.dataset.lossPattern=life.pattern||'quiet';
    }
    drawResearchHUD();
    if(hover>=0)drawTokenHint(positions,q);
  }
  function drawTokenHint(positions,q) {
    const p=positions[hover],selected=hover===query;
    if(!selected&&!top.some(item=>item.i===hover)) {
      ctx.strokeStyle='rgba(7,86,42,.64)';ctx.lineWidth=.85;ctx.setLineDash([2,4]);
      ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();ctx.setLineDash([]);
    }
    bracket(p,24,'#07562a');
    const lines=[`${selected?'QUERY':'TOKEN'} ${String(hover).padStart(2,'0')} / ${model.tokens[hover].label.toUpperCase()}`,
      `${(attention.weights[hover]*100).toFixed(2)}% attention${selected?' · selected':' · click to focus'}`];
    ctx.save();ctx.font='9px "JetBrains Mono", monospace';
    const boxWidth=Math.max(...lines.map(text=>ctx.measureText(text).width))+16;
    const x=clamp(p[0]+18,visibleLeft+8,visibleRight-boxWidth-8);
    let y=clamp(p[1]-46,12,height-48);
    if(labelBounds.some(b=>x<b.x+b.w&&x+boxWidth>b.x&&y<b.y+15&&y+37>b.y))y=clamp(p[1]+18,12,height-48);
    ctx.fillStyle='rgba(227,246,231,.94)';ctx.fillRect(x,y,boxWidth,37);
    ctx.fillStyle='#137339';ctx.fillRect(x,y,2,37);
    ctx.fillStyle='#124a26';ctx.fillText(lines[0],x+8,y+13);
    ctx.fillStyle='#2b6240';ctx.fillText(lines[1],x+8,y+27);ctx.restore();
  }
  function drawResearchHUD() {
    const x=visibleLeft+16,topY=Math.max(24,offsetY-20),color='#27623b';
    ctx.save();ctx.font='8px "JetBrains Mono", monospace';ctx.fillStyle=color;
    ctx.fillText(`SELF-ATTN  /  H${String(head+1).padStart(2,'0')}  /  FIXED W`,x,topY);
    ctx.globalAlpha=.74;
    ctx.fillText('N20 · d_model12 · d_k6 · d_v6 · mask:none',x,topY+14);
    if(width>550)ctx.fillText('QKᵀ × 0.40825 → row-softmax → AV',x,topY+28);
    // One shared linear color scale; the bright outline identifies the query row.
    const cell=width<500?2.2:2.65,size=cell*20,hx=x,hy=Math.min(height-93,offsetY+855*scale);
    ctx.globalAlpha=1;
    for(let row=0;row<20;row++)for(let col=0;col<20;col++) {
      ctx.fillStyle=matrixColors[head][row][col];
      ctx.fillRect(hx+col*cell,hy+row*cell,cell-.55,cell-.55);
    }
    ctx.strokeStyle='#11933b';ctx.lineWidth=.7;ctx.strokeRect(hx-2,hy+query*cell-1,size+4,cell+2);
    ctx.fillStyle=color;ctx.fillText('A[Q,K]',hx,hy-7);
    const tx=hx+size+16;
    ctx.fillText(`H(Aᵢ) ${metrics.entropy.toFixed(3)}b`,tx,hy+4);
    ctx.fillText(`TOP3 ${(metrics.top3*100).toFixed(2)}%   Σα=1`,tx,hy+17);
    ctx.fillText(`‖q‖₂ ${metrics.qNorm.toFixed(3)}   ‖c‖₂ ${metrics.contextNorm.toFixed(3)}`,tx,hy+30);
    ctx.globalAlpha=.7;
    ctx.fillText(`Δlogit ${metrics.logitSpan.toFixed(3)} · toy / non-causal`,tx,hy+43);
    if(width>600) {
      const rx=Math.max(tx+258,width-188);
      ctx.fillText('X[20×12]  Wq[12×6]',rx,hy+4);
      ctx.fillText('Q,K,V[20×6]  A[20×20]',rx,hy+17);
      ctx.fillText('sin/cos position features',rx,hy+30);
      ctx.fillText(`αself=${attention.weights[query].toFixed(4)}  h∈{1…4}`,rx,hy+43);
    }
    ctx.restore();
  }
  function tick(time) {
    if(last)elapsed+=Math.min((time-last)/1000,.06);last=time;
    // High-refresh displays keep the same motion clock without redundant painting.
    if(!lastPaint||time-lastPaint>=1000/60-.5) {
      lastPaint=lastPaint?lastPaint+(1000/60)*Math.max(1,Math.floor((time-lastPaint+.5)/(1000/60))):time;
      if(elapsed-cycleStart>7.5&&elapsed>holdUntil)select((query+7)%20,manualHead?head:(head+1)%4);
      else draw();
    }
    raf=requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(raf);last=0;lastPaint=0;
    pauseButton.textContent=paused?'Play':'Pause';pauseButton.setAttribute('aria-pressed',String(paused));
    pauseButton.setAttribute('aria-label',paused?'Play self-attention animation':'Pause self-attention animation');
    pauseButton.hidden=reduced.matches;stage.dataset.paused=String(paused||reduced.matches);
    draw();if(!paused&&!reduced.matches&&!document.hidden)raf=requestAnimationFrame(tick);
  }
  function nearestAt(clientX,clientY) {
    const box=stage.getBoundingClientRect(),x=clientX-box.left,y=clientY-box.top;
    let index=-1,best=36;
    anchors.forEach((a,i)=>{const p=project(a.p),d=Math.hypot(p[0]-x,p[1]-y);if(d<best){best=d;index=i;}});
    return index;
  }
  stage.addEventListener('pointermove',event=>{
    const box=stage.getBoundingClientRect();
    if(!reduced.matches)pointer=[clamp((event.clientX-box.left)/width*2-1,-1,1),clamp((event.clientY-box.top)/height*2-1,-1,1)];
    hover=nearestAt(event.clientX,event.clientY);stage.dataset.hover=String(hover);stage.style.cursor=hover>=0?'pointer':'default';if(paused||reduced.matches)draw();
  });
  stage.addEventListener('pointerleave',()=>{pointer=[0,0];hover=-1;stage.dataset.hover='-1';if(paused||reduced.matches)draw();});
  stage.addEventListener('click',event=>{const index=nearestAt(event.clientX,event.clientY);if(index>=0)select(index,head,true);});
  stage.addEventListener('keydown',event=>{
    if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(event.key)){event.preventDefault();select(query+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1),head,true);}
    if(event.code==='Space'){event.preventDefault();paused=!paused;sync();}
  });
  pauseButton.addEventListener('click',()=>{paused=!paused;sync();});
  headButtons.forEach((button,i)=>button.addEventListener('click',()=>{manualHead=true;select(query,i,true);}));
  reduced.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();glReady=false;stage.dataset.renderer='canvas';draw();});
  canvas.addEventListener('webglcontextrestored',()=>{try{initGL();draw();}catch(error){console.warn(error.message);}});
  new ResizeObserver(resize).observe(stage);
  select(query);resize();sync();
  document.fonts.ready.then(() => {
    if (reduced.matches) draw();
  });
})();
