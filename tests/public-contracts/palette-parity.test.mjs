import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Independent format fixtures and scalar expectations. The designated modules
// are execution-only artifacts; this test does not read their implementation.
const directory = process.env.PALETTE_ARTIFACT_DIR ?? '/tmp/scriptoscope-palette-c20b18ac';
const identities = JSON.parse(process.env.PALETTE_ARTIFACT_IDENTITIES ?? JSON.stringify({
  baseline: 'b1d3677257fec2b9c300b1a82e90587d37dc35c982d2dc42cf2ec87eebb00697',
  'candidate-fixed': '1e1e616f9c4a432495898b8ab82c2412467ae19a54663295a23bacad17b74331',
}));
const modules = [];
assert.equal(Object.keys(identities).length,2);
for (const [name, expected] of Object.entries(identities)) {
  const path = `${directory}/${name}.mjs`;
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), expected, `${name} immutable identity`);
  modules.push(await import(pathToFileURL(path)));
}
const colors = [[0, 0x1234, 0x5678, 0x9abc], [1, 0xfedc, 0xba98, 0x7654], [2, 0x3456, 0x789a, 0xbcde]];
function fixture(kind, {depth=2,width=9,height=2,flags=0,entries=colors,values,maskWidth=width,maskHeight=height}={}) {
  values ??= Array.from({length:width*height}, (_,i)=>i%Math.min(3,2**depth));
  const stride=Math.ceil(width*depth/8)+2, maskStride=Math.ceil(maskWidth/8)+2;
  const maskSize=maskStride*maskHeight, rows=stride*height;
  const table=kind==='cicn'?82+maskSize:78+rows+11;
  const data=kind==='cicn'?table+8+entries.length*8:78;
  const bytes=new Uint8Array(Math.max(data+rows,table+8+entries.length*8));
  const view=new DataView(bytes.buffer), word=(o,n)=>view.setUint16(o,n);
  const map=kind==='cicn'?0:28;
  if(kind==='ppat'){word(0,1);view.setUint32(2,28);view.setUint32(6,78);view.setUint32(70,table);}
  word(map+4,0x8000|stride);word(map+10,height);word(map+12,width);
  word(map+32,depth);word(map+34,1);word(map+36,depth);
  if(kind==='cicn') {word(54,maskStride);word(60,maskHeight);word(62,maskWidth);
    for(let y=0;y<maskHeight;y++)for(let x=0;x<maskWidth;x++)if((x+y)%3!==1)bytes[82+y*maskStride+(x>>3)]|=128>>(x%8);
  }
  word(table+4,flags);word(table+6,entries.length-1);
  entries.forEach((entry,i)=>entry.forEach((n,j)=>word(table+8+i*8+j*2,n)));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const bit=x*depth;bytes[data+y*stride+(bit>>3)]|=values[y*width+x]<<(8-depth-bit%8);
  }
  for(let y=0;y<height;y++)bytes.fill(0xee,data+y*stride+Math.ceil(width*depth/8),data+(y+1)*stride);
  const expected=values.flatMap((value,i)=>{
    const color=(flags&0x8000)?entries[value]:entries.find(e=>e[0]===value);
    const x=i%width,y=Math.floor(i/width);
    const alpha=kind==='ppat'||x>=maskWidth||y>=maskHeight||((x+y)%3!==1)?255:0;
    return [...(color?color.slice(1).map(n=>n>>8):[0,0,0]),alpha];
  });
  return {bytes,expected};
}
function normalize(value){
  if(typeof value==='function')return '<function>';
  if(ArrayBuffer.isView(value))return [...value];
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalize(v)]));
  return value;
}
function observe(module,kind,bytes,scenario='plain'){
  const calls=[],sentinel={callbackFailure:true};let active=false,parsed;
  const decode=module[kind==='cicn'?'decodeCicn':'decodePpat'];
  const options={};
  if(scenario!=='plain')options.realizeRgb16=rgb=>{
    calls.push(['rgb', [...rgb]]);
    if(parsed&&calls.length===1){
      if(scenario==='midWidth')parsed.pmap.width=1;
      if(scenario==='midHeight')parsed.pmap.height=0;
      if(scenario==='midMask')parsed.maskAlpha[0]=0;
      if(scenario==='replaceMask')parsed.maskAlpha=new Uint8Array(parsed.maskAlpha.length);
      if(scenario==='midIndices')parsed.indices.fill(2);
    }
    if(parsed&&calls.length===2&&scenario==='laterMask')parsed.maskAlpha[0]=0;
    if(scenario==='throw')throw sentinel;
    if(scenario==='reentrant'&&!active){active=true;calls.push(['nested',normalize(decode(bytes.slice()))]);active=false;}
    if(scenario==='mutateRgb')rgb[0]=0xeeee;
    if(scenario==='mutateBytes')bytes.fill(0);
    return rgb.map(n=>n>>8);
  };
  if(scenario==='sampler')options.retainKdefColorSampler=true;
  if(['midWidth','midHeight','midMask','laterMask','replaceMask','midIndices'].includes(scenario))options.finiteTransfer=value=>{parsed=value;return null;};
  if(scenario.startsWith('width'))options.finiteTransfer=parsed=>{parsed.pmap.width=Number(scenario.slice(5));return null;};
  if(scenario.startsWith('height'))options.finiteTransfer=parsed=>{parsed.pmap.height=Number(scenario.slice(6));return null;};
  if(scenario==='indices')options.finiteTransfer=parsed=>{parsed.indices.fill(1);return null;};
  if(scenario==='transferThrow')options.finiteTransfer=()=>{throw sentinel;};
  if(scenario==='transfer')options.finiteTransfer=parsed=>{calls.push(['transfer',normalize(parsed)]);return {rgb:new Uint8Array(parsed.pmap.width*parsed.pmap.height*3).fill(89),provenance:{test:'literal'}};};
  try{
    const result=decode(bytes,options),samples=[];
    if(result?.sampleKdefRgb16)for(const [x,y] of [[0,0],[1,0],[8,1],[-1,0],[100,100]])samples.push(normalize(result.sampleKdefRgb16(x,y)));
    return {result:normalize(result),samples,calls};
  }catch(error){return {error:error===sentinel?'same-callback-value':{constructor:error.constructor.name,name:error.name,message:error.message,code:error.code},calls};}
}
function parity(kind,bytes,scenario){
  const observations=modules.map(module=>observe(module,kind,bytes.slice(),scenario));
  assert.deepEqual(observations[1],observations[0],`${kind}/${scenario}`);
  return observations[0];
}
for(const kind of ['cicn','ppat'])for(const depth of [1,2,4,8])test(`${kind} ${depth}bpp scalar palette/mask/padding and differential callbacks`,()=>{
  for(const flags of [0,0x8000,0x2000,0xa000,0x4000,0xc000])for(const entries of [colors,[colors[2],colors[0],colors[1]],[colors[0],colors[2]],[colors[0],colors[0],colors[1]]]){
    const {bytes,expected}=fixture(kind,{depth,flags,entries});
    const ordinary=parity(kind,bytes,'plain');
    assert.deepEqual(ordinary.result?.rgba??null,(flags&0x4000)?null:expected);
    for(const scenario of ['strict','throw','mutateRgb','mutateBytes','reentrant','sampler'])parity(kind,bytes,scenario);
    const padded=new Uint8Array(bytes.length+13);padded.set(bytes,7);
    assert.deepEqual(observe(modules[1],kind,padded.subarray(7,-6)),ordinary);
  }
});
for(const kind of ['cicn','ppat'])test(`${kind} each truncation and malformed header retains error order`,()=>{
  const {bytes}=fixture(kind);
  for(let length=0;length<bytes.length;length++)for(const scenario of ['plain','throw'])parity(kind,bytes.subarray(0,length),scenario);
  for(const offset of kind==='cicn'?[4,10,12,32,54,60,62]:[0,2,6,32,38,40,60,70])for(const value of [0,1,0x7fff,0xffff]){
    const changed=bytes.slice();new DataView(changed.buffer).setUint16(offset,value);parity(kind,changed,'throw');
  }
});
test('cicn independent mask overlap scalar expectations',()=>{
  for(const maskWidth of [1,8,12])for(const maskHeight of [1,2,3]){
    const {bytes,expected}=fixture('cicn',{maskWidth,maskHeight});assert.deepEqual(parity('cicn',bytes,'plain').result.rgba,expected);
  }
});
for(const scenario of ['indices','transfer','transferThrow','width0','width1','width2','width10','width0.5','width1.5','height0','height1','height3','height0.5','height1.5','midWidth','midHeight','midMask','laterMask','replaceMask','midIndices'])test(`cicn callback seam ${scenario}`,()=>{
  for(const maskWidth of [1,8,12])for(const maskHeight of [1,2,3])parity('cicn',fixture('cicn',{maskWidth,maskHeight}).bytes,scenario);
});
for(const kind of ['cicn','ppat'])test(`${kind} scalar strict missing-index rejection and lazy palette realization`,()=>{
  const {bytes}=fixture(kind,{entries:[colors[0],colors[2]]});
  for(const module of modules){
    const actual=observe(module,kind,bytes.slice(),'strict');
    assert.deepEqual(actual.error,{constructor:'DisplayProfileError',name:'DisplayProfileError',code:'UNSUPPORTED_SOURCE_COLOR',message:`Missing ${kind==='cicn'?'ordinary':'pattern'} palette index`});
    assert.deepEqual(actual.calls,[['rgb',colors[0].slice(1)]]);
    const unused=[200,0x5555,0x6666,0x7777];
    const lazy=observe(module,kind,fixture(kind,{entries:[...colors,unused]}).bytes,'strict');
    assert.equal(lazy.calls.some(([,rgb])=>JSON.stringify(rgb)===JSON.stringify(unused.slice(1))),false);
    assert.deepEqual(observe(module,kind,fixture(kind,{flags:0x4000}).bytes,'throw').calls,[]);
  }
});
test('original rejected candidate is a concrete dimension/interleaving negative control',async()=>{
  const path=`${directory}/candidate.mjs`;
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),'1557c9a2822e4c17019c85ef3f5bd2a8a8f5dd0985b37120272907f629216d5c');
  const rejected=await import(pathToFileURL(path));
  for(const scenario of ['width0','laterMask']){
    const {bytes}=fixture('cicn');
    assert.notDeepEqual(observe(rejected,'cicn',bytes.slice(),scenario),observe(modules[0],'cicn',bytes.slice(),scenario));
  }
});
test('negative controls detect pixel and callback drift',()=>{
  const {bytes}=fixture('cicn');
  const original=observe(modules[0],'cicn',bytes.slice(),'strict');
  const changed=structuredClone(original);changed.result.rgba[0]^=1;
  assert.throws(()=>assert.deepEqual(changed,original),assert.AssertionError);
  const missingCall=structuredClone(original);missingCall.calls.pop();
  assert.throws(()=>assert.deepEqual(missingCall,original),assert.AssertionError);
});
