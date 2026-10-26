// Facade: the built-in window frame (v2 engine family `proceduralFrame`,
// docs/spec/engine/procedural-frame.md) as the ComposedChrome renderWindow and
// WindowManager consume. Serves the schemes with no `wnd#` recipe (the loader
// marks their window types `model: 'corner-sprite'`).
//
// Runtime policy here (not spec rows): the public window-type slug selects a
// declared window record (PF_WINDOW_SLUGS); the title is set in the runtime's
// Charcoal faces in place of the system font (utility titles: the Charcoal stack
// at the UI9 size, 10 px, with the substituted font's own metrics); the
// application is taken to call DrawGrowIcon, so a utility grow box is drawn by
// message 6 (§9.8 UM4); the grow box is returned as an overlay because the
// content region excludes it (§3.3) while the runtime's content is DOM stacked
// over the chrome canvas.
import type { WindowState } from './types.js';
import type { ComposedChrome, PlacementSlice } from './composeChrome.js';
import { themeView, type ThemeInput, type ThemeView } from './ownedTheme.js';
import { PixelBuffer } from './pixelBuffer.js';
import { rasterizeTitle } from './titleFont.js';
import { themeResourceChain } from './engine/resources/theme.js';
import {
  drawProceduralFrame, drawProceduralFrameGrowIcon, proceduralFrameGeometry, proceduralFrameResourceIds, proceduralFrameSlug,
  proceduralFrameState, type ProceduralFrameInput, type PfTextPass, type PfWidget,
} from './engine/families/proceduralFrame.js';
import { PF_DRAW_PARTS, PF_UTILITY_INPUTS, PF_WINDOW_SLUGS } from './engine/tables/proceduralFrame.js';
import { createTrace, type EngineTrace } from './engine/trace.js';
import { equivalentWindowTypeKeys } from './wndCascade.js';
import { rect } from './engine/qd/rect.js';
import type { Pixmap } from './engine/qd/types.js';

/** Runtime title size: the system font is 12 pt (procedural-frame §3.2); Charcoal 12 is pinned to its own grid by rasterizeTitle. */
const TITLE_PX = 12;

export interface ProceduralFrameChromeOptions {
  /** Visible title text ('' for none). */
  title?: string;
  /** Draw one widget in its pressed state (message 0 part 4 / 5 / 9). */
  pressedWidget?: PfWidget;
  /** Record an engine trace on the result (diagnostics). */
  trace?: boolean;
}

const hex = (c: { r: number; g: number; b: number }): string => `#${[c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('')}`;

/**
 * The declared window record for a window-type key. The key is resolved through
 * its canonical / legacy / raw-id equivalents (wndCascade) first. An unknown key
 * falls back to the document window, reported as `fallback` (and warned once),
 * never silently.
 */
export function proceduralFrameRecordFor(key: string): { row: (typeof PF_WINDOW_SLUGS)[number]; resolvedFrom: string | null; fallback: boolean } {
  for (const k of equivalentWindowTypeKeys(key)) {
    const row = proceduralFrameSlug(k);
    if (row) return { row, resolvedFrom: k, fallback: false };
  }
  if (!warnedKeys.has(key)) {
    warnedKeys.add(key);
    console.warn(`[scriptoscope] built-in frame: no window record for window type "${key}"; drawing a document window`);
  }
  return { row: proceduralFrameSlug('document-window')!, resolvedFrom: null, fallback: true };
}
const warnedKeys = new Set<string>();

/** The record only (see proceduralFrameRecordFor). */
export function proceduralFrameRecord(key: string): (typeof PF_WINDOW_SLUGS)[number] {
  return proceduralFrameRecordFor(key).row;
}

/**
 * Compose a built-in frame window at native resolution. `key` is the resolved
 * window-type key; `contentW`/`contentH` the content rect C.
 */
export async function composeProceduralFrameChrome(theme: ThemeInput | ThemeView, key: string, state: WindowState, contentW: number, contentH: number,
  opts: ProceduralFrameChromeOptions = {}): Promise<ComposedChrome & { contentCollapsed: boolean; trace?: EngineTrace }> {
  const owner = themeView(theme);
  const record = proceduralFrameRecordFor(key);
  const row = record.row;
  const hilited = !/inactive/.test(state);
  const collapsed = row.collapsed || /^collapsed/.test(state);
  const chain = await themeResourceChain(owner, proceduralFrameResourceIds());
  const title = opts.title ?? '';
  if (title && typeof document !== 'undefined' && document.fonts?.load) {
    try { await document.fonts.load(`16px "Charcoal 12"`); } catch { /* ignore */ }
    try { await document.fonts.load(`${TITLE_PX}px Charcoal`); } catch { /* ignore */ }
  }
  const utility = row.family === 'utility';
  const px = utility ? PF_UTILITY_INPUTS.font.size : TITLE_PX;
  const raster = (text: string, colour: string) => rasterizeTitle(text, px, colour, utility ? { exactPx: true } : {});
  const measured = title ? raster(title, '#000000') : null;
  const base: Omit<ProceduralFrameInput, 'content'> = {
    variation: row.variation, family: row.family, hilited, goAway: row.goAway, shadeOn: row.shadeOn, collapsed,
    colorTable: row.colorTable, titleWidth: measured?.advance ?? 0,
    ...(utility && measured ? { font: { ascent: measured.fontAscent, descent: measured.fontDescent } } : {}),
  };
  // Collapsed: the content is a degenerate rect (a side utility bar keeps its height, §9.2 UG3).
  const side = utility && proceduralFrameState({ ...base, content: rect(0, 0, 0, 0) }).side;
  const h = collapsed && !side ? 0 : contentH;
  const w = collapsed && side ? 0 : contentW;
  // Geometry with C at the origin gives the structure's extent; then C moves so the structure starts at (0, 0).
  const probe = proceduralFrameGeometry(chain, { ...base, content: rect(0, 0, h, w) });
  const dx = -probe.bounds.left, dy = -probe.bounds.top;
  const input: ProceduralFrameInput = { ...base, content: rect(dy, dx, dy + h, dx + w) };
  const W = probe.bounds.right - probe.bounds.left, Hh = probe.bounds.bottom - probe.bounds.top;
  const buffer = PixelBuffer.alloc(W, Hh);
  const trace = opts.trace ? createTrace('proceduralFrame', { key, state, contentW, contentH, title }) : undefined;
  if (record.fallback) trace?.drawOps.push({ op: 'note', row: 'facade.record', unspecified: `no window record for "${key}"; document-window record used` });
  const colored = new Map<string, ReturnType<typeof rasterizeTitle>>();
  // UT3 truncEnd (TruncString): drop characters until the text plus an ellipsis fits.
  const truncated = (limit: number | undefined): string => {
    if (limit === undefined || (measured?.advance ?? 0) <= limit) return title;
    for (let n = title.length - 1; n > 0; n--) {
      const t = `${title.slice(0, n)}…`;
      if ((raster(t, '#000000')?.advance ?? 0) <= limit) return t;
    }
    return '';
  };
  const renderTitle = (port: Pixmap, pass: PfTextPass): void => {
    const text = truncated(pass.truncateTo);
    if (!text) return;
    const k = `${hex(pass.rgb)}|${text}`;
    if (!colored.has(k)) colored.set(k, raster(text, hex(pass.rgb)));
    const g = colored.get(k);
    if (!g) return;
    (port as PixelBuffer).drawOver(g.buffer, pass.x, pass.y - g.ascent, {
      x: pass.clip.left, y: pass.clip.top, w: pass.clip.right - pass.clip.left, h: pass.clip.bottom - pass.clip.top,
    });
  };
  const { geometry: g } = drawProceduralFrame(buffer, chain, input, { renderTitle }, trace);
  if (utility && g.state.grow && !g.state.smallGrow) drawProceduralFrameGrowIcon(buffer, chain, input, trace);
  if (opts.pressedWidget && g.shown[opts.pressedWidget]) {
    const part = PF_DRAW_PARTS.find(r => r.action === opts.pressedWidget)!.parts[0]!;
    drawProceduralFrame(buffer, chain, input, { part }, trace);
  }
  const C = g.C;
  const placement: PlacementSlice[] = [];
  const order: PfWidget[] = (['close', 'zoom', 'collapse'] as PfWidget[]).filter(w => g.shown[w])
    .sort((a, b) => g.widgets[a].left - g.widgets[b].left || g.widgets[a].top - g.widgets[b].top);
  const xywh = (r: { top: number; left: number; bottom: number; right: number }) => ({ x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top });
  if (order.length) placement.push({ edge: 'widget', code: 4, role: order.join('/'), mode: 'stamp', src: { x: 0, y: 0, w: 16, h: 16 }, rects: order.map(w => xywh(g.widgets[w])) });
  let growBox: ComposedChrome['growBox'];
  if (g.growBelongs && !collapsed) {
    const r = xywh(g.grow);
    const gb = PixelBuffer.alloc(r.w, r.h);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const [pr, pg, pbb, pa] = buffer.getPixel(r.x + x, r.y + y);
      gb.setPixel(x, y, pr, pg, pbb, pa);
    }
    growBox = { buffer: gb, x: r.x, y: r.y, w: r.w, h: r.h };
    placement.push({ edge: 'widget', code: 10, role: 'grow box', mode: 'stamp', src: { x: 0, y: 0, w: r.w, h: r.h }, rects: [r] });
  }
  return {
    buffer,
    contentCollapsed: g.state.collapsed,
    frame: { left: C.left, top: C.top, right: W - C.right, bottom: Hh - C.bottom },
    fullWidth: W,
    fullHeight: Hh,
    titleRegion: g.T ? { x: g.T.left, w: g.T.right - g.T.left } : { x: 0, w: W },
    placement,
    growBox,
    ...(trace ? { trace } : {}),
  };
}
