const sharp = require('/Users/dixi/Documents/Dix/dixii.dev/node_modules/sharp');
const fs = require('fs');
const [src, number, minxArg='1280', minyArg='235', maxyArg='1570'] = process.argv.slice(2);
const id=String(number).padStart(2,'0');
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
(async()=>{
 const {data,info}=await sharp(src).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const W=info.width,H=info.height,N=W*H;
 const baseSmall=await sharp('refs/background.png').resize(W,H,{fit:'fill'}).removeAlpha().raw().toBuffer();
 // Estimate only the generator's smooth sky colour drift from pixels close to
 // the supplied sky. This keeps dark graphite, bright metal, and cyan glass.
 const sample=Buffer.alloc(N*4);
 for(let k=0;k<N;k++){
  const i=k*3,j=k*4,y=Math.floor(k/W);
  const d=[0,1,2].map(c=>data[i+c]-baseSmall[i+c]);
  const ok=y>H*.13&&Math.max(...d.map(Math.abs))<27&&data[i+2]>200;
  for(let c=0;c<3;c++)sample[j+c]=ok?clamp(128+d[c]*3):0;
  sample[j+3]=ok?255:0;
 }
 // Blur each weighted channel independently (alpha must not be premultiplied).
 const channels=[];
 for(let c=0;c<4;c++){
  const ch=Buffer.alloc(N);for(let k=0;k<N;k++)ch[k]=sample[k*4+c];
  channels.push(await sharp(ch,{raw:{width:W,height:H,channels:1}}).blur(45).greyscale().raw().toBuffer());
 }
 const matte=Buffer.alloc(N),estimated=Buffer.alloc(N*3),rgba=Buffer.alloc(N*4);
 for(let k=0;k<N;k++){
  const i=k*3,y=Math.floor(k/W),weight=channels[3][k]/255;
  let difference=0;
  for(let c=0;c<3;c++){
   const offset=weight>.035?(channels[c][k]/weight-128)/3:0;
   estimated[i+c]=clamp(baseSmall[i+c]+offset);
  }
  const dr=data[i]-estimated[i],dg=data[i+1]-estimated[i+1],db=data[i+2]-estimated[i+2];
  difference=Math.max(-db,-dg*.65,-dr*.35,Math.min(dr*.6,dg));
  let edge=0;
  for(const off of [-W*2,-2,2,W*2]){
   const q=k+off;if(q<0||q>=N)continue;
   for(let c=0;c<3;c++)edge=Math.max(edge,Math.abs(data[i+c]-data[q*3+c]));
  }
  if(difference<23&&edge<5)difference=0;
  // Smooth blue regions are sky, even where a large regenerated cloud differs
  // from the base. Real fine filaments retain their local edge contrast.
  if(data[i+2]>215&&data[i+2]>data[i]+12&&data[i+2]>data[i+1]+6&&edge<8)difference=0;
  // Remove generated navigation entirely before finding the branch bounds.
  matte[k]=y<H*.105?0:clamp(255*smooth(8,22,difference));
 }
 // Remove isolated background noise, retaining fine connected optical strands.
 const seen=new Uint8Array(N),keep=new Uint8Array(N);let components=0;
 for(let k=0;k<N;k++){
  if(seen[k]||matte[k]<5)continue;
  const q=[k];seen[k]=1;let strong=0;
  for(let p=0;p<q.length;p++){
   const v=q[p],x=v%W,y=Math.floor(v/W);if(matte[v]>220)strong++;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy,n=ny*W+nx;
    if(nx<0||nx>=W||ny<0||ny>=H||seen[n]||matte[n]<5)continue;
    seen[n]=1;q.push(n);
   }
  }
  if(q.length>=18&&strong>=2){components++;for(const v of q)keep[v]=1;}
 }
 let x0=W,y0=H,x1=0,y1=0;
 for(let k=0;k<N;k++){
  let a=keep[k]?matte[k]/255:0;
  const i=k*3,j=k*4;
  for(let c=0;c<3;c++)rgba[j+c]=a>.02?data[i+c]:0;
  rgba[j+3]=clamp(a*255);
  if(a>.1){const x=k%W,y=Math.floor(k/W);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 }
 x0=Math.max(0,x0-2);y0=Math.max(0,y0-2);y1=Math.min(H-1,y1+2);
 const minx=+minxArg,miny=+minyArg,maxy=+maxyArg;
 const tw=2880-minx,th=maxy-miny;
 const layer=await sharp(rgba,{raw:{width:W,height:H,channels:4}}).extract({left:x0,top:y0,width:W-x0,height:y1-y0+1}).resize(tw,th,{fit:'fill',kernel:'lanczos3'}).png().toBuffer();
 await sharp(layer).toFile(`.work-v4/layers/branch-${id}.png`);
 const out=`v4/branch-${id}.png`;
 await sharp('refs/background.png').composite([{input:layer,left:minx,top:miny}]).png().toFile(out);
 await sharp(out).resize(1440,900).png().toFile(`.work-v4/previews/branch-${id}.png`);
 const report={file:out,source:src,sourceSize:[W,H],sourceBounds:[x0,y0,x1,y1],placement:[minx,miny,2880,maxy],components,matte:'sky-drift-corrected colour difference with edge decontamination'};
 fs.writeFileSync(`.work-v4/branch-${id}.qa.json`,JSON.stringify(report,null,2));
 fs.copyFileSync(src,`.work-v4/raw/branch-${id}.png`);
 console.log(JSON.stringify(report));
})();
