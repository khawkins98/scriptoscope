// Transport port of independently accepted review.mjs + direct-review.mjs.
// Semantic assertion bodies retained; source/static-built supplied by ordinary fixture.
import assert from 'node:assert/strict';
export async function formReview(p,mode){
 const rows=[],failures=[],pixels=[],errors=[];
 const listener=e=>errors.push(String(e));p.on('pageerror',listener);
 const check=(name,fn)=>{try{fn()}catch(e){failures.push({name,message:e.message})}};
 try{
  await p.evaluate(async mode=>{window.api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');window.themes={};for(const slug of ['windows-95','system7-nostalgia-silver'])themes[slug]=await api.loadTheme('/themes/'+slug);window.digest=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');},mode);
  for(const theme of ['windows-95','system7-nostalgia-silver']){
   pixels.push({mode,theme,proof:await p.evaluate(async theme=>{const result=[];for(const opts of [{label:'Form review'},{label:'Form review',default:true},{label:'Form review',disabled:true}]){const traces=[];const buffer=await api.composeButton(themes[theme],{...opts,diagnostics:{onComplete:t=>traces.push(t)}});const face=await api.interactiveButton(themes[theme],opts);document.body.replaceChildren(face);const rect=face.getBoundingClientRect();result.push({opts,pixels:await digest(buffer.data),size:[buffer.width,buffer.height],trace:JSON.parse(JSON.stringify(traces,(k,v)=>typeof v==='string'&&v.startsWith('blob:')?'blob:volatile':v)),style:face.getAttribute('style'),rect:[rect.width,rect.height],text:face.textContent,tag:face.tagName,canvas:face.querySelector('canvas')?.toDataURL()??null});}return result},theme)});
   for(const type of ['button','submit','reset','omitted'])for(const disabled of [false,true]){
    const key=`${mode}/${theme}/${type}/${disabled?'disabled':'enabled'}`;
    await p.evaluate(async({theme,type,disabled})=>{document.body.innerHTML='<button id="before" type="button">Before</button><form id="form"><input id="field" value="original"><button id="original" data-scriptoscope-button '+(type==='omitted'?'':'type="'+type+'"')+(disabled?' disabled':'')+' style="color: red; margin: 7px;">Form review</button></form><button id="after" type="button">After</button>';window.original=document.getElementById('original');window.saved={attrs:[...original.attributes].map(a=>[a.name,a.value]).sort(),object:original};window.counts={click:0,submit:0,reset:0,wrong:0};original.addEventListener('click',e=>{counts.click++;if(e.target!==original||e.currentTarget!==original)counts.wrong++});form.addEventListener('submit',e=>{e.preventDefault();counts.submit++});form.addEventListener('reset',()=>counts.reset++);window.handle=await (await import('/tests/rendering-options/contract-host.mjs')).createContractHost(api, {root:document.body,pageThemeDefault:theme});window.face=original.nextElementSibling;window.stale=[face];face.id='face';}, {theme,type,disabled});
    const setup=await p.evaluate(()=>({same:original===saved.object,tag:face.tagName,canvas:!!face.querySelector('canvas'),type:face.type,sourceType:original.type,omitted:!original.hasAttribute('type'),visible:getComputedStyle(face).display!=='none',disabled:face.disabled||face.getAttribute('aria-disabled')==='true'}));
    check(key+' setup valid themed/fallback controls',()=>{assert(setup.same&&setup.visible);assert.equal(setup.canvas,theme==='windows-95');assert.equal(setup.tag,'BUTTON');assert.equal(!!setup.disabled,disabled);assert.equal(setup.sourceType,type==='omitted'?'submit':type);assert.equal(setup.omitted,type==='omitted')});
    const expected=n=>({click:disabled?0:n,submit:disabled?0:(type==='submit'||type==='omitted'?n:0),reset:disabled?0:(type==='reset'?n:0),wrong:0});
    const observations=[];
    for(const [index,input]of ['pointer','Space'].entries()){
     await p.evaluate(()=>field.value='dirty');
     if(input==='pointer'){const r=await p.locator('#face').boundingBox();assert(r&&r.width>0&&r.height>0);await p.mouse.click(r.x+r.width/2,r.y+r.height/2)}
     else if(disabled){await p.locator('#before').focus();await p.keyboard.press('Tab');await p.keyboard.press('Tab');assert(await p.locator('#after').evaluate(e=>document.activeElement===e),'disabled tab exclusion');await p.keyboard.press('Space')}
     else{await p.locator('#face').focus();await p.keyboard.press('Space')}
     const observation=await p.evaluate(()=>({counts:{...counts},value:field.value}));observations.push({input,...observation});
     check(key+` ${input} original form semantics`,()=>{assert.deepEqual(observation.counts,expected(index+1));assert.equal(observation.value,!disabled&&type==='reset'?'original':'dirty')});
    }
    const cleanup=await p.evaluate(async({disabled,theme})=>{if(!disabled)face.focus();let focused=true;for(const slug of [theme==='windows-95'?'system7-nostalgia-silver':'windows-95',theme]){await handle.retheme(slug);const next=original.nextElementSibling;stale.push(next);if(!disabled)focused&&=document.activeElement===next;}const before={...counts};stale.slice(0,-1).forEach(el=>el.click());const afterRetheme={...counts};handle.disconnect();stale.forEach(el=>el.click());return{before,afterRetheme,afterDisconnect:{...counts},focused,restoredFocus:disabled||document.activeElement===original,same:original===saved.object&&original.parentElement===form,attrs:[...original.attributes].map(a=>[a.name,a.value]).sort(),expectedAttrs:saved.attrs,staleDetached:stale.every(el=>!el.isConnected),markers:document.querySelectorAll('[data-scriptoscope-promoted]').length}}, {disabled,theme});
    check(key+' retheme/disconnect identity focus listener disposal',()=>{assert(cleanup.focused&&cleanup.restoredFocus&&cleanup.same&&cleanup.staleDetached);assert.equal(cleanup.markers,0);assert.deepEqual(cleanup.attrs,cleanup.expectedAttrs);assert.deepEqual(cleanup.before,cleanup.afterRetheme);assert.deepEqual(cleanup.before,cleanup.afterDisconnect)});
    if(!disabled){await p.locator('#original').click();check(key+' restored original source',()=>{});const restored=await p.evaluate(()=>({...counts}));check(key+' restored original source semantics',()=>assert.deepEqual(restored,expected(3)))}
    rows.push({key,setup,observations,cleanup});
   }
   for(const disabled of [false,true]){
    await p.evaluate(async({theme,disabled})=>{document.body.innerHTML='<button type="button" id="safe">Safe</button><form id="direct"></form>';window.directCounts={callback:0,submit:0,reset:0};direct.addEventListener('submit',e=>{e.preventDefault();directCounts.submit++});direct.addEventListener('reset',()=>directCounts.reset++);const el=await api.interactiveButton(themes[theme],{label:'Direct',disabled,onClick:()=>directCounts.callback++});el.id='directFace';direct.append(el)}, {theme,disabled});
    const r=await p.locator('#directFace').boundingBox();await p.mouse.click(r.x+r.width/2,r.y+r.height/2);const directPointer=await p.evaluate(()=>({...directCounts}));check(`${mode}/${theme}/direct/${disabled} pointer one callback`,()=>assert.deepEqual(directPointer,{callback:disabled?0:1,submit:0,reset:0}));if(disabled)await p.locator('#safe').focus();else await p.locator('#directFace').focus();await p.keyboard.press('Space');const direct=await p.evaluate(()=>({...directCounts}));check(`${mode}/${theme}/direct/${disabled} callback owns activation`,()=>assert.deepEqual(direct,{callback:disabled?0:2,submit:0,reset:0}));rows.push({mode,theme,disabled,direct});
   }
  }
  check(mode+' page errors',()=>assert.deepEqual(errors,[]));
 return{rows,failures,pixels};
 }finally{await p.evaluate(()=>{window.handle?.disconnect();Object.values(window.themes??{}).forEach(t=>t.dispose());}).catch(()=>{});p.off('pageerror',listener);}
}
