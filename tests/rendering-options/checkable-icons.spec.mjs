import { createHash } from 'node:crypto';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';

// Pinned kDEF table18b88: normal/disabled off, checked, mixed. Pressed art is a distractor.
const ids = { checkbox: [[-10236,-10235,-10234],[-10240,-10239,-10238],[-10232,-10231,-10230]],
  radio: [[-10220,-10219,-10218],[-10224,-10223,-10222],[-10216,-10215,-10214]] };
const sha = bytes => createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
for (const mode of ['source','built']) test(`${mode}: checkable icon rows and mask-gated mixed retry`, async ({page,servers}, info) => {
  await openHarness(page,servers,mode); let rows;
  try {
    rows=await page.evaluate(async ({mode,ids})=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const rows=[];
      for(const kind of ['checkbox','radio']) for(const disabled of [false,true]) {
        const tier=Number(disabled), selected=ids[kind][tier];
        for(const scenario of ['off','checked','mixed','mixed-over-checked','missing-mask','short-mask','duplicate-mask','mask-without-color','depth8','manual','manual-active','missing-both','unknown-census','contradictory']) {
          if(scenario==='manual-active'&&!disabled) continue;
          const entries=[];
          ids[kind].flat().forEach((id,index)=>{
            // Literal black/white vertical stripe at a distinct x for each table cell.
            const data=new Uint8Array(128);
            for(let y=0;y<16;y++) data[y*8+(index>>1)] |= index%2?15:240;
            entries.push({type:'ics4',id,data});
            entries.push({type:'ics#',id,data:new Uint8Array(64).fill(255)});
          });
          const mixed=selected[2];
          if(['missing-mask','missing-both'].includes(scenario)) entries.splice(entries.findIndex(e=>e.id===mixed&&e.type==='ics#'),1);
          if(scenario==='short-mask') entries.find(e=>e.id===mixed&&e.type==='ics#').data=new Uint8Array(63).fill(255);
          if(scenario==='duplicate-mask') entries.push({type:'ics#',id:mixed,data:new Uint8Array(64).fill(255)});
          if(['mask-without-color','missing-both','manual-active'].includes(scenario)) entries.splice(entries.findIndex(e=>e.id===mixed&&e.type==='ics4'),1);
          if(scenario==='depth8') { const data=new Uint8Array(256);for(let y=0;y<16;y++)data[y*16+12]=255;entries.push({type:'ics8',id:mixed,data}); }
          const bytes=forkOf(entries), theme=await api.loadKaleidoscopeScheme(bytes);
          const originalInspector=theme.inspector;
          if(['manual','manual-active'].includes(scenario)) delete theme.inspector;
          if(scenario==='unknown-census') delete theme.inspector.iconMaskResources;
          if(scenario==='contradictory') theme.inspector={...theme.inspector,iconIndex:theme.inspector.iconIndex.map(e=>e.id===mixed?{...e,url:'wrong-url'}:e)};
          const calls=[],decode=HTMLImageElement.prototype.decode;
          HTMLImageElement.prototype.decode=function(){calls.push(this.src);return decode.call(this);};
          try {
            const options={label:'',disabled,checked:scenario==='checked'||scenario==='mixed-over-checked',mixed:!['off','checked'].includes(scenario)};
            const out=await api.composeCheckable(theme,kind,options);
            rows.push({kind,disabled,scenario,options,size:out?[out.width,out.height]:null,pixels:out?Array.from(out.data):null,calls,
              index:originalInspector.iconIndex,maskResources:originalInspector.iconMaskResources,selected:originalInspector.iconIndex.filter(e=>calls.includes(e.url)),
              resources:entries.map((e,i)=>({type:e.type,id:e.id,index:i,bytes:Array.from(e.data)})),fork:Array.from(bytes)});
          } finally {HTMLImageElement.prototype.decode=decode;theme.dispose();}
        }
      }
      return rows;
    },{mode,ids});
    for(const row of rows) {
      if(['short-mask','duplicate-mask','mask-without-color','unknown-census','contradictory'].includes(row.scenario)) {
        expect(row.size,row.scenario).toBeNull();expect(row.calls).toEqual([]);continue;
      }
      const value=row.scenario==='off'?0:['checked','missing-mask','missing-both'].includes(row.scenario)?1:2;
      const tier=row.scenario==='manual-active'?0:Number(row.disabled), id=ids[row.kind][tier][value];
      expect(row.size).toEqual([16,16]);expect(row.calls).toHaveLength(1);expect(row.selected).toHaveLength(1);
      const entry=row.selected[0],type=row.scenario==='depth8'?'ics8':'ics4';
      expect(entry).toMatchObject({id,type,size:16,depth:type==='ics8'?8:4,masked:true});
      const resource=row.resources[entry.resourceIndex];
      expect(resource).toMatchObject({id,type});
      const mask=row.maskResources.filter(r=>r.id===id);expect(mask).toHaveLength(1);
      expect(row.resources[mask[0].resourceIndex]).toMatchObject({id,type:'ics#'});expect(mask[0].byteLength).toBe(64);
      const x=row.scenario==='depth8'?12:tier*3+value;
      const expected=Array.from({length:256},(_,i)=>[...(i%16===x?[0,0,0]:[255,255,255]),255]).flat();
      expect(row.pixels,`${row.kind}/${row.disabled}/${row.scenario}`).toEqual(expected);
      row.inputSha256=sha(row.fork);row.selectedPayloadSha256=sha(resource.bytes);
    }
  } catch(error) {await attachCase(page,info,{mode,rows},error);throw error;}
  // Compact passing evidence retains exact input/payload identities, not repeated fork/pixel planes.
  await attachObservations(info,'checkable-icons',mode,{mode,rows:rows.map(({fork,resources,pixels,index,...r})=>({...r,pixelSha256:pixels?sha(pixels):null})),
    claim:'Owned same-fork mask census, selected decoded color occurrence and full literal output; no native depth/provider/placement claim'});
});
