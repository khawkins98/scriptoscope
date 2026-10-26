// Independent presentation rules. No runtime source/tables/formulas/goldens imported.
// Run from any candidate checkout with installed dev dependencies and its genuine
// production preview already running. BASE_URL points to that preview's base path.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const require=createRequire(resolve(process.cwd(),'package.json'));
const { chromium }=require('@playwright/test');
const base=process.env.BASE_URL;
assert(base?.startsWith('http'),'SETUP: BASE_URL must be an already built production preview');
const output=resolve(process.env.REVIEW_EVIDENCE??'/tmp/459-consumer-visibility');await mkdir(output,{recursive:true});
let head;try{head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}catch{head='unknown (exported production tree)'}
const result={head,base,interpretation:'modern consumer visibility/interaction only; no native paint/glyph oracle',rows:[],setupFailures:[],failures:[]};
const browser=await chromium.launch();
try {
 for(const theme of ['windows-95','1138','slimes','apple-platinum-2']) {
  const page=await browser.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const row={theme,positivePageAndBuild:false,controls:[],interactions:[]};result.rows.push(row);
  try {
   const response=await page.goto(new URL('diagnostic.html?theme='+theme,base).href,{waitUntil:'networkidle'});
   assert.equal(response.status(),200,'SETUP: actual production document');
   assert(await page.locator('script[type=module][src]').count()>0,'SETUP: built module document');
   const scripts=await page.locator('script[type=module][src]').evaluateAll(es=>es.map(e=>e.src));
   assert(scripts.every(s=>/\/assets\/.+\.js/.test(s)),'SETUP: expected built assets, not dev source');
   await page.getByText('ready — interact with the controls',{exact:true}).waitFor();
   assert.deepEqual(errors,[],'SETUP: page/module errors cannot be counted as a visibility failure');row.positivePageAndBuild=true;
   for(const label of ['Cancel','OK','Help']) {
    const el=page.getByRole('button',{name:label,exact:true});await el.waitFor();
    const visible=await el.evaluate((e,label)=>{
     const r=e.getBoundingClientRect(),s=getComputedStyle(e);
     const text=(e.textContent??'').includes(label)&&Number.parseFloat(s.fontSize)>0&&s.color!=='rgba(0, 0, 0, 0)';
     const canvases=[...e.querySelectorAll('canvas')].map(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let opaque=0;for(let i=3;i<d.length;i+=4)if(d[i])opaque++;return {width:c.width,height:c.height,opaque};});
     return {label,rect:{width:r.width,height:r.height},text,canvases,visible:s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0&&(text||canvases.some(c=>c.opaque>0))};
    },label);row.controls.push(visible);
    if(!visible.visible)result.failures.push({theme,assertion:'VISIBLE_CONTROL_LABEL',label,actual:visible});
   }
   const status=page.getByText('ready — interact with the controls',{exact:true});const handle=await status.elementHandle();
   const statusText=()=>handle.textContent();
   const ok=page.getByRole('button',{name:'OK',exact:true});await ok.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.equal(await ok.evaluate(e=>document.activeElement===e),true,'keyboard focus returns to OK');
   await page.keyboard.press('Space');assert.equal(await statusText(),'OK clicked');row.interactions.push('Space activated OK');
   await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await statusText(),'Cancel clicked');row.interactions.push('pointer activated Cancel');
   const help=page.getByRole('button',{name:'Help',exact:true});assert(await help.evaluate(e=>e.disabled===true||e.getAttribute('aria-disabled')==='true'),'disabled semantics');
   const b=await help.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);assert.equal(await statusText(),'Cancel clicked','disabled pointer must not activate');
   const tab=await help.getAttribute('tabindex');assert(await help.evaluate(e=>e.disabled===true)||tab==='-1','disabled must not enter keyboard tab sequence');row.interactions.push('disabled Help rejected pointer and excluded from tab sequence');
   const cb=page.getByRole('checkbox',{name:'Show invisibles',exact:true});await cb.click();await cb.focus();await page.keyboard.press('Space');assert.equal(await cb.isChecked(),true);row.interactions.push('checkbox pointer/Space roundtrip');
   await page.getByRole('radio',{name:'Off',exact:true}).click();const on=page.getByRole('radio',{name:'On',exact:true});await on.focus();await page.keyboard.press('Space');assert.equal(await on.isChecked(),true);assert.equal(await page.getByRole('radio',{name:'Off',exact:true}).isChecked(),false);row.interactions.push('radio pointer/Space exclusivity');
   assert.deepEqual(errors,[],'runtime page errors');await page.screenshot({path:resolve(output,theme+'.png')});
  } catch(error) {result.setupFailures.push({theme,message:error.message,stack:error.stack});}
  await page.close();
 }
} finally {await browser.close();await writeFile(resolve(output,'result.json'),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({positiveThemes:result.rows.filter(r=>r.positivePageAndBuild).map(r=>r.theme),setupFailures:result.setupFailures,failures:result.failures.map(f=>({theme:f.theme,assertion:f.assertion,label:f.label}))},null,2));
// A broken build/navigation/harness is an error, never a meaningful red visibility result.
if(result.setupFailures.length)process.exitCode=2;
else if(result.failures.length)process.exitCode=1;
