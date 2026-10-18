import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';

async function setup(page, servers, mode, scale = 1) {
  await openHarness(page, servers, mode);
  await page.evaluate(async ({mode,scale}) => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const face = api.PixelBuffer.alloc(7,7), ring = api.PixelBuffer.alloc(9,9);
    ring.setPixel(0,0,199,33,77,255);
    const patterns = {};
    for (let id=0;id<2;id++) {
      const tile = api.PixelBuffer.alloc(5,3);
      for(let y=0;y<3;y++)for(let x=0;x<5;x++)tile.setPixel(x,y,id?0:(y*5+x+1)*10,id?(y*5+x+1)*10:0,0,255);
      patterns[id] = {sourcePpatId:id,asset:api.bufferToCanvas(tile).toDataURL()};
    }
    const asset = api.bufferToCanvas(face).toDataURL();
    const element = (id,pattern) => ({sourceCicnId:id,asset,width:7,height:7,slice:{corner:3,side:1,tile:false},bodyRequest:{mode:0,resourceId:pattern}});
    const theme = {baseUrl:location.origin,manifest:{chromeElements:{normal:element(-10239,0),pressed:element(-10238,1),inactive:element(-10240,0),
      ring:{sourceCicnId:-10231,asset:api.bufferToCanvas(ring).toDataURL(),width:9,height:9,slice:{corner:1,side:1,tile:false}}},patterns}};
    const content = document.createElement('div');content.style.cssText='position:relative;width:100%;height:100%;overflow:auto';
    const spacer=document.createElement('div');spacer.style.cssText='width:800px;height:800px';content.append(spacer);
    const traces=[],controls=[];
    for(let i=0;i<2;i++) {
      const button=await api.interactiveButton(theme,{label:'',minWidth:29,height:9,default:true,diagnostics:{onComplete:t=>traces.push(t)}});
      button.style.position='absolute';button.style.left=`${(20+i*3)*scale}px`;button.style.top=`${(30+i*5)*scale}px`;
      content.append(button);controls.push(button);
    }
    const manager=new api.WindowManager();const host=await manager.add(theme,{title:'Managed',width:240,height:130,scale},{},{contentEl:content});
    document.body.append(host);manager.setPosition(host,30,30);
    const port=manager.contentPort(host),bindings=controls.map(b=>api.bindButtonToContentPort(b,port));
    const frames=async n=>{for(let i=0;i<n;i++)await new Promise(r=>requestAnimationFrame(r));};
    const pixels=()=>controls.map(b=>{const c=b.querySelector('canvas'),r=c.getBoundingClientRect();return{pixel:[...c.getContext('2d').getImageData(8,6,1,1).data],size:[r.width,r.height],canvas:c};});
    window.managed={api,theme,content,controls,manager,host,port,bindings,traces,frames,pixels,scale};
  },{mode,scale});
  await page.waitForFunction(()=>window.managed.bindings.every(b=>b.state.measurement?.status==='ready'&&!b.state.pending&&b.state.committedContext.basis==='managed-content-port'));
}

for(const mode of ['source','built']) for(const scale of [1,2]) test(`${mode}: managed button port phase follows real layout at scale${scale} without translation churn`,async({page,servers},info)=>{
  let result;
  try {
    await setup(page,servers,mode,scale);
    result=await page.evaluate(async()=>{
      const f=window.managed;const initial=f.pixels().map(({pixel,size})=>({pixel,size})),contexts=f.bindings.map(b=>b.state.committedContext);
      const canvases=f.controls.map(b=>b.querySelector('canvas')),before=f.traces.length;
      await f.frames(8);const idle=f.traces.length-before;
      f.manager.setPosition(f.host,150,160);f.host.style.transform='translate(0.25px,0.5px)';await f.frames(4);const translated=f.traces.length-before;
      f.controls[0].style.left=`${23*f.scale}px`;await f.frames(2);await f.bindings[0].refresh();
      const moved={pixel:f.pixels()[0].pixel,state:f.bindings[0].state};
      f.controls[0].focus();f.controls[0].dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));
      const pressed=f.pixels()[0].pixel;
      f.content.scrollTop=11*f.scale;await f.frames(2);await f.bindings[0].refresh();
      const scrolled={pixel:f.pixels()[0].pixel,state:f.bindings[0].state,focus:document.activeElement===f.controls[0]};
      f.controls[0].dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));
      const released=f.pixels()[0].pixel;
      f.content.scrollTop=40*f.scale;await f.frames(2);await f.bindings[0].refresh();const clipped=f.pixels()[0].pixel;
      const stable=f.controls.every((b,i)=>b.querySelector('canvas')===canvases[i]);
      await Promise.all(f.bindings.map(b=>b.dispose()));f.manager.remove(f.host);f.host.remove();
      return{initial,contexts,idle,translated,moved,pressed,scrolled,released,clipped,stable};
    });
    expect(result.initial).toEqual([{pixel:[40,0,0,255],size:[37*scale,17*scale]},{pixel:[120,0,0,255],size:[37*scale,17*scale]}]);
    expect(result.contexts.map(c=>c.controlOrigin)).toEqual([[24,34],[27,39]]);
    expect(result.contexts[0]).toMatchObject({patternOrigin:{status:'unknown'},clip:{kind:'rect',rect:{x:0,y:0,w:240,h:130}}});
    expect(result.idle).toBe(0);expect(result.translated).toBe(0);expect(result.stable).toBe(true);
    expect(result.moved.pixel).toEqual([20,0,0,255]);expect(result.moved.state.committedContext.controlOrigin).toEqual([27,34]);
    expect(result.pressed).toEqual([0,20,0,255]);
    expect(result.scrolled.pixel).toEqual([0,70,0,255]);expect(result.scrolled.state.committedContext.controlOrigin).toEqual([27,23]);
    expect(result.scrolled.focus).toBe(true);expect(result.released).toEqual([70,0,0,255]);expect(result.clipped).toEqual([0,0,0,0]);
  }catch(error){await attachCase(page,info,{mode,scale,result},error);throw error;}
});

for(const mode of ['source','built']) test(`${mode}: managed binding preserves consumer styles and caller context ownership`,async({page,servers},info)=>{
  let result;
  try{
    await setup(page,servers,mode,2);
    result=await page.evaluate(async()=>{
      const f=window.managed,button=f.controls[0],canvas=button.querySelector('canvas'),binding=f.bindings[0];
      canvas.style.setProperty('width','111px','important');await f.frames(2);await binding.refresh();
      const unsupported=binding.state;
      await binding.dispose();const restored={width:canvas.style.width,priority:canvas.style.getPropertyPriority('width'),height:canvas.style.height};
      const next=f.api.bindButtonToContentPort(button,f.port);await next.refresh();
      const input={controlOrigin:[3,5],portOrigin:[0,0],patternOrigin:{status:'unknown'},clip:{kind:'unbounded'}};
      const pending=f.api.setButtonCompositionContext(button,input);input.controlOrigin[0]=99;await pending;
      const caller={pixel:f.pixels()[0].pixel,disposed:next.state.disposed};
      await binding.dispose();await next.dispose();f.controls[0].style.left='88px';await f.frames(3);const retained=f.pixels()[0].pixel;
      await f.bindings[1].dispose();f.manager.remove(f.host);f.host.remove();return{unsupported,restored,caller,retained};
    });
    expect(result.unsupported.measurement).toMatchObject({status:'unsupported',reason:'scale-mismatch'});
    expect(result.unsupported.committedContext.basis).toBe('compatibility-default');
    expect(result.restored).toEqual({width:'111px',priority:'important',height:'17px'});
    expect(result.caller).toEqual({pixel:[80,0,0,255],disposed:true});expect(result.retained).toEqual([80,0,0,255]);
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
});

for(const mode of ['source','built']) test(`${mode}: removed ports terminate bindings without disposing caller interaction`,async({page,servers},info)=>{
  await setup(page,servers,mode,2);
  const result=await page.evaluate(async()=>{
    const f=window.managed,b=f.controls[0],binding=f.bindings[0],canvas=b.querySelector('canvas');
    let notifications=0;
    const observer=f.port.observe(canvas,()=>({x:4,y:4,w:29,h:9}),()=>notifications++);
    f.manager.remove(f.host);
    const immediate={port:f.port.disposed,binding:binding.state.disposed,measurement:binding.state.measurement};
    await f.frames(3);const reset={context:binding.state.committedContext,pixel:f.pixels()[0].pixel,width:canvas.style.width};
    const baseline=f.traces.length,endedNotifications=notifications;
    f.host.remove();document.body.append(f.host);b.style.left='99px';f.port.refresh();await f.frames(4);
    b.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));const pressed=f.pixels()[0].pixel;
    b.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));
    observer.dispose();f.host.remove();
    return{immediate,reset,endedNotifications,notifications,extraCompositions:f.traces.length-baseline,pressed};
  });
  expect(result.immediate).toMatchObject({port:true,binding:true,measurement:{status:'unsupported',reason:'port-removed'}});
  expect(result.reset.context.basis).toBe('compatibility-default');
  expect(result.reset.pixel).toEqual([150,0,0,255]);expect(result.reset.width).toBe('37px');
  expect(result.endedNotifications).toBe(2);expect(result.notifications).toBe(2);expect(result.extraCompositions).toBe(0);
  expect(result.pressed).toEqual([0,150,0,255]);
  await attachObservations(info,'managed-context',`${mode}-terminal-port`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: async managed context commits a whole current pair and rejects stale completion`,async({page,servers},info)=>{
  await setup(page,servers,mode);
  // Replace a test pattern URL with a fresh actual raster. Decode the image,
  // then hold delivery; no compositor, cache or geometry method is stubbed.
  await page.evaluate(()=>{
    const f=window.managed,decode=HTMLImageElement.prototype.decode;
    f.restore=()=>{HTMLImageElement.prototype.decode=decode;};f.held=false;
    const barrier=new Promise(resolve=>f.release=resolve);
    const tile=f.api.PixelBuffer.alloc(5,3);
    for(let y=0;y<3;y++)for(let x=0;x<5;x++)tile.setPixel(x,y,(y*5+x+1)*10,0,1,255);
    const asset=f.api.bufferToCanvas(tile).toDataURL();f.theme.manifest.patterns[0].asset=asset;
    HTMLImageElement.prototype.decode=async function(){const result=await decode.call(this);if(this.src===asset&&!f.held){f.held=true;await barrier;}return result;};
    f.controls[0].style.left='23px';f.pending=f.bindings[0].refresh();
  });
  await page.waitForFunction(()=>window.managed.held);
  const pending=await page.evaluate(()=>{
    const f=window.managed;return{state:f.bindings[0].state,pixel:f.pixels()[0].pixel};
  });
  expect(pending.state.pending).toBe(true);
  expect(pending.state.measurement.context.controlOrigin).toEqual([27,34]);
  expect(pending.state.committedContext.controlOrigin).toEqual([24,34]);
  expect(pending.pixel).toEqual([40,0,0,255]);
  const result=await page.evaluate(async()=>{
    const f=window.managed;f.controls[0].style.left='24px';const latest=f.bindings[0].refresh();
    f.controls[0].dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));const heldPressed=f.pixels()[0].pixel;
    f.release();await Promise.all([f.pending,latest]);f.restore();
    const committed={state:f.bindings[0].state,pressed:f.pixels()[0].pixel};
    f.controls[0].dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));const released=f.pixels()[0].pixel;
    await Promise.all(f.bindings.map(b=>b.dispose()));f.manager.remove(f.host);f.host.remove();return{heldPressed,committed,released};
  });
  expect(result.heldPressed).toEqual([0,40,0,255]);
  expect(result.committed.state.committedContext.controlOrigin).toEqual([28,34]);expect(result.committed.state.pending).toBe(false);
  expect(result.committed.pressed).toEqual([0,30,0,255]);expect(result.released).toEqual([30,0,1,255]);
  await attachObservations(info,'managed-context',`${mode}-paired-epoch`,{mode,pending,result});
});

for(const mode of ['source','built']) test(`${mode}: removing a port during decode cannot commit its pending managed context`,async({page,servers},info)=>{
  await setup(page,servers,mode);
  await page.evaluate(()=>{
    const f=window.managed,decode=HTMLImageElement.prototype.decode;f.held=false;f.decodes=[];
    f.restore=()=>{HTMLImageElement.prototype.decode=decode;};const barrier=new Promise(resolve=>f.release=resolve);
    for(const id of [0,1]){
      const tile=f.api.PixelBuffer.alloc(5,3);
      for(let y=0;y<3;y++)for(let x=0;x<5;x++)tile.setPixel(x,y,id?0:(y*5+x+1)*10,id?(y*5+x+1)*10:0,2,255);
      f.theme.manifest.patterns[id].asset=f.api.bufferToCanvas(tile).toDataURL();
    }
    HTMLImageElement.prototype.decode=async function(){f.decodes.push(this.src);const result=await decode.call(this);if(!f.held){f.held=true;await barrier;}return result;};
    f.controls[0].style.left='23px';f.pending=f.bindings[0].refresh();
  });
  await page.waitForFunction(()=>window.managed.held);
  const result=await page.evaluate(async()=>{
    const f=window.managed;f.manager.remove(f.host);const immediate=f.bindings[0].state;
    f.release();await f.pending;
    // Port removal requests compatibility repaint; it is explicitly pending,
    // not an assertion that compatibility pixels already replaced old pixels.
    while(f.bindings.some(b=>b.state.pending))await f.frames(1);
    f.restore();const result={immediate,final:f.bindings[0].state,pixel:f.pixels()[0].pixel,decodes:f.decodes.length};
    f.host.remove();return result;
  });
  expect(result.immediate.disposed).toBe(true);expect(result.immediate.committedContext.controlOrigin).toEqual([24,34]);
  expect(result.final.measurement.reason).toBe('port-removed');expect(result.final.committedContext.basis).toBe('compatibility-default');
  expect(result.final.pending).toBe(false);expect(result.pixel).toEqual([150,0,2,255]);
  expect(result.decodes).toBe(2); // one shared actual decode per new normal/pressed tile
  await attachObservations(info,'managed-context',`${mode}-removed-pending`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: declared buttons follow owned window ports and respect explicit opt-out`,async({page,servers},info)=>{
  await setup(page,servers,mode);
  await page.evaluate(async()=>{
    const f=window.managed;await Promise.all(f.bindings.map(b=>b.dispose()));f.manager.remove(f.host);f.host.remove();
    const root=document.createElement('section');root.style.setProperty('--scriptoscope-content-padding','0px');document.body.append(root);
    const handle=await f.api.mountDeclarative({root,pageThemeDefault:'pattern',bootAffordance:'none'});handle.registerTheme('pattern',f.theme);
    const make=(name,x,y)=>{
      const holder=document.createElement('div');holder.style.cssText=`position:absolute;left:${x}px;top:${y}px;font-size:0;line-height:0`;
      const native=document.createElement('button');native.dataset.scriptoscopeButton='';native.dataset.scriptoscopeDefault='';native.type='button';native.setAttribute('aria-label',name);holder.append(native);return{holder,native};
    };
    const windows=[];
    for(let i=0;i<2;i++){
      const source=document.createElement('div');source.dataset.scriptoscopeWindow='';source.dataset.scriptoscopeWidth='240';source.dataset.scriptoscopeHeight='130';source.dataset.scriptoscopeTitle=`Port ${i}`;
      const content=document.createElement('div');content.style.cssText='position:relative;width:100%;height:130px';source.append(content);windows.push({source,content});
    }
    const moved=make('Moved',20,30),stationary=make('Stationary',23,35),standalone=make('Standalone',0,0);
    windows[0].content.append(moved.holder);windows[1].content.append(stationary.holder);const additions=document.createElement('div');additions.append(...windows.map(w=>w.source),standalone.holder);root.append(additions);
    let clicks=0;moved.native.addEventListener('click',()=>clicks++);
    const state=()=>[moved,stationary,standalone].map(({native})=>{
      const face=native.nextElementSibling,canvas=face?.querySelector('canvas');return canvas?{pixel:[...canvas.getContext('2d').getImageData(8,6,1,1).data],scale:canvas.getBoundingClientRect().width/canvas.width}:null;
    });
    window.declared={...f,root,handle,windows,moved,stationary,standalone,state,clicks:()=>clicks};
  });
  await expect(page.locator('.scriptoscope-button')).toHaveCount(3);
  await expect(page.locator('[data-scriptoscope-window-host]')).toHaveCount(2);
  await expect.poll(()=>page.evaluate(()=>window.declared.state().map(s=>s?.pixel))).toEqual([[40,0,0,255],[120,0,0,255],[150,0,0,255]]);
  const initial=await page.evaluate(()=>window.declared.state());
  expect(initial.map(s=>s.scale)).toEqual([1,1,1]);
  await page.evaluate(()=>{
    const f=window.declared;f.face=f.moved.native.nextElementSibling;f.canvas=f.face.querySelector('canvas');
    f.moved.holder.style.left='24px';f.moved.holder.style.top='35px';f.windows[1].content.append(f.moved.holder);
  });
  await expect.poll(()=>page.evaluate(()=>window.declared.state()[0]?.pixel)).toEqual([130,0,0,255]);
  expect(await page.evaluate(()=>{const f=window.declared;return f.moved.native.nextElementSibling===f.face&&f.face.querySelector('canvas')===f.canvas;})).toBe(true);
  await page.evaluate(async()=>{
    const f=window.declared;await f.api.setButtonCompositionContext(f.face,{controlOrigin:[3,5],portOrigin:[0,0],patternOrigin:{status:'unknown'},clip:{kind:'unbounded'}});
    f.windows[0].content.append(f.moved.holder);await f.frames(3);
  });
  expect(await page.evaluate(()=>window.declared.state()[0].pixel)).toEqual([80,0,0,255]);
  await page.getByRole('button',{name:'Moved',exact:true}).focus();await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>window.declared.clicks())).toBe(1);
  await page.evaluate(async()=>{const f=window.declared;await f.handle.retheme('pattern');});
  await expect(page.getByRole('button',{name:'Moved',exact:true})).toBeFocused();
  // Retheme creates a new face with fresh owned context; opting out applied to
  // the disposed old face, not to a future consumer declaration.
  await expect.poll(()=>page.evaluate(()=>window.declared.state()[0].pixel)).toEqual([130,0,0,255]);
  const teardown=await page.evaluate(async()=>{
    const f=window.declared;f.moved.native.style.color='blue';f.handle.disconnect();
    const result={faces:f.root.querySelectorAll('.scriptoscope-button').length,visible:getComputedStyle(f.moved.native).display!=='none',identity:f.moved.native.isConnected,color:f.moved.native.style.color,focused:document.activeElement===f.moved.native};
    f.root.remove();return result;
  });
  expect(teardown).toEqual({faces:0,visible:true,identity:true,color:'blue',focused:true});
  await attachObservations(info,'managed-context',`${mode}-declarative`,{mode,initial,teardown});
});

for(const mode of ['source','built']) test(`${mode}: current managed decode failure preserves pixels and explicit refresh retries`,async({page,servers},info)=>{
  await setup(page,servers,mode);
  const result=await page.evaluate(async()=>{
    const f=window.managed,original=f.theme.manifest.patterns[0].asset;
    f.theme.manifest.patterns[0].asset='data:image/png;base64,broken';f.controls[0].style.left='23px';
    let rejected=false;try{await f.bindings[0].refresh();}catch{rejected=true;}
    await Promise.resolve();const failed={state:f.bindings[0].state,pixel:f.pixels()[0].pixel,rejected};
    f.theme.manifest.patterns[0].asset=original;await f.bindings[0].refresh();
    const recovered={state:f.bindings[0].state,pixel:f.pixels()[0].pixel};
    await Promise.all(f.bindings.map(b=>b.dispose()));f.manager.remove(f.host);f.host.remove();return{failed,recovered};
  });
  expect(result.failed.rejected).toBe(true);expect(result.failed.state.error).toBeTruthy();
  expect(result.failed.state.committedContext.controlOrigin).toEqual([24,34]);expect(result.failed.pixel).toEqual([40,0,0,255]);
  expect(result.recovered.state.error).toBe(null);expect(result.recovered.state.committedContext.controlOrigin).toEqual([27,34]);expect(result.recovered.pixel).toEqual([20,0,0,255]);
  await attachObservations(info,'managed-context',`${mode}-decode-recovery`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: incompatible state layouts and transformed boxes have explicit fallback`,async({page,servers},info)=>{
  await setup(page,servers,mode);
  const result=await page.evaluate(async()=>{
    const f=window.managed,button=f.controls[0],binding=f.bindings[0];
    button.style.transform='rotate(2deg)';await f.frames(2);await binding.refresh();const rotated=binding.state;
    button.style.transform='none';await f.frames(2);await binding.refresh();const recovered=binding.state;
    const pressed=f.api.PixelBuffer.alloc(7,12),element=f.theme.manifest.chromeElements.pressed;
    const theme={...f.theme,manifest:{...f.theme.manifest,chromeElements:{...f.theme.manifest.chromeElements,pressed:{...element,height:12,asset:f.api.bufferToCanvas(pressed).toDataURL()}}}};
    const mismatch=await f.api.interactiveButton(theme,{label:'',default:true,minWidth:29});mismatch.style.cssText+=';position:absolute;left:70px;top:30px';f.content.append(mismatch);
    const mismatchBinding=f.api.bindButtonToContentPort(mismatch,f.port);await mismatchBinding.refresh();const incompatible=mismatchBinding.state;
    mismatch.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));await mismatchBinding.refresh();const pressedState=mismatchBinding.state;
    await mismatchBinding.dispose();await Promise.all(f.bindings.map(b=>b.dispose()));f.manager.remove(f.host);f.host.remove();
    return{rotated,recovered,incompatible,pressedState};
  });
  expect(result.rotated.measurement.reason).toBe('transform');expect(result.rotated.committedContext.basis).toBe('compatibility-default');
  expect(result.recovered.measurement.status).toBe('ready');expect(result.recovered.committedContext.basis).toBe('managed-content-port');
  for(const state of [result.incompatible,result.pressedState]){expect(state.measurement.reason).toBe('state-layout-mismatch');expect(state.committedContext.basis).toBe('compatibility-default');}
  await attachObservations(info,'managed-context',`${mode}-unsupported`,{mode,result});
});

for(const mode of ['source','built']) for(const scale of [1,2]) test(`${mode}: real Crayon mounted phase retains independent source samples at scale${scale}`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);
  const result=await page.evaluate(async({mode,scale})=>{
    const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts'),theme=await api.loadTheme('/themes/crayon-os',{provenance:true});
    const traces=[],content=document.createElement('div');content.style.cssText='position:relative;width:100%;height:100%';
    const button=await api.interactiveButton(theme,{label:'',minWidth:80,height:20,default:true,diagnostics:{onComplete:t=>traces.push(t)}});
    button.style.cssText+=`;position:absolute;left:${60*scale}px;top:${60*scale}px`;content.append(button);
    const manager=new api.WindowManager(),host=await manager.add(theme,{title:'Actual Crayon port',width:240,height:130,scale},{},{contentEl:content});document.body.append(host);
    const binding=api.bindButtonToContentPort(button,manager.contentPort(host));await binding.refresh();
    const canvas=button.querySelector('canvas'),pixel=()=>[...canvas.getContext('2d').getImageData(12,12,1,1).data];
    const normal={pixel:pixel(),state:binding.state,scale:canvas.getBoundingClientRect().width/canvas.width};
    button.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));const pressed=pixel();
    button.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));
    button.style.left=`${51*scale}px`;button.style.top=`${61*scale}px`;await binding.refresh();const shifted={pixel:pixel(),state:binding.state};
    button.style.left=`${52*scale}px`;await binding.refresh();const wrapped=pixel();
    await binding.dispose();manager.remove(host);host.remove();theme.dispose();return{normal,pressed,shifted,wrapped,traces};
  },{mode,scale});
  // Independent raw ppat17 samples: (8,8)=(231,222,198),
  // (63,9)=(247,247,214), (0,9)=(247,239,214). These literal display bytes
  // include the declared1.8/2.2 transfer; they are not original-device captures.
  expect(result.normal.state.committedContext.controlOrigin).toEqual([64,64]);expect(result.normal.scale).toBe(scale);
  expect(result.normal.pixel).toEqual([235,228,207,255]);expect(result.pressed).toEqual([48,48,207,255]);
  expect(result.shifted.state.committedContext.controlOrigin).toEqual([55,65]);expect(result.shifted.pixel).toEqual([248,248,221,255]);expect(result.wrapped).toEqual([248,242,221,255]);
  expect(result.traces.filter(t=>t.composition?.context.basis==='managed-content-port').length).toBeGreaterThanOrEqual(6);
  await attachObservations(info,'managed-context',`${mode}-crayon-${scale}`,{mode,scale,result,limits:'Browser managed-port policy and source sample arithmetic; historical port/palette/lookup are unverified.'});
});

for(const mode of ['source','built']) test(`${mode}: finite managed set shares viewport reads and does not recompose on idle or drag`,async({page,servers},info)=>{
  await setup(page,servers,mode);
  const rows=await page.evaluate(async()=>{
    const f=window.managed;await Promise.all(f.bindings.map(b=>b.dispose()));f.manager.remove(f.host);f.host.remove();const rows=[];
    for(const count of [12,100]){
      const content=document.createElement('div');content.style.cssText='position:relative;width:100%;height:100%';const controls=[],bindings=[],traces=[];
      for(let i=0;i<count;i++){
        const b=await f.api.interactiveButton(f.theme,{label:'',minWidth:29,height:9,default:true,diagnostics:{onComplete:t=>traces.push(t)}});
        b.style.cssText+=`;position:absolute;left:${20+(i%10)*40}px;top:${20+Math.floor(i/10)*20}px`;
        let wrapped=b;for(let depth=0;depth<8;depth++){const div=document.createElement('div');div.append(wrapped);wrapped=div;}content.append(wrapped);controls.push(b);
      }
      const manager=new f.api.WindowManager(),host=await manager.add(f.theme,{width:480,height:240},{},{contentEl:content});document.body.append(host);
      const port=manager.contentPort(host),viewport=host.shadowRoot.querySelector('.scriptoscope-content');
      let viewportReads=0,canvasReads=0;const originalRect=viewport.getBoundingClientRect.bind(viewport);viewport.getBoundingClientRect=()=>{viewportReads++;return originalRect();};
      for(const b of controls){const c=b.querySelector('canvas'),get=c.getBoundingClientRect.bind(c);c.getBoundingClientRect=()=>{canvasReads++;return get();};bindings.push(f.api.bindButtonToContentPort(b,port));}
      await Promise.all(bindings.map(b=>b.refresh()));await f.frames(3);
      const baseline=()=>({viewportReads,canvasReads,compositions:traces.length});
      const delta=before=>Object.fromEntries(Object.entries(baseline()).map(([key,value])=>[key,value-before[key]]));
      let before=baseline();await f.frames(20);const idle=delta(before);
      before=baseline();for(let frame=0;frame<10;frame++){manager.setPosition(host,frame*3.25,frame*2.5);await f.frames(1);}const drag=delta(before);
      before=baseline();controls[0].style.left='23px';await f.frames(2);await bindings[0].refresh();const reflow=delta(before);
      await Promise.all(bindings.map(b=>b.dispose()));before=baseline();await f.frames(3);const disposed=delta(before);
      manager.remove(host);host.remove();rows.push({count,depth:8,idle,drag,reflow,disposed});
    }return rows;
  });
  for(const row of rows){
    expect(row.idle.viewportReads).toBeGreaterThan(0);expect(row.idle.canvasReads).toBe(row.idle.viewportReads*row.count);expect(row.idle.compositions).toBe(0);
    expect(row.drag.canvasReads).toBe(row.drag.viewportReads*row.count);expect(row.drag.compositions).toBe(0);
    expect(row.reflow.compositions).toBe(2);expect(row.disposed).toEqual({viewportReads:0,canvasReads:0,compositions:0});
  }
  await attachObservations(info,'managed-context',`${mode}-finite-tracker`,{mode,rows,limits:'Counts are exact browser observations; this is not a field performance result.'});
});

for(const mode of ['source','built']) test(`${mode}: detached managed windows reset and reconnect without reviving disposed bindings`,async({page,servers},info)=>{
  await setup(page,servers,mode,2);
  await page.evaluate(()=>window.managed.host.remove());
  await page.waitForFunction(()=>window.managed.bindings.every(b=>b.state.measurement?.reason==='detached'&&!b.state.pending));
  const detached=await page.evaluate(()=>window.managed.bindings.map(b=>b.state));
  expect(detached.every(s=>s.committedContext.basis==='compatibility-default')).toBe(true);
  await page.evaluate(()=>document.body.append(window.managed.host));
  await page.waitForFunction(()=>window.managed.bindings.every(b=>b.state.measurement?.status==='ready'&&!b.state.pending));
  const result=await page.evaluate(async()=>{
    const f=window.managed,reconnected=f.bindings.map(b=>b.state),pixel=f.pixels()[0].pixel;
    f.host.style.display='none';await f.frames(3);const hidden=f.bindings.map(b=>b.state);
    await Promise.all(f.bindings.map(b=>b.dispose()));const before=f.traces.length;
    f.host.style.display='';f.controls[0].style.left='47px';await f.frames(4);
    const after=f.traces.length-before;f.manager.remove(f.host);f.host.remove();return{reconnected,pixel,hidden,after};
  });
  expect(result.reconnected.map(s=>s.committedContext.controlOrigin)).toEqual([[24,34],[27,39]]);expect(result.pixel).toEqual([40,0,0,255]);
  expect(result.hidden.every(s=>s.measurement.reason==='hidden')).toBe(true);expect(result.after).toBe(0);
  await attachObservations(info,'managed-context',`${mode}-reconnect`,{mode,detached,result});
});
