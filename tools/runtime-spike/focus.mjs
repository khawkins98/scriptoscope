// Local-only focus probe: compare every committed chrome with a fresh public render.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { createServer } from 'vite';
import { writeReport } from './report.mjs';
const exec = promisify(execFile), root = resolve(import.meta.dirname, '../..');
const label = process.argv[2] ?? 'current';
const entry = process.env.SCRIPTOSCOPE_FOCUS_ENTRY ? resolve(process.env.SCRIPTOSCOPE_FOCUS_ENTRY) : resolve(root, 'dist/scriptoscope.js');
const directory = dirname(entry);
const expectedEntry = process.env.SCRIPTOSCOPE_EXPECTED_ENTRY ? resolve(process.env.SCRIPTOSCOPE_EXPECTED_ENTRY) : null;
async function checkedBuild(entry) {
  const result = JSON.parse(await readFile(resolve(dirname(entry), '../build.json'), 'utf8'));
  if (result.status !== 'pass') throw new Error('Reference build did not pass');
  for (const file of result.files) {
    if (!/^[a-zA-Z0-9._-]+$/.test(file.path)) throw new Error('Invalid reference artifact filename');
    const digest = createHash('sha256').update(await readFile(resolve(dirname(entry), file.path))).digest('hex');
    if (digest !== file.sha256) throw new Error('Reference artifact differs from build manifest');
  }
  return result;
}
const compiledBuild = process.env.SCRIPTOSCOPE_FOCUS_ENTRY ? await checkedBuild(entry) : null;
const expectedBuild = expectedEntry ? await checkedBuild(expectedEntry) : null;
if (!/^[a-z-]+$/.test(label)) throw new Error('Use a lowercase report label');
const fingerprint = async () => {
  const paths = (await readdir(directory)).filter(p => p.endsWith('.js')).map(p => resolve(directory, p));
  if (expectedEntry) paths.push(...(await readdir(dirname(expectedEntry))).filter(p => p.endsWith('.js')).map(p => resolve(dirname(expectedEntry), p)));
  paths.push('tools/runtime-spike/report.mjs', 'tools/runtime-spike/focus.mjs', 'src/scriptoscope.css', 'demo/themes-manifest.json');
  const { stdout } = await exec('git', ['ls-files', 'themes'], { cwd: root });
  paths.push(...stdout.trim().split('\n').filter(p => /\/(?:meta\.json|scheme\.(?:sit|rsrc))$/.test(p)));
  const hash = createHash('sha256');
  for (const path of paths.sort()) hash.update(path).update(await readFile(resolve(root, path)));
  return hash.digest('hex');
};
const initial = await fingerprint(), session = `focus-spike-${process.pid}`;
const browser = async (...args) => {
  const result = JSON.parse((await exec('agent-browser', ['--session', session, '--json', ...args], { timeout: 60000, maxBuffer: 8 << 20 })).stdout);
  if (!result.success) throw new Error(JSON.stringify(result.error));
  return result.data.result;
};
const html = `<!doctype html><html><head><link rel="stylesheet" href="/scriptoscope.css"></head><body><script type="module">
import {loadTheme, loadOwnedTheme, WindowManager, renderWindow} from '/@fs/${entry}';
window.focusReport = {status:'running',cases:[],mismatches:[]};
(async()=>{
 const report=window.focusReport;
 const reference=${expectedEntry ? "await import('/@fs/" + expectedEntry + "')" : 'null'};
 const manifest=await (await fetch('/demo/themes-manifest.json')).json();
 const themes=Array.isArray(manifest)?manifest:manifest.themes;
 const pixels=canvas=>canvas?.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
 for(const mode of ['eager','owned'])for(const item of themes){
  const theme=await (mode==='owned'?loadOwnedTheme:loadTheme)('/themes/'+item.slug,{source:item.source});
  const expectedTheme=reference?await (mode==='owned'?reference.loadOwnedTheme:reference.loadTheme)('/themes/'+item.slug,{source:item.source}):theme;
  try{
   for(const windowType of ['document-window','titled-utility-window','side-floating-utility-window','collapsed-document-window'])for(const large of [false,true]){
    const manager=new WindowManager(), options={windowType,width:large?900:180,height:large?600:90,title:'Focus probe'};
    const hosts=[], contents=[];
    let notifications=0;manager.setChangeListener(()=>notifications++);
    for(let i=0;i<2;i++){const content=document.createElement('section');content.innerHTML='<textarea>persistent selection</textarea>';const host=await manager.add(theme,options,{}, {contentEl:content});document.body.append(host);hosts.push(host);contents.push(content);content.firstChild.setSelectionRange(2,7);}
    const canvases=hosts.map(host=>host.shadowRoot.querySelector('canvas.scriptoscope-chrome'));notifications=0;
    const calls=[], focus=manager.focus.bind(manager);
    manager.focus=(...args)=>{const pending=focus(...args);calls.push(pending);return pending;};
    const timings=[], hashes=[];
    let fullRenders=0, fastFlips=0;
    const render=manager.render.bind(manager);manager.render=(...args)=>{fullRenders++;return render(...args);};
    if(manager.tryFastFocusFlip){const fast=manager.tryFastFocusFlip.bind(manager);manager.tryFastFocusFlip=(...args)=>{const hit=fast(...args);if(hit)fastFlips++;return hit;};}
    for(let turn=0;turn<8;turn++){
     const index=(turn+1)%2,start=performance.now();
     hosts[index].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
     await Promise.all(calls.splice(0));timings.push(performance.now()-start);
     for(let i=0;i<2;i++){
      const actual=hosts[i].shadowRoot.querySelector('canvas.scriptoscope-chrome');
      const expected=(await (reference?.renderWindow??renderWindow)(expectedTheme,{...options,state:i===index?'active':'inactive'})).querySelector('canvas.scriptoscope-chrome');
      const a=pixels(actual),b=pixels(expected);
      let difference=a?.length!==b?.length?-1:0,hash=2166136261;
      if(a&&b&&difference===0)for(let p=0;p<a.length;p++){if(a[p]!==b[p])difference++;hash=Math.imul(hash^a[p],16777619);}
      if(difference)report.mismatches.push({mode,slug:item.slug,windowType,large,turn,window:i,differingBytes:difference});
      hashes.push(hash>>>0);
      if(hosts[i].firstChild!==contents[i]||contents[i].firstChild.selectionStart!==2||contents[i].firstChild.selectionEnd!==7||actual!==canvases[i])throw new Error('Focus replaced persistent content, selection or canvas');
     }
     if(hosts[index].shadowRoot.querySelector('.scriptoscope-window').dataset.scriptoscopeCurrentState!=='active')throw new Error('Focused window did not become active');
    }
    if(notifications!==16)throw new Error('Focus notification count changed: '+notifications);
    const active=manager.windows.find(w=>w.active);const count=fullRenders;await manager.focus(active);if(fullRenders!==count)throw new Error('Active click repainted');
    report.cases.push({mode,slug:item.slug,windowType,large,timings,hashes,fullRenders,fastFlips,notifications});
    for(const host of hosts){manager.remove(host);host.remove();}
   }
  }finally{theme.dispose();if(expectedTheme!==theme)expectedTheme.dispose();}
 }
 report.status=report.mismatches.length?'mismatch':'pass';
})().catch(error=>{window.focusReport.status='error';window.focusReport.error=String(error.stack??error)});
</script></body></html>`;
const server = await createServer({ configFile: resolve(root, 'vite.config.js'), root,
  plugins: [{name:'focus-probe',configureServer(server){server.middlewares.use((req,res,next)=>{
    if(req.url!=='/focus-probe.html')return next();res.setHeader('Content-Type','text/html');res.end(html);
  });}}], server:{host:'127.0.0.1',port:0,strictPort:false,open:false,hmr:false,fs:{allow:[root,directory,...(expectedEntry?[dirname(expectedEntry)]:[])]}} });
try {
 await server.listen();await browser('open',server.resolvedUrls.local[0]+'focus-probe.html');
 let report;
 for(let turn=0;turn<900;turn++){
  report=await browser('eval','window.focusReport');
  if(report&&report.status!=='running')break;
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 if(!report||report.status==='running')throw new Error('Focus probe timed out');
 report.compiledBuild=compiledBuild;report.expectedBuild=expectedBuild;report.recordedAt=new Date().toISOString();
 report.provenance={revision:(await exec('git',['rev-parse','HEAD'],{cwd:root})).stdout.trim(),inputs:initial};
 if(await fingerprint()!==initial)report.status='unstable-inputs';
 await writeReport(`focus-${label}-results.json`,report);
 console.log(JSON.stringify({status:report.status,cases:report.cases.length,mismatches:report.mismatches.length,error:report.error}));
 if(report.status!=='pass')process.exitCode=1;
}finally{await browser('close').catch(()=>{});await server.close();}
