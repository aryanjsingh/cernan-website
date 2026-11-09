const sharp=require('/Users/dixi/Documents/Dix/dixii.dev/node_modules/sharp');
const fs=require('fs');
const [src,out,minxArg,minyArg,maxyArg]=process.argv.slice(2);
const minx=+minxArg,miny=+minyArg,maxy=+maxyArg;
const smooth=(a,b,v)=>{let t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
(async()=>{
 const {data,info}=await sharp(src).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const W=info.width,H=info.height,rgba=Buffer.alloc(W*H*4); let x0=W,y0=H,x1=0,y1=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*3,j=(y*W+x)*4,r=data[i],g=data[i+1],b=data[i+2];
 const sky=smooth(-16,-2,b-g)*smooth(-3,8,b-r)*smooth(145,195,b);
 const white=smooth(205,225,Math.min(r,g,b));
 let a=1-Math.max(sky,white);
 // Discard generated UI and preserve only foreground.
 if(y<H*.1&&x<W*.60)a=0;
 if(y<H*.09&&x>W*.84&&x<W*.98&&!(g>r*1.08&&g>b*1.08))a=0;
 if(a<.025)a=0;
 rgba[j]=r;rgba[j+1]=g;rgba[j+2]=b;rgba[j+3]=Math.round(a*255);
 if(a>.5){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
 }
 let leaves=[];
 if(out.endsWith('branch-07.png')){
  const boxes=[[448,275,41,29],[517,288,49,44],[625,250,44,31],[665,302,39,40],[724,277,40,31],[474,355,49,38],[573,342,32,46],[690,342,52,40]];
  const original=Buffer.from(rgba);
  for(const [l,t,w,h] of boxes){
   const leaf=await sharp(original,{raw:{width:W,height:H,channels:4}}).extract({left:l,top:t,width:w,height:h}).raw().toBuffer();
   const seen=new Uint8Array(w*h);let best=[];
   for(let k=0;k<w*h;k++){if(seen[k]||leaf[k*4+3]<10)continue;let q=[k];seen[k]=1;for(let j=0;j<q.length;j++){let v=q[j],x=v%w,y=Math.floor(v/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let nx=x+dx,ny=y+dy,n=ny*w+nx;if(nx<0||ny<0||nx>=w||ny>=h||seen[n]||leaf[n*4+3]<10)continue;seen[n]=1;q.push(n)}}if(q.length>best.length)best=q}
   const keep=new Set(best);for(let k=0;k<w*h;k++)if(!keep.has(k))leaf[k*4+3]=0;
   leaves.push({input:await sharp(leaf,{raw:{width:w,height:h,channels:4}}).resize(Math.round(w*2880/W),Math.round(h*1800/H)).png().toBuffer(),left:Math.round(l*2880/W),top:Math.round(t*1800/H)-35});
   for(let y=t;y<t+h;y++)for(let x=l;x<l+w;x++)rgba[(y*W+x)*4+3]=0;
  }
  x0=W;y0=H;x1=0;y1=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(rgba[(y*W+x)*4+3]>127){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
 }
 const tw=2880-minx, th=maxy-miny;
 const layer=await sharp(rgba,{raw:{width:W,height:H,channels:4}}).extract({left:x0,top:y0,width:W-x0,height:y1-y0+1}).resize(tw,th,{fit:'fill',kernel:'lanczos3'}).png().toBuffer();
 await sharp('refs/background.png').composite([{input:layer,left:minx,top:miny},...leaves]).png().toFile(out);
 const base=await sharp('refs/background.png').removeAlpha().raw().toBuffer();const final=await sharp(out).removeAlpha().raw().toBuffer();
 let nav=0,copy=0;for(let y=0;y<1800;y++)for(let x=0;x<2880;x++){if((y<230&&x<2360)||(x<1250&&y>=700)){let i=(y*2880+x)*3;let diff=base[i]!=final[i]||base[i+1]!=final[i+1]||base[i+2]!=final[i+2];if(diff){if(y<230)nav++;else copy++}}}
 const meta=await sharp(out).metadata();const report={file:out,width:meta.width,height:meta.height,sourceWidth:W,sourceHeight:H,sourceBounds:[x0,y0,x1,y1],finalBounds:[minx,miny,2880,maxy],navigationChangedPixels:nav,textAreaChangedPixels:copy};console.log(JSON.stringify(report));fs.writeFileSync('.work-v4/'+out.split('/').pop().replace('.png','.qa.json'),JSON.stringify(report,null,2));
})();
