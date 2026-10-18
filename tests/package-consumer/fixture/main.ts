import { VERSION, prepareDisplayProfile, DisplayProfileError, type DisplayProfileData, loadKaleidoscopeScheme, composeTab, composeHeaderSurface,
  type ControlDiagnostics, type TabBodyTrace, type CicnSamplingEquivalence, type CicnSampledBandAsset, type CicnBodyBinding, type HeaderSurfaceOptions, type HeaderSurfaceResult, type HeaderSurfaceTrace } from 'scriptoscope';
import { mountDeclarative, type MountHandle } from 'scriptoscope/declarative';
import 'scriptoscope/scriptoscope.css';

const root = document.querySelector<HTMLElement>('#consumer-root')!;
const article = root.querySelector<HTMLElement>('article')!;
const inputs = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select')];
const events: { type: string; value: string }[] = [];
root.addEventListener('input', event => events.push({ type: event.type, value: (event.target as HTMLInputElement).value }));
root.addEventListener('change', event => events.push({ type: event.type, value: (event.target as HTMLInputElement).value }));

// Installed declaration graph must expose additive tab diagnostics without
// resolving repository-only modules. The fixture does not change its UI.
const tabDiagnostics: ControlDiagnostics = { onComplete(trace) { const body: TabBodyTrace | undefined = trace.tabBody; void body; } };
const tabOptions: NonNullable<Parameters<typeof composeTab>[1]> = { selected: true, diagnostics: tabDiagnostics };
void tabOptions;
const samplingDeclaration: CicnSamplingEquivalence = {
  model: 'kaleidoscope-2.3.1-opaque-sampling-v1', comparison: 'opaque-current-display-rgb',
  displayPolicy: 'mac-1.8-to-2.2-high-byte', width: 4, height: 2,
  status: 'unknown', reason: 'missing-sampler',
};
void samplingDeclaration;
const companionDeclaration: CicnSampledBandAsset = {
  model: 'kaleidoscope-2.3.1-opaque-sampling-v1', comparison: 'opaque-current-display-rgb',
  displayPolicy: 'mac-1.8-to-2.2-high-byte', width: 7, height: 7,
  asset: 'cicn-sampled/fixture.png', derivedPath: 'cicn-sampled/fixture.png',
};
void companionDeclaration;
const headerOptions: HeaderSurfaceOptions = { kind: 'window-header', width: 80, height: 18, drawState: 1,
  compositionContext: { controlOrigin: [0, 0], portOrigin: [0, 0], patternOrigin: { status: 'unknown' }, clip: { kind: 'unbounded' } },
  diagnostics: { onComplete(trace) { const surface: HeaderSurfaceTrace | undefined = trace.headerSurface; void surface; } } };
const headerResult: HeaderSurfaceResult = { status: 'unsupported', reason: 'unverified-line-sampling' };
void headerOptions; void headerResult;
const bodyDeclaration: CicnBodyBinding = { model: 'kaleidoscope-2.3.1-cicn-body-v1',
  selectionPolicy: 'unique-same-face-owner', requestedId: 0, status: 'missing', reason: 'same-owner-resource-absent' };
void bodyDeclaration;

const consumer = {
  version: VERSION,
  decoderExport: typeof loadKaleidoscopeScheme,
  headerSurfaceExport: typeof composeHeaderSurface,
  root, article, inputs, events,
  handle: null as MountHandle | null,
  ready: Promise.resolve(),
};
declare global { interface Window { packedConsumer: typeof consumer } }
window.packedConsumer = consumer;
consumer.ready = (async () => {
  const channel = Array.from({ length: 256 }, (_, i) => i);
  const data: DisplayProfileData = { version: 1, conditions: { kind: 'package-boundary-negative' },
    evidence: [{ sha256: '0'.repeat(64), description: 'Synthetic finite profile, not original evidence' }],
    devicePalette: [{ index: 0, rgb16: [0, 0, 0] }],
    mappings: [{ rgb16: [0, 0, 0], deviceIndex: 0, deviceRgb16: [0, 0, 0] }],
    producer: { model: 'rgb16-high-byte-table', channels: [channel, channel, channel] } };
  const displayProfile = await prepareDisplayProfile(data);
  let encoded = 0, rejected = false;
  const bytes = new Uint8Array(await (await fetch(`${import.meta.env.BASE_URL}themes/windows-95/scheme.sit`)).arrayBuffer());
  try { await loadKaleidoscopeScheme(bytes, { displayProfile, assetUrlFactory: () => { encoded++; return 'invalid'; } }); }
  catch (error) { if (!(error instanceof DisplayProfileError) || error.code !== 'MISSING_MAPPING') throw error; rejected = true; }
  if (!rejected || encoded) throw new Error('Packed profile failed to reject missing colors before encoding');
  consumer.handle = await mountDeclarative({
    root, pageThemeDefault: 'windows-95',
    themeBaseUrl: `${import.meta.env.BASE_URL}themes`,
    themes: [{ slug: 'windows-95', source: 'scheme.sit' }],
    bootAffordance: 'none', rejectOnEmptyMount: true,
  });
})();
