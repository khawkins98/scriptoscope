import {createHash} from 'node:crypto';
import {test,expect,openHarness,attachCase,attachObservations} from './fixtures.mjs';
import {grooveIcon,grooveInfo,grooveColors} from '../decoder-fixtures/slider-groove.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
// The owned groove fork on the v2 slider engine (docs/spec/engine/slider.md). The fork holds the active groove
// (-10131 / -10115, cicn + cinf) and optionally a requested-state groove (pressed +1, disabled/inactive -1).
// Gate (G1, §4.1): a non-directional slider (variation bit 3) draws when cinf base (-10144 / -10128) or
// base + 12 (-10132 / -10116) is found. Only the disabled/inactive requested groove sits at base + 12, so only
// those rows draw; every other row hands off (G2, #407 S1) and composeSlider returns null.
// Drawn rows: trackTier 0 (hilite 254/255, TR1) selects candidate gb + 0 = the requested groove (TR3), sliced with
// ITS cinf (TR6): k = 2, byte 2 = 0, so caps RG / YC 1:1 and the middle drawn as lines from source column k
// (SL3, SL4, BL4): 'RG' + 'B' × 28 + 'YC'. The 3-px art is centred in the 16-px band (SL1, rows 6..8). No thumb
// (TH2). Every other pixel of R is the erased background, white by default (BG6).
const requestedRun='RG'+'B'.repeat(28)+'YC';
for(const mode of ['source','built']) test(`${mode}: slider groove selection and metadata follow the CDEF 3 gate and track candidates`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let rows;
  try{
    rows=await page.evaluate(async mode=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const {grooveIcon,grooveInfo}=await import('/tests/decoder-fixtures/slider-groove.mjs');
      const rows=[];
      for(const orientation of ['horizontal','vertical'])for(const state of ['pressed','disabled','inactive','normal'])for(const present of state==='normal'?[false]:[false,true]){
        const vertical=orientation==='vertical',activeId=vertical?-10115:-10131;
        const requestedId=state==='normal'?activeId:state==='pressed'?activeId+1:activeId-1;
        const entries=[{type:'cicn',id:activeId,name:'active groove',data:grooveIcon(vertical)},{type:'cinf',id:activeId,data:grooveInfo()}];
        if(present)entries.push({type:'cicn',id:requestedId,name:'requested groove',data:grooveIcon(vertical)},{type:'cinf',id:requestedId,data:grooveInfo(true)});
        const theme=await api.loadKaleidoscopeScheme(forkOf(entries),{provenance:true});
        try{
          const options={orientation,state,length:32,value:0.5};const out=await api.composeSlider(theme,options);
          const requested=Object.entries(theme.manifest.chromeElements).filter(([,e])=>e.sourceCicnId===requestedId&&present);
          rows.push({orientation,state,present,requestedId,options,isNull:out===null,size:out?[out.width,out.height]:null,pixels:out?Array.from(out.data):null,
            requested,provenance:theme.byteProvenance});
        }finally{theme.dispose();}
      }
      return rows;
    },mode);
    expect(rows).toHaveLength(14);
    const draws=r=>r.present&&(r.state==='disabled'||r.state==='inactive');
    expect(rows.filter(r=>!r.isNull).map(r=>`${r.orientation}/${r.state}`)).toEqual(['horizontal/disabled','horizontal/inactive','vertical/disabled','vertical/inactive']);
    for(const row of rows){
      const vertical=row.orientation==='vertical';
      if(!draws(row)){expect(row.isNull,`${row.orientation}/${row.state}/present=${row.present}: G2 hand-off`).toBe(true);continue;}
      expect(row.size).toEqual(vertical?[16,32]:[32,16]);
      const white=[255,255,255,255];
      const expected=Array.from({length:32*16},(_,i)=>{
        const x=vertical?i%16:i%32,y=vertical?Math.floor(i/16):Math.floor(i/32),along=vertical?y:x,cross=vertical?x:y;
        return cross>=6&&cross<9?grooveColors[requestedRun[along]]:white;
      }).flat();
      expect(row.pixels,`${row.orientation}/${row.state}`).toEqual(expected);
      expect(row.requested).toHaveLength(1);
      const [key,e]=row.requested[0],ref=e.byteProvenance,p=row.provenance;
      expect(e.sourceCicnId).toBe(row.requestedId);expect(e.sourceCinfId).toBe(e.sourceCicnId);
      expect(e.slice).toMatchObject({corner:2,side:1,tile:false});
      expect(ref).toMatchObject({loadId:p.loadId,manifestKey:key,cicnResourceIndex:2,cinfResourceIndex:3});
      expect(p.resources[ref.cicnResourceIndex]).toMatchObject({type:'cicn',signedId:e.sourceCicnId,status:'decoded',byteLength:grooveIcon(vertical).length,sha256:sha(grooveIcon(vertical))});
      expect(p.resources[ref.cinfResourceIndex]).toMatchObject({type:'cinf',signedId:e.sourceCicnId,status:'decoded',byteLength:18,sha256:sha(grooveInfo(true))});
    }
  }catch(error){await attachCase(page,info,{mode,rows},error);throw error;}
  await attachObservations(info,'slider-selected-metadata',mode,{mode,rows,claim:'Owned groove fork: CDEF 3 gate (G1/G2) and track candidate selection (TR3/TR6, SL4/BL4) with the selected cinf; no native capture'});
});
