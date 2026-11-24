const sharp=require('/Users/dixi/Documents/Dix/dixii.dev/node_modules/sharp');
const fs=require('fs'),crypto=require('crypto');
(async()=>{
 const base=await sharp('refs/background.png').removeAlpha().raw().toBuffer();
 const reports=[],tiles=[];let all=true;
 const labels=['Classic','Wide & heavy','Airy','Low dip','Upswept','Close-up','Drifting leaves','Old giant','Spring light','Layered depth'];
 for(let n=1;n<=10;n++){
 const file=`v2/branch-${String(n).padStart(2,'0')}.png`,m=await sharp(file).metadata(),d=await sharp(file).removeAlpha().raw().toBuffer();
 const zones={navBand:[0,0,2360,230],meetingButton:[2440,35,2820,170],textArea:[0,700,1250,1800]};const changed={};
 for(const [name,[x0,y0,x1,y1]]of Object.entries(zones)){let c=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*2880+x)*3;if(base[i]!==d[i]||base[i+1]!==d[i+1]||base[i+2]!==d[i+2])c++}changed[name]=c;}
 const ok=m.width===2880&&m.height===1800&&m.format==='png'&&Object.values(changed).every(c=>c===0);all&&=ok;
 reports.push({file,width:m.width,height:m.height,bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),changedPixels:changed,passed:ok});
 const col=(n-1)%2,row=Math.floor((n-1)/2),left=col*720,top=row*480;
 tiles.push({input:await sharp(file).resize(720,450).png().toBuffer(),left,top});
 const title=Buffer.from(`<svg width="720" height="30"><rect width="720" height="30" fill="#f6f8fa"/><text x="12" y="21" font-family="Arial" font-size="16" fill="#102338">${String(n).padStart(2,'0')} — ${labels[n-1].replace('&','&amp;')}</text></svg>`);
 tiles.push({input:title,left,top:top+450});
 }
 await sharp({create:{width:1440,height:2400,channels:3,background:'#f6f8fa'}}).composite(tiles).png().toFile('.work-v2/contact-sheet.png');
 fs.writeFileSync('.work-v2/verification.json',JSON.stringify({allPassed:all,images:reports},null,2));
 console.log(JSON.stringify({allPassed:all,imageCount:reports.length,totalMB:Math.round(reports.reduce((s,r)=>s+r.bytes,0)/1e6*10)/10,images:reports.map(({file,width,height,changedPixels,passed})=>({file,width,height,changedPixels,passed}))},null,2));
})();
