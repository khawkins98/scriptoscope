import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
for (const mode of ['source','built']) test(`${mode}: finite CIcon transfer preserves explicit plane and rejects unbound preparation`, async ({page,servers},info) => {
  await openHarness(page,servers,mode);
  const row=await page.evaluate(async mode=>{
    const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
    const f=await(await fetch('/tests/decoder-fixtures/finite-cicn-transfer.json')).json();
    const pending=api.prepareCicnTransferResults(f.data);f.data.records[0].destinationIndices[0]=3;
    const results=await pending,profile=await api.prepareDisplayProfile(f.profile);
    const option={results,contractId:results.contractId,maskPolicy:'source-mask-alpha'};
    const encoded=[];
    const theme=await api.loadKaleidoscopeScheme(Uint8Array.from(f.fork),{displayProfile:profile,cicnTransfer:option,provenance:true,
      assetUrlFactory:(rgba,width,height)=>{encoded.push({rgba:[...rgba],width,height});return 'data:image/png;base64,owned';}});
    try {
      let allocated=0;const errors=[];
      for(const opts of [{displayProfile:profile},{displayProfile:profile,cicnTransfer:{...option,contractId:'other'}},
        {displayProfile:profile,cicnTransfer:{...option,results:{...results}}},{cicnTransfer:option}]) {
        try {await api.loadKaleidoscopeScheme(Uint8Array.from(f.fork),{...opts,assetUrlFactory:()=>{allocated++;return'never';}});errors.push(null);}
        catch(e){errors.push(e.code);}
      }
      const e=theme.manifest.chromeElements.owned;
      return {mode,encoded,errors,allocated,profileId:profile.id,resultId:results.id,contractId:results.contractId,
        transfer:e.cicnTransfer,sourceSampling:e.samplingEquivalence,load:theme.byteProvenance,expected:f.expectedRgba,
        frozen:Object.isFrozen(e.cicnTransfer.operation.sourceRect)};
    } finally {theme.dispose();}
  },mode);
  await attachObservations(info,'finite-cicn-transfer',mode,row);
  expect(row.encoded).toEqual([{rgba:[20,20,20,255,36,36,36,255,20,20,20,0],width:3,height:1}]);
  expect(row.errors).toEqual(['UNSUPPORTED_SOURCE_COLOR','INVALID_CICN_TRANSFER','INVALID_CICN_TRANSFER','INVALID_CICN_TRANSFER']);
  expect(row.allocated).toBe(0);expect(row.frozen).toBe(true);
  expect(row.transfer).toMatchObject({resultsId:row.resultId,contractId:row.contractId,forkSha256:row.load.fork.sha256,
    resource:{type:'cicn',signedId:-10239,resourceIndex:0},scope:'finite-raster-preparation',maskPolicy:'source-mask-alpha'});
  expect(row.transfer.source.payloadSha256).toBe(row.load.resources[0].sha256);
  expect(row.sourceSampling.status).toBe('unknown');
});
