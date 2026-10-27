import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const dir=import.meta.dirname;
const server=createServer(async(req,res)=>{try { if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><body></body>');return;} const path=resolve(dir,'.'+req.url.split('?')[0]); if(!path.startsWith(dir)||path.endsWith('.map'))throw Error();res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','public, max-age=3600');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--enable-precise-memory-info','--js-flags=--expose-gc']});
const results=[];
try {
for(const [label,entry] of [['baseline','scriptoscope'],['boundary','scriptoscope'],['boundary','renderer']]) {
 const context=await browser.newContext();const page=await context.newPage(); const runs=[];
 for(let i=0;i<6;i++) { await page.goto(origin);runs.push(await page.evaluate(async({label,entry})=>{const start=performance.now();const api=await import(`/artifacts/${label}/${entry}.js`);const imported=performance.now()-start;const repeat=performance.now();const again=await import(`/artifacts/${label}/${entry}.js`);const repeatMs=performance.now()-repeat;const {scene}=await import('/scene.mjs');const drawn=await scene(api,8);document.body.replaceChildren();globalThis.gc?.(); return {importMs:imported,repeatMs,same:api===again,...drawn,heap:performance.memory?.usedJSHeapSize,resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('/artifacts/')).map(r=>({name:r.name.split('/').pop(),bytes:r.decodedBodySize,transfer:r.transferSize}))};},{label,entry})); }
 results.push({label,entry,runs});await context.close();
}
const context=await browser.newContext();const page=await context.newPage();await page.goto(origin);
const identity=await page.evaluate(async()=>{const root=await import('/artifacts/boundary/scriptoscope.js'), core=await import('/artifacts/boundary/renderer.js'); const differences=Object.keys(core).filter(k=>core[k]!==root[k]);const p=new root.PixelBuffer(2,2);const errors=await Promise.all(['prepareDisplayProfile','prepareCinfEnvironment','prepareCicnTransferResults'].map(async name=>{try{await core[name]({});return null;}catch(e){return {name,code:e.code,message:e.message,shared:e instanceof root[e.name]};}}));return {differences,pixelBuffer:p instanceof core.PixelBuffer,errors};});
await context.close();
const consumers=[];
for(const entry of ['consumer-baseline-scriptoscope','consumer-boundary-scriptoscope','consumer-boundary-renderer']) {
 const consumerContext=await browser.newContext(), consumerPage=await consumerContext.newPage(); await consumerPage.goto(origin);
 consumers.push({entry,...await consumerPage.evaluate(async entry=>{await import(`/artifacts/${entry}/consumer.js`);return globalThis.runScene();},entry)});
 await consumerContext.close();
}
await writeFile(`${dir}/artifacts/browser.json`,JSON.stringify({results,identity,consumers},null,2));
console.log(JSON.stringify({identity,measurements:results.map(r=>({label:r.label,entry:r.entry,cold:r.runs[0].importMs,warm:r.runs.slice(1).map(x=>x.importMs),repeat:r.runs.map(x=>x.repeatMs),scene:r.runs.map(x=>x.times),hashes:[...new Set(r.runs.map(x=>x.hash))],canvases:r.runs[0].canvases,heap:r.runs.map(x=>x.heap),resources:r.runs[0].resources}))},null,2));
} finally{await browser.close();server.close();}
