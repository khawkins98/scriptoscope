import { createServer } from 'node:http';
import { createReadStream, readFileSync } from 'node:fs';
import { stat, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { test as demoTest } from './demo-fixtures.mjs';
import { expect, openHarness } from './fixtures.mjs';
import { verifyShowcaseShape } from './controls459/raw-solid-showcase-fixtures.mjs';
import { startServers, root } from './servers.mjs';
const choices=JSON.parse(readFileSync(new URL('../control-availability/source-choices.json',import.meta.url))).sources;
const test=demoTest.extend({
  transports:[async({},use)=>{const s=await startServers();try{await use(s);}finally{await s.close();}},{scope:'worker'}],
  production:[async({},use)=>{
    const base=resolve(root,'dist/demo');
    const mime={'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html','.wasm':'application/wasm','.png':'image/png'};
    const s=createServer(async(req,res)=>{try{
      const url=new URL(req.url,'http://localhost');
      if(!url.pathname.startsWith('/scriptoscope/'))throw Error('Outside production base');
      const file=resolve(base,'.'+decodeURIComponent(url.pathname.slice('/scriptoscope'.length)));
      if(!file.startsWith(base+sep)||!(await stat(file)).isFile())throw Error('Not a file');
      res.setHeader('Content-Type',mime[extname(file)]??'application/octet-stream');createReadStream(file).pipe(res);
    }catch{res.writeHead(404);res.end('Not found');}});
    await new Promise(r=>s.listen(0,'127.0.0.1',r));
    try{await use(`http://127.0.0.1:${s.address().port}/scriptoscope`);}finally{await new Promise(r=>s.close(r));}
  },{scope:'worker'}],
});

async function attachJson(info,name,value){const path=info.outputPath(name);await writeFile(path,JSON.stringify(value,null,2));await info.attach(name,{path,contentType:'application/json'});}
for(const mode of ['source','production']) test(`${mode}: showcase No theme restores its two original control buttons and remounts once with live form state`,async({page,demo,production,transports},info)=>{
 const network=[],consoleMessages=[],publicControls=[],responseBodies=[];
 page.on('response',r=>{if(/themes\/.*\/(?:theme\.json|.*\.sit|.*\.rsrc)/.test(r.url())){const entry={url:r.url(),status:r.status()};network.push(entry);responseBodies.push(r.body().then(bytes=>{entry.sha256=createHash('sha256').update(bytes).digest('hex');entry.byteLength=bytes.length;}).catch(e=>{entry.bodyError=e.message;}));}});
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')consoleMessages.push(m.text());});
 page.on('pageerror',e=>consoleMessages.push(e.message));
 // Positive controls establish Windows95 has raw metadata and System7 has true
 // local same-ID/default NULL; no declaration based solely on missing CSS class.
 const probe=await page.context().newPage();
 try{
  const runtimeMode=mode==='source'?'source':'built';await openHarness(probe,transports,runtimeMode);
  for(const slug of ['windows-95','system7-nostalgia-silver']){
   const c=choices.find(c=>c.slug===slug);
   const result=await probe.evaluate(async({mode,slug,source})=>{
    const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
    const theme=await api.loadTheme('/themes/'+slug,{source,provenance:true});
    try{let trace;const out=await api.composeButton(theme,{label:'',default:false,diagnostics:{onComplete:t=>trace=t}});
     return {slug,trace,input:theme.byteProvenance.input,fork:theme.byteProvenance.fork,resources:theme.byteProvenance.resources,opaque:out?[...out.data].filter((v,i)=>i%4===3&&v).length:0};
    }finally{theme.dispose();}
   },{mode:runtimeMode,slug,source:c.path.split('/').at(-1)});
   expect(result.input.sha256).toBe(c.archiveSha256);expect(result.fork.sha256).toBe(c.forkSha256);
   expect(result.fork.selection.entryIndex).toBe(c.entryIndex);expect(result.fork.selection.entryName).toBe(c.entryName);
   const face=result.trace.steps.find(s=>s.role==='face'&&s.usage==='admission'&&s.action==='selected');
   expect(face.resource).toMatchObject({type:'cicn',signedId:-10239});
   const local=result.resources.filter(r=>r.type==='cinf'&&[-10239,0].includes(r.signedId));
   if(slug==='windows-95'){expect(local.some(r=>r.signedId===-10239&&r.status==='decoded')).toBe(true);expect(result.opaque).toBeGreaterThan(0);}
   else {expect(local).toEqual([]);expect(result.opaque).toBe(0);expect(result.trace.steps.some(s=>s.bodyPaint||s.role==='face'&&s.usage==='paint'&&s.action==='selected')).toBe(false);}
   publicControls.push(result);
  }
 }finally{await probe.close();await attachJson(info,'independent-public-theme-controls.json',publicControls);}
 await page.addInitScript(()=>{
  window.showcaseButtons={originals:[],saved:[],calls:[0,0]};
  const observer=new MutationObserver(()=>{
   const f=window.showcaseButtons;
   for(const el of document.querySelectorAll('#powers button[data-scriptoscope-button]'))if(!f.originals.includes(el)){
    const i=f.originals.length;f.originals.push(el);f.saved.push({style:el.getAttribute('style'),type:el.getAttribute('type'),hidden:el.hidden});el.addEventListener('click',()=>f.calls[i]++);
   }
  });observer.observe(document,{childList:true,subtree:true});
 });
 const shape=()=>page.evaluate(()=>window.showcaseButtons.originals.map(el=>{
  const face=el.nextElementSibling,canvas=face?.querySelector('canvas'),style=face&&getComputedStyle(face);
  return {same:el.isConnected,sourceHidden:getComputedStyle(el).display==='none',visible:!!face&&style.display!=='none'&&style.visibility!=='hidden'&&face.getBoundingClientRect().width>0,
   tag:face?.tagName,type:face?.getAttribute('type'),label:face?.getAttribute('aria-label')??face?.textContent?.trim(),canvas:face?.querySelectorAll('canvas').length,
   opaque:canvas?[...canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data].filter((v,i)=>i%4===3&&v).length:0};
 }));
 const snapshot=()=>page.evaluate(()=>({url:location.href,hash:location.hash,theme:document.querySelector('#install-teaser')?.getAttribute('data-scriptoscope-theme'),
  windows:[...document.querySelectorAll('#powers [data-scriptoscope-theme]')].map(e=>({tag:e.tagName,id:e.id,theme:e.getAttribute('data-scriptoscope-theme')})),
  buttons:[...document.querySelectorAll('#powers button[data-scriptoscope-button]')].map(el=>({text:el.textContent,html:el.outerHTML,replacement:el.nextElementSibling?.outerHTML})),credit:document.querySelector('#powers-credit')?.textContent}));
 try{
  await page.goto(`${mode==='source'?demo:production}/showcase.html?theme=windows-95`);
  await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  await Promise.all(responseBodies);await attachJson(info,'initial-showcase-identity.json',{snapshot:await snapshot(),network,consoleMessages});
  // Requested URL must mean actual Windows95; a random/no-cinf theme is a bug.
  expect(new URL(page.url()).searchParams.get('theme')).toBe('windows-95');
  await expect(page.locator('#install-teaser')).toHaveAttribute('data-scriptoscope-theme','windows-95');
  await expect(page.locator('#powers button[data-scriptoscope-button] + span.scriptoscope-button')).toHaveCount(2);
  expect(network.some(r=>r.status===200&&r.url.endsWith('/themes/windows-95/scheme.sit')&&r.sha256===choices.find(c=>c.slug==='windows-95').archiveSha256)).toBe(true);
  const initialShape=await shape();verifyShowcaseShape(initialShape,'themed');
  const shapeNegatives=[];
  for(const [name,mutate]of [
   ['missing-replacement',s=>s.pop()],['duplicate-replacement',s=>s.push(structuredClone(s[0]))],
   ['blank-canvas',s=>s[0].opaque=0],['hidden-replacement',s=>s[0].visible=false],
   ['wrong-labelled-control',s=>s[1].label='OK'],['native-for-valid-theme',s=>s[0].tag='BUTTON'],
  ]){const changed=structuredClone(initialShape);mutate(changed);expect(()=>verifyShowcaseShape(changed,'themed'),name).toThrow();shapeNegatives.push(name);}
  await attachJson(info,'showcase-shape-negatives.json',{baseline:initialShape,negatives:shapeNegatives});
  await page.evaluate(()=>{const f=window.showcaseButtons;f.faces=f.originals.map(el=>el.nextElementSibling);f.range=document.querySelector('#powers-hero-vol');});
  for(const name of ['OK','Cancel']){const face=page.getByRole('button',{name,exact:true});await expect(face).toBeVisible();await expect(face.locator('canvas')).toHaveCount(1);}
  const range=page.getByRole('slider',{name:'Vol',exact:true});await range.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#powers-hero-vol')).toHaveValue('51');
  await page.getByRole('button',{name:/Switch to bare HTML/}).click();
  await expect(page.locator('#powers.scriptoscope-ready')).toHaveCount(0);await expect(page.locator('#powers .scriptoscope-button')).toHaveCount(0);await expect(page.locator('#powers [data-scriptoscope-window-host]')).toHaveCount(0);
  const restoration=()=>page.evaluate(()=>{const f=window.showcaseButtons;return {same:f.originals.length===2&&f.originals.every((el,i)=>el.isConnected&&!el.hidden&&getComputedStyle(el).display!=='none'&&el.getAttribute('style')===f.saved[i].style&&el.getAttribute('type')===f.saved[i].type),range:f.range===document.querySelector('#powers-hero-vol'),value:f.range.value,calls:f.calls};});
  expect(await restoration()).toEqual({same:true,range:true,value:'51',calls:[0,0]});
  await page.evaluate(()=>{for(const face of window.showcaseButtons.faces){face.dispatchEvent(new PointerEvent('pointerdown'));face.dispatchEvent(new PointerEvent('pointerup'));face.click();}});
  expect((await restoration()).calls).toEqual([0,0]);
  for(const name of ['OK','Cancel']){await expect(page.getByRole('button',{name,exact:true})).toBeVisible();await page.getByRole('button',{name,exact:true}).click();}
  expect((await restoration()).calls).toEqual([1,1]);
  await page.locator('[data-slug="system7-nostalgia-silver"]').click();await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  await expect(page.locator('#install-teaser')).toHaveAttribute('data-scriptoscope-theme','system7-nostalgia-silver');
  await expect(page).toHaveURL(/theme=system7-nostalgia-silver(?:&|$)/);
  // This branch is admitted only by the separately pinned true-NULL control.
  verifyShowcaseShape(await shape(),'native');
  await page.evaluate(()=>{const f=window.showcaseButtons;f.remountFaces=f.originals.map(el=>el.nextElementSibling);});
  for(const name of ['OK','Cancel']){const face=page.getByRole('button',{name,exact:true});await expect(face).toBeVisible();await face.focus();await page.keyboard.press('Enter');}
  expect(await page.evaluate(()=>window.showcaseButtons.calls)).toEqual([2,2]);await expect(page.locator('#powers-hero-vol')).toHaveValue('51');
  await page.getByRole('button',{name:/Switch to bare HTML/}).click();expect(await restoration()).toEqual({same:true,range:true,value:'51',calls:[2,2]});
  await page.evaluate(()=>{for(const face of window.showcaseButtons.remountFaces){face.dispatchEvent(new PointerEvent('pointerdown'));face.dispatchEvent(new PointerEvent('pointerup'));face.click();}});
  expect((await restoration()).calls).toEqual([2,2]);
 }finally{await Promise.all(responseBodies);await attachJson(info,'showcase-final-identity.json',{snapshot:await snapshot(),network,consoleMessages});}
});
