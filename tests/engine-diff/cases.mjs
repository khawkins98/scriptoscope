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

export const THEMES_DIR = new URL('../../themes/', import.meta.url);

let engine;
/** The engine and the runtime entry points the matrix drives (loaded once). */
export async function runtime() {
  engine ??= {
    E: await import('../../src/engine/index.ts'),
    tables: await import('../../src/engine/tables/scrollbar.ts'),
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
    decodedCache.set(slug, await loadKaleidoscopeScheme(readFileSync(path), { encodeAssets: false, iconBlitCicnIds: E.scrollbarIconBlitCicnIds() }));
  }
  return decodedCache.get(slug);
}

const sha = s => createHash('sha256').update(s).digest('hex');
const xywh = r => r && { x: r.x, y: r.y, w: r.w, h: r.h };

// ── window chrome (wnd# 9-slice re-point onto src/engine/qd) ─────────────────
// Every sliced window type of every wnd# archive, both states, at the template's
// native content size, 97x53 and 320x160, each with no title and a 60 px title.
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
      for (const size of WINDOW_SIZES) for (const titleWidthPx of WINDOW_TITLES) {
        const [w, h] = size ?? [Math.max(0, r - l), Math.max(0, b - t)];
        const key = `${type}/${state}/${size ? `${w}x${h}` : 'native'}/t${titleWidthPx}`;
        const inputs = { type, state, w, h, titleWidthPx, recipeSha256: sha(JSON.stringify(wt.edges)) };
        const source = new PixelBuffer(asset.width, asset.height, new Uint8ClampedArray(asset.rgba));
        let c;
        try { c = composeWindowChrome(source, wt, w, h, { titleWidthPx }); }
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
      if (decoded.iconMaskResources?.some(m => m.id === id && m.byteLength >= tables.SCROLLBAR_ICON_DRAW.maskRecordBytes)) entries.push([`ics#:${id}`, { id }]);
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

export const FAMILIES = {
  window: { rules: ['docs/spec/engine/qd-primitives.md'], cells: windowCells },
  scrollbar: { rules: ['docs/spec/engine/scrollbar.md', 'docs/spec/engine/qd-primitives.md'], cells: scrollbarCells },
};
