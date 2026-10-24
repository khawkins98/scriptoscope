import { createHash } from 'node:crypto';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
import { solidBackgroundIcon, solidBackgroundInfo, solidBackgroundRows } from '../decoder-fixtures/solid-background.mjs';
import { verifySolidCases } from '../rendering-requirements/solid-cases.mjs';
import { solidMutations } from '../rendering-requirements/solid-negatives.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

for (const mode of ['source', 'built']) test(`${mode}: solid bodies consume selected-owner raw background beneath masked and opaque palette collisions`, async ({ page, servers }, info) => {
  info.annotations.push({ type: 'fidelity-assertion', description: 'solid.selected-rgb16-literal' });
  await openHarness(page, servers, mode); let result;
  try {
    result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
      const { solidBackgroundIcon, solidBackgroundInfo } = await import('/tests/decoder-fixtures/solid-background.mjs');
      const rows = [];
      for (const collision of [false, true]) for (const resourceId of [0, 17]) {
        const bytes = solidBackgroundIcon({ opaqueBackground: collision, collision });
        const cinf = solidBackgroundInfo({ resourceId });
        const ids = [-10239, -10238, -10240, -10166, -10165, -10167];
        const owner = await api.loadKaleidoscopeScheme(forkOf(ids.flatMap(id => [{ type: 'cicn', id, data: bytes }, { type: 'cinf', id, data: cinf }])), { provenance: true });
        const child = { baseUrl: `${location.origin}/wrong-child/`, base: owner, manifest: { chromeElements: {
          decoy: { sourceCicnId: -999, colorSamples: { background: { displayRgb: [255, 0, 0] } } },
        } } };
        try { for (const family of ['push', 'bevel']) for (const state of ['normal', 'pressed', 'disabled']) for (const override of [false, true]) {
          let trace;
          const options = {
            ...(family === 'push' ? { default: false } : { on: false, small: false }),
            label: '', minWidth: 29, height: 9, pressed: state === 'pressed', disabled: state === 'disabled', ...(override ? { fg: '#ff0000' } : {}),
          };
          const out = await api[family === 'push' ? 'composeButton' : 'composeBevelButton'](child, { ...options, diagnostics: { onComplete: value => { trace = value; } } });
          const selected = trace.steps.find(s => s.role === 'face' && s.action === 'selected');
          const element = owner.manifest.chromeElements[selected.resource.manifestKey];
          rows.push({ collision, resourceId, family, state, override, options, owner: { baseUrl: owner.baseUrl, byteProvenance: owner.byteProvenance }, childBaseUrl: child.baseUrl, childDeclaration: child.manifest, size: [out.width, out.height], trace,
            background: element.colorSamples.background, resources: owner.byteProvenance.resources.filter(r =>
              r.resourceIndex === element.byteProvenance.cicnResourceIndex || r.resourceIndex === element.byteProvenance.cinfResourceIndex),
            pixels: Array.from({ length: 9 }, (_, y) => Array.from({ length: 29 }, (_, x) => {
              const p = [...out.getPixel(x, y)]; return p[3] === 0 ? '.' : p.every((v, i) => v === [48, 48, 48, 255][i]) ? 'G'
                : p.every((v, i) => v === [0, 0, 255, 255][i]) ? 'B' : '?';
            }).join('')) });
        } } finally { owner.dispose(); }
      }
      return rows;
    }, mode);
    expect(result).toHaveLength(48);
    for (const row of result) {
      expect(row.size).toEqual([29, 9]);
      expect(row.background).toEqual({ rgb16: [0x2121, 0x2121, 0x2121], displayRgb: [48, 48, 48] });
      const selected = row.trace.steps.find(s => s.role === 'face' && s.action === 'selected');
      expect(selected.owner.chainDepth).toBe(1); expect(selected.owner.baseUrl).not.toContain('wrong-child');
      const id = { push: { normal: -10239, pressed: -10238, disabled: -10240 }, bevel: { normal: -10166, pressed: -10165, disabled: -10167 } }[row.family][row.state];
      expect(selected.resource.signedId).toBe(id);
      expect(row.resources.find(r => r.type === 'cicn')).toMatchObject({ signedId: id, sha256: hash(solidBackgroundIcon({ opaqueBackground: row.collision, collision: row.collision })) });
      expect(row.resources.find(r => r.type === 'cinf')).toMatchObject({ signedId: id, sha256: hash(solidBackgroundInfo({ resourceId: row.resourceId })) });
      expect(row.trace.textColors.policy).toBe(row.override ? 'caller-override' : 'source-samples');
      expect(row.pixels, `${row.family}/${row.state}/collision=${row.collision}/id=${row.resourceId}/fg=${row.override}`).toEqual(solidBackgroundRows);
    }
    const verifiedCaseIds = verifySolidCases(result);
    const negatives = [];
    for(const role of ['face','body-fill']){const changed=structuredClone(result),paint=changed[0].trace.steps.find(s=>s.role===role&&s.usage==='paint');changed[0].trace.steps.push(structuredClone(paint));expect(()=>verifySolidCases(changed),`duplicate actual ${role} paint`).toThrow();negatives.push(`duplicate-actual-${role}-paint`);}
    for (const [name, mutate] of solidMutations) {
      const changed = structuredClone(result); mutate(changed);
      expect(() => verifySolidCases(changed), name).toThrow(); negatives.push(name);
    }
    await attachObservations(info, 'solid-background', `${mode}-source-color`, { mode, result, verifiedCaseIds, negatives, evidence: 'literal-source-sample-and-inset-union',
      limits: 'Diagnostic serialized bytes; existing LUT policy, not original device/palette or lookup ownership verification' });
  } catch (error) { await attachCase(page, info, { mode, result, expected: solidBackgroundRows }, error); throw error; }
});

// Intent freeze: external 459-raw-solid-showcase-tests/FREEZE.md, before execution.
for (const mode of ['source', 'built']) test(`${mode}: raw solid admission preserves unknown metadata, unsupported bodies and selected pattern priority`, async ({ page, servers }, info) => {
  const { rawVariants, rawRecords, verifyRawRow } = await import('./controls459/raw-solid-showcase-fixtures.mjs');
  await openHarness(page, servers, mode); let result;
  try {
    result = await page.evaluate(async ({mode,variants}) => {
      const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const {rawRecords,mutateCarried}=await import('/tests/rendering-options/controls459/raw-solid-showcase-fixtures.mjs');
      const rows=[];
      for(const observed of [false,true])for(const variant of variants){
        const owner=await api.loadKaleidoscopeScheme(forkOf(rawRecords(variant)),{provenance:observed});
        // Same signed art in a foreign base must not supply selected-owner RGB16.
        const foreignBytes=rawRecords('valid')[0].data;
        new DataView(foreignBytes.buffer).setUint16(99,65535); // foreign sample red, never selected gray
        const foreignRecords=[{type:'cicn',id:-10239,data:foreignBytes}];
        if(variant==='foreign-pattern'){const {profilePpat}=await import('/tests/decoder-fixtures/display-profile.mjs');foreignRecords.push({type:'ppat',id:0,data:profilePpat([65535,0,0])});}
        const foreign=await api.loadKaleidoscopeScheme(forkOf(foreignRecords),{provenance:observed});
        owner.baseUrl=location.origin+'/raw-owner/';foreign.baseUrl=location.origin+'/foreign-base/';
        owner.base=foreign;
        const child={baseUrl:location.origin+'/wrong-child/',base:owner,manifest:{chromeElements:{}}};
        const el=Object.values(owner.manifest.chromeElements).find(e=>e.sourceCicnId===-10239);
        if(variant.startsWith('carried-'))mutateCarried(el,variant);
        if(variant==='bound-bodyPattern'){el.bodyPattern='2';el.bgPattern='1';}
        if(['bound-bgPattern','unique-no-link','unbound-ambiguous'].includes(variant)){delete el.bodyPattern;delete el.bgPattern;if(variant==='bound-bgPattern')el.bgPattern='2';}
        if(variant==='wrong-ID-links'){el.bodyPattern='red';el.bgPattern='red';}
        let trace,out,error;
        const labelled=variant.startsWith('label');
        try{out=await api.composeButton(child,{label:labelled?'H':'',default:false,minWidth:labelled?80:29,height:labelled?20:9,
          ...(variant==='label-override'?{fg:'#ff0000'}:{}),diagnostics:{onComplete:t=>trace=t}});}catch(e){error={name:e.name,message:e.message};}
        let blue=0,red=0;
        if(labelled&&out)for(let y=3;y<17;y++)for(let x=25;x<55;x++){const p=[...out.getPixel(x,y)];if(p.join(',')==='0,0,255,255')blue++;if(p.join(',')==='255,0,0,255')red++;}
        rows.push({variant,observed,error,trace,owner:owner.baseUrl,provenance:owner.byteProvenance,foreign:foreign.baseUrl,
          source:el.engineColorSamples,ordinaryBackground:[...((await api.loadCicnBuffer(api.assetUrl(owner,el.asset))).getPixel(3,3))],size:out?[out.width,out.height]:null,pixels:out?[...out.data]:null,center:out?[...out.getPixel(4,4)]:null,blue,red});
        owner.dispose();foreign.dispose();
      }
      return rows;
    },{mode,variants:rawVariants});
    // Baseline first: no mutation result substitutes for a passing positive control.
    const validationErrors=[];
    for(const row of result)try{verifyRawRow(row);}catch(e){validationErrors.push({variant:row.variant,message:e.message,observed:row.observed});}
    for(const observed of [false,true])for(const variant of ['valid','ppat0','short-selected'])verifyRawRow(result.find(r=>r.variant===variant&&r.observed===observed));
    const negatives=[];
    for(const [name,variant,mutate] of [
      ['wrong-owner','valid',r=>r.trace.steps.find(s=>s.role==='face'&&s.usage==='admission').owner.baseUrl=r.foreign],
      ['UNKNOWN-as-NULL','short-selected',r=>{r.error=undefined;r.trace.outcome.status='themed';r.pixels=Array(29*9*4).fill(0);}],
      ['wrong-body-type','ppat0',r=>r.trace.steps.find(s=>s.bodyPaint).resource.type='cicn'],
      ['extra-actual-paint','valid',r=>r.trace.steps.push(structuredClone(r.trace.steps.find(s=>s.role==='face'&&s.usage==='paint')))],
      ['changed-output-sentinel-alpha','valid',r=>r.pixels[3]=0],
      ['wrong-source-RGB16','valid',r=>r.source.points['3,3'].rgb16[0]=65535],
      ['changed-current-source-mask','valid',r=>r.ordinaryBackground[3]=255],
      ['extra-actual-body-paint','ppat0',r=>r.trace.steps.push(structuredClone(r.trace.steps.find(s=>s.bodyPaint)))],
    ]){for(const observed of [false,true]){const changed=structuredClone(result.find(r=>r.variant===variant&&r.observed===observed));mutate(changed);expect(()=>verifyRawRow(changed),`${name}/observed=${observed}`).toThrow();negatives.push({name,observed});}}
    for(const row of result){if(!row.observed){expect(row.provenance).toBeUndefined();continue;}const records=rawRecords(row.variant);for(const [index,record]of records.entries()){
      expect(row.provenance.resources.find(r=>r.resourceIndex===index)).toMatchObject({type:record.type,signedId:record.id,sha256:hash(record.data)});
    }}
    await attachObservations(info,'solid-background',`${mode}-raw-boundaries`,{mode,result,negatives,validationErrors,limits:'Independent synthetic public inputs; native provider/cache/device behavior unknown'});
    const path=info.outputPath('raw-observations.json');await (await import('node:fs/promises')).writeFile(path,JSON.stringify({mode,result,negatives,validationErrors},null,2));await info.attach('raw-observations.json',{path,contentType:'application/json'});
    expect(validationErrors).toEqual([]);
  } catch(error){await attachCase(page,info,{mode,result},error);throw error;}
});
