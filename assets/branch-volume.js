/* Open, layered filament geometry with depth-tested internal signal channels. */
(() => {
  const normalize=v=>{const d=Math.hypot(...v)||1;return v.map(n=>n/d);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const mix=(a,b,t)=>a+(b-a)*t;
  const lerp=(a,b,t)=>a.map((n,i)=>mix(n,b[i],t));
  const random=n=>{const x=Math.sin(n*127.13+73.8)*43758.5453;return x-Math.floor(x);};
  const smooth=t=>t*t*(3-2*t);
  const TAU=Math.PI*2;

  const projection=`
    uniform vec2 uViewport; uniform vec3 uFrame;
    vec4 project(vec3 p){vec2 q=p.xy*uFrame.x+uFrame.yz;
      return vec4(q.x/uViewport.x*2.0-1.0,1.0-q.y/uViewport.y*2.0,-p.z/700.0,1.0);}`;
  const vertexSource=`
    attribute vec3 aPosition; attribute vec3 aNormal; attribute vec2 aMaterial;
    uniform mat4 uLightMatrix; ${projection}
    varying vec3 vPosition; varying vec3 vNormal; varying vec2 vMaterial; varying vec4 vShadow;
    void main(){gl_Position=project(aPosition);vPosition=aPosition;vNormal=aNormal;
      vMaterial=aMaterial;vShadow=uLightMatrix*vec4(aPosition,1.0);}`;
  const fragmentSource=`
    precision highp float;
    varying vec3 vPosition; varying vec3 vNormal; varying vec2 vMaterial; varying vec4 vShadow;
    uniform sampler2D uShadow; uniform float uShadowEnabled;
    float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
    float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float visibility(float n){if(uShadowEnabled<.5)return 1.0;
      vec3 p=vShadow.xyz*.5+.5;if(p.x<.0||p.x>1.0||p.y<.0||p.y>1.0)return 1.0;
      float sum=.0;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
        vec4 d=texture2D(uShadow,p.xy+vec2(float(x),float(y))/1024.0);
        sum+=p.z-(.0006+.001*(1.0-n))<=dot(d,vec4(1.0/16777216.0,1.0/65536.0,1.0/256.0,1.0))?1.0:.0;}
      return .21+.79*sum/9.0;}
    void main(){vec3 N=normalize(vNormal);vec3 L=normalize(vec3(-.44,-.58,.81));
      float grain=noise(vPosition*.14)*.6+noise(vPosition*.67)*.4;
      float diffuse=max(.0,dot(N,L)),shadow=visibility(diffuse);
      float fine=step(.5,vMaterial.x),moss=step(1.5,vMaterial.x);
      vec3 dark=mix(vec3(.035,.059,.064),vec3(.115,.16,.16),grain);
      vec3 silver=mix(vec3(.11,.18,.18),vec3(.29,.37,.34),grain);
      vec3 base=mix(dark,silver,fine*.7);
      base=mix(base,mix(vec3(.09,.16,.10),vec3(.28,.34,.20),grain),moss);
      float spec=pow(max(.0,dot(N,normalize(L+vec3(0,0,1)))),19.0)*(.16+fine*.12)*(1.0-moss*.8);
      float fill=max(.0,dot(N,normalize(vec3(.3,.45,.7))));
      vec3 color=base*(.35+diffuse*1.55*shadow+fill*.19)+vec3(.56,.72,.66)*spec*shadow;
      color*=mix(.79,1.1,vMaterial.y);
      float haze=clamp((-vPosition.z+20.0)/390.0,.0,.36);
      color=mix(color,vec3(.33,.49,.54),haze);
      gl_FragColor=vec4(pow(color,vec3(.9)),1.0);}`;
  const signalVertex=`
    attribute vec3 aPosition; attribute vec3 aNormal; attribute vec4 aSignal;
    uniform sampler2D uStrength; ${projection}
    varying vec3 vNormal; varying vec3 vSignal;
    void main(){gl_Position=project(aPosition);vNormal=aNormal;
      vSignal=vec3(aSignal.xy,texture2D(uStrength,vec2((aSignal.z+.5)/128.0,.5)).r);}`;
  const signalFragment=`
    precision highp float; varying vec3 vNormal; varying vec3 vSignal;
    uniform float uPhase; uniform float uTravel; uniform float uTrail;
    void main(){float backward=step(1.5,uPhase)*step(uPhase,3.5);
      float distance=mix(vSignal.x,vSignal.y,backward),delta=uTravel-distance;
      float pulse=step(.0,delta)*(1.0-smoothstep(.0,max(1.0,uTrail),delta));
      float active=step(.5,uPhase)*step(uPhase,3.5);
      if(uPhase>3.5&&uPhase<4.5)pulse=.3+.25*vSignal.z;
      else pulse*=active;
      float strength=mix(.86,vSignal.z,backward);
      vec3 cyan=vec3(.34,.85,.88),amber=vec3(1.0,.52,.12);
      vec3 emission=mix(cyan,amber,backward);
      float face=.6+.4*max(.0,normalize(vNormal).z);
      vec3 core=mix(vec3(.026,.105,.12),vec3(.12,.21,.19),step(4.5,uPhase));
      vec3 color=core*face+emission*pulse*strength*(.65+.55*face);
      gl_FragColor=vec4(color,1.0);}`;
  const shadowVertex=`attribute vec3 aPosition;uniform mat4 uLightMatrix;
    void main(){gl_Position=uLightMatrix*vec4(aPosition,1.0);}`;
  const shadowFragment=`precision highp float;void main(){vec4 d=fract(gl_FragCoord.z*vec4(16777216.0,65536.0,256.0,1.0));
    d-=d.xxyz*vec4(0.0,1.0/256.0,1.0/256.0,1.0/256.0);gl_FragColor=d;}`;

  function buildGeometry(svg){
    const edges=[...svg.querySelectorAll('.signal-path')].map((path,index)=>({id:path.id,parentId:path.dataset.parent,path,index,children:[],length:path.getTotalLength()}));
    const map=new Map(edges.map(edge=>[edge.id,edge]));
    edges.forEach(edge=>{edge.parent=map.get(edge.parentId);edge.parent?.children.push(edge);});
    const roots=edges.filter(edge=>!edge.parent),ordered=[];
    function count(edge){edge.leaves=edge.children.length?edge.children.reduce((n,c)=>n+count(c),0):1;
      edge.reverseDistance=edge.children.reduce((n,c)=>Math.max(n,c.reverseDistance+c.length),0);return edge.leaves;}
    roots.forEach(count);const total=roots.reduce((n,e)=>n+e.leaves,0);
    function walk(edge,distance,z){
      edge.distance=distance;edge.z0=z;edge.continuation=Boolean(edge.parent&&edge.parent.children[0]===edge);
      edge.z1=Math.max(-220,Math.min(220,z+(edge.continuation?22:155)*(random(edge.index+51)*2-1)));
      const nominal=115*Math.pow(edge.leaves/total,.62)*Math.exp(-distance*.00012);
      edge.r0=edge.continuation?edge.parent.r1:edge.parent?Math.min(edge.parent.r1*.87,nominal*1.15):115;
      edge.r1=edge.children.length?Math.max(3,nominal*.85):.15;
      edge.strandCount=Math.max(3,Math.min(32,Math.round(5+edge.r0*.22)));
      ordered.push(edge);edge.children.forEach(c=>walk(c,distance+edge.length,edge.z1));
    }
    roots.forEach(e=>walk(e,0,0));
    const shell=[],signals=[];
    // Elliptical tubes form both broad tensile ribbons and finer joining threads.
    function tube(target,points,widths,sides,meta,flatten=1){
      const rings=[];
      for(let i=0;i<points.length;i++){
        const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
        const tangent=normalize(after.map((n,k)=>n-before[k]));
        const side=normalize(cross(tangent,Math.abs(tangent[2])>.9?[0,1,0]:[0,0,1]));
        const front=normalize(cross(side,tangent)),r=typeof widths==='number'?widths:widths[i];
        const ring=[];
        for(let j=0;j<sides;j++){
          const angle=j/sides*TAU,co=Math.cos(angle),si=Math.sin(angle);
          const position=points[i].map((n,k)=>n+side[k]*co*r+front[k]*si*r*flatten);
          const normal=normalize(side.map((n,k)=>n*co+front[k]*si/flatten));
          ring.push([...position,...normal,...meta(i,j)]);
        }
        rings.push(ring);
      }
      for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){
        const k=(j+1)%sides;target.push(...rings[i][j],...rings[i+1][j],...rings[i+1][k],...rings[i][j],...rings[i+1][k],...rings[i][k]);
      }
    }
    function frame(edge,t){
      const distance=t*edge.length,p=edge.path.getPointAtLength(distance);
      const a=edge.path.getPointAtLength(Math.max(0,distance-.7)),b=edge.path.getPointAtLength(Math.min(edge.length,distance+.7));
      const side=normalize([-(b.y-a.y),b.x-a.x,0]);
      return {center:[p.x,p.y,mix(edge.z0,edge.z1,smooth(t))],side,r:mix(edge.r0,edge.r1,edge.children.length?t:Math.pow(t,.72))};
    }
    function arc(a,b,bend,steps=9){
      const points=[];
      for(let i=0;i<=steps;i++){const t=i/steps,arch=Math.sin(Math.PI*t);points.push(a.map((n,k)=>mix(n,b[k],t)+bend[k]*arch));}
      return points;
    }
    for(const edge of ordered){
      const count=edge.strandCount,steps=Math.max(7,Math.ceil(edge.length/11));
      edge.strands=[];
      for(let lane=0;lane<count;lane++){
        const seed=edge.index*97+lane*13,structural=lane%5===0;
        const angle=lane/count*TAU+random(seed+3)*.55;
        const depthLayer=(lane%5-2)*.38;
        const peel=.65+random(seed+17)*.65;
        const points=[],widths=[];
        const parentLane=edge.parent?Math.min(edge.parent.strands.length-1,Math.floor(lane/count*edge.parent.strands.length)):0;
        const inherited=edge.parent?.strands[parentLane].at(-1);
        for(let i=0;i<=steps;i++){
          const t=i/steps,f=frame(edge,t),global=edge.distance+t*edge.length;
          const warp=Math.sin(global*.009+lane*1.43)*.22+Math.sin(global*.022+lane*.83)*.1;
          const theta=angle+warp;
          const lateral=Math.cos(theta)*peel*(.78+.22*Math.sin(t*Math.PI));
          const zOffset=(Math.sin(theta)*.73+depthLayer*.55)*f.r;
          const lobe=Math.sin(Math.PI*t)*Math.sin(seed)*f.r*.32;
          let p=f.center.map((n,k)=>n+f.side[k]*(lateral*f.r+lobe));p[2]+=zOffset;
          if(inherited&&t<.34)p=lerp(inherited,p,smooth(t/.34));
          points.push(p);
          const taper=edge.children.length?1:Math.max(.04,Math.pow(1-t,.62));
          const width=(structural?1.2+edge.r0*.025:.35+edge.r0*.006)*(1+.18*Math.sin(global*.027+lane))*taper;
          widths.push(width);
        }
        edge.strands.push(points);
        tube(shell,points,widths,structural?7:4,()=>[structural?0:1,.35+random(seed+6)*.65],structural?.38:.78);
      }
      // Sparse asymmetric diagonals split and rejoin the long paths into cells.
      const bridges=Math.round(edge.r0*.16)+2;
      for(let n=0;n<bridges;n++){
        const seed=edge.index*173+n*31;
        const lane=Math.floor(random(seed+2)*count),other=(lane+1+Math.floor(random(seed+7)*Math.max(1,count*.2)))%count;
        const i=Math.floor(random(seed+9)*(steps-2)),j=Math.min(steps,i+2+Math.floor(random(seed+11)*4));
        const a=edge.strands[lane][i],b=edge.strands[other][j];
        const bend=[(random(seed+13)-.5)*edge.r0*.18,(random(seed+19)-.5)*edge.r0*.3,(random(seed+23)-.5)*edge.r0*.35];
        const points=arc(a,b,bend,5);
        tube(shell,points,.24+random(seed+29)*.55,4,()=>[1,.65],.7);
      }
      // Signals inhabit several inner layers; the surrounding cage occludes them.
      const channelCount=edge.r0>40?5:edge.r0>15?3:1;
      edge.channels=[];
      for(let lane=0;lane<channelCount;lane++){
        const points=[],widths=[],angle=(lane/channelCount*TAU)+.4;
        const parentLane=edge.parent?Math.min(edge.parent.channels.length-1,Math.round(lane/channelCount*(edge.parent.channels.length-1))):0;
        const inherited=edge.parent?.channels[parentLane].at(-1);
        for(let i=0;i<=steps;i++){
          const t=i/steps,f=frame(edge,t),global=edge.distance+t*edge.length;
          const shift=Math.cos(angle)*f.r*.29+Math.sin(global*.015+lane)*f.r*.07;
          let p=f.center.map((n,k)=>n+f.side[k]*shift);p[2]+=Math.sin(angle)*f.r*.31;
          if(inherited&&t<.3)p=lerp(inherited,p,smooth(t/.3));
          points.push(p);widths.push(Math.max(.22,(.67+Math.sqrt(edge.r0)*.15)*(edge.children.length?1:Math.pow(1-t,.55))));
        }
        edge.channels.push(points);
        tube(signals,points,widths,6,(i)=>[edge.distance+i/steps*edge.length,edge.reverseDistance+(1-i/steps)*edge.length,edge.index,0],.8);
      }
    }
    // Tendons span fork crotches, opening large chambers outside the old trunk.
    for(const edge of ordered.filter(e=>e.children.length>1&&e.r1>9)){
      const children=edge.children;
      for(let childIndex=1;childIndex<children.length;childIndex++){
        const a=children[0],b=children[childIndex],webCount=Math.min(23,Math.round(edge.r1*.3)+5);
        for(let n=0;n<webCount;n++){
          const seed=edge.index*431+childIndex*67+n*19;
          const laneA=Math.floor(random(seed)*a.strands.length),laneB=Math.floor(random(seed+1)*b.strands.length);
          const ai=Math.max(1,Math.round((.13+random(seed+2)*.44)*(a.strands[laneA].length-1)));
          const bi=Math.max(1,Math.round((.13+random(seed+3)*.5)*(b.strands[laneB].length-1)));
          const start=a.strands[laneA][ai],end=b.strands[laneB][bi],fork=frame(edge,1).center;
          const middle=lerp(start,end,.5),toward=fork.map((v,k)=>(v-middle[k])*(.27+random(seed+4)*.3));
          toward[2]+=(random(seed+8)-.5)*edge.r1*.7;
          const points=arc(start,end,toward,10),widths=points.map((_,i)=>(.26+random(seed+5)*.55)*(1+.5*Math.sin(i/10*Math.PI)));
          tube(shell,points,widths,4,()=>[random(seed+13)>.88?2:1,.8],.6);
          if(n%3===0){
            const forkLane=edge.strands[Math.floor(random(seed+20)*edge.strands.length)].at(-1);
            tube(shell,arc(forkLane,points[4],[0,-edge.r1*.1,edge.r1*.13],6),.35,4,()=>[1,.55],.65);
          }
        }
      }
    }
    return {vertices:new Float32Array(shell),signals:new Float32Array(signals),edges};
  }

  function mount(container,svg,options={}){
    const canvas=document.createElement('canvas');canvas.className='branch-volume-canvas';
    Object.assign(canvas.style,{display:'block',width:'100%',height:'100%',position:'absolute',inset:'0'});
    canvas.setAttribute('aria-label','Volumetric filament network with internal learning signals');
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
    if(!gl)throw new Error('WebGL is unavailable');
    const geometry=buildGeometry(svg),shadowSize=1024,strengthData=new Uint8Array(128*4).fill(255);
    const light=normalize([-.44,-.58,.81]),right=normalize(cross([0,1,0],light)),up=normalize(cross(light,right));
    const center=[750,500,0],dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
    const lightMatrix=new Float32Array([right[0]/1100,up[0]/1000,-light[0]/1100,0,right[1]/1100,up[1]/1000,-light[1]/1100,0,
      right[2]/1100,up[2]/1000,-light[2]/1100,0,-dot(right,center)/1100,-dot(up,center)/1000,dot(light,center)/1100,1]);
    let resources,lost=false,disposed=false,state={phase:'rest',travel:0,trail:100},width=1,height=1;
    const phaseCodes={rest:0,forward:1,backward:2,error:3,update:4,still:5};
    function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message);}return shader;}
    function link(vertexCode,fragmentCode){const vertex=compile(gl.VERTEX_SHADER,vertexCode),fragment=compile(gl.FRAGMENT_SHADER,fragmentCode);
      const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      const names=['uLightMatrix','uViewport','uFrame','uShadow','uShadowEnabled','uStrength','uPhase','uTravel','uTrail'];
      return {program,uniforms:Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)])),
        attributes:Object.fromEntries(['aPosition','aNormal','aMaterial','aSignal'].map(name=>[name,gl.getAttribLocation(program,name)]))};}
    function bind(info,buffer,isSignal=false){gl.useProgram(info.program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(let i=0;i<4;i++)gl.disableVertexAttribArray(i);
      for(const [name,size,offset] of [['aPosition',3,0],['aNormal',3,12],[isSignal?'aSignal':'aMaterial',isSignal?4:2,24]]){
        const location=info.attributes[name];if(location>=0){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,isSignal?40:32,offset);}}
      gl.uniformMatrix4fv(info.uniforms.uLightMatrix,false,lightMatrix);
      const scale=Math.min(width/1500,height/1000);gl.uniform2f(info.uniforms.uViewport,width,height);
      gl.uniform3f(info.uniforms.uFrame,scale,width-1500*scale,(height-1000*scale)/2);}
    function texture(width,height,data){const result=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,result);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return result;}
    function initialize(){
      resources={surface:link(vertexSource,fragmentSource),signal:link(signalVertex,signalFragment),shadow:link(shadowVertex,shadowFragment)};
      resources.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,resources.buffer);gl.bufferData(gl.ARRAY_BUFFER,geometry.vertices,gl.STATIC_DRAW);
      resources.signalBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,resources.signalBuffer);gl.bufferData(gl.ARRAY_BUFFER,geometry.signals,gl.STATIC_DRAW);
      gl.activeTexture(gl.TEXTURE0);resources.texture=texture(shadowSize,shadowSize,null);
      resources.strength=texture(128,1,strengthData);
      resources.depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,resources.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,shadowSize,shadowSize);
      resources.framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,resources.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,resources.texture,0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,resources.depth);
      resources.shadows=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
      if(resources.shadows){bind(resources.shadow,resources.buffer);gl.viewport(0,0,shadowSize,shadowSize);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,2);gl.drawArrays(gl.TRIANGLES,0,geometry.vertices.length/8);gl.disable(gl.POLYGON_OFFSET_FILL);}
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);
    }
    function render(){if(lost||disposed)return;
      const bounds=container.getBoundingClientRect();width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);
      const dpr=Math.min(window.devicePixelRatio||1,1.5),pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);
      if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
      gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      bind(resources.surface,resources.buffer);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,resources.texture);
      gl.uniform1i(resources.surface.uniforms.uShadow,0);gl.uniform1f(resources.surface.uniforms.uShadowEnabled,resources.shadows?1:0);
      gl.drawArrays(gl.TRIANGLES,0,geometry.vertices.length/8);
      bind(resources.signal,resources.signalBuffer,true);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,resources.strength);
      gl.uniform1i(resources.signal.uniforms.uStrength,1);gl.uniform1f(resources.signal.uniforms.uPhase,phaseCodes[state.phase]??0);
      gl.uniform1f(resources.signal.uniforms.uTravel,state.travel||0);gl.uniform1f(resources.signal.uniforms.uTrail,state.trail||100);
      gl.drawArrays(gl.TRIANGLES,0,geometry.signals.length/10);
      const error=gl.getError();container.dataset.volumeStatus=error===gl.NO_ERROR?'ready':'render-error';container.dataset.volumeShadows=String(resources.shadows);
      if(error!==gl.NO_ERROR)options.onError?.(new Error('WebGL render error '+error));
    }
    function setSignal(next){state={...state,...next};if(lost||disposed)return;
      let changed=false;if(next.strengths)for(const edge of geometry.edges){const value=Math.round(Math.max(0,Math.min(1,next.strengths[edge.id]??1))*255);
        if(strengthData[edge.index*4]!==value){strengthData[edge.index*4]=value;changed=true;}}
      if(changed){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,resources.strength);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,128,1,gl.RGBA,gl.UNSIGNED_BYTE,strengthData);}
      render();
    }
    function contextLost(event){event.preventDefault();lost=true;canvas.hidden=true;container.dataset.volumeStatus='context-lost';options.onError?.(new Error('WebGL context lost'));}
    function contextRestored(){if(disposed)return;try{initialize();lost=false;canvas.hidden=false;render();options.onRestore?.();}
      catch(error){container.dataset.volumeStatus='restore-error';options.onError?.(error);}}
    canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
    initialize();container.append(canvas);const observer=new ResizeObserver(render);observer.observe(container);render();
    return {canvas,render,setSignal,usesNativeSignals:true,edgeCount:geometry.edges.length,vertexCount:geometry.vertices.length/8+geometry.signals.length/10,
      dispose(){disposed=true;observer.disconnect();canvas.remove();canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);
        if(!lost){gl.deleteBuffer(resources.buffer);gl.deleteBuffer(resources.signalBuffer);for(const key of ['surface','signal','shadow'])gl.deleteProgram(resources[key].program);
          gl.deleteTexture(resources.texture);gl.deleteTexture(resources.strength);gl.deleteRenderbuffer(resources.depth);gl.deleteFramebuffer(resources.framebuffer);}}};
  }
  window.BranchVolume={mount};
})();
