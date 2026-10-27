import { ownLayout } from './explicit-layout.mjs';
import { WindowManager, bindButtonToContentPort } from 'scriptoscope';
import { ScriptoscopeWindow, createOwnedThemeResolver, promoteGuardedButton, restoreButton, disposePromotedButtonFace,
  promoteGuardedControl, restoreControl, promoteField, restoreField, promoteTabs, restoreTabs, promoteIconAsync, promoteThemePicker,
  syncThemePickerActive, openModal } from '../src/declarative/index.ts';

export class PagePromotionError extends Error {
  constructor(message, failures, options) {
    super(message, options); this.name='PagePromotionError'; this.failures=failures;
  }
}
const mountedSources = new WeakMap();
function nativeShape(source) {
  const rect=source.getBoundingClientRect(), style=getComputedStyle(source);
  return [rect.width,rect.height,source.scrollWidth,source.scrollHeight,
    style.font,style.lineHeight,style.letterSpacing,style.whiteSpace].join('|');
}

// Consumer-owned showcase orchestration. All source elements are captured before
// window promotion detaches them; later application additions call attach explicitly.
export async function mountExplicitPage(opts) {
  opts = {themes:[], pageThemeDefault:'1138', ...opts};
  const root = opts.root instanceof Element ? opts.root : document.body;
  const mountingViewport=innerWidth;
  const events = new EventTarget();
  const resolver = createOwnedThemeResolver(opts);
  // Application-owned decoded themes are borrowed before the initial paint.
  for (const [ref, theme] of opts.registeredThemes ?? []) resolver.register(ref, theme);
  const manager = new WindowManager();
  const life = new AbortController();
  const layout = ownLayout(opts,life.signal);
  const windows = new Map();
  const selected = opts.sources ?? selectPageSources(root);
  const buttons = new Set(selected.buttons);
  const controls = new Set(selected.controls);
  const fields = [...selected.fields];
  const tabs = [...selected.tabs];
  const switchers = [...selected.switchers];
  const icons = new Map([...selected.icons].map(el =>
    [el, { nodes:[...el.childNodes], attrs:new Map([...el.attributes].map(a=>[a.name,a.value])), owned:new Map() }]));
  const sources = [...selected.windows];
  const pickerEl = selected.picker;
  const pickerNodes = new Set();
  const bindings = new Map();
  const buttonFaces = new Map();
  const pendingFaces = new Map();
  const committedFaces = new Map();
  const ownership = new Map([...buttons,...controls].map(el => [el,new AbortController()]));
  const modals = new Set();
  const cascade = new Map();
  let picker;
  let disposed = false;
  let epoch = 0;
  let attempt;
  let ref;
  let timer;
  let barrier = Promise.resolve();
  const stats = {windows:0,buttons:0,controls:0,tabs:0,fields:0};
  const promoted = new Map();
  const bootAnimations = new Set();
  let successes=0;
  const failures = [];
  function success(kind,el,host=el) {
    if (promoted.get(el)===kind) return;
    promoted.set(el,kind);successes++;
    if (kind in stats) stats[kind]++;
    mark(kind.replace(/s$/,''),host);
    if (kind==='windows' && opts.bootAffordance!=='none' && opts.bootAffordance!==false &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const animation=host.animate([{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0)'}],
        {duration:180,easing:'steps(8,end)'});
      bootAnimations.add(animation);
      void animation.finished.catch(()=>{}).finally(()=>bootAnimations.delete(animation));
    }
  }
  const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type,{detail}));
  const fixedRefs = new Map();
  for (const el of [...sources,...buttons,...controls,...fields,...tabs,...icons.keys()]) {
    const ancestor = el.closest('[data-scriptoscope-theme]');
    if (ancestor?.dataset.scriptoscopeTheme) fixedRefs.set(el,ancestor.dataset.scriptoscopeTheme);
  }
  const targetTheme = (el, fallback) => fixedRefs.has(el) ? resolver.load(fixedRefs.get(el)) : Promise.resolve(fallback);
  const current = token => !disposed && token === epoch;
  const url = new URL(location.href);
  const deep = opts.themes.some(t => t.slug === url.searchParams.get(opts.syncToUrlParam));
  const initial = deep ? url.searchParams.get(opts.syncToUrlParam) : opts.pageThemeDefault;
  if (opts.bootAffordance!=='none' && opts.bootAffordance!==false) root.setAttribute('data-scriptoscope-loading','');
  const wasInert = root.inert;
  root.inert = true;
  let ownedInert = root.inert;
  function restoreInert() {
    if (root.inert === ownedInert) root.inert = wasInert;
    ownedInert = wasInert;
  }
  const mark = (kind, host) => host.dispatchEvent(new CustomEvent('scriptoscope:promoted',
    {bubbles:true,detail:{kind,host}}));
  function fail(kind, el, cause) {
    const detail = {kind,el,cause};
    failures.push(detail);
    emit('promoteError',detail);
    el.dispatchEvent(new CustomEvent('scriptoscope:promoteError',{bubbles:true,detail}));
    if (opts.onPromoteError?.(detail) !== false) console.error('Explicit showcase promotion',detail);
  }
  async function bind(button, face) {
    const win = [...windows.values()].find(w => w.host.contains(face));
    if (!win || !face.querySelector('canvas')) return;
    const port = win.consumerManager.contentPort(win.host);
    if (port) {
      const binding = bindButtonToContentPort(face,port);
      bindings.set(button,binding);
      await binding.refresh();
    }
  }
  const owned = (el, owner) => !disposed && !!owner && owner === ownership.get(el) && !owner.signal.aborted && root.contains(el);
  async function paintOne(el, theme, signal, token, button) {
    const owner = ownership.get(el);
    if (!owner || !owned(el,owner) || !current(token)) return;
    theme = await targetTheme(el,theme);
    if (!owned(el,owner) || !current(token)) return;
    const preparation = new AbortController();
    pendingFaces.set(el,preparation);
    const lifetime = AbortSignal.any([preparation.signal,owner.signal,life.signal]);
    try {
      if (button) {
        const previous = buttonFaces.get(el);
        const focused = previous && (document.activeElement === previous || previous.contains(document.activeElement));
        const face = await promoteGuardedButton(el,theme,lifetime,()=>owned(el,owner) && current(token) && pendingFaces.get(el)===preparation);
        if (!face || !owned(el,owner)) return;
        const previousBinding=bindings.get(el);
        bindings.delete(el);
        const released=previousBinding?.dispose();
        buttonFaces.set(el,face);
        if (focused) face.focus({preventScroll:true});
        if (previous && previous !== face) disposePromotedButtonFace(el,previous);
        committedFaces.get(el)?.abort();
        committedFaces.set(el,preparation);
        pendingFaces.delete(el);
        await released;
        if (owned(el,owner) && buttonFaces.get(el)===face) await bind(el,face);
        if (current(token) && owned(el,owner)) success('buttons',el,face);
      } else {
        const face = await promoteGuardedControl(el,theme,lifetime,()=>owned(el,owner) && current(token) && pendingFaces.get(el)===preparation);
        if (!face || !owned(el,owner)) return;
        committedFaces.get(el)?.abort();
        committedFaces.set(el,preparation);
        pendingFaces.delete(el);
        if(current(token))success('controls',el);
      }
    } finally {
      if (pendingFaces.get(el)===preparation) pendingFaces.delete(el);
      if (committedFaces.get(el)!==preparation) preparation.abort();
    }
  }

  async function paintTargets(theme, signal, token) {
    for (const button of buttons) {
      try { await paintOne(button,theme,signal,token,true); } catch(error) { if(current(token)) fail('button',button,error); }
    }
    for (const control of controls) {
      try { await paintOne(control,theme,signal,token,false); } catch(error) { if(current(token)) fail('control',control,error); }
    }
    for (const el of fields) {
      try { const selectedTheme=await targetTheme(el,theme); if (current(token) && root.contains(el)) { promoteField(el,selectedTheme); success('fields',el); } }
      catch(error) { if(current(token)) fail('field',el,error); }
    }
    for (const el of tabs) {
      try { if (current(token) && root.contains(el)) { await promoteTabs(el,await targetTheme(el,theme),{forceRescan:true,signal:AbortSignal.any([signal,life.signal])}); if(current(token)) success('tabs',el); } }
      catch(error) { if(current(token)) fail('tabs',el,error); }
    }
    for (const el of icons.keys()) {
      if (!current(token)) return;
      try { if (root.contains(el)) {
        await promoteIconAsync(el,await targetTheme(el,theme),signal,() => current(token) && root.contains(el));
        if(current(token)) {
          const original=icons.get(el);
          for(const attr of [...el.attributes])if(original.attrs.get(attr.name)!==attr.value)original.owned.set(attr.name,attr.value);
          for(const name of original.attrs.keys())if(!el.hasAttribute(name))original.owned.set(name,null);
          success('icons',el);
        }
      } }
      catch(error) { if(current(token)) fail('icon',el,error); }
    }
  }
  function syncUrl(next) {
    if (!opts.syncToUrlParam) return;
    const value = new URL(location.href);
    value.searchParams.set(opts.syncToUrlParam,next);
    history.replaceState(history.state,'',value);
  }
  async function retheme(next) {
    if (disposed) return;
    const token = ++epoch;
    attempt?.abort();
    for (const pending of pendingFaces.values()) pending.abort();
    pendingFaces.clear();
    // Guards invalidate pending source paints. Committed faces keep their own
    // lifetime until successful replacement, explicit detach or disconnect.
    attempt = new AbortController();
    const signal = attempt.signal;
    const previous = barrier;
    const loading = resolver.load(next);
    void loading.catch(()=>{});
    const cancelled = new Promise(resolve => signal.addEventListener('abort',()=>resolve(undefined),{once:true}));
    const operation = (async () => {
      await previous.catch(()=>{});
      if (!current(token)) return;
      const theme = await Promise.race([loading,cancelled]);
      if (!current(token)) return;
      await manager.retheme(theme,signal,next);
      if (!current(token)) return;
      await paintTargets(theme,signal,token);
      if (!current(token)) return;
      for (const win of windows.values()) await win.consumerManager.refreshScrollbars(win.host);
      if (!current(token)) return;
      ref = next;
      if (pickerEl) syncThemePickerActive(pickerEl,next);
      syncUrl(next);
      emit('retheme',{ref:next});
    })();
    barrier = operation;
    try { await operation; }
    catch (error) { if (current(token)) throw error; }
  }
  function prepareCascade() {
    for (const container of root.querySelectorAll('[data-scriptoscope-cascade]')) {
      cascade.set(container,{height:container.style.minHeight,position:container.style.position});
      const children = [...windows].filter(([,win]) => container.contains(win.host));
      const stepX = Number(container.dataset.scriptoscopeCascadeStepX ?? 32);
      const stepY = Number(container.dataset.scriptoscopeCascadeStepY ?? 28);
      const baseX = Number(container.dataset.scriptoscopeCascadeBaseX ?? 0);
      const baseY = Number(container.dataset.scriptoscopeCascadeBaseY ?? 0);
      container.style.position = 'relative';
      let tallest = 0;
      let lastY = 0;
      children.forEach(([source,win],i) => {
        if (source.hasAttribute('data-scriptoscope-x') || source.hasAttribute('data-scriptoscope-y')) return;
        const x=baseX+i*stepX, y=baseY+i*stepY;
        tallest = Math.max(tallest,win.host.getBoundingClientRect().height);
        lastY = Math.max(lastY,y);
        win.consumerManager.setPosition(win.host,x,y);
      });
      container.style.minHeight = `${tallest+lastY+8}px`;
      Object.assign(cascade.get(container),{ownedHeight:container.style.minHeight,ownedPosition:container.style.position});
    }
  }
  function inheritedRef(el) {
    for(let ancestor=el;ancestor;ancestor=ancestor.parentElement) {
      const ownedWindow=[...windows].find(([,win])=>win.host===ancestor);
      if(ownedWindow) { if(fixedRefs.has(ownedWindow[0]))return fixedRefs.get(ownedWindow[0]); }
      else if(ancestor.dataset.scriptoscopeTheme)return ancestor.dataset.scriptoscopeTheme;
      if(ancestor===root)break;
    }
  }
  async function attach({buttons:addedButtons=[],controls:addedControls=[]}) {
    const batch = [];
    for (const [els,target,button] of [[addedButtons,buttons,true],[addedControls,controls,false]]) {
      for (const el of els) {
        if (disposed || !root.contains(el) || (!button&&el.dataset.scriptoscopeControl==='off')) continue;
        if (target.has(el) && owned(el,ownership.get(el))) continue;
        const inherited=inheritedRef(el);
        if(inherited)fixedRefs.set(el,inherited);else fixedRefs.delete(el);
        ownership.get(el)?.abort();
        const owner = new AbortController();
        ownership.set(el,owner); target.add(el); batch.push({el,owner,button});
      }
    }
    const previous = barrier;
    const requestedEpoch=epoch;
    const operation = (async () => {
      await previous.catch(()=>{});
      if (requestedEpoch!==epoch) return;
      if (disposed || !batch.some(({el,owner})=>owned(el,owner))) return;
      const token=epoch;
      const theme=await resolver.load(ref);
      for (const {el,owner,button} of batch) {
        if (owned(el,owner)) {
          try { await paintOne(el,theme,attempt.signal,token,button); }
          catch(cause) { if(current(token))fail(button?'button':'control',el,cause); }
        }
      }
      if (current(token)) for (const win of windows.values()) await win.consumerManager.refreshScrollbars(win.host);
    })();
    barrier=operation;
    await operation;
    if (barrier!==operation) await barrier;
  }

  function detach({buttons:removedButtons=[],controls:removedControls=[]}) {
    for (const [els,target,button] of [[removedButtons,buttons,true],[removedControls,controls,false]]) {
      for (const el of els) {
        ownership.get(el)?.abort(); ownership.delete(el); target.delete(el);
        pendingFaces.get(el)?.abort(); pendingFaces.delete(el);
        committedFaces.get(el)?.abort(); committedFaces.delete(el);
        if (button) { void bindings.get(el)?.dispose(); bindings.delete(el); buttonFaces.delete(el); restoreButton(el); }
        else restoreControl(el);
      }
    }
  }
  function disconnect() {
    if (disposed) return;
    disposed = true;
    const reusable=[];
    for(const [source,win] of windows) {
      const state=win.consumerManager.describe(win.host);
      if(state)reusable.push([source,{viewport:mountingViewport,height:state.height,theme:fixedRefs.get(source)??ref}]);
    }
    ++epoch;
    attempt?.abort();
    life.abort();
    for (const owner of ownership.values()) owner.abort();
    ownership.clear();
    for(const pending of pendingFaces.values())pending.abort();
    pendingFaces.clear();
    for(const committed of committedFaces.values())committed.abort();
    committedFaces.clear();
    clearInterval(timer);
    for(const animation of bootAnimations)animation.cancel();
    bootAnimations.clear();
    for (const modal of modals) modal.close();
    picker?.teardown();
    for (const node of pickerNodes) node.remove();
    pickerNodes.clear();
    for (const binding of bindings.values()) void binding.dispose();
    bindings.clear();
    const focus = [...buttons].filter(el => restoreButton(el));
    buttonFaces.clear();
    for (const el of fields) restoreField(el);
    for (const el of tabs) restoreTabs(el);
    for (const el of controls) restoreControl(el);
    for (const win of [...windows.values()].reverse()) win.restoreOriginalElement();
    windows.clear();
    for (const [el,original] of icons) {
      el.replaceChildren(...original.nodes);
      for (const [name,ownedValue] of original.owned) {
        if(el.getAttribute(name)!==ownedValue)continue;
        const value=original.attrs.get(name);
        if(value===undefined)el.removeAttribute(name);else el.setAttribute(name,value);
      }
    }
    for (const [el,original] of cascade) {
      if(el.style.minHeight===original.ownedHeight)el.style.minHeight=original.height;
      if(el.style.position===original.ownedPosition)el.style.position=original.position;
    }
    resolver.dispose();
    root.classList.remove('scriptoscope-ready');
    root.removeAttribute('data-scriptoscope-loading');
    restoreInert();
    // Sample only at this explicit teardown boundary. Any later natural size
    // or font change invalidates same-width reuse; no content observer is used.
    for(const [source,record] of reusable)mountedSources.set(source,{...record,shape:nativeShape(source)});
    focus.find(el => el.isConnected)?.focus({preventScroll:true});
    emit('unmounted');
  }
  try {
    await resolver.preloadFonts();
    const hasTargets = sources.length+buttons.size+controls.size+fields.length+tabs.length+icons.size;
    const theme = hasTargets ? await resolver.load(initial) : undefined;
    if (disposed) throw new Error('Disconnected during load');
    attempt = new AbortController();
    const token = ++epoch;
    const nativeShapes=new Map(sources.map(source=>[source,nativeShape(source)]));
    for (const source of sources) {
      try {
        const windowTheme = await targetTheme(source,theme);
        const windowManager = fixedRefs.has(source) ? new WindowManager() : manager;
        const restoreLayoutAttrs=layout.initialAttrs(source,sources.indexOf(source));
        const explicitHeight=source.getAttribute('data-scriptoscope-height');
        const previous=mountedSources.get(source);
        const useMeasurement=opts.measureReusedSources && previous?.viewport===innerWidth &&
          previous.theme===(fixedRefs.get(source)??initial) && previous.shape===nativeShapes.get(source) &&
          Number.isFinite(previous.height) && explicitHeight===null;
        if (useMeasurement) source.dataset.scriptoscopeHeight=String(previous.height);
        let win;
        try { win=await ScriptoscopeWindow.promote(source,{manager:windowManager,theme:windowTheme,signal:life.signal}); }
        finally { if (useMeasurement) source.removeAttribute('data-scriptoscope-height'); restoreLayoutAttrs(); }
        win.consumerManager=windowManager;
        windows.set(source,win);
        layout.add(source,sources.indexOf(source),win,windowManager);
        win.host.setAttribute('data-scriptoscope-theme',fixedRefs.get(source) ?? initial);
        success('windows',source,win.host);
      } catch (cause) { fail('window',source,cause); }
    }
    prepareCascade();
    if (hasTargets) await paintTargets(theme,attempt.signal,token);
    ref=initial;
    if (pickerEl) {
      const before=new Set(pickerEl.childNodes);
      const promotion=promoteThemePicker(pickerEl,opts.themes,{
        loadTheme:slug => resolver.load(slug),switchTheme:retheme,initialSlug:initial
      });
      for(const node of pickerEl.childNodes)if(!before.has(node))pickerNodes.add(node);
      picker = await promotion;
    }
    for (const win of windows.values()) await win.consumerManager.refreshScrollbars(win.host);
    if (opts.rejectOnEmptyMount && hasTargets && !successes) throw new PagePromotionError('No selected source could be promoted', failures); 
    restoreInert();
    root.removeAttribute('data-scriptoscope-loading');
    root.classList.add('scriptoscope-ready');
    syncUrl(initial);
    const stopCycle = () => clearInterval(timer);
    for (const type of ['pointerdown','keydown','wheel']) root.addEventListener(type,stopCycle,
      {once:true,passive:true,signal:life.signal});
    if (opts.autoCycle && opts.themes.length && !deep && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timer=setInterval(() => {
        const index=opts.themes.findIndex(t => t.slug === ref);
        void retheme(opts.themes[(index+1)%opts.themes.length].slug).catch(console.error);
      },opts.autoCycle);
    }
    for (const switcher of switchers) {
      switcher.addEventListener('change',()=>void retheme(switcher.value).catch(error=>fail('control',switcher,error)),{signal:life.signal});
    }
    setTimeout(()=>{if(!disposed)emit('ready',{stats});},0);
  } catch (error) {
    disconnect();
    throw error instanceof PagePromotionError ? error : new PagePromotionError('Page boot failed',failures,{cause:error});
  }
  const handle=Object.assign(events,{
    registerTheme:(key,theme) => resolver.register(key,theme),
    retheme,disconnect,stats,attach,detach,
    persistenceStatus:layout.status,
    failures,
    whenReady:()=>barrier,
    openModal(wrap,options) { const modal=openModal(wrap,options); modals.add(modal); return modal; },
  });
  return Object.defineProperty(handle,'activeRef',{get:()=>ref});
}

export const mountShowcase=opts=>mountExplicitPage({...opts,measureReusedSources:true});


// Capture once at an application-controlled mount boundary. New DOM is opt-in via attach.
export function selectPageSources(root) {
  const all = selector => [...root.querySelectorAll(selector)];
  return {
    windows:all('[data-scriptoscope-window],.scriptoscope-window-fallback'),
    buttons:all('[data-scriptoscope-button],.scriptoscope-button-fallback'),
    controls:all('input[type=range],input[type=checkbox],input[type=radio],select').filter(el=>el.dataset.scriptoscopeControl!=='off'),
    fields:all('[data-scriptoscope-field]'), tabs:all('[data-scriptoscope-tabs]'),
    icons:all('[data-scriptoscope-icon]'), switchers:all('[data-scriptoscope-theme-switcher]'),
    picker:root.querySelector('[data-scriptoscope-theme-picker]'),
  };
}
