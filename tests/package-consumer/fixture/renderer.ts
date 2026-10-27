import * as root from 'scriptoscope';
import * as renderer from 'scriptoscope/renderer';
import type { ThemeInput, DisplayProfileData, CinfEnvironmentInput, ButtonOptions } from 'scriptoscope/renderer';

// @ts-expect-error The focused entry does not include the package manager API.
type NoLoader = typeof renderer.loadOwnedTheme;
// @ts-expect-error Unknown entry exports must not silently become any.
type NoUnknownExport = typeof renderer.nonexistentRendererExport;

export async function verifyRendererEntry() {
  const check = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
  const full = root as unknown as Record<string, unknown>;
  check(Object.keys(root).length === 75 && Object.keys(renderer).length === 44, 'Public namespace changed');
  for (const [key, value] of Object.entries(renderer)) check(value === full[key], `Renderer alias: ${key}`);
  check(await import('scriptoscope/renderer') === renderer, 'Repeated renderer import changed identity');
  const pixel = new renderer.PixelBuffer(2, 2);
  check(pixel instanceof root.PixelBuffer, 'Cross-entry PixelBuffer identity');
  const channel = Array.from({ length: 256 }, (_, i) => i);
  const data: DisplayProfileData = { version: 1, conditions: { purpose: 'authored renderer consumer' },
    evidence: [{ sha256: '0'.repeat(64), description: 'caller authored' }],
    devicePalette: [{ index: 0, rgb16: [0, 0, 0] }],
    mappings: [{ rgb16: [0, 0, 0], deviceIndex: 0, deviceRgb16: [0, 0, 0] }],
    producer: { model: 'rgb16-high-byte-table', channels: [channel, channel, channel] } };
  const environmentData: CinfEnvironmentInput = { version: 1, complete: true,
    providers: [{ kind: 'theme-fork', id: 'authored', complete: true }] };
  const bytes = new Uint8Array(286), view = new DataView(bytes.buffer);
  view.setUint32(0, 256); view.setUint32(4, 256); view.setUint32(12, 30);
  bytes.set(bytes.slice(0, 16), 256); view.setUint16(280, 28); view.setUint16(282, 30); view.setInt16(284, -1);
  for (const [producer, consumer] of [[renderer, root], [root, renderer]] as const) {
    const displayProfile = await producer.prepareDisplayProfile(structuredClone(data));
    const cinfEnvironment = await producer.prepareCinfEnvironment(structuredClone(environmentData));
    const owned = await root.loadOwnedKaleidoscopeScheme(bytes, { displayProfile, cinfEnvironment });
    const theme: ThemeInput = owned;
    check(owned.source.manifest.displayProfile === displayProfile, 'Prepared profile lost identity');
    const options: ButtonOptions = { label: 'authored' };
    check(await consumer.composeButton(theme, options) === null, 'Empty authored scheme unexpectedly has a button');
    owned.dispose(); owned.dispose();
    try { await consumer.composeProgress(theme, { length: 60 }); throw new Error('Disposed owner accepted'); }
    catch (error) {
      check(error instanceof DOMException && error.name === 'AbortError' && error.code === 20 &&
        error.message === 'Raster owner disposed', 'Cross-entry disposal contract changed');
    }
  }
  for (const [prepare, ErrorClass, code, message] of [
    [renderer.prepareDisplayProfile, root.DisplayProfileError, 'INVALID_PROFILE', 'Display profile requires version, conditions and evidence identity'],
    [renderer.prepareCinfEnvironment, root.CinfEnvironmentError, 'INVALID_CINF_ENVIRONMENT', 'Declare version, completeness and ordered providers'],
    [renderer.prepareCicnTransferResults, root.CicnTransferError, 'INVALID_CICN_TRANSFER', 'Expected fields: version scope environment records'],
  ] as const) {
    try { await prepare({} as never); throw new Error('Invalid preparation accepted'); }
    catch (error) { check(error instanceof ErrorClass, 'Cross-entry public error class');
      const actual = error as Error & { code: string };
      check(actual.name === ({ INVALID_PROFILE: 'DisplayProfileError', INVALID_CINF_ENVIRONMENT: 'CinfEnvironmentError', INVALID_CICN_TRANSFER: 'CicnTransferError' }[code]) &&
        actual.code === code && actual.message === message, 'Explicit public error contract'); }
  }
}
