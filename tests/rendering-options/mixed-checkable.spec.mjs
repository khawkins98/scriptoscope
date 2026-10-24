import {checkablePresentation} from './checkable-presentation.mjs';
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
          {name:'modern-active-checked',mixed:true,disabled:true,keep:[0,2],expected:null},
          {name:'existing-disabled-off-fallback',disabled:true,keep:[0],expected:null},
        ];
        for(const c of cases){
          const theme=await api.loadKaleidoscopeScheme(forkOf(c.keep.map(i=>entries[i])),{provenance:true});
          const calls=[],decode=HTMLImageElement.prototype.decode;
          HTMLImageElement.prototype.decode=function(){calls.push(this.src);return decode.call(this);};
          try {
            const options={label:'',checked:!!c.checked,mixed:!!c.mixed,disabled:!!c.disabled};
            let trace;const out=await api.composeCheckable(theme,kind,{...options,onTrace:t=>trace=t});
            const selected=Object.entries(theme.manifest.chromeElements).filter(([,e])=>trace.resolved.some(r=>r.type==='cicn'&&r.found&&r.id===e.sourceCicnId));
            rows.push({kind,...c,options,trace,pixels:out?Array.from(out.data):null,size:out?[out.width,out.height]:null,calls,selected,provenance:theme.byteProvenance});
          }finally{HTMLImageElement.prototype.decode=decode;theme.dispose();}
        }
        // Icon mixed-mask miss retries checked at the same tier; CICN cases above stay unchanged.
        const glyphId=kind==='checkbox'?-10238:-10222,checkedId=kind==='checkbox'?-10239:-10223;
        for(const disabledArt of [true,false]){
          const id=disabledArt?glyphId:checkedId;
          const theme=await api.loadKaleidoscopeScheme(forkOf([{type:'ics4',id,data:new Uint8Array(128).fill(255)},{type:'ics#',id,data:new Uint8Array(64).fill(255)},{type:'ics8',id,data:new Uint8Array(256).fill(255)}]),{provenance:true});
          try{const out=await api.composeCheckable(theme,kind,{label:'',mixed:true,checked:true,disabled:true});rows.push({kind,name:'icons',disabledArt,pixels:Array.from(out.data),size:[out.width,out.height]});}finally{theme.dispose();}
        }
        const base=await api.loadKaleidoscopeScheme(forkOf(entries),{provenance:true});
        const child=await api.loadKaleidoscopeScheme(forkOf([{type:'cinf',id:0,data:new Uint8Array(18)}]),{provenance:true});
        child.base=base;
        base.baseUrl=`/owned-base-${kind}`;base.manifest.name=`owned-base-${kind}`;
        try{
          let trace;const out=await api.composeCheckable(child,kind,{label:'',mixed:true,onTrace:t=>trace=t});
          const entry=Object.values(base.manifest.chromeElements).find(e=>e.sourceCicnId===ids[kind][4]);
          rows.push({kind,name:'declared-base-chain',trace,pixels:[...out.data],size:[out.width,out.height],owner:{baseUrl:base.baseUrl,chainDepth:1},selected:entry,provenance:base.byteProvenance});
          const own=await api.loadKaleidoscopeScheme(forkOf([{type:'cicn',id:ids[kind][4],name:'child-mixed',data:entries[2].data}]),{provenance:true});own.base=base;own.manifest.name=`owned-child-${kind}`;
          try{let trace;const value=await api.composeCheckable(own,kind,{label:'',mixed:true,onTrace:t=>trace=t});rows.push({kind,name:'child-canonical-precedence',trace,pixels:[...value.data],size:[value.width,value.height],selected:own.manifest.chromeElements['child-mixed'],provenance:own.byteProvenance});}finally{own.dispose();}
        }finally{child.dispose();base.dispose();}
        // CB18 is a different boundary: ics8 is restricted to the selected mask
        // provider, even though canonical CICN requests use the declared chain.
        const maskId=kind==='checkbox'?-10234:-10218;
        const maskOwner=await api.loadKaleidoscopeScheme(forkOf([{type:'ics#',id:maskId,data:new Uint8Array(64).fill(255)}]),{provenance:true});
        const foreign=await api.loadKaleidoscopeScheme(forkOf([{type:'ics8',id:maskId,data:new Uint8Array(256).fill(0)}]),{provenance:true});maskOwner.base=foreign;
        try{let error,trace,out;try{out=await api.composeCheckable(maskOwner,kind,{label:'',mixed:true,onTrace:t=>trace=t});}catch(e){error={name:e.name,message:e.message};}rows.push({kind,name:'foreign-ics8-rejected',error,trace,value:out?Array.from(out.data):null,maskId});}finally{maskOwner.dispose();foreign.dispose();}
      }
      return rows;
    },{mode,ids,colors});
    verifyMixedRows(result,{presentation:checkablePresentation});
    for(const row of result){
      if(row.name==='icons'){expect(row.size).toEqual([16,20]);expect(row.pixels).toEqual(checkablePresentation({width:16,height:16,rgba:Array.from({length:256},()=>[0,0,0,255]).flat()},'icon').rgba);continue;}
      if(row.name==='declared-base-chain'||row.name==='child-canonical-precedence'){
        const base=row.name==='declared-base-chain',expected=checkablePresentation({width:1,height:1,rgba:base?colors[4]:colors[2]},'cicn');
        expect(row.size).toEqual([expected.width,expected.height]);expect(row.pixels).toEqual(expected.rgba);
        const resource=row.trace.resolved.find(r=>r.type==='cicn'&&r.found);expect(resource).toMatchObject({id:ids[row.kind][4],tier:base?'base':'archive',provider:base?`owned-base-${row.kind}#base1`:`owned-child-${row.kind}`});
        if(base)expect(row.owner).toEqual({baseUrl:`/owned-base-${row.kind}`,chainDepth:1});
        const ref=row.selected.byteProvenance,record=row.provenance.resources[ref.cicnResourceIndex];expect(ref.loadId).toBe(row.provenance.loadId);expect(record).toMatchObject({type:'cicn',signedId:ids[row.kind][4],sha256:createHash('sha256').update(payload(base?colors[4]:colors[2])).digest('hex')});continue;
      }
      if(row.name==='foreign-ics8-rejected'){expect(row.value).toBeNull();expect(row.error).toMatchObject({name:'Error',message:expect.stringMatching(/Unsupported checkable output:.*mapping unavailable/)});expect(row.trace.resolved.some(r=>r.type==='ics8'&&r.id===row.maskId&&r.found)).toBe(false);continue;}

      if(row.expected===null){expect(row.size,row.name).toBeNull();expect(row.pixels).toBeNull();expect(row.trace.resolved.some(r=>r.type==='cicn'&&r.found)).toBe(false);continue;}
      const plane=checkablePresentation({width:1,height:1,rgba:colors[row.expected]},'cicn');
      expect(row.size).toEqual([plane.width,plane.height]);expect(row.pixels).toEqual(plane.rgba);
      expect(row.selected).toHaveLength(1);expect(row.calls.length).toBeGreaterThan(0);
      const [key,e]=row.selected[0],ref=e.byteProvenance,resource=row.provenance.resources[ref.cicnResourceIndex];
      expect(e.sourceCicnId).toBe(ids[row.kind][row.expected]);
      expect(ref.loadId).toBe(row.provenance.loadId);expect(ref.manifestKey).toBe(key);
      expect(resource).toMatchObject({type:'cicn',signedId:ids[row.kind][row.expected],status:'decoded',byteLength:payload(colors[row.expected]).length});
      expect(resource.sha256).toBe(createHash('sha256').update(payload(colors[row.expected])).digest('hex'));
    }
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'mixed-checkable',mode,{mode,result,claim:'Literal owned state art and observed decode URL plus complete public output; no native provider or band-paint trace claim'});
});
