import '../helpers/registerTs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from './controls459-rules.mjs';
const { drawPushButton, pushLabelLines, pushButtonTextMode } = await import('../../src/engine/families/pushButton.ts');
const { drawCheckable, checkableLabelLines } = await import('../../src/engine/families/checkables.ts');
const { drawCinfFrame } = await import('../../src/engine/qd/cinfFrame.ts');
const { ResourceChain, mapProvider } = await import('../../src/engine/resources/chain.ts');
const { createTrace } = await import('../../src/engine/trace.ts');
const pm=(w=64,h=40,c=[91,92,93,255])=>({width:w,height:h,data:new Uint8ClampedArray(Array.from({length:w*h},()=>c).flat())});
const chain=(entries=[])=>new ResourceChain([mapProvider('own','archive',entries)]);
const D={left:7,top:8,right:47,bottom:29};
const meta={cornerSize:1,sideThickness:1,tileSides:1,patternAnchor:0,bgPatternId:33,bgPixel:{x:0,y:0},textPixel:{x:1,y:0},embossPixel:{x:2,y:0}};
const art=(bg=[256,256,256],em=[257,257,257])=>({pixmap:pm(5,5),pixelSize:8,unmasked:null,origin:{left:0,top:0},sampling:'equivalent',sampleRgb16:p=>p.x===0?bg:p.x===1?[900,1000,1100]:em});
const pinput=extra=>({rect:D,hilite:0,depth:32,lowDepth:false,...extra});
const cinput=extra=>({rect:D,variation:1,hilite:0,value:0,acidAlternate:false,colorPort:true,lowDepth:false,colorIconMapAvailable:true,...extra});
const realize=rgb=>({r:rgb[0]>>8,g:rgb[1]>>8,b:rgb[2]>>8,a:255});
const metrics={ascent:7,descent:2,leading:1};
const monoColors={foreground:{r:1,g:2,b:3,a:255},background:{r:4,g:5,b:6,a:255}};
const req=t=>t.resolved.map(r=>[r.type,r.id]);
const mask=all=>({planes:[...Array(32).fill(255),...Array(32).fill(all?255:128)]});
function push(extra={},entries=[],env={}) { const t=createTrace('push-button'),out=pm(); const result=drawPushButton(out,chain(entries),pinput(extra),{realize,...env},t);return {t,out,result}; }
function check(extra={},entries=[],system=[],env={}) {const t=createTrace('checkables'),out=pm(); const result=drawCheckable(out,chain(entries),cinput(extra),{systemResources:chain(system),monoColors,...env},t);return {t,out,result};}

test('guards: PB1 PB2 CB1 CB2 suppress callback/resource stages; recorder exact shape',()=>{
  let p=0,c=0;
  for(const visible of [false,true]) {
    const a=push({visible,regionRecording:true},[],{frameRoundRect:(r,w,h)=>{p++;assert.deepEqual([r,w,h],[D,8,8]);}});
    const b=check({visible,regionRecording:true},[],[],{frameRect:r=>{c++;assert.deepEqual(r,D);}});
    assert.deepEqual(req(a.t),[]);assert.deepEqual(req(b.t),[]);
  }
  assert.deepEqual([p,c],[1,1]);
});
test('push-state: PB3–PB7 DR2–DR4 literal states and typed NULL transcripts',()=>{
  for(const hilite of [0,1,2,253,254,255]) {
    const {t}=push({hilite,defaultDataValid:true,defaultFlag:9});
    assert.deepEqual(req(t),[['cicn',R.face(hilite)],...R.ring(hilite).map(id=>['cicn',id])]);
    const state=t.drawOps.find(o=>o.op==='state');
    assert.deepEqual([state.disabled,state.pressed],[R.disabled(hilite),!R.disabled(hilite)&&!!hilite]);
  }
});
test('ring-gate: DR1 requires valid identity AND nonzero flag',()=>{
  for(const valid of [false,true]) for(const flag of [0,1,-1]) {
    const {result,t}=push({defaultDataValid:valid,defaultFlag:flag});
    assert.equal(result.ringAttempted,valid&&!!flag);assert.equal(t.resolved.length,valid&&flag?2:1);
  }
});
test('push-null: PB8 PB9 missing art has no cinf; found art retries only metadata zero',()=>{
  const id=-10239;
  for(const entries of [[],[[`cicn:${id}`,art()]],[[`cicn:${id}`,art()],['cinf:0',meta]]]) {
    const {t,result}=push({},entries);
    assert.deepEqual(req(t),entries.length===0?[['cicn',id]]:entries.length===1?[['cicn',id],['cinf',id],['cinf',0]]:[['cicn',id],['cinf',id],['cinf',0],['ppat',33]]);
    assert.equal(result.faceFound,entries.length>0);
  }
});
test('ring-retry: DR3 DR6 metadata-only miss suppresses normal-art retry; art NULL allows exactly one',()=>{
  for(const present of [false,true]) {
    const {t,result}=push({hilite:1,defaultDataValid:true,defaultFlag:1},present?[['cicn:-10230',art()]]:[]);
    assert.deepEqual(req(t),present?[['cicn',-10238],['cicn',-10230],['cinf',-10230],['cinf',1]]:[['cicn',-10238],['cicn',-10230],['cicn',-10231]]);
    assert.equal(result.ringFound,present);
  }
});
test('raw-colour: PB10 PB12 PB13 compare RGB16 equality/sentinel before display, including display collision',()=>{
  for(const [bg,em,point] of [[[256,256,256],[257,257,257],{x:2,y:0}],[[256,256,256],[256,256,256],{x:2,y:0}],[[0,0,0],[0x1234,65535,0],{x:2,y:0}],[[0,0,0],[999,2,3],{x:0,y:0}]]) {
    const calls=[];push({label:'a'},[['cicn:-10239',art(bg,em)],['cinf:-10239',{...meta,embossPixel:point}]],{fontMetrics:metrics,textWidth:()=>3,drawLabel:p=>calls.push(p)});
    assert.deepEqual(calls.map(p=>p.offset.x),R.emboss(bg,em,point)?[1,0]:[0]);
  }
});
test('text-mode: PB11 depth boundary and unsupported low-depth pixels remain explicit',()=>{
  for(const h of [0,1,254,255]) for(const depth of [1,2,3,4,8,32]) assert.equal(pushButtonTextMode(h,depth),R.disabled(h)&&depth<4?49:1);
  const {t,result}=push({hilite:255,lowDepth:true,depth:2});assert.match(result.unsupported,/low-depth/);assert.deepEqual(req(t),[]);
});
test('paint-order: PB12 DR5 face before emboss/text before ring, outset four, body false never samples',()=>{
  let samples=0;const ringArt=art();ringArt.sampleRgb16=()=>{samples++;assert.fail('ring sampled');};
  const calls=[];const {t}=push({label:'a',defaultDataValid:true,defaultFlag:1},[['cicn:-10239',art()],['cinf:-10239',meta],['cicn:-10231',ringArt],['cinf:-10231',meta]],{fontMetrics:metrics,textWidth:()=>3,drawLabel:p=>calls.push(p)});
  assert.equal(samples,0);assert.deepEqual(calls.map(p=>p.offset.x),[1,0]);assert.ok(calls.every(p=>JSON.stringify(p.clip)===JSON.stringify(D)));
  assert.deepEqual(t.rects.ringRect,{left:3,top:4,right:51,bottom:33});
  const labels=t.drawOps.map((o,i)=>o.op==='label'?i:-1).filter(i=>i>=0);
  assert.ok(t.drawOps.slice(0,labels[0]).some(o=>o.piece));assert.ok(t.drawOps.slice(labels.at(-1)+1).some(o=>o.row==='B0'));assert.equal(t.resolved.filter(r=>r.type==='ppat').length,1);
});
test('check-state: CB3–CB6 CB8 CB10 CB13 all variations/states/values/alternate and six literal icon rows',()=>{
  for(const variation of [1,2,3,4,9,10]) for(const hilite of [0,1,253,254,255]) for(const value of [0,1,2,3]) for(const acidAlternate of [false,true]) {
    const input={variation,hilite,value,acidAlternate},e=R.selection(input),{t}=check(input);
    const expected=[...e.cicns.map(id=>['cicn',id]),...e.icons.map(id=>['ics#',id])];
    // A successful special-value probe would repeat; all NULL takes checked once.
    assert.deepEqual(req(t),expected,JSON.stringify(input));
  }
});
test('check-retry: CB9 CB12 CB14 CB15 original value re-read, mixed success requests mask twice, no unchecked/normal retries',()=>{
  for(const hilite of [0,1,254,255]) for(const value of [2,3]) {
    const input={hilite,value},s=R.selection(cinput(input));
    for(const hit of [0,1]) {
      const {t}=check(input,[],[[`ics#:${s.icons[hit]}`,mask(false)]]);
      assert.deepEqual(req(t),[...s.cicns.map(id=>['cicn',id]),['ics#',s.icons[0]],['ics#',s.icons[hit]],['ics8',s.icons[hit]]]);
    }
  }
});
test('check-null: CB16 unknown is not NULL and never authorizes retry',()=>{
  for(const type of ['cicn','ics#','ics8']) {
    const entries=type==='cicn'?[['cicn:-9497',{status:'unknown',reason:'independent poison'}]]:[];
    const system=type==='ics#'?[['ics#:-10234',{status:'unknown',reason:'independent poison'}]]:[['ics#:-10234',mask(false)],['ics8:-10234',{status:'unknown',reason:'independent poison'}]];
    const {t,result}=check({value:2},entries,system);assert.match(result.unsupported,/independent poison/);
    assert.equal(req(t).some(([ty,id])=>ty==='ics#'&&id===-10235),false);
  }
});
test('mask-owner: CB18 CB19 missing colour stays mono, same owner only, never ics4 substitution',()=>{
  const systemResources=new ResourceChain([mapProvider('mask','archive',[['ics#:-10236',mask(false)],['ics4:-10236',pm(16,16)]]),mapProvider('wrong-owner','base',[['ics8:-10236',pm(16,16)]])]);
  const {t,result}=check({},[],[],{systemResources});assert.equal(result.drawn,true);assert.deepEqual(req(t),[['cicn',-9503],['ics#',-10236],['ics8',-10236]]);assert.equal(t.resolved.at(-1).found,false);assert.equal(t.drawOps.find(o=>o.transfer)?.transfer,'copyMask');
});
test('icon-transfer: CB17 CB19–CB23 all-set/partial, low-depth/color-port/map, picture vs custom, opaque hidden source pixel',()=>{
  for(const color of [false,true]) for(const allSet of [false,true]) for(const recordingPicture of [false,true]) for(const customBottlenecks of [false,true]) {
    const {t,out}=check({recordingPicture,customBottlenecks},[],[['ics#:-10236',mask(allSet)],...(color?[['ics8:-10236',pm(16,16,[200,201,202,255])]]:[])]);
    const expected=R.iconTransfer({color,allSet,recordingPicture,customBottlenecks});assert.equal(t.drawOps.find(o=>o.transfer)?.transfer,expected);
    // x=8 is a clear mask bit in partial masks; y=12 is the icon's first row.
    assert.equal(out.data[(12*out.width+8)*4],expected==='copyBits'?(color?200:1):91);
  }
  for(const lowDepth of [false,true]) for(const colorPort of [false,true]) {
    const {t}=check({lowDepth,colorPort},[],[['ics#:-10236',mask(false)],['ics8:-10236',pm(16,16)]]);
    assert.equal(t.resolved.some(r=>r.type==='ics8'),colorPort&&!lowDepth);
  }
  const {t}=check({colorIconMapAvailable:false},[],[['ics#:-10236',mask(false)],['ics8:-10236',pm(16,16)]]);assert.ok(t.drawOps.some(o=>o.row==='CB19'));
});
test('icon-geometry: CB24 floor negative odd y, erase 16×12 before 16×16 full-source draw',()=>{
  for(const [top,bottom] of [[-7,2],[8,29],[0,0]]) {
    const r={...D,top,bottom},events=[],{t}=check({rect:r},[],[['ics#:-10236',mask(false)]],{erase:r=>events.push(r)});
    const y=Math.floor((top+bottom-12)/2);assert.deepEqual(events,[{left:7,top:y,right:23,bottom:y+12}]);assert.deepEqual(t.drawOps.find(o=>o.transfer).dst,{left:7,top:y,right:23,bottom:y+16});
  }
});
test('source-bounds: CB11 logical positive/negative origins share storage adapter and mask-clear erasure',()=>{
  for(const origin of [{left:9,top:7},{left:-9,top:-7}]) {
    const icon=art();icon.origin=origin;icon.pixmap=pm(3,5,[9,8,7,255]);icon.pixmap.data[3]=0;
    const events=[],out=pm(),t=createTrace('checkables');
    const result=drawCheckable(out,chain([['cicn:-9503',icon]]),cinput({eraseControl:true,label:'a'}),{systemResources:chain(),fontMetrics:metrics,drawLabel:()=>events.push('label'),erase:(r,m)=>{events.push(m?'mask':'control');if(m){assert.deepEqual(m.storageOrigin,{x:origin.left,y:origin.top});assert.equal(m.source.data[3],0);for(let y=0;y<m.source.height;y++)for(let x=0;x<m.source.width;x++)if(!m.source.data[(y*m.source.width+x)*4+3])out.data[((r.top+y)*out.width+r.left+x)*4+3]=0;}}},t);
    assert.equal(result.drawn,true);assert.deepEqual(events,['control','label','mask']);
    const op=t.drawOps.find(o=>o.operation==='cornerFullBounds');assert.deepEqual(op.src,{...origin,right:origin.left+3,bottom:origin.top+5});assert.deepEqual(op.storageRect,{left:0,top:0,right:3,bottom:5});assert.deepEqual(op.dst,{left:14,top:16,right:17,bottom:21});assert.equal(out.data[(16*out.width+14)*4+3],0,'clear source mask erases prior backing');assert.equal(out.data[(16*out.width+15)*4],9);
  }
});
test('label metrics: odd/negative geometry, short-height 12/13 boundary, empty/interior/final CR explicitly separated',()=>{
  for(const r of [D,{left:-12,top:-7,right:5,bottom:8}]) for(const m of [metrics,{ascent:9,descent:3,leading:1},{ascent:8,descent:3,leading:1}]) for(const text of ['', 'A','A\rB','A\r\rB','A\r']) {
    assert.deepEqual(pushLabelLines(r,text,m,s=>s.length*3),R.label(r,text,m,s=>s.length*3,true));assert.deepEqual(checkableLabelLines(r,text,m),R.label(r,text,m,()=>0,false));
  }
});
test('row registration covers PB1–PB13 DR1–DR6 CB1–CB24 with named discriminating tests',()=>{
  assert.equal(Object.keys(R.ROWS).length,43);for(const [prefix,n] of [['PB',13],['DR',6],['CB',24]])for(let i=1;i<=n;i++)assert.ok(R.ROWS[prefix+i]);assert.equal(R.ICON_ROWS.length,6);
});

// CB7 independently distinguishes disabled mode49 at full colour depth.
test('check-order: CB7 erase then label then glyph; disabled mode49 does not mean pressed',()=>{
 const events=[];const {t}=check({eraseControl:true,label:'A',hilite:254},[],[],{fontMetrics:metrics,erase:()=>events.push('erase'),drawLabel:p=>{events.push('label');assert.equal(p.mode,49);assert.deepEqual(p.clip,D);}});
 assert.deepEqual(events.slice(0,2),['erase','label']);assert.equal(t.resolved[0].id,-9504);
 const first=t.drawOps.findIndex(o=>o.operation==='label');assert.ok(first>=0);assert.ok(t.drawOps.slice(first+1).some(o=>o.row==='CB8'));
});
test('mode5-body: B1 B2 B3 uses opaque deep icon over whole side inset; NULL erases only cross union',()=>{
 const faceArt=art();faceArt.pixmap=pm(7,7,[0,0,0,0]);
 const masked=pm(2,1,[0,0,0,0]),opaque=pm(2,1,[200,0,0,255]);opaque.data.set([0,0,201,255],4);
 const records=[['cicn:-10239',faceArt],['cinf:-10239',{...meta,cornerSize:3,sideThickness:1,patternAnchor:5,bgPatternId:77}]];
 const present=push({},[...records,['cicn:77',{pixmap:masked,pixelSize:8,unmasked:opaque}]]),absent=push({},records);
 const pixel=(p,x,y)=>[...p.data.slice((y*p.width+x)*4,(y*p.width+x)*4+4)];
 assert.deepEqual(pixel(present.out,8,9),[200,0,0,255],'side inset begins before corner inset');
 assert.deepEqual(pixel(present.out,45,9),[0,0,201,255],'deep hidden RGB survives CopyBits');
 assert.deepEqual(pixel(absent.out,8,9),[91,92,93,255],'missing body cross excludes this square');
 assert.deepEqual(pixel(absent.out,10,9),[1,1,1,255],'R1 erases with raw background realization');
 assert.deepEqual(req(present.t),[['cicn',-10239],['cinf',-10239],['cicn',77]]);
});
test('raw-colour mask holes cannot erase RGB16 samples or supply missing exact points from display pixels',()=>{
 const faceArt=art();for(let x=0;x<3;x++)faceArt.pixmap.data.set([250,0,0,0],x*4);
 const calls=[];push({label:'A'},[['cicn:-10239',faceArt],['cinf:-10239',meta]],{fontMetrics:metrics,textWidth:()=>3,drawLabel:p=>calls.push(p)});
 assert.equal(calls.length,2);assert.deepEqual(calls.at(-1).color,{r:3,g:3,b:4,a:255});
 faceArt.sampleRgb16=()=>null;const unknown=[];const {t}=push({label:'A'},[['cicn:-10239',faceArt],['cinf:-10239',meta]],{fontMetrics:metrics,textWidth:()=>3,drawLabel:p=>unknown.push(p)});
 assert.deepEqual(unknown,[]);assert.ok(t.drawOps.some(o=>o.unspecified?.includes('raw colour')));
});
test('final/interior CR boundaries: final glyph output remains unknown; zero emits none; interior uses independent line metrics',()=>{
 for(const text of ['', 'A\r','A\rB']) {
  const calls=[],{t}=push({label:text},[['cicn:-10239',art()],['cinf:-10239',meta]],{fontMetrics:metrics,textWidth:()=>3,drawLabel:p=>calls.push(p)});
  assert.equal(calls.length,text==='A\rB'?2:0);
  if(text.endsWith('\r'))assert.ok(t.drawOps.some(o=>/final carriage-return/.test(o.unspecified??'')));
 }
});
test('source-bounds: glyph destination uses truncation for negative odd midpoint, then clips only at port storage',()=>{
 const icon=art();icon.pixmap=pm(3,5,[9,8,7,255]);icon.origin={left:-9,top:7};
 const {t,out}=check({rect:{left:-5,top:-5,right:20,bottom:7}},[['cicn:-9503',icon]]);
 assert.deepEqual(t.drawOps.find(o=>o.operation==='cornerFullBounds').dst,{left:2,top:-1,right:5,bottom:4});assert.equal(out.data[(0*out.width+2)*4],9);assert.deepEqual(req(t),[['cicn',-9503]]);assert.equal(t.drawOps.at(-1).operation,'releaseCicn');
});
