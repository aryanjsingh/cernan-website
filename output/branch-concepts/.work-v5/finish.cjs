const sharp = require('/Users/dixi/Documents/Dix/dixii.dev/node_modules/sharp');
const fs = require('fs');
const [src, id, mode = 'canvas'] = process.argv.slice(2);
const W=2880,H=1800;
(async()=>{
  const meta=await sharp(src).metadata();
  if(!meta.hasAlpha) throw new Error('Generated image has no alpha channel. Regenerate a transparent layer.');
  let layer=await sharp(src).ensureAlpha().resize(W,H,{fit:'fill'}).raw().toBuffer();
  let transparent=0, opaque=0, bounds=[W,H,0,0], protectedPixels=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const a=layer[(y*W+x)*4+3];
    if(a===0)transparent++;
    if(a===255)opaque++;
    if(a>8){bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}
    if(a>0&&(y<230||(x<1250&&y>=700)))protectedPixels++;
  }
  if(transparent<W*H*.35)throw new Error('Expected a mostly transparent hero foreground.');
  if(mode!=='canvas'){
    const [left,top,bottom]=mode.split(',').map(Number);
    const crop={left:bounds[0],top:bounds[1],width:W-bounds[0],height:bounds[3]-bounds[1]+1};
    const cut=await sharp(layer,{raw:{width:W,height:H,channels:4}}).extract(crop).resize(W-left,bottom-top,{fit:'fill'}).png().toBuffer();
    layer=await sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:cut,left,top}]).raw().toBuffer();
  }
  let removedProtectedPixels=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(y<230||(x<1250&&y>=700)){
    const i=(y*W+x)*4;
    if(layer[i+3])removedProtectedPixels++;
    layer[i+3]=0;
  }
  if(removedProtectedPixels>100)throw new Error(`Foreground overlaps keep-out zones (${removedProtectedPixels} pixels); adjust placement or regenerate.`);
  const layerPath=`.work-v5/layers/branch-${id}.png`;
  await sharp(layer,{raw:{width:W,height:H,channels:4}}).png().toFile(layerPath);
  const out=`v5/branch-${id}.png`;
  await sharp('refs/background.png').composite([{input:layerPath,left:0,top:0}]).removeAlpha().png().toFile(out);
  await sharp(out).resize(1440,900).png().toFile(`.work-v5/previews/branch-${id}.png`);
  const base=await sharp('refs/background.png').removeAlpha().raw().toBuffer();
  const final=await sharp(out).removeAlpha().raw().toBuffer();
  const zones={navigation:[0,0,2880,230],requestedButton:[2060,40,2360,120],actualButton:[2440,35,2820,170],copy:[0,700,1250,1800]};
  const changed={};
  for(const [name,[x0,y0,x1,y1]]of Object.entries(zones)){
    let n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*W+x)*3;if(base[i]!==final[i]||base[i+1]!==final[i+1]||base[i+2]!==final[i+2])n++;}changed[name]=n;
  }
  let outsideAlphaChanged=0,finalBounds=[W,H,0,0];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*3,j=(y*W+x)*4;
    if(layer[j+3]===0&&(base[i]!==final[i]||base[i+1]!==final[i+1]||base[i+2]!==final[i+2]))outsideAlphaChanged++;
    if(layer[j+3]>8){finalBounds[0]=Math.min(finalBounds[0],x);finalBounds[1]=Math.min(finalBounds[1],y);finalBounds[2]=Math.max(finalBounds[2],x);finalBounds[3]=Math.max(finalBounds[3],y);}
  }
  const edgeRuns=[];let start=null;
  for(let y=0;y<=H;y++){
    const present=y<H&&layer[(y*W+W-1)*4+3]>100;
    if(present&&start===null)start=y;
    if(!present&&start!==null){if(y-start>=8)edgeRuns.push([start,y,y-start]);start=null;}
  }
  const report={file:out,width:W,height:H,sourceSize:[meta.width,meta.height],sourceBounds:bounds,finalBounds,rightEdgeRuns:edgeRuns,sourceProtectedPixels:protectedPixels,removedProtectedPixels,changedPixels:changed,outsideAlphaChanged,passed:Object.values(changed).every(n=>n===0)&&outsideAlphaChanged===0};
  fs.writeFileSync(`.work-v5/branch-${id}.qa.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
})();
