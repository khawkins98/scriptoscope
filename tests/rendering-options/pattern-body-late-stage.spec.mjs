import {test,expect,openHarness,attachCase} from './fixtures.mjs';
import {observeLatePatternExecution} from './late-pattern-fixture.mjs';
const literal=['........................','..GGGGGGGGGGGGGGGGGGGG..','.GGGGGGGGGGGGGGGGGGGGGG.','.GGGGGGGGGGGGGGGGGGGGGG.','..GGGGGGGGGGGGGGGGGGGG..','........................'];
const expected=Array(32*14*4).fill(0);
for(let y=0;y<6;y++)for(let x=0;x<24;x++)if(literal[y][x]==='G')expected.splice(((y+4)*32+x+4)*4,4,17,101,203,255);
function verify(rows){
 expect(rows.map(r=>r.kind)).toEqual(['uninstrumented-positive','positive','malformed-ring','abort-after-pattern']);
 for(const row of rows){
  expect(row.callbacks).toBe(1);
  if(row.kind==='uninstrumented-positive'){expect(row.error).toBeUndefined();expect(row.output).toEqual({width:32,height:14,plane:expected});continue;}
  expect(row.trackedAllocations,'actual output allocation observation must reach').toBe(1);
  expect(row.writeCalls,'two literal inset rectangles include40 repeated writes').toBe(124);
  expect(row.writes,'actual complete distinct output writes before later decision').toBe(84);
  expect(row.writePlane,'independent full literal before late error or abort').toEqual(expected);
  const lastWrite=row.events.findIndex(e=>e.event==='actual-pattern-write'&&e.call===124),callback=row.events.findIndex(e=>e.event==='callback');expect(lastWrite).toBeGreaterThanOrEqual(0);expect(callback).toBeGreaterThan(lastWrite);
  if(row.kind==='positive'){
   expect(row.error).toBeUndefined();expect(row.output).toEqual({width:32,height:14,plane:expected});
   const body=row.trace.steps.filter(s=>s.bodyPaint);expect(body).toHaveLength(1);
   expect(body[0].resource).toMatchObject({type:'ppat',signedId:17,byteProvenance:{loadId:row.loadId}});
   expect(body[0].owner).toEqual({baseUrl:'owned-late-pattern',chainDepth:0});
   expect(body[0].bodyPaint).toMatchObject({branch:'pattern-fill-union',paintedPixels:84,sourceSize:[1,1],unionRects:[{x:1,y:2,w:22,h:2},{x:2,y:1,w:20,h:4}]});
  }else{
   expect(row.output).toBeNull();expect(row.error).toBeDefined();expect(row.trace.outcome.status).toBe('error');
   expect(row.trace.steps.some(s=>s.bodyPaint),'completed body must be withheld after actual writes').toBe(false);expect(row.trace.bandPaints??[]).toEqual([]);
   if(row.kind==='malformed-ring')expect(row.error.message).toMatch(/short|malformed/i);
   else{expect(row.error.name).toBe('AbortError');expect(row.lateStarts).toEqual([]);expect(row.events.some(e=>e.event==='abort-after-84-unique-written'&&e.writeCalls===124)).toBe(true);}
  }
 }
}
for(const mode of ['source','built'])test(`${mode}: actual pattern writes suppress staged completion on later ring failure and instrumented post-write abort`,async({page,servers},info)=>{
 await openHarness(page,servers,mode);let rows;
 try{
  rows=await observeLatePatternExecution(page,mode);
  await info.attach('executed-pattern-staging.json',{body:JSON.stringify({mode,rows,limits:'Output-array proxy and post-write abort are process-only test instrumentation; genuine malformed ring is later public failure. No original-device claim.'},null,2),contentType:'application/json'});
  verify(rows);
  const positive=rows.find(r=>r.kind==='positive'),payload=positive.trace.steps.find(s=>s.bodyPaint);
  for(const [name,mutate]of [['leaked completed body',r=>r[2].trace.steps.push(structuredClone(payload))],['wrong full body plane',r=>r[1].writePlane[0]=1],['missing actual writes',r=>r[2].writes=0],['wrong owner',r=>r[1].trace.steps.find(s=>s.bodyPaint).owner.chainDepth=1],['duplicate callback',r=>r[2].callbacks++],['late request after abort',r=>r[3].lateStarts.push('mutated-late-request')]]){
   const changed=structuredClone(rows);mutate(changed);expect(()=>verify(changed),name).toThrow();
  }
 }catch(error){await attachCase(page,info,{mode,rows,expected},error);throw error;}
});
