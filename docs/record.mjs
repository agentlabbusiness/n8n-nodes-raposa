// One continuous, uncut recording of the n8n-nodes-raposa demo for n8n's manual review.
import { chromium } from '/Users/AgentLabiMac/HEAD/PROJECTS/escrypt-stack/node_modules/playwright/index.mjs';
import fs from 'fs';
const S=process.env.S; const env = Object.fromEntries(fs.readFileSync(S+'/demo-keys.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>l.split(/=(.*)/s).slice(0,2)));
const wfAgent=fs.readFileSync(S+'/agent-wf-id.txt','utf8').trim();
const t0=Date.now(); const log=(m)=>console.log(((Date.now()-t0)/1000).toFixed(1)+'s', m);
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:1280,height:800}, recordVideo:{dir:S+'/video', size:{width:1280,height:800}}});
const p = await ctx.newPage(); const w=(ms)=>p.waitForTimeout(ms);
// 1. sign in
await p.goto('http://localhost:5678/signin',{waitUntil:'domcontentloaded',timeout:90000}); await w(1500);
await p.locator('#emailOrLdapLoginId').pressSequentially('demo@raposa.group',{delay:30}); await p.locator('#password').fill(env.N8N_PASS); await w(400);
await p.getByRole('button',{name:'Sign in'}).click(); await p.waitForURL(/home|workflow/,{timeout:60000}); await w(2000); log('signed in');
// 2. install from npm
await p.goto('http://localhost:5678/settings/community-nodes',{waitUntil:'domcontentloaded',timeout:90000}); await w(2500);
await p.getByRole('button',{name:'Install a community node'}).click(); await w(1200);
await p.locator('[data-test-id=package-name-input]').pressSequentially('n8n-nodes-raposa',{delay:70}); await w(600);
await p.getByText('I understand the risks').click(); await w(600);
await p.getByRole('button',{name:'Install',exact:true}).click();
for (let i=0;i<90;i++){ await w(2000); const txt=await p.locator('body').innerText(); if (/v0\.1\.2/.test(txt)) break; }
await w(3000); log('installed');
// 3. new workflow, insert the node
await p.goto('http://localhost:5678/workflow/new',{waitUntil:'domcontentloaded',timeout:90000});
await p.getByText('Add first step').waitFor({timeout:120000}); await w(1200);
await p.getByText('Add first step').click(); await w(900);
await p.keyboard.type('Manual',{delay:60}); await w(700); await p.keyboard.press('Enter'); await w(1800);
await p.mouse.click(772,411); await w(1000);
await p.keyboard.type('Raposa',{delay:90}); await w(1300); await p.keyboard.press('Enter'); await w(1800);
await p.getByText('Create an approval request').click(); await w(2500); log('node inserted');
// 4. credential + test
await p.getByText('Connect to Raposa').click(); await w(2500);
await p.locator('input[type=password]').pressSequentially(env.CLIENT_API_KEY,{delay:5}); await w(800);
await p.getByRole('button',{name:'Save'}).click(); await w(4000);
await p.mouse.click(827,152); await w(4500); // reopen: "Connection tested successfully"
await p.locator('[data-test-id=editCredential-modal] .el-dialog__headerbtn').click(); await w(1200); log('credential tested');
// 5. Create
const f=(n)=>p.locator(`[data-test-id=parameter-input-${n}] [data-test-id=parameter-input-field]`);
await f('action').click(); await p.keyboard.type('Refund EUR 120 to customer #4821',{delay:35});
await f('context').click(); await p.keyboard.type('Order 7731 — duplicate charge on 2026-09-04',{delay:25}); await w(500);
await p.locator('[data-test-id=node-execute-button], button:has-text("Execute step")').last().click(); await w(6000); log('create executed');
const out=await p.locator('body').innerText(); const m=out.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/); const approvalId=m?m[1]:'';
// 6. Get
await p.locator('[data-test-id=parameter-input-operation] input').click(); await w(800); await p.getByText('Get',{exact:true}).last().click(); await w(1000);
await f('approvalId').click(); await p.keyboard.type(approvalId,{delay:8}); await w(500);
await p.locator('[data-test-id=node-execute-button], button:has-text("Execute step")').last().click(); await w(5000); log('get executed');
// 7. Ask and Wait
await p.locator('[data-test-id=parameter-input-operation] input').click(); await w(800); await p.getByText('Ask and Wait',{exact:true}).last().click(); await w(1000);
await f('action').click({clickCount:3}); await p.keyboard.type('Pay invoice #2210 — EUR 1,480 to ACME Ltd',{delay:30});
await f('context').click({clickCount:3}); await p.keyboard.type('Vendor payment run 05.09 — needs finance sign-off',{delay:25});
await p.locator('[data-test-id=parameter-input-risk] input').click(); await w(600); await p.getByText('High',{exact:true}).last().click(); await w(500);
const poll=p.locator('[data-test-id=parameter-input-pollSeconds] input'); await poll.click({clickCount:3}); await p.keyboard.type('5'); await w(500);
await p.locator('[data-test-id=node-execute-button], button:has-text("Execute step")').last().click();
for (let i=0;i<20;i++){ await w(2000); const t=await p.locator('body').innerText(); if(/Node executed successfully/.test(t)) break; }
await w(4000); log('wait executed');
await p.locator('[data-test-id=ndv-close-button]').click(); await w(1200);
await p.keyboard.press('Meta+s'); await w(1500);
// 8. as a tool for an AI agent
await p.goto('http://localhost:5678/workflow/'+wfAgent,{waitUntil:'domcontentloaded',timeout:90000});
await p.getByText('Google Gemini Chat Model').first().waitFor({timeout:120000}); await w(2500);
await p.locator('[data-test-id=canvas-handle-plus-wrapper]').last().click(); await w(1300);
await p.keyboard.type('Raposa',{delay:90}); await w(1200); await p.keyboard.press('Enter'); await w(3000);
await p.locator('[data-test-id=parameter-input-action]').hover(); await w(600); await p.locator('[data-test-id=from-ai-override-button]').first().click(); await w(800);
await p.locator('[data-test-id=parameter-input-context]').hover(); await w(600); await p.locator('[data-test-id=from-ai-override-button]').first().click(); await w(800);
await poll.click({clickCount:3}); await p.keyboard.type('5'); await w(600);
await p.locator('[data-test-id=ndv-close-button]').click(); await w(1200);
await p.locator('[data-test-id=canvas-background]').click({position:{x:200,y:600}}).catch(()=>{}); await w(500);
await p.locator('button:has-text("Open chat")').last().click(); await w(1500);
await p.locator('textarea[placeholder*="Type message"]').first().click();
await p.keyboard.type('Please refund EUR 250 to customer #9917 for order 8120 (duplicate charge).',{delay:25}); await p.keyboard.press('Enter');
for (let i=0;i<24;i++){ await w(4000); const t=await p.locator('body').innerText(); if(/Workflow executed successfully|Error in workflow/.test(t)) break; }
await w(6000); log('agent done');
await ctx.close(); await b.close();
const files=fs.readdirSync(S+'/video').filter(f=>f.endsWith('.webm')).map(f=>({f,t:fs.statSync(S+'/video/'+f).mtimeMs})).sort((a,b)=>b.t-a.t);
console.log('VIDEO', S+'/video/'+files[0].f);
