import {createHash} from 'node:crypto';
import {test,expect,openHarness,attachCase,attachObservations} from './fixtures.mjs';
import {grooveIcon,grooveInfo,grooveColors,activeGrooveRow,requestedGrooveRow} from '../decoder-fixtures/slider-groove.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const mode of ['source','built']) test(`${mode}: slider fallback keeps selected groove metadata`,async({page,servers},info)=>{
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
        const calls=[],decode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=function(){calls.push(this.src);return decode.call(this);};
        try{
          const options={orientation,state,length:32,value:0.5};const out=await api.composeSlider(theme,options);
          rows.push({orientation,state,present,requestedId,options,size:[out.width,out.height],pixels:Array.from(out.data),calls,
            selected:Object.entries(theme.manifest.chromeElements).filter(([,e])=>calls.includes(api.assetUrl(theme,e.asset))),provenance:theme.byteProvenance});
        }finally{HTMLImageElement.prototype.decode=decode;theme.dispose();}
      }
      return rows;
    },mode);
    expect(rows).toHaveLength(14);
    for(const row of rows){
      const vertical=row.orientation==='vertical',run=row.present?requestedGrooveRow:activeGrooveRow;
      expect(run.length).toBe(32);expect(row.size).toEqual(vertical?[3,32]:[32,3]);
      const expected=Array.from({length:96},(_,i)=>grooveColors[run[vertical?Math.floor(i/3):i%32]]).flat();
      expect(row.pixels,`${row.orientation}/${row.state}/present=${row.present}`).toEqual(expected);
      expect(row.calls).toHaveLength(1);expect(row.selected).toHaveLength(1);
      const [key,e]=row.selected[0],ref=e.byteProvenance,p=row.provenance;
      expect(e.sourceCicnId).toBe(row.present?row.requestedId:vertical?-10115:-10131);expect(e.sourceCinfId).toBe(e.sourceCicnId);
      expect(e.slice).toMatchObject({corner:row.present?2:1,side:1,tile:!row.present});
      expect(ref).toMatchObject({loadId:p.loadId,manifestKey:key,cicnResourceIndex:row.present?2:0,cinfResourceIndex:row.present?3:1});
      expect(p.resources[ref.cicnResourceIndex]).toMatchObject({type:'cicn',signedId:e.sourceCicnId,status:'decoded',byteLength:grooveIcon(vertical).length,sha256:sha(grooveIcon(vertical))});
      expect(p.resources[ref.cinfResourceIndex]).toMatchObject({type:'cinf',signedId:e.sourceCicnId,status:'decoded',byteLength:18,sha256:sha(grooveInfo(row.present))});
    }
  }catch(error){await attachCase(page,info,{mode,rows},error);throw error;}
  await attachObservations(info,'slider-selected-metadata',mode,{mode,rows,claim:'Owned selected-art/metadata consistency under current self-only fallback and slicing policy; no native fallback or endpoint claim'});
});
