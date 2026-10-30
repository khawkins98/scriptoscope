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
 try { initial=key?parse(localStorage.getItem(key)):null; } catch(error) { status.enabled=false; console.error('Consumer layout read failed',error); }
 function initialAttrs(source,index) {
  const id=source.dataset.scriptoscopeWindowId||String(index);
  const state=initial?.windows[id];
  if(!state)return ()=>{};
  const before=new Map();
  for(const [field,attr]of [['x','x'],['y','y'],['w','width'],['h','height'],['z','z'],['collapsed','collapsed']]){
   if(state[field]===undefined)continue;
   const name=`data-scriptoscope-${attr}`;before.set(name,source.getAttribute(name));
   if(field==='collapsed'){if(state[field])source.setAttribute(name,'');else source.removeAttribute(name);}
   else if(Number.isFinite(state[field]))source.setAttribute(name,String(state[field]));
  }
  return ()=>{for(const [name,value]of before)if(value===null)source.removeAttribute(name);else source.setAttribute(name,value);};
 }
 function snapshot() {
  const windows={};
  for(const [id,{win,manager}]of records){
   const state=manager.describe(win.host);if(!state)continue;
   // ow: the OUTER width (content + this theme's frame). Another tab may use a
   // thicker scheme, so it restores the footprint its container bounds, not the
   // content width, and the content height, which flow and scrolling absorb (#542).
   const ext=manager.chromeExtent(win.host);
   const row={w:state.width,h:state.height,ow:ext&&state.width+ext.x,collapsed:state.collapsed,z:state.z};
   if(getComputedStyle(win.host).position==='absolute'){row.x=parseFloat(win.host.style.left);row.y=parseFloat(win.host.style.top);}
   windows[id]=row;
  }
  return {version:1,windows};
 }
 function schedule() {
  if(!key||applying||signal.aborted)return;
  clearTimeout(timer);timer=setTimeout(()=>{try{localStorage.setItem(key,JSON.stringify(snapshot()));}catch(error){console.error('Consumer layout write failed',error);}},250);
 }
 function add(source,index,win,manager) {
  records.set(source.dataset.scriptoscopeWindowId||String(index),{win,manager});
  manager.setChangeListener(schedule);
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
   }
  } finally {applying=false;}
 }
 if(key)addEventListener('storage',event=>{if(event.key===key)latest=latest.catch(()=>{}).then(()=>update(parse(event.newValue))).catch(error=>console.error('Consumer layout restore failed',error));},{signal});
 signal.addEventListener('abort',()=>{clearTimeout(timer);for(const {manager}of records.values())manager.setChangeListener(undefined);records.clear();},{once:true});
 return {initialAttrs,add,snapshot,status};
}
