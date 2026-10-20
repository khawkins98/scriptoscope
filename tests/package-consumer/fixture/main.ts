import { verifyFiniteTransfer } from './finite-transfer.js';
import { VERSION, prepareCinfEnvironment, type CinfEnvironmentInput, type PreparedCinfEnvironment, prepareBitmapFont, type BitmapFontData, type PreparedBitmapFont, type BitmapTextPaint, prepareDisplayProfile, DisplayProfileError, type DisplayProfileData, loadKaleidoscopeScheme, composeTab, composeHeaderSurface,
  type ThemeInspector, type WindowByteProvenance, type ButtonOptions, type BevelButtonOptions, type ControlDiagnostics, type TabBodyTrace, type CicnSamplingEquivalence, type CicnSampledBandAsset, type CicnBodyBinding, type HeaderSurfaceOptions, type HeaderSurfaceResult, type HeaderSurfaceTrace } from 'scriptoscope';
import { mountDeclarative, type MountHandle } from 'scriptoscope/declarative';
import 'scriptoscope/scriptoscope.css';

const iconMaskDeclaration: ThemeInspector['iconMaskResources'] = [{ id: -10234, resourceIndex: 0, byteLength: 64 }];
const iconOccurrenceDeclaration: ThemeInspector['iconIndex'][number]['resourceIndex'] = 1;
void iconMaskDeclaration; void iconOccurrenceDeclaration;

const root = document.querySelector<HTMLElement>('#consumer-root')!;
const article = root.querySelector<HTMLElement>('article')!;
const inputs = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select')];
const events: { type: string; value: string }[] = [];
root.addEventListener('input', event => events.push({ type: event.type, value: (event.target as HTMLInputElement).value }));
root.addEventListener('change', event => events.push({ type: event.type, value: (event.target as HTMLInputElement).value }));

// Installed declaration graph must expose additive tab diagnostics without
// resolving repository-only modules. The fixture does not change its UI.
const tabDiagnostics: ControlDiagnostics = { onComplete(trace) { const body: TabBodyTrace | undefined = trace.tabBody;
  const legacyOccupancy: number | undefined = trace.legacyFacePaint?.retainedNonzeroAlphaPixels;
  void body; void legacyOccupancy; } };
const tabOptions: NonNullable<Parameters<typeof composeTab>[1]> = { selected: true, diagnostics: tabDiagnostics };
void tabOptions;
const windowBinding: WindowByteProvenance | undefined = undefined;
void windowBinding;
const buttonTypography: ButtonOptions = { label: 'OK', fontSize: 12, height: 24 };
const bevelTypography: BevelButtonOptions = { label: 'OK', fontSize: 16 };
void buttonTypography; void bevelTypography;
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
  directProfilePixels: [] as number[],
  root, article, inputs, events,
  handle: null as MountHandle | null,
  ready: Promise.resolve(),
};
declare global { interface Window { packedConsumer: typeof consumer } }
window.packedConsumer = consumer;
consumer.ready = (async () => {
  await verifyFiniteTransfer();
  const bitmapData: BitmapFontData = { version: 1, strikeSize: 12,
    metrics: { ascent: 8, descent: 2, leading: 1 },
    provenance: { kind: 'caller-declared', description: 'Owned synthetic packed-consumer glyph' },
    glyphs: [{ character: 'x', advance: 2, bearingX: 0, bearingY: -1, width: 1, height: 1, mask: [1] }] };
  const bitmapFont: PreparedBitmapFont = await prepareBitmapFont(bitmapData);
  const preparedOptions: ButtonOptions = { bitmapFont, label: 'x', diagnostics: { onComplete(trace) {
    const paint: BitmapTextPaint | undefined = trace.bitmapTextPaint; void paint;
  } } };
  if (!bitmapFont.id.startsWith('bitmap-font:') || !Object.isFrozen(bitmapFont.data.glyphs[0]!.mask)) throw new Error('Packed bitmap font preparation failed');
  void preparedOptions;
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
  // Owned literal 2x2 RGBDirect ppat (version 1, padded rows and varied unused
  // high bytes). This is embedded input, not an import from repository tooling.
  const directFork = Uint8Array.from(atob('AAAAEAAAAHoAAABqAAAAMgAAAGYAAQAAABwAAABOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAMAAAAAAACAAIAAQAAAAAAAABIAAAASAAAABAAIAADAAgAAAAAAAAAAAAAAAAAqqqq/7u7u15eXl5V3d3dqqqqql5eXl4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAyAABwcGF0AAAACgCA//8AAAAAAAAAAA=='), c => c.charCodeAt(0));
  const directData: DisplayProfileData = { ...data, version: 2,
    devicePalette: [{ index: 0, rgb16: [0, 0, 0] }, { index: 1, rgb16: [0x1234, 0x5678, 0x9abc] }],
    directRgb8: { operation: 'GetPixPat-FillCRect-patCopy', context: 'declared-context0', scope: 'preparation-only',
      evidence: data.evidence,
      mappings: [170, 187, 221].map(v => ({ rgb8: [v, v, v] as const,
        deviceIndex: 1, deviceRgb16: [0x1234, 0x5678, 0x9abc] as const })) } };
  const directProfile = await prepareDisplayProfile(directData);
  let directAssets = 0;
  const directLoaded = await loadKaleidoscopeScheme(directFork, { displayProfile: directProfile,
    assetUrlFactory: (rgba, width, height) => {
      if (width !== 2 || height !== 2) throw new Error('Packed direct asset geometry drift');
      directAssets++; consumer.directProfilePixels = [...rgba]; return 'owned:direct-pattern';
    } });
  if (directAssets !== 1 || directLoaded.manifest.displayProfile !== directProfile
    || !Object.values(directLoaded.manifest.patterns ?? {}).some(p => p.sourcePpatId === 128 && p.asset === 'owned:direct-pattern'))
    throw new Error('Packed v2 direct asset/profile join failed');
  const cinfData: CinfEnvironmentInput = { version: 1, complete: true, providers: [{ kind: 'theme-fork', id: 'actual', complete: true }] };
  const cinfEnvironment: PreparedCinfEnvironment = await prepareCinfEnvironment(cinfData);
  const cinfLoaded = await loadKaleidoscopeScheme(bytes, { cinfEnvironment, encodeAssets: false });
  const cinfFace = Object.values(cinfLoaded.manifest.chromeElements).find(e => e.sourceCicnId === -10239);
  if (!cinfEnvironment.id.startsWith('cinf-environment:') || cinfFace?.bodyCinf?.status !== 'ready'
    || cinfFace.bodyCinf.selected?.providerId !== 'actual') throw new Error('Packed cinf environment/role view failed');
  const sliderLoaded = await loadKaleidoscopeScheme(bytes, { sliderLayoutEnvironment: cinfEnvironment, encodeAssets: false });
  const sliderThumb = Object.values(sliderLoaded.manifest.chromeElements).find(e => e.sourceCicnId === -10129);
  if (sliderLoaded.manifest.sliderLayoutEnvironment?.scope !== 'standalone-group2-slider-layout'
    || sliderThumb?.sliderLayoutCinf?.orientation !== 'horizontal'
    || !['ready', 'unsupported'].includes(sliderThumb.sliderLayoutCinf.status)) throw new Error('Packed slider layout role failed');
  consumer.handle = await mountDeclarative({
    root, pageThemeDefault: 'windows-95',
    themeBaseUrl: `${import.meta.env.BASE_URL}themes`,
    themes: [{ slug: 'windows-95', source: 'scheme.sit' }],
    bootAffordance: 'none', rejectOnEmptyMount: true,
  });
})();
