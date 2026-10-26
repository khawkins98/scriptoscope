import assert from 'node:assert/strict';
import {createServer as createViteServer} from 'vite';
import {createServer as reservePort} from 'node:net';
import {fileURLToPath} from 'node:url';
import {test,expect,openHarness,attachObservations} from './fixtures.mjs';
import {formReview} from './controls459/form-review.mjs';
import {literalFormReview} from './controls459/form-literal.mjs';
for(const mode of ['source','built'])test(`${mode}: independent FORM semantics preserve each original default action and cleanup`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);
  const result=await formReview(page,mode);
  await attachObservations(info,'controls459-form',mode,{mode,result,claim:'Accepted independent literal HTML default actions; no native painter claim'});
  expect(result.failures).toEqual([]);
  expect(result.rows.filter(r=>r.key)).toHaveLength(16);
  expect(result.rows.filter(r=>r.direct)).toHaveLength(4);
});
test('built: literal HTML and generic baseline default actions remain independent controls',async({page,servers},info)=>{
  await openHarness(page,servers,'built');
  const rows=await literalFormReview(page);
  expect(rows).toHaveLength(10);
  await attachObservations(info,'controls459-form','literal',{mode:'built',rows});
});
test('source: process-only reverted neutral property fails named fallback form semantics after valid themed positives',async({page},info)=>{
  const root=fileURLToPath(new URL('../..',import.meta.url)).replace(/\/$/,'');
  const reservation=reservePort();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));
  const port=reservation.address().port;await new Promise((r,j)=>reservation.close(e=>e?j(e):r()));
  let transforms=0;
  const server=await createViteServer({root,configFile:false,publicDir:false,server:{host:'127.0.0.1',port,strictPort:true,open:false},plugins:[{name:'form-neutral-property-semantic-mutant',enforce:'pre',transform(code,id){if(id===root+'/src/interactive.ts'){assert.equal(code.split("el.type = 'button';").length,2);transforms++;return code.replace("el.type = 'button';", "el.type = painter ? 'button' : 'submit'; /* process-only reverted fallback neutrality */");}}}]});
  try{
    await server.listen();await openHarness(page,{source:`http://127.0.0.1:${port}`},'source');
    const result=await formReview(page,'source');
    await attachObservations(info,'controls459-form','mutant',{mode:'source',result,transforms});
    expect(transforms).toBe(1);
    expect(result.rows.filter(r=>r.key?.startsWith('source/windows-95/'))).toHaveLength(8);
    expect(result.failures.filter(r=>r.name.includes('windows-95'))).toEqual([]);
    expect(result.failures.filter(r=>/setup|page errors/i.test(r.name))).toEqual([]);
    const decisive=result.failures.find(r=>r.name==='source/system7-nostalgia-silver/button/enabled pointer original form semantics');
    expect(decisive).toBeDefined();expect(decisive.message).toMatch(/submit/);
    expect(result.failures.every(r=>r.name.includes('system7-nostalgia-silver'))).toBe(true);
  }finally{await server.close();}
});
