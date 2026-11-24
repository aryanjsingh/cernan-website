/* Native WebGL material study. No animation or external rendering dependency. */
(() => {
  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aBark;
    uniform vec2 uViewport;
    uniform vec3 uFrame;
    uniform mat4 uLightMatrix;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vBark;
    varying vec4 vShadow;
    void main() {
      vec2 p = aPosition.xy * uFrame.x + uFrame.yz;
      gl_Position = vec4(p.x / uViewport.x * 2.0 - 1.0,
                        1.0 - p.y / uViewport.y * 2.0,
                        -aPosition.z / 600.0, 1.0);
      vPosition = aPosition;
      vNormal = aNormal;
      vBark = aBark;
      vShadow = uLightMatrix * vec4(aPosition, 1.0);
    }`;
  const fragmentSource = `
    precision highp float;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vBark;
    varying vec4 vShadow;
    uniform sampler2D uShadow;
    uniform float uShadowEnabled;
    uniform vec4 uMossColonies[10];
    float readDepth(vec4 color) {
      return dot(color, vec4(1.0/16777216.0, 1.0/65536.0, 1.0/256.0, 1.0));
    }
    float shadowFactor(float lighting) {
      if (uShadowEnabled < .5) return 1.0;
      vec3 p = vShadow.xyz / vShadow.w * .5 + .5;
      if (p.x<.0 || p.x>1.0 || p.y<.0 || p.y>1.0 || p.z>1.0) return 1.0;
      float bias=.00075 + .0013*(1.0-lighting);
      float visibility=.0;
      for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++) {
        float depth=readDepth(texture2D(uShadow,p.xy+vec2(float(x),float(y))/1024.0));
        visibility += p.z-bias <= depth ? 1.0 : .0;
      }
      return .12 + .88*visibility/9.0;
    }
    float hash(vec3 p) {
      p = fract(p * .1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }
    float noise(vec3 p) {
      vec3 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                     mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                     mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
    }
    float fbm(vec3 p) {
      return noise(p)*.57 + noise(p*2.08+5.1)*.27 + noise(p*4.23+13.6)*.16;
    }
    void main() {
      vec3 normal = normalize(vNormal);
      float grain = fbm(vec3(vBark.x*6.7, vBark.y*.018, 4.3));
      float fissure = smoothstep(.61,.81,fbm(vec3(vBark.x*19.0+grain*2.6,vBark.y*.009,8.2)));
      float fine = noise(vPosition*.6);
      normal = normalize(normal + vec3((grain-.5)*.11, (fine-.5)*.07, .0));
      float mossField = fbm(vPosition*.039 + vec3(15.0,5.0,0.0));
      float upward = smoothstep(-.18, .57, -normal.y);
      float colony = .0;
      for(int i=0;i<10;i++) {
        float r=uMossColonies[i].w;
        vec3 offset=(vPosition-uMossColonies[i].xyz)*vec3(.36,1.0,.83);
        float edgeNoise=fbm(vPosition*.071+float(i)*3.7);
        if(r>.0)colony=max(colony,1.0-smoothstep(.15,1.0,length(offset)/r+edgeNoise*.7-.28));
      }
      float moss = smoothstep(.35,.73,colony*.78+mossField*.4) * upward;
      bool tuft = vBark.x<.0;
      if(tuft)moss=1.0;
      vec3 graphite = mix(vec3(.064,.095,.11), vec3(.20,.245,.25), grain);
      graphite *= 1.0 - fissure*.43;
      vec3 lichen = mix(vec3(.09,.17,.12), vec3(.29,.36,.24), fine*.6+mossField*.4);
      vec3 albedo = mix(graphite, lichen, moss*.94);
      vec3 light = normalize(vec3(-.46,-.62,.79));
      float diffuse = max(0.0,dot(normal,light));
      float visibility = shadowFactor(diffuse);
      float fill = max(0.0,dot(normal,normalize(vec3(.5,.35,.65))));
      float spec = pow(max(0.0,dot(normal,normalize(light+vec3(0,0,1)))), 31.0);
      spec *= (.11 + grain*.15) * (1.0-moss*.85);
      float rim = pow(1.0-max(0.0,normal.z),3.0) * max(0.0,-normal.y)*.08;
      vec3 color = albedo*(.24 + diffuse*1.6*visibility + fill*.29);
      color += vec3(.67,.83,.86)*spec*visibility + vec3(.39,.58,.61)*rim;
      color *= .91 + fine*.12;
      float distanceHaze = clamp((-vPosition.z-20.0)/230.0,0.0,.38);
      color = mix(color,vec3(.42,.61,.69),distanceHaze);
      color = pow(color,vec3(.86));
      gl_FragColor = vec4(color,1.0);
    }`;
  const shadowVertex = `attribute vec3 aPosition; uniform mat4 uLightMatrix;
    void main(){gl_Position=uLightMatrix*vec4(aPosition,1.0);}`;
  const shadowFragment = `precision highp float;
    void main(){vec4 depth=fract(gl_FragCoord.z*vec4(16777216.0,65536.0,256.0,1.0));
      depth-=depth.xxyz*vec4(0.0,1.0/256.0,1.0/256.0,1.0/256.0);gl_FragColor=depth;}`;

  const normalize = v => { const d = Math.hypot(...v) || 1; return v.map(n => n / d); };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const mix = (a,b,t) => a+(b-a)*t;
  const random = n => { const x = Math.sin(n*127.13+73.8)*43758.5453; return x-Math.floor(x); };

  function buildGeometry(svg) {
    const edges = [...svg.querySelectorAll('.signal-path')].map((path,index) => ({
      id:path.id, parentId:path.dataset.parent, path, index, children:[], length:path.getTotalLength()
    }));
    const map = new Map(edges.map(edge=>[edge.id,edge]));
    edges.forEach(edge=>{edge.parent=map.get(edge.parentId);edge.parent?.children.push(edge);});
    const roots=edges.filter(edge=>!edge.parent);
    function count(edge) { edge.leaves=edge.children.length?edge.children.reduce((s,e)=>s+count(e),0):1;return edge.leaves; }
    roots.forEach(count);
    const total=roots.reduce((sum,edge)=>sum+edge.leaves,0);
    const ordered=[];
    function walk(edge,distance,z) {
      edge.distance=distance;edge.z0=z;
      const lateral=edge.parent&&edge.parent.children[0]!==edge;
      edge.continuation=Boolean(edge.parent&&!lateral);
      edge.z1=z+(lateral?(random(edge.index)*2-1)*190:(random(edge.index)*2-1)*26);
      edge.z1=Math.max(-215,Math.min(215,edge.z1));
      const nominal=78*Math.pow(edge.leaves/total,.91)*Math.exp(-distance*.00023);
      edge.r0=edge.continuation?edge.parent.r1:edge.parent?Math.min(edge.parent.r1*.92,nominal*1.03):78;
      edge.r1=edge.children.length?Math.max(.4,nominal*.86):.06;
      ordered.push(edge);edge.children.forEach(child=>walk(child,distance+edge.length,edge.z1));
    }
    roots.forEach(edge=>walk(edge,0,0));
    const vertices=[], signalFibers=Object.create(null);
    const radialCount=28;
    for(const edge of ordered) {
      const ringCount=Math.max(7,Math.ceil(edge.length/4));
      const rings=[];
      for(let ring=0;ring<=ringCount;ring++) {
        const t=ring/ringCount, distance=t*edge.length;
        const p=edge.path.getPointAtLength(distance);
        const before=edge.path.getPointAtLength(Math.max(0,distance-.5));
        const after=edge.path.getPointAtLength(Math.min(edge.length,distance+.5));
        const eased=t*t*(3-2*t), dz=(edge.z1-edge.z0)*6*t*(1-t)/edge.length;
        let tangent=normalize([after.x-before.x,after.y-before.y,dz]);
        if(edge.continuation&&t<.18) {
          const blend=t/.18;
          tangent=normalize(tangent.map((n,i)=>mix(edge.parent.endTangent[i],n,blend)));
        }
        const side=normalize([-tangent[1],tangent[0],0]);
        const forward=normalize(cross(tangent,side));
        const center=[p.x,p.y,mix(edge.z0,edge.z1,eased)];
        const baseRadius=mix(edge.r0,edge.r1,edge.children.length?t:Math.pow(t,.72));
        const points=[];
        if(ring===0&&edge.continuation) {
          rings.push(edge.parent.lastRing.map(vertex=>vertex.slice()));
          continue;
        }
        for(let j=0;j<=radialCount;j++) {
          const angle=j/radialCount*Math.PI*2;
          const globalDistance=edge.distance+distance;
          const growth=1+.027*Math.sin(globalDistance*.019)+.016*Math.sin(globalDistance*.041+angle*2.0);
          const grooves=1+.018*Math.sin(angle*7+globalDistance*.009)+.012*Math.sin(angle*13-globalDistance*.013);
          const lobes=1+.105*Math.sin(globalDistance*.007+.7)*Math.cos(angle-.45)
            +.052*Math.sin(globalDistance*.013+1.2)*Math.cos(angle*2+.8);
          const endSwelling=edge.children.length>1?.14*Math.exp(-Math.pow((distance-edge.length)/Math.max(13,edge.r1*.8),2)):0;
          const startSwelling=edge.continuation&&edge.parent.children.length>1?.14*Math.exp(-Math.pow(distance/Math.max(13,edge.r0*.8),2)):0;
          const knuckle=1+(endSwelling+startSwelling)*(.65+.35*Math.cos(angle));
          const radius=baseRadius*growth*grooves*lobes*knuckle;
          const normal=normalize(side.map((s,k)=>s*Math.cos(angle)+forward[k]*Math.sin(angle)));
          const position=center.map((c,k)=>c+normal[k]*radius);
          points.push([...position,...normal,angle,edge.distance+distance]);
        }
        rings.push(points);
        if(ring===ringCount)edge.endTangent=tangent;
      }
      edge.lastRing=rings[ringCount];
      edge.rings=rings;
      // Project three interior front-surface strands from the same mesh rings.
      // Their geometry stays aligned with the rendered limb as its radii vary.
      const lanes=edge.r0>3?[5,7,9]:[7];
      signalFibers[edge.id]=lanes.map(lane=>rings.map((ring,index)=>
        `${index?'L':'M'}${ring[lane][0].toFixed(2)},${ring[lane][1].toFixed(2)}`).join(' '));
      for(let i=0;i<ringCount;i++)for(let j=0;j<radialCount;j++) {
        vertices.push(...rings[i][j],...rings[i+1][j],...rings[i+1][j+1]);
        vertices.push(...rings[i][j],...rings[i+1][j+1],...rings[i][j+1]);
      }
    }
    // Coherent colonies sit on old load-bearing forks, with sparse real tufts
    // breaking their silhouette. Their positions are shared with the shader.
    const mossColonies=[];
    for(const edge of ordered.filter(edge=>edge.children.length>1&&edge.r1>5).sort((a,b)=>b.r1-a.r1).slice(0,7)) {
      const anchor=edge.lastRing[3];
      const colonyRadius=Math.max(17,Math.min(49,edge.r1*.85+7));
      mossColonies.push(anchor[0],anchor[1],anchor[2],colonyRadius);
      for(let seed=0;seed<95;seed++) {
        const key=edge.index*113+seed;
        const ri=Math.max(0,edge.rings.length-1-Math.floor(random(key)*Math.min(edge.rings.length*.38,colonyRadius/3)));
        const lane=Math.floor(random(key+121)*6);
        const surface=edge.rings[ri][lane], base=surface.slice(0,3), normal=surface.slice(3,6);
        if(Math.hypot(base[0]-anchor[0],base[1]-anchor[1],base[2]-anchor[2])>colonyRadius*.94)continue;
        const height=2.0+random(key+88)*5.0;
        const width=.35+random(key+33)*.65;
        const direction=normalize([normal[0]*.45,normal[1]-.55,normal[2]*.5]);
        const tip=base.map((n,i)=>n+direction[i]*height);
        const side=normalize(cross(direction,[0,0,1]));
        const left=base.map((n,i)=>n-side[i]*width),right=base.map((n,i)=>n+side[i]*width);
        const tuftNormal=normalize([normal[0],normal[1]-.2,normal[2]+.35]);
        vertices.push(...left,...tuftNormal,-1,edge.distance,
          ...right,...tuftNormal,-1,edge.distance,...tip,...tuftNormal,-1,edge.distance);
      }
    }
    while(mossColonies.length<40)mossColonies.push(0,0,0,0);
    return {vertices:new Float32Array(vertices),edgeCount:edges.length,signalFibers,mossColonies:new Float32Array(mossColonies)};
  }

  function mount(container,svg,options={}) {
    const canvas=document.createElement('canvas');
    canvas.className='branch-volume-canvas';
    Object.assign(canvas.style,{display:'block',width:'100%',height:'100%',position:'absolute',inset:'0'});
    canvas.setAttribute('aria-label','Procedural volumetric branch material study');
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
    if(!gl) throw new Error('WebGL is unavailable');
    const geometry=buildGeometry(svg), shadowSize=1024;
    const light=normalize([-.46,-.62,.79]);
    const right=normalize(cross([0,1,0],light)), up=normalize(cross(light,right));
    const center=[750,500,0], dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
    const lightMatrix=new Float32Array([
      right[0]/1050,up[0]/950,-light[0]/1000,0,
      right[1]/1050,up[1]/950,-light[1]/1000,0,
      right[2]/1050,up[2]/950,-light[2]/1000,0,
      -dot(right,center)/1050,-dot(up,center)/950,dot(light,center)/1000,1
    ]);
    let resources, lost=false, disposed=false;
    function compile(type,source) {
      const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
        const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(error);
      }
      return shader;
    }
    function link(vertexCode,fragmentCode) {
      const vertex=compile(gl.VERTEX_SHADER,vertexCode),fragment=compile(gl.FRAGMENT_SHADER,fragmentCode);
      const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
      gl.deleteShader(vertex);gl.deleteShader(fragment);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      return program;
    }
    function bind(program) {
      gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,resources.buffer);
      for(const [name,size,offset] of [['aPosition',3,0],['aNormal',3,12],['aBark',2,24]]) {
        const location=gl.getAttribLocation(program,name);
        if(location>=0){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,32,offset);}
      }
      gl.uniformMatrix4fv(gl.getUniformLocation(program,'uLightMatrix'),false,lightMatrix);
    }
    function initialize() {
      resources={program:link(vertexSource,fragmentSource),shadowProgram:link(shadowVertex,shadowFragment)};
      resources.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,resources.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,geometry.vertices,gl.STATIC_DRAW);
      resources.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,resources.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,shadowSize,shadowSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      resources.depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,resources.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,shadowSize,shadowSize);
      resources.framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,resources.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,resources.texture,0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,resources.depth);
      resources.shadows=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
      if(resources.shadows) {
        bind(resources.shadowProgram);gl.viewport(0,0,shadowSize,shadowSize);gl.clearColor(1,1,1,1);
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,2);
        gl.drawArrays(gl.TRIANGLES,0,geometry.vertices.length/8);gl.disable(gl.POLYGON_OFFSET_FILL);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);
    }
    function render() {
      if(lost||disposed)return;
      const bounds=container.getBoundingClientRect(),width=Math.max(1,bounds.width),height=Math.max(1,bounds.height);
      const dpr=Math.min(window.devicePixelRatio||1,1.5);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      gl.viewport(0,0,canvas.width,canvas.height);bind(resources.program);
      const scale=Math.min(width/1500,height/1000);
      gl.uniform2f(gl.getUniformLocation(resources.program,'uViewport'),width,height);
      gl.uniform3f(gl.getUniformLocation(resources.program,'uFrame'),scale,width-1500*scale,(height-1000*scale)/2);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,resources.texture);
      gl.uniform1i(gl.getUniformLocation(resources.program,'uShadow'),0);
      gl.uniform1f(gl.getUniformLocation(resources.program,'uShadowEnabled'),resources.shadows?1:0);
      gl.uniform4fv(gl.getUniformLocation(resources.program,'uMossColonies[0]'),geometry.mossColonies);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES,0,geometry.vertices.length/8);
      const error=gl.getError();
      container.dataset.volumeStatus=error===gl.NO_ERROR?'ready':'render-error';
      container.dataset.volumeShadows=String(resources.shadows);
      if(error!==gl.NO_ERROR)options.onError?.(new Error('WebGL render error '+error));
    }
    function contextLost(event) {
      event.preventDefault();lost=true;canvas.hidden=true;container.dataset.volumeStatus='context-lost';
      options.onError?.(new Error('WebGL context lost'));
    }
    function contextRestored() {
      if(disposed)return;
      try{initialize();lost=false;canvas.hidden=false;render();options.onRestore?.();}
      catch(error){container.dataset.volumeStatus='restore-error';options.onError?.(error);}
    }
    canvas.addEventListener('webglcontextlost',contextLost);
    canvas.addEventListener('webglcontextrestored',contextRestored);
    initialize();container.append(canvas);
    const observer=new ResizeObserver(render);observer.observe(container);render();
    return {canvas,render,edgeCount:geometry.edgeCount,vertexCount:geometry.vertices.length/8,signalFibers:geometry.signalFibers,
      dispose(){
        disposed=true;observer.disconnect();canvas.remove();
        canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);
        if(!lost){gl.deleteBuffer(resources.buffer);gl.deleteProgram(resources.program);gl.deleteProgram(resources.shadowProgram);
          gl.deleteTexture(resources.texture);gl.deleteRenderbuffer(resources.depth);gl.deleteFramebuffer(resources.framebuffer);}
      }};
  }
  window.BranchVolume={mount};
})();
