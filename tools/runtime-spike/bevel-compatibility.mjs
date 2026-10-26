// Explicit modern compatibility inputs derived from the current approximation.
// These are not decoded cinf resources or evidence of original-engine behavior.
import { ResourceChain, mapProvider } from '../../src/engine/resources/chain.ts';
import { controlTextColors } from '../../src/controlTextColors.ts';

export function prepareCompatibilityFrame(chain, id, source, element, owner, opts, mode) {
  if (chain.probe('cinf', [id, 0])) return null;
  const corner = element.slice?.corner ?? Math.max(2, Math.floor((Math.min(source.width, source.height) - 3) / 2));
  const side = element.slice?.side ?? corner;
  const bg = element.bgAnchor, text = element.textAnchor;
  const valid = !element.bgPattern && bg && Number.isInteger(bg[0]) && Number.isInteger(bg[1])
    && bg[0] >= 0 && bg[0] < source.width && bg[1] >= 0 && bg[1] < source.height && source.getPixel(...bg)[3] > 0;
  if (element.bodyRequest || element.slice && valid)
    throw new Error('prototype: missing-cinf body branch requires separate preparation');
  const x = valid ? bg[0] : text ? Math.max(0, Math.min(source.width - 1, text[0] - 3)) : corner;
  const y = valid ? bg[1] : text ? Math.max(0, Math.min(source.height - 1, text[1])) : corner;
  const sample = source.getPixel(x, y), [red, green, blue] = sample;
  const dark = 0.299 * red + 0.587 * green + 0.114 * blue < 128;
  const fallback = opts.disabled ? dark ? '#b0b0b0' : '#707070' : dark ? '#ffffff' : '#000000';
  const colors = controlTextColors(element, opts.fg, fallback, owner.manifest);
  const prepared = { colors, corner, side, sample, source,
    insets: { l: corner, t: side, r: corner, b: side }, mode: element.slice?.tile ? 'tile' : 'stretch' };
  if (mode === 'rectangular') return { ...prepared, kind: 'rectangular-compatibility' };
  const record = { cornerSize: corner, sideThickness: side, tileSides: element.slice?.tile ? 1 : 0,
    patternAnchor: 1, bgPatternId: 0, bgPixel: { x, y }, textPixel: { x, y }, embossPixel: { x: 0, y: 0 } };
  return { ...prepared, kind: 'inferred-cinf',
    chain: new ResourceChain([...chain.providers, mapProvider('compatibility:bevel', 'cinf', [[`cinf:${id}`, record]])],
      mapProvider('compatibility:empty-body', 'cinf', [])) };
}

export function drawPreparedCompatibility(out, prepared) {
  const { source, corner, side, insets, mode, sample } = prepared;
  out.nineSlice(source, { x: 0, y: 0, w: source.width, h: source.height }, insets,
    { x: 0, y: 0, w: out.width, h: out.height }, mode);
  const width = out.width - corner * 2, height = out.height - side * 2;
  if (sample[3] > 0 && width > 0 && height > 0)
    out.fillRect({ x: corner, y: side, w: width, h: height }, sample[0], sample[1], sample[2], 255);
}
