// Structural recovery from pre-migration public output; no hash-only blessing.
import { readFileSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir='/Users/khawkins/orca/worker-receipts/v2-lanes/459-controls-independent/';
const old=JSON.parse(readFileSync(dir+'binding-old-public-data.json')),current=JSON.parse(readFileSync(dir+'binding-new-public-data.json'));
const committed=JSON.parse(readFileSync('tests/acceptance-bindings/bindings.json'));
assert.deepEqual(old.bindings.sources,committed.sources,'historical expanded core must reproduce prior binding identities');
const {toolchain:oldTools,...prior}=committed,{toolchain:newTools,...next}=current.bindings;
assert.deepEqual(next,prior,'core recipe source/resource/asset/envelope bindings unchanged');
const rows=[];
for(let i=0;i<old.expanded.length;i++) {
 const a=old.expanded[i],b=current.expanded[i];assert.equal(a.id,b.id);assert.deepEqual(a.conversion,b.conversion,'default core full structural observation unchanged');
 const before=a.public,after=b.public,recovered=structuredClone(after.manifest),removed=[];
 for(const [key,el] of Object.entries(recovered.chromeElements)) {
  const previous=before.manifest.chromeElements[key];assert.ok(previous);
  // Only documented additive preparation metadata is removed, and ONLY when
  // absent before. Existing field values, paths, geometry and ownership survive.
  for(const field of ['engineColorSamples','boundsOrigin','iconBlit'])if(!(field in previous)&&field in el) {
   if(field==='iconBlit')assert.ok([-10240,-10239,-10238,-10232,-10231,-10230].includes(el.sourceCicnId)||(el.sourceCicnId>=-9504&&el.sourceCicnId<=-9481));
   removed.push(`chromeElements.${key}.${field}`);delete el[field];
  }
 }
 for(const id of Object.keys(recovered.engineCinfs??{}))if(!(id in (before.manifest.engineCinfs??{}))) {
  assert.ok([-10240,-10239,-10238,-10232,-10231,-10230,0,1].includes(+id));delete recovered.engineCinfs[id];removed.push(`engineCinfs.${id}`);
 }
 assert.deepEqual(recovered,before.manifest,`${a.id} prior manifest recovered exactly`);
 const newPlanes=after.assets.filter(n=>!before.assets.some(o=>o.path===n.path));
 for(const plane of before.assets)assert.deepEqual(after.assets.find(p=>p.path===plane.path),plane,`${a.id}/${plane.path} prior plane identity`);
 for(const plane of newPlanes)assert.match(plane.path,/^(cicn-unmasked\/|icons\/opaque-ics8-)/);
 rows.push({id:a.id,existingPlanes:before.assets.length,existingPlaneChanges:0,additivePlanes:newPlanes,removedAdditiveMetadata:removed,priorManifestRecovered:true});
}
const report={sourceRef:'23c8048b',frozenRef:'8e304e49839b93d0d5f8f66e85950b88e10eb72a',coreBindingDelta:'toolchain-only',toolchainDelta:newTools.filter(t=>oldTools.find(o=>o.path===t.path)?.sha256!==t.sha256),rows};
writeFileSync(dir+'binding-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sources:rows.length,existingPlaneChanges:0,addedPlanes:rows.reduce((n,r)=>n+r.additivePlanes.length,0),recoveredManifests:rows.length,coreBindingDelta:report.coreBindingDelta}));
