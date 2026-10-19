import { verifyMixedRows } from '../rendering-requirements/mixed-cases.mjs';
import { createHash } from 'node:crypto';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
import { onePixelCicn } from '../resource-provenance/fixtures.mjs';

// Literal state IDs and RGB endpoints: no runtime selector/decoder supplies expectations.
const colors = [[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,0,255],[255,0,255,255],[0,255,255,255]];
const ids = { checkbox: [-9503,-9504,-9500,-9501,-9497,-9498], radio: [-9491,-9492,-9488,-9489,-9485,-9486] };
const payload = color => { const bytes=onePixelCicn();const view=new DataView(bytes.buffer);color.slice(0,3).forEach((v,i)=>view.setUint16(94+2*i,v*257));return bytes; };
for (const mode of ['source','built']) test(`${mode}: mixed checkables select owned CICNs before checked fallback`, async ({page,servers}, info) => {
  test.info().annotations.push({type:'fidelity-assertion',description:'checkable.mixed-cicn-selection'});
  await openHarness(page,servers,mode); let result;
  try {
    result=await page.evaluate(async ({mode,ids,colors})=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const {forkOf,onePixelCicn}=await import('/tests/resource-provenance/fixtures.mjs');
      const rows=[];
      for(const kind of ['checkbox','radio']) {
        const entries=ids[kind].map((id,i)=>{const data=onePixelCicn(),v=new DataView(data.buffer);colors[i].slice(0,3).forEach((c,j)=>v.setUint16(94+2*j,c*257));return {type:'cicn',id,name:`state-${i}`,data};});
        const cases=[
          ...[false,true].flatMap(disabled=>[false,true].flatMap(checked=>[false,true].map(mixed=>({name:'all',disabled,checked,mixed,keep:[0,1,2,3,4,5],expected:mixed?4+Number(disabled):checked?2+Number(disabled):Number(disabled)})))),
          {name:'mixed-miss-checked-tier',mixed:true,disabled:true,keep:[0,1,2,3,4],expected:3},
          {name:'mixed-miss-checked-normal',mixed:true,keep:[0,1,2,3,5],expected:2},
          {name:'modern-active-checked',mixed:true,disabled:true,keep:[0,2],expected:2},
          {name:'existing-disabled-off-fallback',disabled:true,keep:[0],expected:0},
        ];
        for(const c of cases){
          const theme=await api.loadKaleidoscopeScheme(forkOf(c.keep.map(i=>entries[i])),{provenance:true});
          const calls=[],decode=HTMLImageElement.prototype.decode;
          HTMLImageElement.prototype.decode=function(){calls.push(this.src);return decode.call(this);};
          try {
            const options={label:'',checked:!!c.checked,mixed:!!c.mixed,disabled:!!c.disabled};
            const out=await api.composeCheckable(theme,kind,options);
            const selected=Object.entries(theme.manifest.chromeElements).filter(([,e])=>calls.includes(api.assetUrl(theme,e.asset)));
            rows.push({kind,...c,options,pixels:Array.from(out.data),size:[out.width,out.height],calls,selected,provenance:theme.byteProvenance});
          }finally{HTMLImageElement.prototype.decode=decode;theme.dispose();}
        }
        // Existing icon fallback stays mixed-first and self-only. Explicit mask avoids corner flood policy.
        const glyphId=kind==='checkbox'?-10238:-10222,activeId=kind==='checkbox'?-10230:-10214;
        for(const disabledArt of [true,false]){
          const id=disabledArt?glyphId:activeId;
          const theme=await api.loadKaleidoscopeScheme(forkOf([{type:'ics4',id,data:new Uint8Array(128).fill(255)},{type:'ics#',id,data:new Uint8Array(64).fill(255)}]),{provenance:true});
          try{const out=await api.composeCheckable(theme,kind,{label:'',mixed:true,checked:true,disabled:true});rows.push({kind,name:'icons',disabledArt,pixels:Array.from(out.data),size:[out.width,out.height]});}finally{theme.dispose();}
        }
        const base=await api.loadKaleidoscopeScheme(forkOf(entries),{provenance:true});
        const child=await api.loadKaleidoscopeScheme(forkOf([{type:'cinf',id:0,data:new Uint8Array(18)}]),{provenance:true});
        child.base=base;
        try{rows.push({kind,name:'no-base-borrow',value:await api.composeCheckable(child,kind,{label:'',mixed:true})});}finally{child.dispose();base.dispose();}
      }
      return rows;
    },{mode,ids,colors});
    verifyMixedRows(result);
    for(const row of result){
      if(row.name==='icons'){expect(row.size).toEqual([16,16]);expect(row.pixels).toEqual(Array.from({length:256},()=>[0,0,0,255]).flat());continue;}
      if(row.name==='no-base-borrow'){expect(row.value).toBeNull();continue;}
      expect(row.size).toEqual([1,1]);expect(row.pixels).toEqual(colors[row.expected]);
      expect(row.selected).toHaveLength(1);expect(row.calls).toHaveLength(1);
      const [key,e]=row.selected[0],ref=e.byteProvenance,resource=row.provenance.resources[ref.cicnResourceIndex];
      expect(e.sourceCicnId).toBe(ids[row.kind][row.expected]);
      expect(ref.loadId).toBe(row.provenance.loadId);expect(ref.manifestKey).toBe(key);
      expect(resource).toMatchObject({type:'cicn',signedId:ids[row.kind][row.expected],status:'decoded',byteLength:payload(colors[row.expected]).length});
      expect(resource.sha256).toBe(createHash('sha256').update(payload(colors[row.expected])).digest('hex'));
    }
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'mixed-checkable',mode,{mode,result,claim:'Literal owned state art and observed decode URL plus complete public output; no native provider or band-paint trace claim'});
});
