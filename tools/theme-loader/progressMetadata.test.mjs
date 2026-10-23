// Independent public contract: issues #436 and #459, not a drawing oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { forkOf, faceBytes } from '../../tests/decoder-fixtures/cinf-environment.mjs';

// Mutation is confined to the test process; no production file is rewritten.
if (['loader-model', 'inspector-model', 'sample-role'].includes(process.env.SCRIPTOSCOPE_459_MUTATION)) registerHooks({
  load(url, context, next) {
    const result = next(url, context);
    if (url.endsWith('/classifyResources.js')) {
      let source = String(result.source);
      if (process.env.SCRIPTOSCOPE_459_MUTATION === 'sample-role') source = source.replace(
        'procedural progress colour samples (three pixels; not track art)', 'progress TRACK');
      else if (process.env.SCRIPTOSCOPE_459_MUTATION === 'inspector-model') source = source.replace(
        'theme: themeSlug,', 'theme: themeSlug, progress: { model: "lavender" },');
      else source += '\nexport function progressSummary() { return { model: "lavender" }; }\n';
      assert.notEqual(source, String(result.source), 'loader mutation must apply');
      return { ...result, source };
    }
    return result;
  },
});
const roles = await import('./classifyResources.js');
const { loadKaleidoscopeScheme } = await import('./loadKaleidoscopeScheme.js');

test('retired progress model is absent from classifier and actual public loader inspector', async () => {
  assert.equal('progressSummary' in roles, false, 'progressSummary must not be exported');
  for (const ids of [[], [-10223], [-10224], [-10220, -10221, -10222, -10223, -10224]]) {
    const bytes = forkOf(ids.map(id => ({ type: 'cicn', id, name: `sample${-id}`, data: faceBytes() })));
    const loaded = await loadKaleidoscopeScheme(bytes, {
      encodeAssets: true, assetUrlFactory: (_rgba, _width, _height, path) => `test:${path}`,
    });
    const actual = loaded.inspector.resourceRoles;
    assert.equal('progress' in actual, false, 'resourceRoles.progress must not exist, even as null');
    assert.equal(actual.resources.filter(r => r.type === 'cicn').length, ids.length);
    assert.ok('scrollArrows' in actual, 'unrelated inspector mapping survives');
    loaded.dispose();
  }
});

test('CDEF 5 roles distinguish unused -10223 and three colour samples -10224 regardless of author label', () => {
  for (const name of [null, 'lavender fill', 'progress track', 'FRAME inactive']) {
    const unused = roles.classify(-10223, 'cicn', name);
    assert.equal(unused.family, 'progress');
    assert.match(unused.role, /unused|not requested/i);
    assert.doesNotMatch(unused.role, /lavender|FILL|TRACK|FRAME/);
    const samples = roles.classify(-10224, 'cicn', name);
    assert.equal(samples.family, 'progress');
    assert.match(samples.role, /(?:colour|color) samples/i);
    assert.match(samples.role, /three|3/);
    assert.doesNotMatch(samples.role, /progress TRACK|progress FILL|progress FRAME/);
  }
});

test('public TypeScript consumers cannot import ThemeProgressModel or access the retired property', () => {
  const fixture = fileURLToPath(new URL('./__progress_contract__.ts', import.meta.url));
  const source = `
    import type { ThemeInspector, ThemeScrollArrowMap } from '../../src/index.js';
    // @ts-expect-error #436 removes this public export
    import type { ThemeProgressModel } from '../../src/index.js';
    // @ts-expect-error #436 removes this property, including optional/null forms
    type Removed = ThemeInspector['resourceRoles']['progress'];
    const preserved: ThemeInspector['resourceRoles']['scrollArrows'] = null as ThemeScrollArrowMap | null;
    void preserved;
  `;
  const options = { noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, types: [] };
  const host = ts.createCompilerHost(options), originalRead = host.readFile.bind(host);
  host.readFile = path => {
    if (path === fixture) return source;
    const text = originalRead(path);
    if (process.env.SCRIPTOSCOPE_459_MUTATION !== 'public-model' || !text) return text;
    if (path.endsWith('/src/types.ts')) return text.replace('resourceRoles: {', 'resourceRoles: { progress?: ThemeProgressModel;') + '\nexport interface ThemeProgressModel { model: string }\n';
    if (path.endsWith('/src/index.ts')) return text + '\nexport type { ThemeProgressModel } from "./types.js";\n';
    return text;
  };
  const program = ts.createProgram([fixture], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.map(d => `${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`), [],
    'removed public model must produce the expected compiler errors');
});
