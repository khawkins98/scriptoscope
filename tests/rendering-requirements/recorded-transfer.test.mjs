import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareCicnTransferResults} from '../../tools/theme-loader/cicn-transfer-results.js';
import {prepareDisplayProfile} from '../../tools/theme-loader/display-profile.js';
import {loadKaleidoscopeScheme} from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import {prepareRecordedTransfer,transferFor,recordedLoadKey,retainRecordedTransfers} from './recorded-transfer.mjs';
import {RECORDED_CASES,captureBinding,recordedSubjects,validateRecordedProfiles,validateRecordedTransfers} from './recorded-face.mjs';
const fixture=JSON.parse(readFileSync(new URL('../decoder-fixtures/finite-cicn-transfer.json',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function owned(t){
 const root=mkdtempSync(join(tmpdir(),'recorded-transfer-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const bytes=Buffer.from(JSON.stringify(fixture.data)),results=await prepareCicnTransferResults(fixture.data);
 const path=join(root,'results.json');writeFileSync(path,bytes);
 const binding={path,sha256:sha(bytes),id:results.id,contractId:results.contractId,maskPolicy:'source-mask-alpha'};
 const profilePath=join(root,'profile.json');writeFileSync(profilePath,JSON.stringify(fixture.profile));
 const profile=await prepareDisplayProfile(fixture.profile);
 const profileBinding={path:profilePath,id:profile.id,sha256:sha(readFileSync(profilePath))};
 return {root,bytes,binding,profile,profileBinding,read:async p=>readFileSync(p)};
}
test('finite registration preserves old capture bindings and state profiles; explicit malformed opt-in fails',async t=>{
 const x=await owned(t),registry=structuredClone(RECORDED_CASES),slug='evolution';
 const corpus=JSON.parse(readFileSync(new URL('../reference-captures/captures.json',import.meta.url))).captures;
 const ledger=JSON.parse(readFileSync(new URL('./ledger.json',import.meta.url)));
 for(const c of corpus)assert.deepEqual(captureBinding(c),ledger.cases.find(r=>r.recordedComparison?.captureId===c.id).recordedComparison);
 assert(registry[slug].states.includes('pressed'));registry[slug].cicnTransfer=x.binding;registry[slug].profilesByState={pressed:x.profileBinding};
 const states=recordedSubjects(registry).find(s=>s.slug===slug).cases;
 for(const s of states)assert.deepEqual(s.cicnTransfer,x.binding);
 assert.equal(states.find(s=>s.state==='normal').profile.id,RECORDED_CASES[slug].profile.id);
 assert.equal(states.find(s=>s.state==='pressed').profile.id,x.profile.id);
 const capture=structuredClone(corpus.find(c=>c.source.slug===slug));capture.conditions.state='pressed';
 assert.deepEqual(captureBinding(capture,registry).cicnTransfer,x.binding);
 assert.equal(captureBinding(capture,registry).profile.id,x.profile.id);
 for(const bad of [null,{}, {...x.binding,maskPolicy:'native-mask'}, {...x.binding,unexpected:true}]){
  registry[slug].cicnTransfer=bad;assert.throws(()=>recordedSubjects(registry),/recorded transfer/);
 }
 assert.equal(transferFor('missing',registry),undefined);
});
test('finite bytes, results identity and operation contract are checked before loader allocation',async t=>{
 const x=await owned(t),api={prepareCicnTransferResults};
 const option=await prepareRecordedTransfer(x.binding,api,x.read);
 assert.equal(option.results.id,x.binding.id);assert(Object.isFrozen(option));
 for(const bad of [{...x.binding,sha256:'0'.repeat(64)},{...x.binding,id:'cicn-transfer-results:'+'0'.repeat(64)},
  {...x.binding,contractId:'cicn-transfer-context:'+'0'.repeat(64)}])await assert.rejects(prepareRecordedTransfer(bad,api,x.read),/DATA bytes|prepared results/);
 await assert.rejects(prepareRecordedTransfer({...x.binding,path:join(x.root,'missing')},api,x.read),/ENOENT/);
 const altered=structuredClone(fixture.data);altered.records[0].operation.localZeroGlobal[0]++;
 const bytes=Buffer.from(JSON.stringify(altered));
 await assert.rejects(prepareRecordedTransfer({...x.binding,sha256:sha(bytes)},api,async()=>bytes),/prepared results/);
 const before={...x.binding};const pending=prepareRecordedTransfer(before,api,x.read);before.contractId='wrong';
 assert.equal((await pending).contractId,x.binding.contractId);
 assert.notEqual(recordedLoadKey(x.profileBinding),recordedLoadKey(x.profileBinding,x.binding));
 assert.notEqual(recordedLoadKey(x.profileBinding,x.binding),recordedLoadKey(x.profileBinding,{...x.binding,contractId:'other'}));
 validateRecordedProfiles(x.root,{owned:{states:['normal'],profile:x.profileBinding,cicnTransfer:x.binding}});
 writeFileSync(x.binding.path,'{}');assert.throws(()=>validateRecordedProfiles(x.root,{owned:{states:['normal'],profile:x.profileBinding,cicnTransfer:x.binding}}),/DATA bytes/);
});
async function loaded(t){
 const x=await owned(t),option=await prepareRecordedTransfer(x.binding,{prepareCicnTransferResults},x.read),encoded=[];
 const theme=await loadKaleidoscopeScheme(Uint8Array.from(fixture.fork),{encodeAssets:true,provenance:true,displayProfile:x.profile,cicnTransfer:option,
  assetUrlFactory:(rgba,w,h)=>{encoded.push([...rgba]);return 'owned:finite-'+encoded.length;}});
 t.after(()=>theme.dispose());const e=theme.manifest.chromeElements.owned;
 const row={...retainRecordedTransfers(theme,x.binding),loadId:theme.byteProvenance.loadId,profileInput:theme.byteProvenance.input.sha256,
  profileFork:theme.byteProvenance.fork.sha256,resources:theme.byteProvenance.resources,selectedKey:'owned',selectedAsset:e.asset,
  source:e.byteProvenance,selectedCicnTransfer:e.cicnTransfer};
 return {...x,theme,row,encoded};
}
test('owned sparse plane uses ordinary public loader and retains exact source mask separately',async t=>{
 const x=await loaded(t);assert.deepEqual(x.encoded,[fixture.expectedRgba]);
 validateRecordedTransfers(x.row,{cicnTransfer:x.binding});
 let urls=0;await assert.rejects(loadKaleidoscopeScheme(Uint8Array.from(fixture.fork),{displayProfile:x.profile,
  assetUrlFactory:()=>{urls++;return'bad';}}),e=>e.code==='UNSUPPORTED_SOURCE_COLOR');assert.equal(urls,0);
 assert.equal(x.theme.manifest.chromeElements.owned.samplingEquivalence.status,'unknown');
 // A whole-load dependency is allowed when another, ordinary face is selected.
 const ordinary=structuredClone(x.row);ordinary.selectedKey='ordinary';delete ordinary.selectedCicnTransfer;
 validateRecordedTransfers(ordinary,{cicnTransfer:x.binding});
});
test('actual finite whole-load joins reject missing/context/plane/source/owner/selected substitutions',async t=>{
 const x=await loaded(t);
 for(const mutate of [
  r=>r.cicnTransfer.elements=[],r=>r.cicnTransfer.elements.push(r.cicnTransfer.elements[0]),
  r=>r.cicnTransfer.load.loadId='foreign',r=>r.cicnTransfer.elements[0].byteProvenance.loadId='foreign',
  r=>r.cicnTransfer.elements[0].transfer.operation.clipRect[0]++,
  r=>r.cicnTransfer.elements[0].transfer.operation.localZeroGlobal.reverse(),
  r=>r.cicnTransfer.elements[0].transfer.source.indexedRepresentationSha256='0'.repeat(64),
  r=>r.cicnTransfer.elements[0].transfer.destinationPlaneSha256='0'.repeat(64),
  r=>r.cicnTransfer.elements[0].transfer.resource.resourceIndex++,
  r=>r.cicnTransfer.elements[0].transfer.preparationEvidenceSha256='0'.repeat(64),
  r=>r.cicnTransfer.elements[0].transfer.maskPolicy='native-mask',
  r=>r.cicnTransfer.catalog=[],r=>r.cicnTransfer.elements[0].asset='other',r=>delete r.selectedCicnTransfer,
 ]){const row=structuredClone(x.row);mutate(row);assert.throws(()=>validateRecordedTransfers(row,{cicnTransfer:x.binding}),/recorded face/);}
 assert.throws(()=>validateRecordedTransfers(x.row,{}),/unregistered/);
});
