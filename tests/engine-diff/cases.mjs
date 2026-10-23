// Engine diff gate matrix (v2 PLAN §6). Each family renders a fixed sample of
// public inputs for every applicable archive, in Node, and reduces each call to
// a trace: resolved resource ids, named rects and the ordered draw steps, plus
// `pixels`, the sha256 of the output buffer. The gate (run.mjs) compares the
// traces cell by cell against the committed baseline. The pixel digest is there
// because composeWindowChrome passes no EngineTrace to the qd primitives, so a
// window trace alone cannot see, for example, a tile direction; it also catches
// a qd primitive change that leaves a scroll-bar trace unchanged.
//
// A family entry:
//   rules       spec files whose decision-table row ids are the valid `rule` ids
//               for an expected (blessed) difference
//   cells(ctx)  async generator of { key, trace } for one decoded archive
//
// ctx = { slug, decoded, E (src/engine index), runtime (composeChrome + PixelBuffer),
//         mutate (test hook: lets a test perturb inputs to prove the gate fails) }.
import '../helpers/registerTs.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';

const ICS_FULL_RECORD_BYTES = 64;

export const THEMES_DIR = new URL('../../themes/', import.meta.url);

let engine;
/** The engine and the runtime entry points the matrix drives (loaded once). */
export async function runtime() {
  engine ??= {
    E: await import('../../src/engine/index.ts'),
    tables: await import('../../src/engine/tables/scrollbar.ts'),
    sliderTables: await import('../../src/engine/tables/slider.ts'),
    progressTables: await import('../../src/engine/tables/progress.ts'),
    realizeRgb16: (await import('../../tools/theme-loader/display-profile.js')).realizeRgb16,
    PixelBuffer: (await import('../../src/pixelBuffer.ts')).PixelBuffer,
    composeWindowChrome: (await import('../../src/composeChrome.ts')).composeWindowChrome,
  };
  return engine;
}

export function themeSlugs() {
  return readdirSync(THEMES_DIR).filter(s => ['scheme.sit', 'scheme.rsrc'].some(f => existsSync(new URL(`${s}/${f}`, THEMES_DIR)))).sort();
}

const decodedCache = new Map();
export async function decode(slug) {
  if (!decodedCache.has(slug)) {
    const { E } = await runtime();
    const path = ['scheme.sit', 'scheme.rsrc'].map(f => new URL(`${slug}/${f}`, THEMES_DIR)).find(existsSync);
    decodedCache.set(slug, await loadKaleidoscopeScheme(readFileSync(path), { encodeAssets: false, iconBlitCicnIds: E.engineIconBlitCicnIds(), engineCinfIds: E.engineCinfIds() }));
  }
  return decodedCache.get(slug);
}

const sha = s => createHash('sha256').update(s).digest('hex');
const xywh = r => r && { x: r.x, y: r.y, w: r.w, h: r.h };

// ── window chrome (wnd# 9-slice re-point onto src/engine/qd) ─────────────────
// Every sliced window type of every wnd# archive, both states, at the template's
// native content size, 97x53 and 320x160, each with no title and a 60 px title. The
// popup-window type is traced again as the popup family (`/popup` keys), the way
// renderWindow draws it (window-widgets AP1/PP rows, WD6).
// composeWindowChrome carries no EngineTrace, so the cell trace is built from its
// public result: the template cicn resolved, the frame/title rects, and the
// placement map in draw order (edge, part code, mode, source band, destination rects).
const WINDOW_SIZES = [null, [97, 53], [320, 160]];
const WINDOW_TITLES = [0, 60];

async function* windowCells({ decoded, mutate = x => x }) {
  const { PixelBuffer, composeWindowChrome } = await runtime();
  const elements = Object.values(decoded.manifest.chromeElements ?? {});
  for (const [type, wt0] of Object.entries(decoded.manifest.windowTypes ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    if (wt0.model === 'corner-sprite' || !wt0.edges || !wt0.parts?.['part-0']) continue;
    const wt = mutate(structuredClone(wt0), { family: 'window', type });
    for (const state of Object.keys(wt.chrome ?? {}).sort()) {
      const asset = decoded.assets.find(a => a.path === wt.chrome[state]);
      if (!asset?.rgba) continue;
      const cicnId = elements.find(e => e.asset === wt.chrome[state])?.sourceCicnId ?? null;
      const [l, t, r, b] = wt.parts['part-0'].rect;
      for (const popupFamily of type === 'popup-window' ? [false, true] : [false])
      for (const size of WINDOW_SIZES) for (const titleWidthPx of WINDOW_TITLES) {
        const [w, h] = size ?? [Math.max(0, r - l), Math.max(0, b - t)];
        const key = `${type}/${state}/${size ? `${w}x${h}` : 'native'}/t${titleWidthPx}${popupFamily ? '/popup' : ''}`;
        const inputs = { type, state, w, h, titleWidthPx, ...(popupFamily ? { popupFamily } : {}), recipeSha256: sha(JSON.stringify(wt.edges)) };
        const source = new PixelBuffer(asset.width, asset.height, new Uint8ClampedArray(asset.rgba));
        let c;
        try { c = composeWindowChrome(source, wt, w, h, { titleWidthPx, popupFamily }); }
        catch (e) { yield { key, trace: { family: 'window', inputs, error: String(e.message) } }; continue; }
        yield {
          key,
          trace: {
            family: 'window', inputs,
            resolved: [{ type: 'cicn', id: cicnId, found: cicnId !== null }],
            rects: { full: { w: c.fullWidth, h: c.fullHeight }, frame: c.frame, titleRegion: c.titleRegion ?? null },
            drawOps: c.placement.map(s => ({ op: s.mode, edge: s.edge, code: s.code, src: xywh(s.src), dst: s.rects.map(xywh) })),
            pixels: sha(c.buffer.data),
          },
        };
      }
    }
  }
}

// ── scroll bar (CDEF driver on the v2 engine) ────────────────────────────────
// Every archive, both orientations, every public state (pressed per part), at
// lengths 48, 120 and 300 and values 0, 0.5 and 1, through the same inputs the
// composeScrollbar facade builds. The resource chain mirrors
// src/engine/resources/theme.ts over the loader's raw assets, like
// tests/rendering-options/scrollbar-driver-binding.test.mjs, because Node has no
// canvas to decode the browser adapter's blob PNGs. The trace is the engine's own.
const SCROLL_STATES = [
  { state: 'normal' }, { state: 'disabled' }, { state: 'inactive' },
  ...['up', 'down', 'pageUp', 'pageDown', 'thumb'].map(pressedPart => ({ state: 'pressed', pressedPart })),
];
const SCROLL_LENGTHS = [48, 120, 300];
const SCROLL_VALUES = [0, 0.5, 1];

function scrollbarChain(E, tables, slug, decoded, horizontal, mutate) {
  const asset = path => { const a = decoded.assets.find(x => x.path === path || x.path.endsWith(`/${path}`)); return a && { width: a.width, height: a.height, data: new Uint8ClampedArray(a.rgba) }; };
  const elements = Object.values(decoded.manifest.chromeElements ?? {}), patterns = Object.values(decoded.manifest.patterns ?? {});
  const entries = [];
  for (const { type, id } of E.scrollbarResourceIds(horizontal)) {
    if (type === 'cicn') {
      const el = elements.find(e => e.sourceCicnId === id && e.asset);
      if (el) entries.push([`cicn:${id}`, { pixmap: asset(el.asset), pixelSize: el.iconBlit?.pixelSize ?? null, unmasked: el.iconBlit?.unmaskedAsset ? asset(el.iconBlit.unmaskedAsset) : null }]);
    } else if (type === 'ppat') {
      const p = patterns.find(e => e.sourcePpatId === id && e.asset);
      if (p) entries.push([`ppat:${id}`, asset(p.asset)]);
    } else if (type === 'ics#') {
      // A full ics# record (32-byte image + 32-byte mask plane): the same presence
      // rule the loader applies when it fills inspector.iconMaskPlanes (convert.js).
      if (decoded.iconMaskResources?.some(m => m.id === id && m.byteLength >= ICS_FULL_RECORD_BYTES)) entries.push([`ics#:${id}`, { id }]);
    } else if (type === 'ics8') {
      const icon = decoded.iconIndex?.find(i => i.id === id && i.type === 'ics8');
      if (icon) entries.push([`ics8:${id}`, asset(icon.file)]);
    }
  }
  return new E.ResourceChain([E.mapProvider(slug, 'archive', mutate(entries, { family: 'scrollbar', horizontal }))]);
}

async function* scrollbarCells({ slug, decoded, mutate = x => x }) {
  const { E, tables } = await runtime();
  const t = tables.SCROLLBAR_FACADE_THICKNESS.thickness, range = tables.SCROLLBAR_FACADE_RANGE;
  for (const orientation of ['horizontal', 'vertical']) {
    const horizontal = orientation === 'horizontal';
    const chain = scrollbarChain(E, tables, slug, decoded, horizontal, mutate);
    for (const st of SCROLL_STATES) for (const length of SCROLL_LENGTHS) for (const value of SCROLL_VALUES) {
      const { hilite } = E.normalizeControlState(st, E.SCROLLBAR_PRESSED_PARTS);
      const input = {
        rect: horizontal ? E.rect(0, 0, t, length) : E.rect(0, 0, length, t),
        hilite, min: range.min, max: range.max, value: range.min + Math.round(value * (range.max - range.min)),
      };
      const trace = E.createTrace('scrollbar', { ...input });
      const port = { width: input.rect.right, height: input.rect.bottom, data: new Uint8ClampedArray(input.rect.right * input.rect.bottom * 4) };
      const key = `${orientation}/${st.pressedPart ? `pressed-${st.pressedPart}` : st.state}/${length}/v${value}`;
      try { E.drawScrollbar(port, chain, input, trace); }
      catch (e) { yield { key, trace: { family: 'scrollbar', inputs: trace.inputs, error: String(e.message) } }; continue; }
      yield { key, trace: { ...trace, pixels: sha(port.data) } };
    }
  }
}

// ── built-in window frame (procedural-frame.md, the five no-wnd# archives) ─────
// Every archive the loader marks corner-sprite (no wnd# window types), every
// public window-type slug the family declares (PF_WINDOW_SLUGS), both hilite
// states, three content sizes and three title widths (none, 60 px, and 250 px,
// wider than the small windows' title limits), plus the
// three widget-part draws (§2 parts 4, 5, 9) on the active document window.
// The chain mirrors src/engine/resources/theme.ts over the loader's raw assets.
// Titles are traced, not rasterised (the text renderer is the runtime's).
const FRAME_SIZES = [[97, 53], [200, 100], [320, 160]];
const FRAME_TITLES = [0, 60, 250];
const FRAME_STATES = ['active', 'inactive'];
const FRAME_PRESSED = [[4, 'close'], [5, 'zoom'], [9, 'collapse']];

function frameChain(E, slug, decoded, mutate) {
  const asset = path => { const a = decoded.assets.find(x => x.path === path || x.path.endsWith(`/${path}`)); return a && { width: a.width, height: a.height, data: new Uint8ClampedArray(a.rgba) }; };
  const elements = Object.values(decoded.manifest.chromeElements ?? {}), patterns = Object.values(decoded.manifest.patterns ?? {});
  const entries = [];
  for (const { type, id } of E.proceduralFrameResourceIds()) {
    if (type === 'cicn') {
      const el = elements.find(e => e.sourceCicnId === id && e.asset);
      if (el) entries.push([`cicn:${id}`, { pixmap: asset(el.asset), pixelSize: el.iconBlit?.pixelSize ?? null, unmasked: el.iconBlit?.unmaskedAsset ? asset(el.iconBlit.unmaskedAsset) : null }]);
    } else if (type === 'ppat') {
      const p = patterns.find(e => e.sourcePpatId === id && e.asset);
      if (p) entries.push([`ppat:${id}`, asset(p.asset)]);
    } else if (type === 'ics#') {
      const planes = decoded.iconMaskPlanes?.[String(id)];
      if (planes) entries.push([`ics#:${id}`, { planes }]);
    } else if (type === 'ics8') {
      const icon = decoded.iconIndex?.find(i => i.id === id && i.type === 'ics8');
      if (icon) entries.push([`ics8:${id}`, asset(icon.file)]);
    } else if (decoded.colorTables?.[`${type}:${id}`]) entries.push([`${type}:${id}`, decoded.colorTables[`${type}:${id}`]]);
  }
  return new E.ResourceChain([E.mapProvider(slug, 'archive', mutate(entries, { family: 'proceduralFrame' }))]);
}

async function* proceduralFrameCells({ slug, decoded, mutate = x => x }) {
  const { E } = await runtime();
  const types = Object.values(decoded.manifest.windowTypes ?? {});
  if (!types.length || !types.every(w => w.model === 'corner-sprite')) return;
  const chain = frameChain(E, slug, decoded, mutate);
  for (const row of E.PF_WINDOW_SLUGS) for (const state of FRAME_STATES) for (const [w, h] of FRAME_SIZES) for (const titleWidth of FRAME_TITLES) {
    const pressed = row.slug === 'document-window' && state === 'active' && w === FRAME_SIZES[0][0] && titleWidth === 0 ? [[0, null], ...FRAME_PRESSED] : [[0, null]];
    for (const [part, name] of pressed) {
      const H = 80;
      const content = E.rect(H, H, H + (row.collapsed ? 0 : h), H + w);
      const input = { content, variation: row.variation, family: row.family, hilited: state === 'active', goAway: row.goAway, shadeOn: row.shadeOn,
        collapsed: row.collapsed, colorTable: row.colorTable, titleWidth };
      const key = `${row.slug}/${state}/${w}x${h}/t${titleWidth}${name ? `/pressed-${name}` : ''}`;
      const trace = E.createTrace('proceduralFrame', { ...input, part });
      const size = { w: w + 2 * H, h: h + 2 * H };
      const port = { width: size.w, height: size.h, data: new Uint8ClampedArray(size.w * size.h * 4) };
      try {
        const { geometry: g } = E.drawProceduralFrame(port, chain, input, { part }, trace);
        if (row.family === 'document') {
          trace.rects.features = { top: E.proceduralFrameFeatures(input), left: 0, bottom: 0, right: 0 };
          const probe = [g.widgets.close, g.widgets.zoom, g.widgets.collapse, g.grow].map(r => ({ x: r.left + 8, y: r.top + 8 }));
          trace.hits = probe.map(p => E.proceduralFramePartAt(g, chain, p));
        } else {
          // Utility (§9.9): box centres, box corners (inset-1 edge), the grow rect; message 6 draws the grow box (UM4).
          const probe = [g.widgets.close, g.widgets.zoom, g.widgets.collapse, g.grow].flatMap(r => [{ x: r.left + 4, y: r.top + 4 }, { x: r.left, y: r.top }]);
          trace.hits = probe.map(p => E.proceduralFramePartAt(g, chain, p));
          if (part === 0) E.drawProceduralFrameGrowIcon(port, chain, input, trace);
        }
      } catch (e) { yield { key, trace: { family: 'proceduralFrame', inputs: trace.inputs, error: String(e.message) } }; continue; }
      yield { key, trace: { ...trace, pixels: sha(port.data) } };
    }
  }
}

// ── slider (CDEF 3 driver on the v2 engine) ──────────────────────────────────
// Every archive, both orientations, the three variant groups (directional ones
// with 5 tick marks on a 32 px rect, as the composeSlider facade defaults), every
// public state (pressed per part), at lengths 32 and 120 and values 0, 0.25 and
// 1, through the inputs the facade builds: message 3 (init) then message 0. The
// chain mirrors src/engine/resources/theme.ts over the loader's raw assets (cicn
// pixels, manifest.engineCinfs bytes). A handed-off control (G2) is one cell.
const SLIDER_STATES = [
  { state: 'normal' }, { state: 'disabled' }, { state: 'inactive' },
  ...['thumb', 'pageUp', 'pageDown'].map(pressedPart => ({ state: 'pressed', pressedPart })),
];
const SLIDER_VARIANTS = [['nonDirectional', 8, 0], ['pointsDownOrRight', 2, 5], ['pointsUpOrLeft', 6, 5]];
const SLIDER_LENGTHS = [32, 120];
const SLIDER_VALUES = [0, 0.25, 1];

// The slider and progress adapters share their cicn and cinf entries (src/engine/resources/theme.ts):
// cicn pixels with depth, bounds origin and the sampler companion; raw engine cinf bytes.
function lineSampledCicnEntry(elements, id, asset) {
  const el = elements.find(e => e.sourceCicnId === id && e.asset);
  if (!el) return null;
  const status = el.samplingEquivalence?.status ?? null;
  return [`cicn:${id}`, { pixmap: asset(el.asset), pixelSize: el.iconBlit?.pixelSize ?? null, unmasked: null,
    origin: el.boundsOrigin ?? null, sampling: status,
    sampled: status === 'different' && el.sampledBandAsset ? asset(el.sampledBandAsset.asset) : null }];
}
function cinfEntry(decoded, id) {
  const bytes = decoded.manifest.engineCinfs?.[String(id)];
  return bytes ? [`cinf:${id}`, { bytes }] : null;
}

function sliderChain(E, slug, decoded, horizontal, mutate) {
  const asset = path => { const a = decoded.assets.find(x => x.path === path || x.path.endsWith(`/${path}`)); return a && { width: a.width, height: a.height, data: new Uint8ClampedArray(a.rgba) }; };
  const elements = Object.values(decoded.manifest.chromeElements ?? {});
  const entries = [];
  for (const { type, id } of E.sliderResourceIds(horizontal)) {
    if (type === 'cicn') {
      const entry = lineSampledCicnEntry(elements, id, asset);
      if (entry) entries.push(entry);
    } else if (type === 'cinf') {
      const entry = cinfEntry(decoded, id);
      if (entry) entries.push(entry);
    }
  }
  return new E.ResourceChain([E.mapProvider(slug, 'archive', mutate(entries, { family: 'slider', horizontal }))]);
}

async function* sliderCells({ slug, decoded, mutate = x => x }) {
  const { E, sliderTables: T } = await runtime();
  const range = T.SLIDER_FACADE_RANGE, bg = T.SLIDER_FACADE_BACKGROUND;
  for (const orientation of ['horizontal', 'vertical']) {
    const horizontal = orientation === 'horizontal';
    const chain = sliderChain(E, slug, decoded, horizontal, mutate);
    for (const [variant, variation, ticks] of SLIDER_VARIANTS) {
      const cross = ticks ? T.SLIDER_FACADE_THICKNESS.withTicks : T.SLIDER_FACADE_THICKNESS.plain;
      // G2 depends only on the archive, the orientation and the variation: one cell.
      const gate = E.createTrace('slider', { variation });
      const R0 = horizontal ? E.rect(0, 0, cross, 120) : E.rect(0, 0, 120, cross);
      if (E.sliderGate(chain, { rect: R0, hilite: 0, min: range.min, max: range.max, value: range.min, variation }, gate) === 'G2') {
        yield { key: `${orientation}/${variant}/handoff`, trace: gate };
        continue;
      }
      for (const st of SLIDER_STATES) for (const length of SLIDER_LENGTHS) for (const value of SLIDER_VALUES) {
        const { hilite } = E.normalizeControlState(st, E.SLIDER_PRESSED_PARTS);
        const R = horizontal ? E.rect(0, 0, cross, length) : E.rect(0, 0, length, cross);
        const input = { rect: R, hilite, min: range.min, max: range.max, value: range.min + Math.round(value * (range.max - range.min)), variation };
        const trace = E.createTrace('slider', { ...input, ticks });
        const key = `${orientation}/${variant}/${st.pressedPart ? `pressed-${st.pressedPart}` : st.state}/${length}/v${value}`;
        const port = { width: R.right, height: R.bottom, data: new Uint8ClampedArray(R.right * R.bottom * 4) };
        try {
          const init = E.sliderInit(chain, { ...input, value: range.min }, ticks, trace);
          if (!init) throw new Error('handed off after a G1 gate');
          E.drawSlider(port, chain, init.record, input, { background: { r: bg.r, g: bg.g, b: bg.b, a: bg.a } }, trace);
        } catch (e) { yield { key, trace: { family: 'slider', inputs: trace.inputs, error: String(e.message) } }; continue; }
        yield { key, trace: { ...trace, pixels: sha(port.data) } };
      }
    }
  }
}

// ── progress bar (CDEF 5 driver on the v2 engine) ────────────────────────────
// Every archive, the three public states that draw differently (pressed draws as
// normal), lengths 40, 100 (the spec examples) and 160, determinate values 0, 0.25 and 1 through the
// facade's 0..10000 mapping, two unclamped native cells (DET3 below min and past
// max), and indeterminate phases 0, 2, 4 and 9. The chain mirrors
// src/engine/resources/theme.ts over the loader's raw assets (cicn pixels and
// sampler companions, manifest.engineCinfs bytes, ppat pixels).
const PROGRESS_STATES = ['normal', 'inactive', 'disabled'];
const PROGRESS_LENGTHS = [40, 100, 160];
const PROGRESS_VALUES = [0, 0.25, 1];
const PROGRESS_NATIVE = [[-10, 0, 100], [150, 0, 100]];
const PROGRESS_PHASES = [0, 2, 4, 9];

function progressChain(E, slug, decoded, mutate) {
  const asset = path => { const a = decoded.assets.find(x => x.path === path || x.path.endsWith(`/${path}`)); return a && { width: a.width, height: a.height, data: new Uint8ClampedArray(a.rgba) }; };
  const elements = Object.values(decoded.manifest.chromeElements ?? {}), patterns = Object.values(decoded.manifest.patterns ?? {});
  const entries = [];
  for (const { type, id } of E.progressResourceIds()) {
    if (type === 'cicn') {
      const entry = lineSampledCicnEntry(elements, id, asset);
      if (entry) entries.push(entry);
    } else if (type === 'cinf') {
      const entry = cinfEntry(decoded, id);
      if (entry) entries.push(entry);
    } else if (type === 'ppat') {
      const p = patterns.find(e => e.sourcePpatId === id && e.asset);
      if (p) entries.push([`ppat:${id}`, asset(p.asset)]);
    }
  }
  return new E.ResourceChain([E.mapProvider(slug, 'archive', mutate(entries, { family: 'progress' }))]);
}

async function* progressCells({ slug, decoded, mutate = x => x }) {
  const { E, progressTables: T, realizeRgb16 } = await runtime();
  const chain = progressChain(E, slug, decoded, mutate);
  const realize = rgb => { const [r, g, b] = realizeRgb16(rgb, decoded.manifest.displayProfile); return { r, g, b, a: 255 }; };
  const F = T.PROGRESS_FACADE_RANGE;
  const variants = [
    ...PROGRESS_VALUES.map(v => [`v${v}`, { value: F.min + Math.trunc(v * (F.max - F.min)), min: F.min, max: F.max }, 0, 0]),
    ...PROGRESS_NATIVE.map(([value, min, max]) => [`native${value}`, { value, min, max }, 0, 0]),
    ...PROGRESS_PHASES.map(phase => [`indeterminate/p${phase}`, { value: F.min, min: F.min, max: F.max }, 1, phase]),
  ];
  for (const state of PROGRESS_STATES) for (const length of PROGRESS_LENGTHS) for (const [name, native, inde, phase] of variants) {
    const hilite = T.PROGRESS_STATE.find(r => r.state === state).hilite;
    const input = { rect: E.rect(0, 0, T.PROGRESS_RECT.RECT1.height, length), hilite, ...native };
    const trace = E.createTrace('progress', { ...input, indeterminate: inde, phase });
    const key = `${state}/${length}/${name}`;
    const port = { width: length, height: input.rect.bottom, data: new Uint8ClampedArray(length * input.rect.bottom * 4) };
    try {
      const record = E.newProgressRecord(trace);
      record.indeterminate = inde; record.phase = phase;
      const res = E.drawProgress(port, chain, record, input, { realize }, trace);
      trace.phaseAfter = res.phase;
    } catch (e) { yield { key, trace: { family: 'progress', inputs: trace.inputs, error: String(e.message) } }; continue; }
    yield { key, trace: { ...trace, pixels: sha(port.data) } };
  }
}

/** @internal probe hook: the proceduralFrame chain over one decoded archive. */
export const __frameChain = (E, slug, decoded) => frameChain(E, slug, decoded, x => x);

export const FAMILIES = {
  window: { rules: ['docs/spec/engine/window-widgets.md', 'docs/spec/engine/qd-primitives.md'], cells: windowCells },
  scrollbar: { rules: ['docs/spec/engine/scrollbar.md', 'docs/spec/engine/qd-primitives.md'], cells: scrollbarCells },
  proceduralFrame: { rules: ['docs/spec/engine/procedural-frame.md', 'docs/spec/engine/qd-primitives.md'], cells: proceduralFrameCells },
  slider: { rules: ['docs/spec/engine/slider.md', 'docs/spec/engine/qd-primitives.md'], cells: sliderCells },
  progress: { rules: ['docs/spec/engine/progress.md'], cells: progressCells },
};
