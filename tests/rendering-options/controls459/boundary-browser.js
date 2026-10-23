(async()=>{
 const mode=location.port==='63950'?'built':'source';
 const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
 const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
 const {solidBackgroundIcon,solidBackgroundInfo}=await import('/tests/decoder-fixtures/solid-background.mjs');
 // Body-only source: preserve the original PixMap, mask, palette and color
 // indices, insert a conventional seven-row mono plane before the ColorTable.
 const bodyIcon=()=>{const original=solidBackgroundIcon(),bytes=new Uint8Array(original.length+7);bytes.set(original.subarray(0,89));bytes.set(original.subarray(89),96);const v=new DataView(bytes.buffer);v.setUint16(68,1);v.setUint16(74,7);v.setUint16(76,7);return bytes;};
 const rows=[];
 const face={type:'cicn',id:-10239,name:'face',data:solidBackgroundIcon()};
 const good=solidBackgroundInfo(),short=new Uint8Array(17);
 for(const variant of ['valid','NULL','valid-fallback','short-selected-valid-fallback','base-fallback-valid','base-fallback-short','valid-selected-base-short','short-selected','short-fallback','valid-selected-short-fallback','duplicate-first-good','duplicate-first-short','ring-valid','ring-short','ring-fallback-short','pressed-ring-short','pressed-ring-NULL','body-mode5-valid','body-mode5-UNKNOWN','body-mode5-scaled-unsupported','body-mode5-NIL-mono']) {
  const records=[face];
  if(['valid','valid-selected-short-fallback','ring-valid','ring-short','ring-fallback-short','pressed-ring-short','pressed-ring-NULL'].includes(variant))records.push({type:'cinf',id:-10239,data:good});
  if(variant==='short-selected'||variant==='short-selected-valid-fallback')records.push({type:'cinf',id:-10239,data:short});
  if(variant==='valid-fallback'||variant==='short-selected-valid-fallback')records.push({type:'cinf',id:0,data:good});
  if(variant==='valid-selected-base-short')records.push({type:'cinf',id:-10239,data:good});
  if(['short-fallback','valid-selected-short-fallback'].includes(variant))records.push({type:'cinf',id:0,data:short});
  if(variant.startsWith('duplicate-'))for(const data of variant==='duplicate-first-good'?[good,short]:[short,good])records.push({type:'cinf',id:-10239,data});
  if(variant.startsWith('ring-')){records.push({type:'cicn',id:-10231,name:'ring',data:solidBackgroundIcon()});records.push({type:'cinf',id:variant==='ring-fallback-short'?1:-10231,data:variant==='ring-valid'?good:short});}
  if(variant.startsWith('pressed-ring-')){records.push({type:'cicn',id:-10238,name:'pressed',data:solidBackgroundIcon()},{type:'cinf',id:-10238,data:good},{type:'cicn',id:-10230,name:'pressed-ring',data:solidBackgroundIcon()},{type:'cicn',id:-10231,name:'normal-ring',data:solidBackgroundIcon()},{type:'cinf',id:-10231,data:good});if(variant==='pressed-ring-short')records.push({type:'cinf',id:-10230,data:short});}
  if(variant.startsWith('body-')){records.push({type:'cinf',id:-10239,data:solidBackgroundInfo({mode:5,resourceId:77})},{type:'cicn',id:77,name:'body',data:variant==='body-mode5-NIL-mono'?solidBackgroundIcon():bodyIcon()});if(variant.endsWith('UNKNOWN'))records.push({type:'cicn',id:77,name:'body-duplicate',data:bodyIcon()});}
  let theme,base,trace,result,error,bodySource;
  try{theme=await api.loadKaleidoscopeScheme(forkOf(records));if(variant==='body-mode5-valid'){const body=Object.values(theme.manifest.chromeElements).find(e=>e.sourceCicnId===77);const ordinary=await api.loadCicnBuffer(api.assetUrl(theme,body.asset)),opaque=await api.loadCicnBuffer(api.assetUrl(theme,body.iconBlit.unmaskedAsset));bodySource={ordinary:[...ordinary.data],opaque:[...opaque.data],bounds:body.cicnSource.bounds};}if(variant.includes('base-')){base=await api.loadKaleidoscopeScheme(forkOf([{type:'cinf',id:0,data:variant==='base-fallback-valid'?good:short}]));theme.base=base;}result=await api.composeButton(theme,{label:'',minWidth:variant.startsWith('body-')&&variant!=='body-mode5-scaled-unsupported'?9:29,height:9,default:variant.includes('ring-'),pressed:variant.startsWith('pressed-'),diagnostics:{onComplete:t=>trace=t}});}catch(e){error={name:e.name,message:e.message};}
  rows.push({mode,variant,bodySource,error,outcome:trace?.outcome,size:result?[result.width,result.height]:null,opaque:result?[...result.data].filter((v,i)=>i%4===3&&v).length:null,trace});theme?.dispose?.();base?.dispose?.();
 }
 return rows;
})()
