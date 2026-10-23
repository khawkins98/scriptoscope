// New regression trace families only. Selections independently transcribed from
// engine/{push-button,checkables}.md; traces are not native/source pixel proof.
import { createHash } from 'node:crypto';
import { readFileSync,existsSync } from 'node:fs';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import { detectContainer,unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { parseResourceFork } from '../../tools/theme-loader/resource-fork.js';
import { ICON_ROWS,selection,face,ring } from '../rendering-options/controls459-rules.mjs';
const hash=data=>createHash('sha256').update(data).digest('hex');
const pm=(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)});
const cache=new Map();
async function newArchive(slug) {
 if(!cache.has(slug))cache.set(slug,(async()=>{
  const path=['scheme.sit','scheme.rsrc'].map(f=>new URL(`../../themes/${slug}/${f}`,import.meta.url)).find(existsSync);
  const bytes=readFileSync(path),fork=detectContainer(bytes)==='stuffit'?(await stuffItResourceForkWithSelection(bytes)).bytes:unwrapToResourceFork(bytes);
  const raw=parseResourceFork(fork),pushIds=[-10240,-10239,-10238,-10232,-10231,-10230],checkIds=Array.from({length:24},(_,i)=>-9504+i);
  const decoded=await loadKaleidoscopeScheme(fork,{encodeAssets:false,engineCinfIds:[...pushIds,0,1],iconBlitCicnIds:[...pushIds,...checkIds],unmaskedIconIds:[...new Set(ICON_ROWS.flat())]});
  // Independently guard full bounds from the selected fork bytes. This Node
  // adapter must not inherit the public loader's missing-origin defect.
  for(const el of Object.values(decoded.manifest.chromeElements??{})) {
   const matches=raw.filter(r=>r.type==='cicn'&&r.id===el.sourceCicnId);
   if(matches.length===1&&matches[0].data.length>=10){const r=matches[0].data,v=new DataView(r.buffer,r.byteOffset,r.byteLength);el.boundsOrigin={top:v.getInt16(6),left:v.getInt16(8)};}
  }
  return decoded;
 })());return cache.get(slug);
}
export function archiveEntries(decoded) {
  const asset=path=>{const a=decoded.assets.find(a=>a.path===path||a.path===`icons/${path}`);return a?{width:a.width,height:a.height,data:new Uint8ClampedArray(a.rgba)}:null;};
  const entries=[];
  for(const el of Object.values(decoded.manifest.chromeElements??{})) {
    if(el.sourceCicnId==null||!el.asset)continue;
    const pixmap=asset(el.asset);if(!pixmap)throw Error(`missing ${el.asset}`);
    const samples=el.engineColorSamples;
    entries.push([`cicn:${el.sourceCicnId}`,{pixmap,pixelSize:el.iconBlit?.pixelSize??null,unmasked:asset(el.iconBlit?.unmaskedAsset),origin:el.boundsOrigin??null,
      sampling:el.samplingEquivalence?.status,sampled:asset(el.sampledBandAsset?.asset),sampleRgb16:p=>samples?.asset===el.asset?samples.points[`${p.x},${p.y}`]?.rgb16??null:null}]);
  }
  for(const [id,bytes] of Object.entries(decoded.manifest.engineCinfs??{}))entries.push([`cinf:${id}`,{bytes}]);
  for(const el of Object.values(decoded.manifest.patterns??{}))if(el.sourcePpatId!=null&&el.asset)entries.push([`ppat:${el.sourcePpatId}`,asset(el.asset)]);
  for(const [id,planes] of Object.entries(decoded.iconMaskPlanes??{}))entries.push([`ics#:${id}`,{planes}]);
  for(const el of decoded.iconIndex??[])if(el.type==='ics8'&&el.unmaskedFile)entries.push([`ics8:${el.id}`,asset(el.unmaskedFile)]);
  return entries;
}
export async function* pushCells({slug,decoded,mutate=x=>x}) {
  decoded=await newArchive(slug);
  const E=await import('../../src/engine/index.ts'),{realizeRgb16}=await import('../../tools/theme-loader/display-profile.js');
  const entries=mutate(archiveEntries(decoded),{family:'pushButton'}),chain=new E.ResourceChain([E.mapProvider(slug,'archive',entries)]);
  for(const hilite of [0,1,254,255])for(const [w,h] of [[9,7],[56,20],[97,29]])for(const def of [false,true]) {
    const input={rect:{left:4,top:4,right:4+w,bottom:4+h},hilite,depth:32,lowDepth:false,defaultDataValid:def,defaultFlag:def?1:0,label:'A\rB'};
    const trace=E.createTrace('pushButton',input),port=pm(w+8,h+8);
    E.drawPushButton(port,chain,input,{realize:rgb=>{const [r,g,b]=realizeRgb16(rgb,decoded.manifest.displayProfile);return{r,g,b,a:255};},fontMetrics:{ascent:7,descent:2,leading:1},textWidth:s=>s.length*5,drawLabel:()=>{}},trace);
    if(trace.resolved[0]?.id!==face(hilite))throw Error('PB selection not source rule');
    const requested=trace.resolved.filter(r=>r.type==='cicn'&&ring(hilite).includes(r.id));
    if(def&&!requested.length)throw Error('DR selection absent');
    yield{key:`h${hilite}/${w}x${h}/default${+def}`,trace:{...trace,pixels:hash(port.data)}};
  }
}
export async function* checkCells({slug,decoded,mutate=x=>x}) {
  decoded=await newArchive(slug);
  const E=await import('../../src/engine/index.ts'),entries=mutate(archiveEntries(decoded),{family:'checkables'});
  const chain=new E.ResourceChain([E.mapProvider(slug,'archive',entries)]);
  for(const variation of [1,2])for(const hilite of [0,1,254,255])for(const value of [0,1,2,3])for(const acidAlternate of [false,true])for(const [w,h] of [[9,7],[56,20]]) {
    const input={rect:{left:2,top:2,right:2+w,bottom:2+h},variation,hilite,value,acidAlternate,colorPort:true,lowDepth:false,colorIconMapAvailable:true};
    const trace=E.createTrace('checkables',input),port=pm(w+24,h+24);
    E.drawCheckable(port,chain,input,{systemResources:chain,monoColors:{foreground:{r:0,g:0,b:0,a:255},background:{r:255,g:255,b:255,a:255}}},trace);
    if(trace.resolved[0]?.id!==selection(input).cicns[0])throw Error('CB selection not source rule');
    yield{key:`v${variation}/h${hilite}/value${value}/alt${+acidAlternate}/${w}x${h}`,trace:{...trace,pixels:hash(port.data)}};
  }
}
