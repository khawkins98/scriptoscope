import { verifyFiniteTransfer } from './finite-transfer.js';
import { verifyRendererEntry } from './renderer.js';
import { VERSION, prepareCinfEnvironment, type CinfEnvironmentInput, type PreparedCinfEnvironment, prepareBitmapFont, type BitmapFontData, type PreparedBitmapFont, type BitmapTextPaint, prepareDisplayProfile, DisplayProfileError, type DisplayProfileData, loadKaleidoscopeScheme, loadTheme, renderWindow, composeTab, composeHeaderSurface,
  type ThemeInspector, type WindowByteProvenance, type ButtonOptions, type BevelButtonOptions, type ControlDiagnostics, type TabBodyTrace, type CicnSamplingEquivalence, type CicnSampledBandAsset, type CicnBodyBinding, type HeaderSurfaceOptions, type HeaderSurfaceResult, type HeaderSurfaceTrace } from '@khawkins98/scriptoscope';
import { createOwnedThemeResolver, ScriptoscopeWindow, promoteGuardedControl, restoreControl } from '@khawkins98/scriptoscope/declarative';
import { WindowManager, type ThemeInput, type ManagedWindowState } from '@khawkins98/scriptoscope';
import '@khawkins98/scriptoscope/scriptoscope.css';

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

const archiveDetached = (archive: Uint8Array) => archive.byteLength === 0;
const consumer = {
  version: VERSION,
  decoderExport: typeof loadKaleidoscopeScheme,
  headerSurfaceExport: typeof composeHeaderSurface,
  directProfilePixels: [] as number[],
  builtInFrame: null as HTMLElement | null,
  decodeWorker: {} as Record<string, { same: boolean; assets: number }>,
  wrappedWorker: null as { same: boolean; assets: number } | null,
  root, article, inputs, events,
  handle: null as { disconnect(): void } | null,
  ready: Promise.resolve(),
};
declare global { interface Window { packedConsumer: typeof consumer } }
window.packedConsumer = consumer;
consumer.ready = (async () => {
  await verifyRendererEntry();
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
  const sliderMarker = sliderLoaded.manifest.sliderLayoutEnvironment;
  if (!sliderMarker || sliderMarker.environmentId !== cinfEnvironment.id
    || !sliderMarker.bindingId.startsWith('cinf-binding:') || !Object.isFrozen(sliderMarker)
    || Object.keys(sliderMarker).sort().join(',') !== 'bindingId,environmentId'
    || !sliderThumb || 'sliderLayoutCinf' in sliderThumb) throw new Error('Packed slider identity marker failed');
  const sliderFromDirectory = await loadTheme(`${import.meta.env.BASE_URL}themes/windows-95`, { sliderLayoutEnvironment: cinfEnvironment });
  if (sliderFromDirectory.manifest.sliderLayoutEnvironment?.environmentId !== cinfEnvironment.id
    || !Object.isFrozen(sliderFromDirectory.manifest.sliderLayoutEnvironment)) throw new Error('Packed directory slider option failed');
  // The removed decoded role and summary fields must also be absent from the installed declaration graph.
  // @ts-expect-error slider marker is opaque identity, with no scope summary
  void sliderMarker.scope;
  // @ts-expect-error decoded slider roles belong to the typed engine adapter
  void sliderThumb.sliderLayoutCinf;
  // A no-wnd# scheme renders through the lazily imported built-in-frame
  // compositor chunk; windows-95 alone would never request that chunk.
  const builtInTheme = await loadTheme(`${import.meta.env.BASE_URL}themes/platinum-8`, { source: 'scheme.sit' });
  consumer.builtInFrame = await renderWindow(builtInTheme, { title: 'Built-in frame', width: 160, height: 60 });
  document.querySelector('#consumer-builtin-frame')!.append(consumer.builtInFrame);
  // Opt-in off-main-thread decoding through the packed `./decode-worker` export, exactly
  // as the consumer guide writes it. Both archives share the one caller-owned worker
  // and must decode to what the main thread produces.
  const decodeWorker = new Worker(new URL('@khawkins98/scriptoscope/decode-worker', import.meta.url), { type: 'module' });
  type RawDecode = { manifest: unknown; assets: { path: string; width: number; height: number; rgba: Uint8Array }[] };
  const rawDecode = async (archive: Uint8Array, worker?: Worker) => await loadKaleidoscopeScheme(archive,
    { encodeAssets: false, source: 'packed-consumer', ...(worker ? { decodeWorker: worker } : {}) }) as unknown as RawDecode;
  const decodeInputs = { 'windows-95': bytes,
    'platinum-8': new Uint8Array(await (await fetch(`${import.meta.env.BASE_URL}themes/platinum-8/scheme.sit`)).arrayBuffer()) };
  const offThread = await Promise.all(Object.values(decodeInputs).map(archive => rawDecode(archive, decodeWorker)));
  for (const [index, [slug, archive]] of Object.entries(decodeInputs).entries()) {
    const main = await rawDecode(archive), off = offThread[index]!;
    const same = JSON.stringify(off.manifest) === JSON.stringify(main.manifest) && off.assets.length === main.assets.length
      && main.assets.every((asset, i) => { const other = off.assets[i]!;
        return other.path === asset.path && other.width === asset.width && other.height === asset.height
          && other.rgba.length === asset.rgba.length && other.rgba.every((value, at) => value === asset.rgba[at]); });
    consumer.decodeWorker[slug] = { same, assets: off.assets.length };
  }
  if (archiveDetached(bytes)) throw new Error('The decode worker detached the caller\'s archive bytes');
  decodeWorker.terminate();
  // The other documented shape: the consumer's own worker file importing the entry.
  const wrapped = new Worker(new URL('./own-worker.ts', import.meta.url), { type: 'module' });
  const viaWrapped = await rawDecode(bytes, wrapped), onMain = await rawDecode(bytes);
  consumer.wrappedWorker = { assets: viaWrapped.assets.length, same: JSON.stringify(viaWrapped.manifest) === JSON.stringify(onMain.manifest)
    && viaWrapped.assets.every((asset, i) => asset.rgba.length === onMain.assets[i]!.rgba.length && asset.rgba.every((value, at) => value === onMain.assets[i]!.rgba[at])) };
  wrapped.terminate();
  const resolver = createOwnedThemeResolver({ themeBaseUrl: `${import.meta.env.BASE_URL}themes`,
    themes: [{ slug: 'windows-95', source: 'scheme.sit' }] });
  const lifetime = new AbortController();
  const theme = await resolver.load('windows-95');
  const manager = new WindowManager<ThemeInput>();
  const promoted = await ScriptoscopeWindow.promote(article, { manager, theme, signal: lifetime.signal });
  for (const input of inputs) {
    const face = await promoteGuardedControl(input, theme, lifetime.signal,
      () => !lifetime.signal.aborted && root.contains(input));
    if (!face) throw new Error('Selected package control did not attach');
  }
  const state: ManagedWindowState = { z: 850 };
  await manager.applyState(promoted.host, state, lifetime.signal);
  await manager.refreshScrollbars(promoted.host);
  consumer.handle = { disconnect() {
    lifetime.abort();
    inputs.forEach(restoreControl);
    promoted.restoreOriginalElement();
    resolver.dispose();
  } };
})();
