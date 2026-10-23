// Structural recovery from pre-migration output; no hash-only blessing.
import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const dir='/Users/khawkins/orca/worker-receipts/v2-lanes/459-controls-independent/';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const old=JSON.parse(readFileSync(dir+'binding-old-public-data.json'));
const current=JSON.parse(readFileSync(dir+(process.argv[2]??'binding-new-public-data.json')));
const tag=process.argv[3]??'binding-audit';
function recover(after,before) {
 const manifest=structuredClone(after),removed=[];
 for(const [key,el] of Object.entries(manifest.chromeElements)) {
  const previous=before.chromeElements[key];assert.ok(previous);
  // Remove ONLY newly added documented preparation fields. Existing versions of
  // those fields must survive byte-for-byte. Source paths, IDs, sizes stay intact.
  for(const field of ['cicnSource','engineColorSamples','boundsOrigin','iconBlit'])if(!(field in previous)&&field in el) {
   if(field==='iconBlit')assert.ok([-10240,-10239,-10238,-10232,-10231,-10230].includes(el.sourceCicnId)||(el.sourceCicnId>=-9504&&el.sourceCicnId<=-9481));
   removed.push(`chromeElements.${key}.${field}`);delete el[field];
  }
 }
 for(const id of Object.keys(manifest.engineCinfs??{}))if(!(id in (before.engineCinfs??{}))) {
  assert.ok([-10240,-10239,-10238,-10232,-10231,-10230,0,1].includes(+id));delete manifest.engineCinfs[id];removed.push(`engineCinfs.${id}`);
 }
 assert.deepEqual(manifest,before,'prior complete manifest recovered');return{manifest,removed};
}
const rows=[],recoveredBindings=structuredClone(current.bindings);
for(let i=0;i<old.expanded.length;i++) {
 const a=old.expanded[i],b=current.expanded[i];assert.equal(a.id,b.id);
 const core=recover(b.conversion.manifest,a.conversion.manifest);
 const recovered=structuredClone(b.conversion);recovered.manifest=core.manifest;recovered.manifestSha256=hash(core.manifest);
 for(const [name,entries] of Object.entries(recovered.catalogs))for(const entry of entries)entry.valueSha256=hash(core.manifest[name][entry.key]);
 assert.deepEqual(recovered,a.conversion,`${a.id} full core observation recovered: source/assets/resources/windows unchanged`);
 const compact=recoveredBindings.sources.find(s=>s.id===a.id);
 assert.equal(compact.actualLoader.agreement,'agrees');compact.actualLoader.manifestSha256=hash(core.manifest);compact.canonical.manifestSha256=hash(core.manifest);
 for(const [name,entries] of Object.entries(compact.canonical.catalogs))for(const entry of entries)entry[2]=hash(core.manifest[name][entry[0]]);
 const before=a.public,after=b.public,pub=recover(after.manifest,before.manifest);
 const newPlanes=after.assets.filter(n=>!before.assets.some(o=>o.path===n.path));
 for(const plane of before.assets)assert.deepEqual(after.assets.find(p=>p.path===plane.path),plane,`${a.id}/${plane.path} prior plane identity`);
 for(const plane of newPlanes)assert.match(plane.path,/^(cicn-unmasked\/|icons\/opaque-ics8-)/);
 rows.push({id:a.id,existingPlanes:before.assets.length,existingPlaneChanges:0,additivePlanes:newPlanes,removedCoreMetadata:core.removed,removedPublicMetadata:pub.removed,priorManifestRecovered:true});
}
const {toolchain:oldTools,...prior}=old.bindings,{toolchain:newTools,...next}=recoveredBindings;
assert.deepEqual(next,prior,'entire prior compact source/resource/asset/envelope identity recovered');
const report={sourceRef:'23c8048b',frozenRef:'8e304e49839b93d0d5f8f66e85950b88e10eb72a',repairRef:'fc5e96956b0541657f615602ac45aefb35a2b152',bindingDelta:'documented additive preparation metadata and toolchain only',toolchainDelta:newTools.filter(t=>oldTools.find(o=>o.path===t.path)?.sha256!==t.sha256),rows};
writeFileSync(dir+tag+'.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sources:rows.length,existingPlaneChanges:0,addedPlanes:rows.reduce((n,r)=>n+r.additivePlanes.length,0),recoveredManifests:rows.length,bindingDelta:report.bindingDelta}));
