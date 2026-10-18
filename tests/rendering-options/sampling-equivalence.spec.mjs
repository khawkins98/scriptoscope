import { createHash } from 'node:crypto';
import { colorIcon } from '../decoder-fixtures/control-colors.mjs';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
for (const mode of ['source', 'built']) test(`${mode}: actual encoded cicn occurrences retain bounded display-equivalence metadata`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode); let result;
  try {
    result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
      const { colorIcon } = await import('/tests/decoder-fixtures/control-colors.mjs');
      const entries = [
        { type: 'cicn', id: 7, name: 'sequential', data: colorIcon({ origin: 0, mask: [240,240], entries: [[0,65535,0,0]], pixels: Array(8).fill(0) }) },
        { type: 'cicn', id: 7, name: 'collision', data: colorIcon({ origin: 0, mask: [240,240], flags: 32768, entries: [[1,65535,0,0],[7,0,0,65535]], pixels: Array(8).fill(1) }) },
      ];
      const owner = await api.loadKaleidoscopeScheme(forkOf(entries), { provenance: true });
      try {
        const rows=[];
        for (const [key,e] of Object.entries(owner.manifest.chromeElements)) {
          const image = new Image(); image.src=e.asset; await image.decode();
          const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
          rows.push({key,metadata:e.samplingEquivalence,sourceCicnId:e.sourceCicnId,sourceCinfId:e.sourceCinfId,byteProvenance:e.byteProvenance,pixel:[...ctx.getImageData(0,0,1,1).data],frozen:Object.isFrozen(e.samplingEquivalence)});
        }
        const parallel = await Promise.all(entries.map(entry => api.loadKaleidoscopeScheme(forkOf([{...entry,name:'same-key'}]),{provenance:true})));
        try {
          return {rows, provenance:owner.byteProvenance, parallel:parallel.map(theme=>({
            provenance:theme.byteProvenance, element:Object.values(theme.manifest.chromeElements)[0],
          }))};
        } finally {for(const theme of parallel)theme.dispose();}
      } finally { owner.dispose(); }
    },mode);
    expect(result.rows.map(r=>[r.key,r.metadata.status,r.byteProvenance.cicnResourceIndex,r.pixel])).toEqual([
      ['sequential','equivalent',0,[255,0,0,255]],['collision','different',1,[0,0,255,255]],
    ]);
    const payloads = [colorIcon({origin:0,mask:[240,240],entries:[[0,65535,0,0]],pixels:Array(8).fill(0)}),
      colorIcon({origin:0,mask:[240,240],flags:32768,entries:[[1,65535,0,0],[7,0,0,65535]],pixels:Array(8).fill(1)})];
    const hashes = payloads.map(p=>createHash('sha256').update(p).digest('hex'));
    expect(result.provenance.resources.map(r=>[r.resourceIndex,r.signedId,r.sha256,r.status])).toEqual(hashes.map((h,i)=>[i,7,h,'decoded']));
    expect(new Set([result.provenance.loadId,...result.parallel.map(p=>p.provenance.loadId)]).size).toBe(3);
    for(const [i,p]of result.parallel.entries()) {
      expect(p.element.byteProvenance).toMatchObject({loadId:p.provenance.loadId,manifestKey:'same-key',cicnResourceIndex:0});
      expect(p.provenance.resources[0]).toMatchObject({resourceIndex:0,signedId:7,sha256:hashes[i],status:'decoded'});
      expect(p.element.samplingEquivalence.status).toBe(i===0?'equivalent':'different');
    }
    for (const row of result.rows) {
      expect(row.byteProvenance.loadId).toBe(result.provenance.loadId);
      expect(row.metadata).toMatchObject({model:'kaleidoscope-2.3.1-opaque-sampling-v1',comparison:'opaque-current-display-rgb',displayPolicy:'mac-1.8-to-2.2-high-byte',width:4,height:2});
      expect(row.sourceCicnId).toBe(7);expect(row.sourceCinfId).toBe(null);expect(row.frozen).toBe(true);
    }
  } catch(error) {await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'sampling-equivalence',mode,{mode,scope:'actual encoded occurrence and current-display admission; no historical color claim',result});
});
