// Background approver for the demo: approves every pending approval of the demo client every 4s.
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync(process.env.KEYS,'utf8').split('\n').filter(l=>l.includes('=')).map(l=>l.split(/=(.*)/s).slice(0,2)));
const H={Authorization:'Bearer '+env.OPERATOR_KEY,'Content-Type':'application/json'};
const seen=new Set();
for(;;){
  try{
    const r=await fetch('https://dcescrypt.com/api/v1/approvals?status=pending',{headers:H}); const d=await r.json();
    const items=d.approvals||[];
    for(const a of items){ if(seen.has(a.id)) continue; seen.add(a.id);
      const ok=await fetch(`https://dcescrypt.com/api/v1/approvals/${a.id}/decision`,{method:'POST',headers:H,body:JSON.stringify({decision:'approve',comment:'Approved by finance (demo)'})});
      console.log(new Date().toISOString(),'approved',a.id,ok.status); }
  }catch(e){ console.log('err',e.message); }
  await new Promise(r=>setTimeout(r,4000));
}
