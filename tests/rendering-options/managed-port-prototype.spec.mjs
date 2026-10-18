import { test, expect, openHarness } from './fixtures.mjs';

// Standalone D prototype. Public binding/pixel integration is deliberately not claimed.
test('managed port prototype maps actual face layout without screen-translation drift', async ({page,servers}) => {
await openHarness(page,servers,'source');
const result=await page.evaluate(async()=>{
  const runtime=await import('/src/index.ts');
  const {composeButtonWithLayout}=await import('/src/controls.ts');
  const {ManagedContentPort}=await import('/src/managedContentPort.ts');
  const theme=await runtime.loadTheme('/themes/crayon-os'), rows=[];
  for(const scale of [1,2])for(const buttonScale of [1,scale]){
   const manager=new runtime.WindowManager(),content=document.createElement('div');Object.assign(content.style,{position:'relative',width:'100%',height:'100%',overflow:'auto'});
   const opts={label:'',minWidth:80,height:20,default:true};
   const control=await runtime.interactiveButton(theme,{...opts,scale:buttonScale});Object.assign(control.style,{position:'absolute',left:`${20*scale}px`,top:`${30*scale}px`});content.append(control);
   const host=await manager.add(theme,{title:'Measured port',width:240,height:120,scale},{},{contentEl:content});host.style.left='100px';host.style.top='100px';document.body.append(host);
   await new Promise(r=>requestAnimationFrame(r));
   const layout=(await composeButtonWithLayout(theme,opts)).layout;
   const adapter=new ManagedContentPort();adapter.commit(host,host.shadowRoot.querySelector('.scriptoscope-content'),scale);
   const measure=()=>{
    const viewport=host.shadowRoot.querySelector('.scriptoscope-content').getBoundingClientRect(),canvas=control.querySelector('canvas'),rect=canvas.getBoundingClientRect(),effective=rect.width/canvas.width;
    return{measured:adapter.measure(canvas,layout.faceRect),viewport:{x:viewport.x,y:viewport.y,w:viewport.width,h:viewport.height},canvas:{x:rect.x,y:rect.y,w:rect.width,h:rect.height,backingW:canvas.width,backingH:canvas.height},effectiveControlScale:effective,faceOrigin:[(rect.x+layout.faceRect.x*effective-viewport.x)/scale,(rect.y+layout.faceRect.y*effective-viewport.y)/scale],scaleCompatible:effective===scale};
   };
   const initial=measure();manager.setPosition(host,180,160);const translated=measure();
   control.style.left=`${23*scale}px`;const reflow=measure();host.style.transform='translate(0.25px,0.5px)';const fractionalTranslation=measure();host.style.transform='scale(2)';const ancestorScale=measure();host.style.transform='rotate(10deg)';const rotation=measure();host.style.transform='';control.style.border='1px solid red';const wrapperBorder=measure();control.querySelector('canvas').style.border='1px solid red';const canvasBorder=measure();
   rows.push({scale,buttonScale,layout,initial,translated,reflow,fractionalTranslation,ancestorScale,rotation,wrapperBorder,canvasBorder});manager.remove(host);host.remove();
  }
  theme.dispose?.();return rows;
 });
for (const row of result) {
  if (row.buttonScale !== row.scale) {
    expect(row.initial.measured).toMatchObject({status:'unsupported',reason:'scale-mismatch'});
  } else {
    expect(row.initial.measured.context.controlOrigin).toEqual([24,34]);
    expect(row.translated.measured.context.controlOrigin).toEqual([24,34]);
    expect(row.reflow.measured.context.controlOrigin).toEqual([27,34]);
    expect(row.fractionalTranslation.measured.context.controlOrigin).toEqual([27,34]);
    expect(row.ancestorScale.measured.context.controlOrigin).toEqual([27,34]);
  }
  expect(row.rotation.measured).toMatchObject({status:'unsupported',reason:'transform'});
  expect(row.canvasBorder.measured).toMatchObject({status:'unsupported',reason:'canvas-box'});
}
});
test('managed port prototype shares viewport reads and owns dormant tracking', async ({page,servers}) => {
await openHarness(page,servers,'source');
const result=await page.evaluate(async({count,depth})=>{
  const runtime=await import('/src/index.ts');
  const {composeButtonWithLayout}=await import('/src/controls.ts');
  const {ManagedContentPort,trackManagedContent}=await import('/src/managedContentPort.ts');
  const theme=await runtime.loadTheme('/themes/crayon-os'),manager=new runtime.WindowManager(),content=document.createElement('div');
  Object.assign(content.style,{position:'relative',width:'100%',height:'100%'});
  const opts={label:'',minWidth:80,height:20,default:true};
  const layout=(await composeButtonWithLayout(theme,opts)).layout;
  const controls=[];for(let i=0;i<count;i++){const c=await runtime.interactiveButton(theme,opts);Object.assign(c.style,{position:'absolute',left:`${20+(i%4)*100}px`,top:`${20+Math.floor(i/4)*40}px`});let wrap=c;for(let d=0;d<depth;d++){const outer=document.createElement('div');outer.append(wrap);wrap=outer;}content.append(wrap);controls.push(c);}
  const host=await manager.add(theme,{title:'Tracker probe',width:480,height:180},{},{contentEl:content});document.body.append(host);manager.setPosition(host,30,30);
  const viewport=host.shadowRoot.querySelector('.scriptoscope-content'),port=new ManagedContentPort();port.commit(host,viewport,1);
  let viewportReads=0,measurements=0,changes=0;const samples=[];const originalRect=viewport.getBoundingClientRect.bind(viewport);viewport.getBoundingClientRect=()=>{viewportReads++;return originalRect();};
  const originalMeasure=port.measureInFrame.bind(port);port.measureInFrame=(...args)=>{measurements++;const t=performance.now();try{return originalMeasure(...args);}finally{samples.push(performance.now()-t);}};
  const states=[];const bindings=controls.map((c,i)=>trackManagedContent(port,c.querySelector('canvas'),()=>layout.faceRect,m=>{changes++;states[i]=m;}));
  const frames=async(n,each)=>{for(let i=0;i<n;i++){each?.(i);await new Promise(r=>requestAnimationFrame(r));}};
  const reset=()=>{viewportReads=0;measurements=0;changes=0;samples.length=0;};
  const snapshot=()=>({viewportReads,measurements,changes,measurementMs:samples.reduce((a,b)=>a+b,0),maxMeasurementMs:Math.max(0,...samples),states:states.map(x=>x.status==='ready'?x.context.controlOrigin:x.reason)});
  await frames(3);reset();await frames(20);const idle=snapshot();
  reset();await frames(10,i=>manager.setPosition(host,30+i*3.25,30+i*2.5));const translated=snapshot();
  reset();controls[0].style.left='23px';await frames(3);const reflow=snapshot();
  reset();host.remove();await frames(3);const detached=snapshot();
  reset();document.body.append(host);await frames(3);const reconnected=snapshot();
  reset();host.style.display='none';await frames(3);const hidden=snapshot();reset();await frames(5);const hiddenIdle=snapshot();host.style.display='';await frames(3);
  bindings.forEach(x=>x.dispose());reset();await frames(3);const disposed=snapshot();
  let initialThrow=false;try{trackManagedContent(port,controls[0].querySelector('canvas'),()=>layout.faceRect,()=>{throw new Error('expected callback failure');});}catch{initialThrow=true;}reset();await frames(3);const failedSubscribe=snapshot();const invalidFace=port.measure(controls[0].querySelector('canvas'),{...layout.faceRect,w:NaN});
  manager.remove(host);theme.dispose?.();return{depth,initialThrow,failedSubscribe,invalidFace,hidden,hiddenIdle,controls:count,framePolicy:'one shared pass; prototype notifications, no pixel recomposition yet',idle,translated,reflow,detached,reconnected,disposed};
 },{count:12,depth:0});
expect(result.idle.changes).toBe(0);
expect(result.translated.changes).toBe(0);
expect(result.reflow.changes).toBe(1);
expect(result.idle.measurements).toBe(result.idle.viewportReads * result.controls);
expect(result.hiddenIdle.measurements).toBe(0);
expect(result.disposed.measurements).toBe(0);
expect(result.failedSubscribe.measurements).toBe(0);
expect(result.initialThrow).toBe(true);
expect(result.invalidFace.reason).toBe('face-layout');
});

test('managed port prototype uses its owner realm and rejects invalid declared layout', async ({page,servers}) => {
  await openHarness(page,servers,'source');
  const result = await page.evaluate(async () => {
    const {ManagedContentPort} = await import('/src/managedContentPort.ts');
    const iframe = document.createElement('iframe'); document.body.append(iframe);
    const doc = iframe.contentDocument, host = doc.createElement('div');
    host.dataset.scriptoscopeWindowHost = ''; host.style.position = 'relative';
    const shadow = host.attachShadow({mode:'open'}), viewport = doc.createElement('div');
    viewport.style.cssText = 'position:relative;width:200px;height:120px';
    viewport.append(doc.createElement('slot')); shadow.append(viewport);
    const canvas = doc.createElement('canvas'); canvas.width = 88; canvas.height = 28;
    canvas.style.cssText = 'position:absolute;left:20px;top:30px;width:88px;height:28px';
    host.append(canvas); doc.body.append(host);
    const authority = new ManagedContentPort(); authority.commit(host,viewport,1);
    const rect = {x:4,y:4,w:80,h:20}, observed = authority.port.measure(canvas,rect);
    const invalid = authority.port.measure(canvas,{...rect,w:NaN});
    const foreign = authority.port.measure(document.createElement('canvas'),rect);
    const readonly = !('commit' in authority.port) && Object.isFrozen(authority.port) && Object.isFrozen(observed.context) && Object.isFrozen(observed.context.controlOrigin);
    iframe.remove(); return {observed,invalid,foreign,readonly};
  });
  expect(result.observed).toMatchObject({status:'ready',context:{controlOrigin:[24,34],portOrigin:[0,0],patternOrigin:{status:'unknown'}}});
  expect(result.invalid).toMatchObject({status:'unsupported',reason:'face-layout'});
  expect(result.foreign).toMatchObject({status:'unsupported',reason:'document-mismatch'});
  expect(result.readonly).toBe(true);
});
