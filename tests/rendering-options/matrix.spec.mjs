import {createHash} from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
import { listCases } from './cases.mjs';
const catalog = JSON.parse(readFileSync(new URL('../../demo/themes-manifest.json', import.meta.url)));

async function pixels(page, canvases) {
  return page.evaluate(async selectors => Promise.all(selectors.map(async selector => {
    const canvas = document.querySelector(selector);
    const rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const digest = await crypto.subtle.digest('SHA-256', rgba);
    return { width: canvas.width, height: canvas.height,
      sha256: [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('') };
  })), canvases.map(c => c.selector));
}

function assertOutput(result,c,slug){
  const noCinfPush=['apple-platinum-2','black-platinum','platinum-8','slimes','system7-nostalgia-silver'].includes(slug)&&['push','default'].includes(c.family);
  expect(result.status,result.error??c.id).not.toBe('error');
  if(noCinfPush&&c.mode==='direct'){
    expect(result.status).toBe('rendered');expect(result.resolutionTrace.outcome.status).toBe('themed');
    const id=c.options.disabled?-10240:c.options.pressed?-10238:-10239;
    const admitted=result.resolutionTrace.steps.find(s=>s.role==='face'&&s.action==='selected'&&s.resource?.type==='cicn');
    expect(admitted).toBeDefined();expect(admitted.resource.signedId).toBe(id);expect(admitted.owner.chainDepth).toBe(0);expect(admitted.resource.manifestKey).toBeTruthy();
    const nulls=result.resolutionTrace.steps.filter(s=>s.role==='face'&&s.action==='missing'&&s.reason.includes('cinf'));
    expect(nulls.map(s=>s.requestedId)).toEqual([id,0]);
  }
  if (result.status === 'unavailable') {
    expect(c.mode, 'only direct compositor calls may report missing themed art').toBe('direct');
    expect(result.canvases).toHaveLength(0);
    return;
  }
  if (c.mode === 'direct') expect(result.canvases.length, `${c.id} produces visible backing pixels`).toBeGreaterThan(0);
  // Native/CSS fallback controls can correctly have no canvas. Their real DOM
  // remains subject to style, focus, geometry and source/built screenshot checks.
  for (const canvas of result.canvases) {
    expect(canvas.width).toBeGreaterThan(0); expect(canvas.height).toBeGreaterThan(0);
    if(noCinfPush&&c.mode==='direct'){
      if(!c.options.fg||!c.options.label)expect(canvas.opaqueBounds,'PB9 double-NULL retains transparent admission').toBeNull();
      else{expect(canvas.opaqueBounds,'explicit caller foreground paints modern label ink').not.toBeNull();if(result.resolutionTrace.textColors)expect(result.resolutionTrace.textColors).toMatchObject({policy:'caller-override',labelPainted:true});}
      expect(result.resolutionTrace.legacyFacePaint).toBeUndefined();
      expect(result.resolutionTrace.bandPaints??[]).toEqual([]);
      expect(result.resolutionTrace.steps.some(s=>s.bodyPaint)).toBe(false);
    }else expect(canvas.opaqueBounds,'a rendered canvas contains art').not.toBeNull();
    expect(canvas.rect.width, 'CSS must not squash backing width').toBeCloseTo(canvas.width, 4);
    expect(canvas.rect.height, 'CSS must not squash backing height').toBeCloseTo(canvas.height, 4);
  }
  if (c.mode === 'declarative') {
    expect(result.controls.length, 'the real scanner produced control DOM').toBeGreaterThan(0);
    for (const control of result.controls) {
      if(noCinfPush){
        const shadows=control.boxShadow.split(/,(?![^(]*\))/).map(s=>s.trim());
        const baseline=['rgb(255, 255, 255) 0px 1px 0px 0px inset','rgba(0, 0, 0, 0.14) 0px -1px 1px 0px inset'];
        if(c.options.default)baseline.push('rgb(212, 212, 212) 0px 0px 0px 1px','rgb(0, 0, 0) 0px 0px 0px 3px');
        expect(shadows,'native baseline retains only its declared bevel and default outline layers').toEqual(baseline);
      }
      else expect(control.boxShadow,'window-only shadow must not decorate promoted controls').toBe('none');
      expect(control.filter, 'window-only filter must not decorate promoted controls').toBe('none');
    }
    expect(result.windows, 'both scanner and imperative windows must really be promoted').toHaveLength(2);
    for (const window of result.windows) {
      expect(window.isWindowHost).toBe(true);
      expect(window.boxShadow, 'stretchable outer hosts must not cast window shadows').toBe('none');
      expect(window.part, 'actual chrome exposes its window part').not.toBeNull();
      expect(window.part.boxShadow, 'optional shell shadows default off').toBe('none');
    }
    if (result.native && 'disabled' in c.options) expect(result.native.disabled).toBe(c.options.disabled);
  }
}


async function assertNativeReplacement(page,result,c){
  expect(result.canvases,'known no-cinf consumer uses visible native replacement').toHaveLength(0);
  expect(result.controls).toHaveLength(1);
  const face=page.locator(result.controls[0].selector);
  await expect(face).toBeVisible();
  const setup=await page.evaluate(({nativeSelector,faceSelector,label})=>{
    const original=document.querySelector(nativeSelector),face=document.querySelector(faceSelector);
    if(!original||!face)throw Error('matrix native probe requires actual source and face');
    window.matrixNativeProbe={original,clicks:0};const onClick=()=>window.matrixNativeProbe.clicks++;
    original.addEventListener('click',onClick);window.matrixNativeProbe.onClick=onClick;
    const before=document.createElement('button'),after=document.createElement('button');before.type=after.type='button';before.textContent='Before';after.textContent='After';before.id='matrix-probe-before';after.id='matrix-probe-after';original.before(before);face.after(after);
    return{tag:face.tagName,label:face.textContent,disabled:face.disabled,sourceDisabled:original.disabled};
  },{nativeSelector:result.native.selector,faceSelector:result.controls[0].selector,label:c.options.label});
  try{
    expect(setup).toEqual({tag:'BUTTON',label:c.options.label,disabled:!!c.options.disabled,sourceDisabled:!!c.options.disabled});
    const box=await face.boundingBox();expect(box.width).toBeGreaterThan(0);expect(box.height).toBeGreaterThan(0);await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
    expect(await page.evaluate(()=>window.matrixNativeProbe.clicks)).toBe(c.options.disabled?0:1);
    if(c.options.disabled){await page.locator('#matrix-probe-before').focus();await page.keyboard.press('Tab');await expect(page.locator('#matrix-probe-after')).toBeFocused();}else await face.focus();
    await page.keyboard.press('Space');expect(await page.evaluate(()=>window.matrixNativeProbe.clicks)).toBe(c.options.disabled?0:2);
    expect(await page.evaluate(selector=>document.querySelector(selector)===window.matrixNativeProbe.original,result.native.selector)).toBe(true);
  }finally{await page.evaluate(()=>{const p=window.matrixNativeProbe;p.original.removeEventListener('click',p.onClick);document.querySelector('#matrix-probe-before')?.remove();document.querySelector('#matrix-probe-after')?.remove();delete window.matrixNativeProbe;});}
}

async function assertKeyboardFocus(page, result) {
  const candidates = result.controls.filter(c => c.tabIndex >= 0 && c.ariaDisabled !== 'true');
  if (!candidates.length) return;
  let selector;
  for (const candidate of candidates) {
    if (await page.locator(candidate.selector).evaluate(el => !el.matches(':disabled'))) { selector = candidate.selector; break; }
  }
  if (!selector) return;
  // Enter keyboard modality before focusing, rather than checking a mouse-only
  // pseudo-state or merely trusting tabIndex metadata.
  await page.keyboard.press('Tab');
  await page.locator(selector).focus();
  const focus = await page.locator(selector).evaluate(el => {
    const style = getComputedStyle(el);
    return { active: document.activeElement === el, visible: el.matches(':focus-visible'),
      outline: style.outlineStyle, width: parseFloat(style.outlineWidth), clip: style.clipPath };
  });
  expect(focus.active).toBe(true); expect(focus.visible).toBe(true);
  expect(focus.outline).not.toBe('none'); expect(focus.width).toBeGreaterThan(0);
  expect(focus.clip, 'focus must not be hidden by boot animation').toBe('none');
}

async function assertTabLayout(page, result) {
  const layout = await page.locator(result.outputSelector).evaluate(root => {
    const tabs = [...root.querySelectorAll('[role="tab"]')].filter(el => getComputedStyle(el).display !== 'none');
    const panels = [...root.querySelectorAll('[role="tabpanel"]')];
    const visiblePanels = panels.filter(el => !el.hidden && getComputedStyle(el).display !== 'none');
    return { tabs: tabs.map(el => ({ bottom: el.getBoundingClientRect().bottom,
      precedesPanels: panels.every(panel => !!(el.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING)) })),
      panelTops: visiblePanels.map(el => el.getBoundingClientRect().top) };
  });
  expect(layout.tabs, 'the real tab strip exposes both tab buttons').toHaveLength(2);
  expect(layout.panelTops, 'exactly one panel is visible').toHaveLength(1);
  for (const tab of layout.tabs) {
    expect(tab.precedesPanels, 'all tab buttons precede the panels in consumer markup').toBe(true);
    expect(tab.bottom, 'every tab stays above the visible panel').toBeLessThanOrEqual(layout.panelTops[0] + 0.01);
  }
}

for (const { slug } of catalog) test(`${slug}: option contracts and source/built pixels`, async ({ browser, servers }, testInfo) => {
  const profile = testInfo.project.metadata.caseProfile ?? 'smoke';
  const cases = listCases({ profile }).sort((a, b) => (a.mode === 'declarative') - (b.mode === 'declarative'));
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: testInfo.project.use.deviceScaleFactor ?? 1 });
  const pages = { source: await context.newPage(), built: await context.newPage() };
  let activePage = pages.source, current, mode, result;
  const summary=[];let checkedNativeNegatives=false,checkedDirectNegative=false;
  try {
    for (const m of ['source', 'built']) await openHarness(pages[m], servers, m);
    const groupSizes = new Map();
    for (const c of cases) {
      current = c;
      const versions = {};
      const resolutionTraces = {};
      const presentationStates = {};
      for (mode of ['source', 'built']) {
        activePage = pages[mode];
        result = await activePage.evaluate(({ c, slug }) => window.controlMatrix.runCase(c, { slug }), { c, slug });
        resolutionTraces[mode] = result.resolutionTrace;
        assertOutput(result,c,slug);
        if(c.mode==='direct'&&['push','default'].includes(c.family)&&['apple-platinum-2','black-platinum','platinum-8','slimes','system7-nostalgia-silver'].includes(slug)&&!checkedDirectNegative){
          const missing=structuredClone(result);missing.canvases=[];expect(()=>assertOutput(missing,c,slug),'missing direct canvas cannot pass PB9 admission').toThrow();
          const unavailable=structuredClone(result);unavailable.status='unavailable';expect(()=>assertOutput(unavailable,c,slug),'unavailable cannot pass reached metadata NULL').toThrow();checkedDirectNegative=true;
        }
        if(c.mode==='declarative'&&['push','default'].includes(c.family)&&['apple-platinum-2','black-platinum','platinum-8','slimes','system7-nostalgia-silver'].includes(slug)){
          await assertNativeReplacement(activePage,result,c);
          if(!checkedNativeNegatives&&c.options.label&&!c.options.disabled){
            const outer=structuredClone(result);outer.controls[0].boxShadow+=', rgb(0, 0, 0) 1px 1px 1px 0px';expect(()=>assertOutput(outer,c,slug),'extra outer window shadow must fail accepted native baseline').toThrow();
            const empty=structuredClone(result);empty.controls[0].boxShadow='none';expect(()=>assertOutput(empty,c,slug),'missing baseline pair cannot pass').toThrow();
            const selector=result.controls[0].selector;
            await activePage.locator(selector).evaluate(e=>{e.textContent='';});
            try{await expect(assertNativeReplacement(activePage,result,c),'blank native replacement must fail').rejects.toThrow();}
            finally{await activePage.locator(selector).evaluate((e,label)=>{e.textContent=label;},c.options.label);}
            await activePage.evaluate(({face,source})=>{window.matrixDuplicate=()=>document.querySelector(source).click();document.querySelector(face).addEventListener('click',window.matrixDuplicate);},{face:selector,source:result.native.selector});
            try{await expect(assertNativeReplacement(activePage,result,c),'duplicate forwarding must fail exact callback count').rejects.toThrow();}
            finally{await activePage.locator(selector).evaluate(e=>{e.removeEventListener('click',window.matrixDuplicate);delete window.matrixDuplicate;});}
            checkedNativeNegatives=true;
          }
        }
        if (c.mode === 'declarative' && c.family === 'tab') await assertTabLayout(activePage, result);
        // Compare both entries in the same keyboard-focused presentation.
        if (c.mode === 'declarative') await assertKeyboardFocus(activePage, result);
        versions[mode]={status:result.status,pixels:await pixels(activePage,result.canvases)};
        if(c.mode==='direct'&&(!c.options.fg||!c.options.label)&&['push','default'].includes(c.family)&&['apple-platinum-2','black-platinum','platinum-8','slimes','system7-nostalgia-silver'].includes(slug)){
          expect(versions[mode].pixels).toEqual(result.canvases.map(canvas=>({width:canvas.width,height:canvas.height,sha256:createHash('sha256').update(new Uint8Array(canvas.width*canvas.height*4)).digest('hex')})));
        }
        if (c.mode === 'declarative' && result.canvases.length === 0) {
          presentationStates[mode]=await activePage.evaluate(({root,controls})=>{
            const inspect=selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect(),s=getComputedStyle(el);return{rect:{x:r.x,y:r.y,width:r.width,height:r.height},active:document.activeElement===el,focusVisible:el.matches(':focus-visible'),hover:el.matches(':hover'),disabled:el.matches(':disabled'),style:Object.fromEntries(['appearance','backgroundColor','border','borderRadius','boxShadow','outline','outlineOffset','opacity','font','transform','zoom'].map(k=>[k,s[k]]))};};
            return{scroll:[scrollX,scrollY],devicePixelRatio,fonts:document.fonts.status,root:inspect(root),controls:controls.map(inspect)};
          },{root:result.outputSelector,controls:result.controls.map(c=>c.selector)});
          versions[mode].domPng = (await activePage.locator(result.outputSelector).screenshot({ animations: 'disabled', caret: 'hide' })).toString('base64');
        }
        if (['push', 'default', 'bevel'].includes(c.family) && c.labelKind !== 'empty' && result.status === 'rendered') {
          const key = `${mode}/${c.group}`;
          const geometry = result.canvases.map(({ width, height }) => ({ width, height }));
          if (groupSizes.has(key)) expect(geometry, `${c.group}: state changes preserve footprint`).toEqual(groupSizes.get(key));
          else groupSizes.set(key, geometry);
        }
      }
      if(versions.source.domPng!==versions.built.domPng)await testInfo.attach('dom-parity-presentation.json',{body:JSON.stringify({slug,case:c,presentationStates},null,2),contentType:'application/json'});
      expect(versions.built, `${c.id}: actual published entry preserves source pixels`).toEqual(versions.source);
      const { domPng, ...record } = versions.built;
      summary.push({ id: c.id, ...record, resolutionTraces, nativeScreenshotCompared: !!domPng });
    }
    // Keep a compact executed-case inventory even on success. It distinguishes
    // absent source art from an asserted fallback and exposes actual coverage.
    await attachObservations(testInfo, 'contracts', slug, { slug, profile, declaredRuntimeModes: ['source', 'built'], complete: true, cases: summary });
  } catch (error) {
    await attachObservations(testInfo, 'contracts', slug, { slug, profile, declaredRuntimeModes: ['source', 'built'], complete: false, cases: summary }).catch(() => {});
    await attachCase(activePage, testInfo, { slug, profile, mode, case: current, result, completed: summary }, error);
    throw error;
  } finally {
    for (const page of Object.values(pages)) await page.evaluate(() => window.controlMatrix?.dispose()).catch(() => {});
    await context.close();
  }
});
