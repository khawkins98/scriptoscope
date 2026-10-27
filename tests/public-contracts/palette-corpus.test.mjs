import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { enumerateForks, selectFork } from '../control-availability/source.mjs';
import { parseResourceFork } from '../../tools/theme-loader/resource-fork.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const directory=process.env.PALETTE_ARTIFACT_DIR??'/tmp/scriptoscope-palette-c20b18ac';
const identities=JSON.parse(process.env.PALETTE_ARTIFACT_IDENTITIES??JSON.stringify({baseline:'b1d3677257fec2b9c300b1a82e90587d37dc35c982d2dc42cf2ec87eebb00697','candidate-fixed':'1e1e616f9c4a432495898b8ab82c2412467ae19a54663295a23bacad17b74331'}));
assert.equal(Object.keys(identities).length,2);
const decoders=[];
for(const [name,expected]of Object.entries(identities)){
  const path=`${directory}/${name}.mjs`;
  assert.equal(hash(readFileSync(path)),expected);
  decoders.push(await import(pathToFileURL(path)));
}
function normalized(value){
  if(typeof value==='function')return '<function>';
  if(ArrayBuffer.isView(value))return {length:value.length,sha256:hash(value)};
  if(Array.isArray(value))return value.map(normalized);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,normalized(child)]));
  return value;
}
function observe(module,resource,options){
  try{return normalized(module[resource.type==='cicn'?'decodeCicn':'decodePpat'](resource.data.slice(),options));}
  catch(error){return {error:{name:error.name,constructor:error.constructor.name,message:error.message,code:error.code}};}
}
test('all 18 selected licensed forks retain every occurrence and all cicn/ppat planes',async()=>{
  const {sources}=JSON.parse(readFileSync(new URL('../control-availability/source-choices.json',import.meta.url)));
  const observations=[[],[]];let total=0,cicn=0,ppat=0;
  for(const choice of sources){
    const archive=readFileSync(new URL(`../../${choice.path}`,import.meta.url));
    const selected=selectFork(archive,await enumerateForks(archive,choice.format),choice);
    const resources=parseResourceFork(selected.bytes);
    for(let occurrence=0;occurrence<resources.length;occurrence++){
      const resource=resources[occurrence];total++;
      const identity={source:choice.slug,occurrence,type:resource.type,id:resource.id,name:resource.name,attributes:resource.attributes,payloadSha256:hash(resource.data)};
      const indexed=['cicn','ppat'].includes(resource.type);if(resource.type==='cicn')cicn++;if(resource.type==='ppat')ppat++;
      const pair=decoders.map(module=>({...identity,...(indexed?{ordinary:observe(module,resource,{}),strict:observe(module,resource,{realizeRgb16:rgb=>rgb.map(n=>n>>8)})}:{})}));
      assert.deepEqual(pair[1],pair[0],`${choice.slug}/${occurrence}/${resource.type}/${resource.id}`);
      pair.forEach((row,i)=>observations[i].push(row));
    }
  }
  // Isolated transient outputs retain every occurrence and normalized output;
  // the committed receipt needs only hashes/counts, never a duplicate corpus.
  for(const [i,name]of ['baseline','candidate'].entries())writeFileSync(`${directory}/independent-${name}-normalized.json`,JSON.stringify(observations[i]));
  assert.equal(cicn,3325);assert.equal(ppat,218);
  console.log(JSON.stringify({sources:sources.length,totalOccurrences:total,cicn,ppat,normalizedSha256:hash(JSON.stringify(observations[0]))}));
});
