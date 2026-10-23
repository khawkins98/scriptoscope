import { readFileSync } from 'node:fs';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
const sourceSamples = JSON.parse(readFileSync(new URL('../decoder-fixtures/control-text-source-samples.json', import.meta.url)));
const crayonPins = JSON.parse(readFileSync(new URL('../resource-provenance/pattern-pins.json', import.meta.url)));

for (const mode of ['source', 'built']) test(`${mode}: raw masked text samples and emboss order survive actual loader and face owner selection`, async ({ page, servers }, info) => {
  info.annotations.push({ type: 'fidelity-assertion', description: 'text.masked-emboss-order' });
  await openHarness(page, servers, mode);
  let result;
  try {
    result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
      const { colorIcon, colorInfo } = await import('/tests/decoder-fixtures/control-colors.mjs');
      // All source pixels are masked. RGB must survive before canvas transport;
      // red text and green emboss are endpoint colors, independent of the LUT.
      const data = colorIcon({ entries: [[0, 0xffff, 0xffff, 0xffff], [1, 0xffff, 0, 0], [2, 0, 0xffff, 0]],
        pixels: [0, 1, 2, 0, 0, 0, 0, 0] });
      const ids = [-10239, -10238, -10240, -10175, -10174, -10176];
      const bytes = forkOf(ids.flatMap(id => [{ type: 'cicn', id, data }, { type: 'cinf', id, data: colorInfo({ emboss: [2, 0] }) }]));
      const owner = await api.loadKaleidoscopeScheme(bytes, { provenance: true });
      const child = { baseUrl: `${location.origin}/misleading-child/`, base: owner, manifest: { chromeElements: {} } };
      try {
        // Independent browser-font mask, not a historical glyph oracle. Only
        // full-coverage foreground/emboss pixels establish order and (+1,+1).
        const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 20;
        const ctx = canvas.getContext('2d'); ctx.font = '12px Chicago, "Charcoal", Geneva, sans-serif';
        const width = Math.ceil(ctx.measureText('H').width), glyphHeight = 16;
        const gx = Math.round((80 - width) / 2), gy = Math.round((20 - glyphHeight) / 2);
        ctx.fillStyle = '#000'; ctx.textBaseline = 'middle'; ctx.fillText('H', gx, gy + 8);
        const mask = ctx.getImageData(0, 0, 80, 20).data;
        const foreground = [], emboss = [];
        for (let y = 1; y < 20; y++) for (let x = 1; x < 80; x++) {
          if (mask[(y * 80 + x) * 4 + 3] === 255) foreground.push([x, y]);
          else if (mask[(y * 80 + x) * 4 + 3] === 0 && mask[((y - 1) * 80 + x - 1) * 4 + 3] === 255) emboss.push([x, y]);
        }
        const rows = [];
        for (const family of ['push', 'bevel']) for (const state of ['normal', 'pressed', 'disabled']) for (const override of [false, true]) {
          let trace;
          const output = await api[family === 'push' ? 'composeButton' : 'composeBevelButton'](child, { label: 'H', minWidth: 80, height: 20, ...(family === 'bevel' ? { small: true } : {}),
            pressed: state === 'pressed', disabled: state === 'disabled', ...(override ? { fg: '#0000ff' } : {}), diagnostics: { onComplete: value => { trace = value; } } });
          rows.push({ family, state, override, size: [output.width, output.height], trace,
            foreground: foreground.map(([x, y]) => [...output.getPixel(x, y)]), emboss: emboss.map(([x, y]) => [...output.getPixel(x, y)]) });
        }
        return { rows, foregroundCount: foreground.length, embossCount: emboss.length, metadata: Object.values(owner.manifest.chromeElements).map(e => e.colorSamples) };
      } finally { owner.dispose(); }
    }, mode);
    expect(result.foregroundCount).toBeGreaterThan(0); expect(result.embossCount).toBeGreaterThan(0);
    expect(result.rows.filter(r => r.state === 'normal' && !r.override).map(r => r.family).sort()).toEqual(['bevel', 'push']);
    for (const row of result.rows) {
      expect(row.trace.requested).toMatchObject({ state: row.state === 'normal' ? 'active' : row.state === 'disabled' ? 'inactive' : 'pressed', pressed: row.state === 'pressed', disabled: row.state === 'disabled' });
      expect(row.trace.textColors.embossDecision).toBe(row.override ? 'caller-override' : 'present');
      expect(row.size).toEqual([80, 20]);
      for (const pixel of row.foreground) expect(pixel).toEqual(row.override ? [0, 0, 255, 255] : [255, 0, 0, 255]);
      // Suppressing emboss reveals the independently encoded white body,
      // including when its background RGB sample is masked in the source cicn.
      for (const pixel of row.emboss) expect(pixel).toEqual(row.override ? [255, 255, 255, 255] : [0, 255, 0, 255]);
      expect(row.trace.textColors).toMatchObject({ policy: row.override ? 'caller-override' : 'source-samples', sourceOwnerDepth: 1, labelPainted: true, deviceMode: 'full-color-policy' });
      const selected = row.trace.steps.find(s => s.role === 'face' && s.action === 'selected');
      expect(row.trace.textColors.sourceManifestKey).toBe(selected.resource.manifestKey);
      expect(selected.resource).toMatchObject({ signedId: { push: { normal: -10239, pressed: -10238, disabled: -10240 }, bevel: { normal: -10175, pressed: -10174, disabled: -10176 } }[row.family][row.state] });
      expect(selected.owner.chainDepth).toBe(1);
      expect(selected.resource.manifestKey).toBe(`cicn-${{ push: { normal: -10239, pressed: -10238, disabled: -10240 }, bevel: { normal: -10175, pressed: -10174, disabled: -10176 } }[row.family][row.state]}`);
      expect(selected.resource.byteProvenance.cinfResourceIndex).not.toBeNull();
    }
    await attachObservations(info, 'control-text-colors', `${mode}-masked`, { mode, result,
      limits: 'Actual source samples/owner/order; independent current browser-font mask is not original glyph/transfer evidence' });
  } catch (error) { await attachCase(page, info, { mode, result }, error); throw error; }
});

for (const mode of ['source', 'built']) test(`${mode}: Crayon push and bevel labels consume independently pinned authored RGB16`, async ({ page, servers }, info) => {
  info.annotations.push({ type: 'fidelity-assertion', description: 'text.authored-rgb16' });
  await openHarness(page, servers, mode);
  let result;
  try {
    result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const owner = await api.loadTheme('/themes/crayon-os', { provenance: true });
      try {
        const rows = [];
        for (const family of ['push', 'bevel']) for (const state of ['normal', 'pressed', 'disabled']) {
          let trace;
          const output = await api[family === 'push' ? 'composeButton' : 'composeBevelButton'](owner, { label: 'H', minWidth: 80, height: 20, ...(family === 'bevel' ? { small: true } : {}),
            pressed: state === 'pressed', disabled: state === 'disabled', diagnostics: { onComplete: value => { trace = value; } } });
          const empty = await api[family === 'push' ? 'composeButton' : 'composeBevelButton'](owner, { label: '', minWidth: 80, height: 20, ...(family === 'bevel' ? { small: true } : {}),
            pressed: state === 'pressed', disabled: state === 'disabled' });
          const selected = trace.steps.find(s => s.role === 'face' && s.action === 'selected'), entry = owner.manifest.chromeElements[selected.resource.manifestKey];
          const bytes = owner.byteProvenance.resources;
          const reference = entry.byteProvenance;
          const selectedResources = bytes.filter(r => r.resourceIndex === reference.cicnResourceIndex || r.resourceIndex === reference.cinfResourceIndex);
          const wanted = state === 'disabled' ? 152 : 48;
          let count = 0;
          for (let y = 8; y < Math.min(output.height - 4, 22); y++) for (let x = 30; x < 58; x++) {
            const p = output.getPixel(x, y), before = empty.getPixel(x, y);
            if (p[0] === wanted && p[1] === wanted && p[2] === wanted && p[3] === 255 && p.some((v, i) => v !== before[i])) count++;
          }
          rows.push({ family, state, trace, colors: entry.colorSamples, selectedResources, count });
        }
        return { rows, load: owner.byteProvenance };
      } finally { owner.dispose(); }
    }, mode);
    expect(result.load.input.sha256).toBe(crayonPins.archiveSha256);
    expect(result.load.fork.sha256).toBe(crayonPins.forkSha256);
    expect(result.rows.filter(r => (r.family === 'push' && r.state !== 'pressed') || (r.family === 'bevel' && r.state === 'normal')).map(r => `${r.family}/${r.state}`).sort()).toEqual(['bevel/normal', 'push/disabled', 'push/normal']);
    for (const row of result.rows) {
      expect(row.trace.requested).toMatchObject({ state: row.state === 'normal' ? 'active' : row.state === 'disabled' ? 'inactive' : 'pressed', pressed: row.state === 'pressed', disabled: row.state === 'disabled' });
      const selected = row.trace.steps.find(s => s.role === 'face' && s.action === 'selected');
      const expectedId = { push: { normal: -10239, pressed: -10238, disabled: -10240 }, bevel: { normal: -10175, pressed: -10174, disabled: -10176 } }[row.family][row.state];
      const expectedKey = `${row.family === 'push' ? 'push-button' : 'small-bevel-button-off'}-${row.state === 'normal' ? 'active' : row.state === 'disabled' ? 'inactive' : 'pressed'}`;
      expect(selected.resource).toMatchObject({ type: 'cicn', signedId: expectedId, sourceCinfId: expectedId, manifestKey: expectedKey });
      expect(selected.owner.chainDepth).toBe(0);
      expect(row.trace.textColors).toMatchObject({ policy: 'source-samples', labelPainted: true, sourceManifestKey: expectedKey, sourceOwnerDepth: 0 });
      const pin = sourceSamples.samples.find(s => s.id === selected.resource.signedId);
      expect(pin).toBeTruthy();
      expect(row.colors.text.rgb16).toEqual(pin.textRgb16);
      expect(row.colors.text.displayRgb).toEqual(row.state === 'disabled' ? [152, 152, 152] : [48, 48, 48]);
      expect(row.count).toBeGreaterThan(0);
      expect(row.colors.embossDecision).toBe('absent-coordinates'); expect(row.trace.textColors.emboss).toBeNull();
      for (const resource of row.selectedResources) expect(resource.sha256).toBe(resource.type === 'cicn' ? pin.cicnSha256 : pin.cinfSha256);
      expect(row.selectedResources).toHaveLength(2);
    }
    await attachObservations(info, 'control-text-colors', `${mode}-crayon`, { mode, sourceSamples, result,
      limits: 'Palette samples and current display policy only; original device palette, transfer modes and glyphs remain unverified' });
  } catch (error) { await attachCase(page, info, { mode, result, sourceSamples }, error); throw error; }
});

for (const mode of ['source', 'built']) test(`${mode}: unobserved duplicate image bindings retain explicit unknown text colors`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const result = await page.evaluate(async mode => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
    const { colorIcon, colorInfo } = await import('/tests/decoder-fixtures/control-colors.mjs');
    const bytes = forkOf([
      { type: 'cicn', id: -10239, name: 'same', data: colorIcon({ entries: [[0, 0xffff, 0, 0]], pixels: Array(8).fill(0), mask: [0xf0, 0xf0] }) },
      { type: 'cicn', id: -10239, name: 'same', data: colorIcon({ entries: [[0, 0, 0, 0xffff]], pixels: Array(8).fill(0), mask: [0xf0, 0xf0] }) },
      { type: 'cinf', id: -10239, data: colorInfo() },
    ]);
    const theme = await api.loadKaleidoscopeScheme(bytes);
    try {
      let trace,error,completions=0;
      try {await api.composeButton(theme,{label:'H',minWidth:80,height:20,diagnostics:{onComplete:value=>{trace=value;completions++;}}});}
      catch(e){error={name:e.name,message:e.message};}
      const unique=await api.loadKaleidoscopeScheme(forkOf([
        {type:'cicn',id:-10239,name:'unique-red',data:colorIcon({origin:0,entries:[[0,0xffff,0,0]],pixels:Array(8).fill(0),mask:[0xf0,0xf0]})},
        {type:'cinf',id:-10239,data:colorInfo()},
      ]),{provenance:true});
      try {
        let positiveTrace;const output=await api.composeButton(unique,{label:'H',minWidth:80,height:20,diagnostics:{onComplete:t=>{positiveTrace=t;}}});
        return {trace,error,completions,entries:Object.values(theme.manifest.chromeElements).map(e=>({colors:e.colorSamples,reason:e.colorSamplesUnavailableReason})),
          positive:{trace:positiveTrace,corner:[...output.getPixel(0,0)],sample:unique.manifest.chromeElements['unique-red'].colorSamples,loadId:unique.byteProvenance.loadId}};
      }finally{unique.dispose();}
    } finally { theme.dispose(); }
  }, mode);
  expect(result.error).toMatchObject({name:'Error',message:expect.stringContaining('ambiguous or undecoded raw cicn occurrence')});
  expect(result.completions).toBe(1);expect(result.trace.outcome.status).toBe('error');expect(result.trace.bandPaints??[]).toEqual([]);
  expect(result.positive.corner).toEqual([255,0,0,255]);
  expect(result.positive.sample.text).toMatchObject({rgb16:[65535,0,0],displayRgb:[255,0,0]});
  const selected=result.positive.trace.steps.find(s=>s.role==='face'&&s.usage==='paint'&&s.resource?.type==='cicn');
  expect(selected.resource).toMatchObject({signedId:-10239,manifestKey:'unique-red',byteProvenance:{loadId:result.positive.loadId,cicnResourceIndex:0}});
  expect(result.entries).toEqual(Array(2).fill({ colors: null, reason: 'ambiguous-asset-path' }));
  expect(result.positive.trace.textColors).toMatchObject({policy:'source-samples',foreground:'rgb(255, 0, 0)'});
  await attachObservations(info, 'control-text-colors', `${mode}-ambiguous`, { mode, result });
});
