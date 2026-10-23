// Independent byte/literal fixtures. Native provider/cache/device claims are excluded.
const assert=Object.assign((ok,message='assertion failed')=>{if(!ok)throw Error(message);},{
 equal:(a,b,message)=>{if(a!==b)throw Error(message??`Expected ${JSON.stringify(a)} = ${JSON.stringify(b)}`);},
 deepEqual:(a,b,message)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(message??'Literal plane/value differs');},
 match:(a,re)=>{if(!re.test(a))throw Error(`Expected ${a} to match ${re}`);},
});
assert.ok=assert;
import { solidBackgroundIcon, solidBackgroundInfo, solidBackgroundRows } from '../../decoder-fixtures/solid-background.mjs';
import { profilePpat } from '../../decoder-fixtures/display-profile.mjs';
export const carriedVariants = ['missing','wrong-model','wrong-policy','invalid-display','invalid-rgb16','ambiguous-sample','invalid-anchor','legacy-no-request','mode5','invalid-mode','invalid-resource','invalid-slice','declared-display'];
export const rawVariants = ['valid','opaque-collision','default-cinf','NULL','short-selected','short-default','raw-invalid-anchor','ppat0','ppat17','wrong-type-only','mode5-unsupported','mode5-UNKNOWN','broken-pattern','bound-bodyPattern','bound-bgPattern','unique-no-link','unbound-ambiguous','wrong-ID-links','foreign-pattern','label','label-override',...carriedVariants.map(v=>'carried-'+v)];
export function rawRecords(variant) {
 const id=variant==='ppat17'?17:0;
 const face=solidBackgroundIcon({opaqueBackground:variant==='opaque-collision',collision:variant==='opaque-collision'});
 const mode=variant.startsWith('mode5-')?5:0;
 const records=[{type:'cicn',id:-10239,data:face}];
 if(variant!=='NULL')records.push({type:'cinf',id:variant==='default-cinf'||variant==='short-default'?0:-10239,data:variant.startsWith('short-')?new Uint8Array(17):solidBackgroundInfo({mode,resourceId:id,background:variant==='raw-invalid-anchor'?[99,99]:[3,3]})});
 if(variant.startsWith('ppat'))records.push({type:'ppat',id,data:profilePpat([0,65535,0])},{type:'cicn',id,data:solidBackgroundIcon()});
 if(variant==='wrong-type-only'||variant.startsWith('mode5-'))records.push({type:'cicn',id:0,name:'body-first',data:solidBackgroundIcon()});
 if(variant==='mode5-UNKNOWN')records.push({type:'cicn',id:0,name:'body-second',data:solidBackgroundIcon()});
 if(['bound-bodyPattern','bound-bgPattern','unbound-ambiguous'].includes(variant))records.push({type:'ppat',id:0,name:'2',data:profilePpat([65535,0,0])},{type:'ppat',id:0,name:'1',data:profilePpat([0,65535,0])});
 if(['unique-no-link','wrong-ID-links'].includes(variant))records.push({type:'ppat',id:0,name:'green',data:profilePpat([0,65535,0])});
 if(variant==='wrong-ID-links')records.push({type:'ppat',id:17,name:'red',data:profilePpat([65535,0,0])});
 if(variant==='broken-pattern')records.push({type:'ppat',id:0,data:new Uint8Array([1])});
 return records;
}
export function mutateCarried(el,variant) {
 const v=variant.replace(/^carried-/,'');
 // Copy only legacy declarations; retain actual cicnSource/engine sample binding.
 for(const key of ['colorSamples','bodyRequest','slice'])if(el[key])el[key]=structuredClone(el[key]);
 if(v==='missing')delete el.colorSamples;
 if(v==='wrong-model')el.colorSamples.model='unknown';
 if(v==='wrong-policy')el.colorSamples.displayPolicy='unknown';
 if(v==='invalid-display')el.colorSamples.background.displayRgb=[NaN,48,48];
 if(v==='invalid-rgb16')el.colorSamples.background.rgb16=[-1,8481,8481];
 if(v==='ambiguous-sample')el.colorSamplesUnavailableReason='ambiguous-asset-path';
 if(v==='invalid-anchor')el.bgAnchor=[99,99];
 if(v==='legacy-no-request')delete el.bodyRequest;
 if(v==='mode5')el.bodyRequest.mode=5;
 if(v==='invalid-mode')el.bodyRequest.mode=256;
 if(v==='invalid-resource')el.bodyRequest.resourceId=32768;
 if(v==='invalid-slice')el.slice.corner=3.5;
 if(v==='declared-display')el.colorSamples.background.displayRgb=[96,96,96];
}
const rgba={'.':[0,0,0,0],B:[0,0,255,255],G:[48,48,48,255],P:[0,255,0,255],R:[255,0,0,255]};
export const expectedSolid=solidBackgroundRows.flatMap(row=>[...row].flatMap(c=>rgba[c]));
export const expectedPattern=solidBackgroundRows.flatMap(row=>[...row].flatMap(c=>rgba[c==='G'?'P':c]));
export const expectedRedPattern=solidBackgroundRows.flatMap(row=>[...row].flatMap(c=>rgba[c==='G'?'R':c]));
export const expectedBorder=solidBackgroundRows.flatMap(row=>[...row].flatMap(c=>rgba[c==='G'?'.':c]));
export function verifyRawRow(row) {
 const error=['short-selected','short-default','mode5-unsupported','mode5-UNKNOWN','broken-pattern','unbound-ambiguous'].includes(row.variant);
 if(error){assert.ok(row.error&&row.error.name!=='TypeError','explicit unsupported rejection');assert.match(row.error.message,/short|malformed|unknown|unsupported|unavailable|decode/i);assert.equal(row.trace?.outcome.status,'error');assert.equal(row.pixels,null);assert.equal(row.trace.steps.some(s=>s.bodyPaint),false);return;}
 assert.equal(row.error,undefined);assert.equal(row.trace.outcome.status,'themed');
 assert.deepEqual(row.ordinaryBackground,row.variant==='opaque-collision'?[255,0,0,255]:[0,0,0,0]);
 const face=row.trace.steps.filter(s=>s.role==='face'&&s.action==='selected'&&s.usage==='admission'&&s.resource?.type==='cicn'&&s.reason.startsWith('engine:'));
 assert.equal(face.length,1);assert.equal(face[0].resource.type,'cicn');assert.equal(face[0].resource.signedId,-10239);
 assert.equal(face[0].owner.baseUrl,row.owner);assert.equal(face[0].owner.chainDepth,1);
 if(row.observed){assert.equal(face[0].resource.byteProvenance.cicnResourceIndex,0);assert.equal(face[0].resource.byteProvenance.loadId,row.provenance.loadId);}
 else assert.equal(face[0].resource.byteProvenance,undefined);
 if(row.variant!=='NULL'&&row.variant!=='raw-invalid-anchor'){assert.deepEqual(row.source?.points?.['3,3'],{rgb16:[8481,8481,8481],displayRgb:[48,48,48]});assert.equal(row.source.source.resourceIndex,0);}
 const paint=row.trace.steps.filter(s=>s.role==='face'&&s.action==='selected'&&s.usage==='paint');
 if(row.variant==='NULL'){assert.equal(paint.length,0);assert.ok(row.pixels.every(n=>n===0));assert.equal(row.trace.steps.some(s=>s.bodyPaint),false);return;}
 assert.equal(paint.length,1);assert.equal(paint[0].owner.baseUrl,row.owner);
 const bodies=row.trace.steps.filter(s=>s.bodyPaint);
 if(row.variant.startsWith('ppat')||['bound-bodyPattern','bound-bgPattern','unique-no-link','wrong-ID-links'].includes(row.variant)){assert.equal(bodies.length,1);assert.equal(bodies[0].resource.type,'ppat');assert.equal(bodies[0].resource.signedId,row.variant==='ppat17'?17:0);assert.equal(bodies[0].owner.baseUrl,row.owner);assert.equal(bodies[0].owner.chainDepth,1);assert.equal(bodies[0].bodyPaint.branch,'pattern-fill-union');assert.equal(bodies[0].resource.manifestKey,['bound-bodyPattern','bound-bgPattern'].includes(row.variant)?'2':['unique-no-link','wrong-ID-links'].includes(row.variant)?'green':row.variant==='ppat17'?'ppat-17':'ppat-0');if(row.observed)assert.equal(bodies[0].resource.byteProvenance.ppatResourceIndex,2);else assert.equal(bodies[0].resource.byteProvenance,undefined);assert.equal(bodies[0].bodyPaint.paintedPixels,173);assert.deepEqual(bodies[0].bodyPaint.unionRects,[{x:3,y:1,w:23,h:7},{x:1,y:3,w:27,h:3}]);}
 else {assert.equal(bodies.length,0,'missing pattern cannot claim completed bodyPaint');const missing=row.trace.steps.filter(s=>s.role==='body-fill'&&s.usage==='paint'&&s.action==='missing');assert.equal(missing.length,1);assert.equal(missing[0].requestedResourceType,'ppat');assert.equal(missing[0].reason,'same-face-owner-pattern-unavailable');}
 if(row.variant==='raw-invalid-anchor')assert.ok(row.trace.steps.some(s=>s.action==='rejected'&&/background sample unavailable/.test(s.reason)));
 if(row.variant.startsWith('label')){assert.deepEqual(row.center,[48,48,48,255]);assert.ok(row.variant==='label'?row.blue>0:row.red>0);assert.equal(row.variant==='label'?row.red:row.blue,0);assert.equal(row.trace.textColors.policy,row.variant==='label'?'source-samples':'caller-override');}
 else {assert.deepEqual(row.size,[29,9]);assert.deepEqual(row.pixels,row.variant==='raw-invalid-anchor'?expectedBorder:['bound-bodyPattern','bound-bgPattern'].includes(row.variant)?expectedRedPattern:row.variant.startsWith('ppat')||['unique-no-link','wrong-ID-links'].includes(row.variant)?expectedPattern:expectedSolid);}
}

export function verifyShowcaseShape(shape,kind) {
 assert.equal(shape.length,2,'exactly one replacement per original');
 for(const [i,row]of shape.entries()){
  assert.equal(row.same,true);assert.equal(row.visible,true);assert.equal(row.label,['OK','Cancel'][i]);
  assert.equal(row.tag,kind==='themed'?'SPAN':'BUTTON');assert.equal(row.sourceHidden,true);
  assert.equal(row.canvas,kind==='themed'?1:0);
  if(kind==='themed')assert.ok(row.opaque>0,'replacement must contain painted pixels');
  else assert.equal(row.type,'button');
 }
}
