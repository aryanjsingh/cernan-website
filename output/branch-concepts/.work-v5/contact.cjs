const sharp=require('/Users/dixi/Documents/Dix/dixii.dev/node_modules/sharp');
const fs=require('fs'),crypto=require('crypto');
const names=['Clean flat vector','Monoline line-art','Duotone','Stipple / risograph','Glass vector','Dense network','Heavy overgrowth','Backward-pass focus','Forward-pass focus','Layered depth (flat)'];
(async()=>{
 const tiles=[],reports=[];
 for(let n=1;n<=10;n++){
  const id=String(n).padStart(2,'0'),file=`v5/branch-${id}.png`;
  if(!fs.existsSync(file))continue;
  const report=JSON.parse(fs.readFileSync(`.work-v5/branch-${id}.qa.json`));
  const m=await sharp(file).metadata();report.finalDimensionsVerified=m.width===2880&&m.height===1800;
  report.sha256=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');reports.push(report);
  const left=((n-1)%2)*1000,top=Math.floor((n-1)/2)*665;
  tiles.push({input:await sharp(file).resize(1000,625).png().toBuffer(),left,top});
  tiles.push({input:Buffer.from(`<svg width="1000" height="40"><rect width="1000" height="40" fill="#f4f7fa"/><text x="18" y="27" font-family="Arial" font-size="21" fill="#0b1a2b">${id}  ${names[n-1]}</text></svg>`),left,top:top+625});
 }
 await sharp({create:{width:2000,height:3325,channels:3,background:'#f4f7fa'}}).composite(tiles).png().toFile('.work-v5/contact-sheet.png');
 const summary={allPassed:reports.length===10&&reports.every(r=>r.passed&&r.finalDimensionsVerified),imageCount:reports.length,images:reports};
 fs.writeFileSync('.work-v5/verification.json',JSON.stringify(summary,null,2));
 console.log(JSON.stringify({allPassed:summary.allPassed,imageCount:summary.imageCount}));
})();
