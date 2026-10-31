// Finite window ownership: no discovery or geometry observer. The public
// manager's change listener supplies post-commit geometry for these windows.
export function ownLayout(options,signal) {
 const key=options.persistKey&&`scriptoscope:layout:${options.persistKey}`;
 const records=new Map();
 const status={enabled:!!key,geometry:true,crossTabGeometry:true,compatible:true,unsupported:[]};
 let timer,applying=false;
 let latest=Promise.resolve();
 function parse(raw) {
  try {const value=JSON.parse(raw);return value?.version===1&&value.windows&&typeof value.windows==='object'?value:null;}
  catch {return null;}
 }
 let initial=null;
 // Saved OUTER widths awaiting their window: the attributes can only declare content.
 const pendingOuter=new Map();
 try { initial=key?parse(localStorage.getItem(key)):null; } catch(error) { status.enabled=false; console.error('Consumer layout read failed',error); }
 function initialAttrs(source,index) {
  const id=source.dataset.scriptoscopeWindowId||String(index);
  const state=initial?.windows[id];
  if(!state)return ()=>{};
  if(Number.isFinite(state.ow)&&Number.isFinite(state.w))pendingOuter.set(id,state.ow);
  const before=new Map();
  for(const [field,attr]of [['x','x'],['y','y'],['w','width'],['h','height'],['z','z'],['collapsed','collapsed']]){
   if(state[field]===undefined)continue;
   const name=`data-scriptoscope-${attr}`;before.set(name,source.getAttribute(name));
   if(field==='collapsed'){if(state[field])source.setAttribute(name,'');else source.removeAttribute(name);}
   else if(Number.isFinite(state[field]))source.setAttribute(name,String(state[field]));
  }
  return ()=>{for(const [name,value]of before)if(value===null)source.removeAttribute(name);else source.setAttribute(name,value);};
 }
 // A window's committed position: absolute left/top, or none while it is in flow.
 function placed(host) {
  return getComputedStyle(host).position==='absolute'?{x:parseFloat(host.style.left),y:parseFloat(host.style.top)}:null;
 }
 // The title-bar drag and the grow box capture the pointer, and the drag's hot loop writes
 // left/top without a commit. A write that lands mid-drag (the activation render schedules one)
 // would save that uncommitted position, and a cancelled drag (#563) commits nothing to replace
 // it, so it stayed persisted and reached other tabs (#581). While a window holds a capture,
 // snapshots use the position it had when the capture began; the capture's end, by release,
 // cancel or loss, schedules a write of whatever the window then has. The capture begins on
 // pointerdown, before any move, so that position is the pre-drag one.
 // Holds are keyed by pointerId and released by one document listener: when the capturing
 // element is removed (a collapse drops the grow box mid-drag, a scrollbar goes away while its
 // thumb is pressed), lostpointercapture goes to the document, not through the host, so a
 // host-only listener would leave the window held at a stale position for good.
 const held=new Map();
 document.addEventListener('lostpointercapture',e=>{
  for(const [host,h]of held){
   if(!h.ids.delete(e.pointerId))continue;
   if(!h.ids.size)held.delete(host);
   schedule();
  }
 },{capture:true,signal});
 // One window's saved row, taken from the live window. Undefined fields are dropped by JSON.
 function rowOf({win,manager}) {
  const state=manager.describe(win.host);if(!state)return null;
  // ow: the OUTER width (content + this theme's frame). Another tab may use a
  // thicker scheme, so it restores the footprint its container bounds, not the
  // content width, and the content height, which flow and scrolling absorb (#542).
  const ext=manager.chromeExtent(win.host);
  const r={w:state.width,h:state.height,ow:ext&&state.width+ext.x,collapsed:state.collapsed,z:state.z};
  const at=held.has(win.host)?held.get(win.host).at:placed(win.host);
  if(at){r.x=at.x;r.y=at.y;}
  return r;
 }
 function snapshot() {
  const windows={};
  for(const [id,record]of records){const r=rowOf(record);if(r)windows[id]=r;}
  return {version:1,windows};
 }
 // Each tab both writes the layout and applies the other tabs' writes. Writing a whole local
 // snapshot echoed state this tab never changed: a write scheduled before a remote update was
 // applied (or by the mount's first render) carried the older rows and overwrote the other tab's
 // newer ones, which then moved its windows back (#584). A write now replaces only the rows of
 // windows that changed here since they were last in sync with storage, keeps every other stored
 // row, and is skipped when nothing differs. `synced` holds each window's local row at its last
 // sync: the stored row it mounted from, its last write, or the result of applying a remote row.
 // Seeded from the layout the page loaded: a window not changed here or re-synced since then
 // has that row, so a write for another window keeps a newer stored row for it instead of saving
 // the loaded one over it while the other tab's update is still in flight.
 const synced=new Map();
 if(initial)for(const [id,r]of Object.entries(initial.windows))synced.set(id,JSON.stringify(r));
 function write() {
  clearTimeout(timer);timer=undefined;
  // Known limit: localStorage has no transactions, so two tabs that flush changes to different
  // windows within a few milliseconds can both read the same value and one change is lost. Main's
  // whole-snapshot writes lost more; accepted for the demo (#584).
  try{
   const raw=localStorage.getItem(key);
   const windows={...parse(raw)?.windows};
   for(const [id,record]of records){
    const r=rowOf(record);if(!r)continue;
    const json=JSON.stringify(r);
    if(json===synced.get(id)&&windows[id])continue;
    windows[id]=r;synced.set(id,json);
   }
   const value=JSON.stringify({version:1,windows});
   if(value!==raw)localStorage.setItem(key,value);
  }catch(error){console.error('Consumer layout write failed',error);}
 }
 // Writes are debounced, so a reload or navigation inside the 250 ms window would drop the
 // last commit and keep an older snapshot, such as one taken mid-drag from the hot loop's
 // left/top (#578). pagehide flushes the pending write before the page goes away, and so does
 // the page becoming hidden: mobile browsers can discard a background tab without pagehide (#581).
 function schedule() {
  if(!key||applying||signal.aborted)return;
  clearTimeout(timer);timer=setTimeout(write,250);
 }
 const flush=()=>{if(timer!==undefined&&!signal.aborted)write();};
 if(key){
  addEventListener('pagehide',flush,{signal});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();},{signal});
 }
 function add(source,index,win,manager) {
  const id=source.dataset.scriptoscopeWindowId||String(index);
  records.set(id,{win,manager});
  const host=win.host;
  // The capture is taken by trackDrag in src/interactive.ts; its comment points back here.
  host.addEventListener('gotpointercapture',e=>{const h=held.get(host);if(h)h.ids.add(e.pointerId);else held.set(host,{at:placed(host),ids:new Set([e.pointerId])});},{signal});
  manager.setChangeListener(schedule);
  // A reload declares the saved CONTENT width, which carries the saving scheme's frame
  // difference into a different scheme. Re-bound it to the saved OUTER width, as the
  // cross-tab restore does (#542, #558); on the same scheme this is a no-op size.
  const ow=pendingOuter.get(id);pendingOuter.delete(id);
  if(ow!==undefined)latest=latest.catch(()=>{}).then(()=>signal.aborted?undefined:manager.setOuterSize(win.host,{width:ow})).catch(error=>console.error('Consumer layout restore failed',error));
  // Another tab's write that landed while this page was loading reached no window (update()
  // applies only added ones), so apply the stored row now if it moved on from the mounted one (#584).
  let stored;
  try{stored=key&&parse(localStorage.getItem(key))?.windows[id];}catch{}
  if(stored&&JSON.stringify(stored)!==JSON.stringify(initial?.windows[id]))latest=latest.catch(()=>{}).then(()=>update({windows:{[id]:stored}})).catch(error=>console.error('Consumer layout restore failed',error));
 }
 async function update(value) {
  if(!value||signal.aborted)return;
  applying=true;
  try {
   for(const [id,{win,manager}]of records){
    const row=value.windows[id];if(!row||signal.aborted)continue;
    if(Number.isFinite(row.x)&&Number.isFinite(row.y))manager.setPosition(win.host,row.x,row.y);
    const state={};
    const outer=Number.isFinite(row.ow);
    for(const [input,output]of [['w','width'],['h','height'],['z','z']])if(Number.isFinite(row[input])&&!(outer&&input==='w'))state[output]=row[input];
    if(typeof row.collapsed==='boolean')state.collapsed=row.collapsed;
    await manager.applyState(win.host,state,signal);
    if(outer&&!signal.aborted)await manager.setOuterSize(win.host,{width:row.ow});
    // Persisted dimensions are an explicit user size, so content-fit must not
    // later grow them back when a collapsed window becomes visible.
    if (Number.isFinite(row.w)||Number.isFinite(row.h)) {
      const committed=manager.describe(win.host);
      if(committed?.width!==undefined&&committed.height!==undefined)win.acceptUserSize(committed.width,committed.height);
    }
    // The window now matches storage: a later write keeps this stored row unless it changes here.
    const applied=rowOf({win,manager});if(applied)synced.set(id,JSON.stringify(applied));
   }
  } finally {applying=false;}
 }
 if(key)addEventListener('storage',event=>{if(event.key===key)latest=latest.catch(()=>{}).then(()=>update(parse(event.newValue))).catch(error=>console.error('Consumer layout restore failed',error));},{signal});
 signal.addEventListener('abort',()=>{clearTimeout(timer);for(const {manager}of records.values())manager.setChangeListener(undefined);records.clear();},{once:true});
 return {initialAttrs,add,snapshot,status};
}
