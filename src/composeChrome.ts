// Window-chrome compositor for the `wnd#` schemes: the facade over the v2 engine
// family `window` (src/engine/families/window.ts, docs/spec/engine/window-widgets.md).
// The driver lays out the four side lists and remaps the rect-list widgets; this
// file blits the placed cells (qd-primitives table W), reports the placement map
// the demo's slice inspector and the engine diff read, and returns the widget
// hit areas renderWindow and WindowManager use. It touches no DOM. The five
// recipe-less schemes draw through proceduralFrameChrome.ts instead.
//
// Runtime policy here (not spec rows; lane notes v2-lanes/window-migration):
//   - the structure is sized to the template's drawable extent (compositor-spec
//     "Draw + distribution") and the content rect C starts at the body's inset;
//   - transfer: opaque CopyBits for every chrome cell (qd-primitives §6 Q5 open);
//   - draw order left, right, top, bottom, so the horizontal bars own the
//     corners under that opaque transfer (the decode's order is WD4's 0..3);
//   - the leading region `[0, S[0])` is drawn 1:1 at its template position, and
//     a horizontal side's opaque trailing art past S[N] is scaled onto the end
//     of the side (window-widgets §6 Q3: what paints them is not traced);
//   - the title text is drawn by renderWindow on the code-5 plate (§6 Q4).
import { PixelBuffer } from './pixelBuffer.js';
import { rect, rectXYWH, scaleBlit, tileBlit, type Pixmap, type QdRect, type Transfer } from './engine/qd/index.js';
import { windowBlitRow } from './engine/tables/windowBlit.js';
import { CELL_WIDTH, WINDOW_SIDES } from './engine/tables/window.js';
import {
  drawPressedWidget, layoutWindow, widgetHit, widgetHittable, windowCell, windowWidgets, type WindowLayout,
} from './engine/families/window.js';
import type { EngineTrace } from './engine/trace.js';
import type { WindowType, WindowCinf, Rect } from './types.js';

const CHROME_TRANSFER: Transfer = 'copyBits';

/** Frame thicknesses, derived from the body part rect (part-0). */
export interface Frame { top: number; right: number; bottom: number; left: number }

/**
 * Frame insets from the body rect, clamped into the template: a mis-paired
 * body rect and cicn (a data bug) then yields a minimal coherent frame instead
 * of negative insets or out-of-bounds bands.
 */
export function frameFromBody(bodyRect: Rect, cicnW: number, cicnH: number): Frame {
  const [left, top, right, bottom] = bodyRect;
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(v, hi));
  return { left: clamp(left, cicnW), top: clamp(top, cicnH), right: clamp(cicnW - right, cicnW), bottom: clamp(cicnH - bottom, cicnH) };
}

/** The template's drawable extent: last opaque column/row + 1 (beos's padded active document window is the one case it trims). */
function drawableExtent(cicn: PixelBuffer): { w: number; h: number } {
  let maxX = -1, maxY = -1;
  for (let y = 0; y < cicn.height; y++) for (let x = 0; x < cicn.width; x++) {
    if (cicn.getPixel(x, y)[3] > 16) { if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  }
  return { w: maxX < 0 ? cicn.width : maxX + 1, h: maxY < 0 ? cicn.height : maxY + 1 };
}

/** A rectangle in pixel space (for the diagnostic placement map). */
export interface PixRectXY { x: number; y: number; w: number; h: number }

/** How a slice's source pixels were laid into the output. */
export type SliceMode = 'fixed' | 'stretch' | 'tile' | 'scale' | 'collapse' | 'stamp';

/** One slice in the diagnostic placement map. */
export interface PlacementSlice {
  edge: 'top' | 'bottom' | 'left' | 'right' | 'widget';
  code: number;
  role: string;
  mode: SliceMode;
  src: PixRectXY;
  rects: PixRectXY[];
  /** Side-list segment index: 0 is the leading `[0, S[0])` region and -1 the trailing art; neither is a segment. */
  segment?: number;
}

/** Human label for a part code, for the diagnostic. */
export function partRole(code: number): string {
  switch (code) {
    case 0: return 'corner/stretch';
    case 1: return 'fixed divider';
    case 2: return 'close gap';
    case 3: return 'zoom gap';
    case 4: return 'shade gap';
    case 5: case 6: return 'title bezel';
    case 7: return 'fixed';
    case 8: return 'side fill';
    case 11: return 'stretch';
    case 12: return 'tile';
    case 13: case 14: return 'stretch';
    case 15: return 'close cell';
    case 16: return 'zoom cell';
    case 17: return 'shade cell';
    case 18: return 'scale band';
    default: return `p${code}`;
  }
}

/** A title-bar widget action, independent of its authored position. */
export type TitleWidgetRole = 'close' | 'zoom' | 'collapse';

export interface ComposedChrome {
  buffer: PixelBuffer;
  frame: Frame;
  /** Full footprint size (content rect + chrome margins), in cicn px. */
  fullWidth: number;
  fullHeight: number;
  /** The title plate: the top side's code-5 cell (TT5–TT9), else the full width. `midY` is the title marker band's centre. */
  titleRegion: { x: number; w: number; midY?: number };
  /** cicn column of the title-text colour marker (cinf textPixel, else the marker rect), or −1. */
  titleFillSrcX: number;
  /** The template's colour at the marker, or null. */
  titleFillRgb?: { r: number; g: number; b: number; a: number } | null;
  /** Slice-by-slice placement map for the diagnostic inspector. */
  placement: PlacementSlice[];
  /** Widgets with a reachable hit (HT1–HT5, HT7): remapped rects in buffer pixels. */
  widgets?: { role: TitleWidgetRole; rect: PixRectXY }[];
  /** `wHit` widget branch at a buffer pixel (HT rows): the widget hit, or null. */
  hitWidget?: (x: number, y: number) => TitleWidgetRole | null;
  /** The engine layout (sides, placed borders, rows taken), for diagnostics. */
  layout?: WindowLayout;
  /** The grow box as a separate overlay sprite (built-in frame only). */
  growBox?: { buffer: PixelBuffer; x: number; y: number; w: number; h: number } | undefined;
}

export interface ComposeWindowOptions {
  cinf?: WindowCinf | null;
  /** `SW`: the title's measured width in the title face; 0 for no title. */
  titleWidthPx?: number;
  /** `SWc`: the title's width in the condensed face (TT2). Default `SW`. */
  titleWidthCondensedPx?: number;
  /** `titleLen`: the title's length (only its zero-ness is read: TT4, AW5). Default 1 when `SW > 0`, else 0. */
  titleLength?: number;
  /** procID family 63 (`popup-window`, service slot 8): a titled side takes AP1. */
  popupFamily?: boolean;
  /** `drawActive` (the window is hilited). Default true. */
  active?: boolean;
  /** The pressed-widget strip cicn (WD11 `base`); without it no widget is drawn pressed or hit (WD9, HT7). */
  widgetCicn?: Pixmap | null;
  /** Draw one widget pressed (WD3 parameter 4 / 5 / 9, state 1). */
  pressedWidget?: TitleWidgetRole;
  trace?: EngineTrace;
}

const xywh = (r: QdRect): PixRectXY => ({ x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top });
const partCode = (slug: string): number => { const m = /^part-(-?\d+)$/.exec(slug); return m ? Number(m[1]) : -1; };

/**
 * Compose a window's chrome into a pixel buffer at native resolution. The
 * content rect (contentW × contentH) is left transparent so DOM content shows
 * through when the buffer is drawn behind it.
 */
export function composeWindowChrome(cicn: PixelBuffer, windowType: WindowType, contentW: number, contentH: number,
  opts: ComposeWindowOptions = {}): ComposedChrome {
  const body = windowType.parts['part-0'];
  if (!body) throw new Error('composeWindowChrome: windowType has no part-0 body rect');
  const { w: drawW, h: drawH } = drawableExtent(cicn);
  const frame = frameFromBody(body.rect, drawW, drawH);
  const fullW = frame.left + contentW + frame.right, fullH = frame.top + contentH + frame.bottom;
  const out = PixelBuffer.alloc(fullW, fullH);

  const rects = Object.entries(windowType.parts).map(([slug, p]) => ({ type: partCode(slug), rect: rect(p.rect[1], p.rect[0], p.rect[3], p.rect[2]) }));
  const SW = opts.titleWidthPx ?? 0;
  const layout = layoutWindow({
    sides: WINDOW_SIDES.map(s => windowType.edges?.[s.edge]?.map(e => ({ code: partCode(e.part), border: e.at }))),
    rects, B: rect(0, 0, cicn.height, cicn.width), C: rectXYWH(frame.left, frame.top, contentW, contentH),
    titleWidth: SW, titleWidthCondensed: opts.titleWidthCondensedPx ?? SW, titleLength: opts.titleLength ?? (SW > 0 ? 1 : 0),
    flags: { popupFamily: opts.popupFamily ?? false, drawActive: opts.active ?? true },
  }, opts.trace);

  // ── draw the sides, collect the placement map in side order ───────────────
  const bySide: PlacementSlice[][] = WINDOW_SIDES.map(() => []);
  const titleCodes = CELL_WIDTH.find(r => r.kind === 'titleGate')!.codes;
  const growerRows = CELL_WIDTH.filter(r => r.kind === 'tiles' || r.kind === 'primaryRemainder' || r.kind === 'remainder').map(r => r.id);
  const blit = (t: QdRect, p: QdRect, code: number | null): void => {
    if (p.right <= p.left || p.bottom <= p.top || t.right <= t.left || t.bottom <= t.top) return; // WD4
    const row = code === null ? null : windowBlitRow(code);
    if (!row || row.blit === 'scale') scaleBlit(out, cicn, t, p, CHROME_TRANSFER);
    else tileBlit(out, cicn, t, p, row.direction!, CHROME_TRANSFER);
  };
  for (const sd of [WINDOW_SIDES[2], WINDOW_SIDES[3], WINDOW_SIDES[0], WINDOW_SIDES[1]]) {
    const s = layout.sides[sd.side];
    if (!s) continue;
    const slices = bySide[sd.side]!;
    const N = s.S.length - 1;
    const along = (c: QdRect, a0: number, a1: number): QdRect => s.horizontal ? rect(c.top, a0, c.bottom, a1) : rect(a0, c.left, a1, c.right);
    const band = (i: number) => windowCell(layout, sd.side, i);
    const push = (code: number, mode: SliceMode, t: QdRect, p: QdRect, segment: number) =>
      slices.push({ edge: sd.edge, code, role: partRole(code), mode, src: xywh(t), rects: [xywh(p)], segment });
    // Leading region (Q3, runtime policy): 1:1 at its template position.
    if (s.S[0]! > 0) {
      const c = band(1), lead = s.P[0]! - s.S[0]!;
      const t = along(c.t, 0, s.S[0]!), p = along(c.p, lead, s.P[0]!);
      blit(t, p, null);
      push(s.codes[0]!, 'fixed', t, p, 0);
    }
    for (let i = 1; i <= N; i++) {
      const { t, p } = band(i), code = s.codes[i]!;
      if (s.S[i]! <= s.S[i - 1]!) continue; // no template pixels: nothing to draw or report
      blit(t, p, code);
      const row = s.cellRow[i];
      const mode: SliceMode = code === 18 ? 'scale' : row && growerRows.includes(row as never) ? 'tile'
        : row === 'AW4' || row === 'AW5' || inList(titleCodes, code) ? 'collapse' : 'fixed';
      push(code, mode, t, p, i);
    }
    // Trailing art (Q3, runtime policy): a horizontal side's opaque template past S[N], at the end of the side.
    const end = s.P[N]!, sN = s.S[N]!;
    if (s.horizontal && sN < drawW && end < fullW) {
      const c = band(N), t = along(c.t, sN, drawW);
      if (hasOpaque(cicn, t)) {
        const p = along(c.p, end, end + Math.min(drawW - sN, fullW - end));
        blit(t, p, null);
        push(0, 'fixed', t, p, -1);
      }
    }
  }
  const placement = bySide.flat();

  // ── widgets: remap (RM), pressed draw (WD9), hit (HT) ──────────────────────
  const strip = opts.widgetCicn ?? null;
  const widgets = windowWidgets(layout);
  if (opts.pressedWidget) {
    const w = widgets.find(x => x.row.role === opts.pressedWidget);
    if (w) drawPressedWidget(out, layout, w, strip, opts.trace);
  }
  const hittable = widgets.filter(w => widgetHittable(layout, w, strip));

  // ── title plate and marker ─────────────────────────────────────────────────
  const top = layout.sides[0];
  let titleMarkerX = -1, my0 = -1, my1 = -1;
  for (const [slug, part] of Object.entries(windowType.parts)) {
    const [l, t, r, b] = part.rect;
    // The title marker: a ≤ 2 px wide rect in the title bar (the colour sample line, 0x5530).
    if (slug !== 'part-0' && r > l && b > t && t < frame.top && r - l <= 2) { titleMarkerX = l; my0 = t; my1 = b; break; }
  }
  const titleRegion = {
    ...(top?.anchor ? { x: top.P[top.anchor - 1]!, w: top.P[top.anchor]! - top.P[top.anchor - 1]! } : { x: 0, w: fullW }),
    ...(my1 > my0 ? { midY: Math.min(frame.top - 1, (my0 + my1) / 2) } : {}),
  };
  const cinf = opts.cinf ?? windowType.cinf ?? null;
  const titleFillSrcX = cinf?.textPixel ? cinf.textPixel[0] : titleMarkerX;
  let titleFillRgb: { r: number; g: number; b: number; a: number } | null = null;
  if (titleFillSrcX >= 0 && my1 > my0 && titleFillSrcX < cicn.width) {
    const [r, g, b, a] = cicn.getPixel(titleFillSrcX, Math.max(0, Math.min(cicn.height - 1, Math.floor((my0 + my1) / 2))));
    if (a > 0) titleFillRgb = { r, g, b, a };
  }
  return {
    buffer: out, frame, fullWidth: fullW, fullHeight: fullH, titleRegion, titleFillSrcX, titleFillRgb, placement, layout,
    widgets: hittable.map(w => ({ role: w.row.role, rect: xywh(w.rect) })),
    hitWidget: (x, y) => widgetHit(layout, widgets, strip, x, y).role,
  };
}

const inList = (codes: readonly number[] | '*', c: number): boolean => codes !== '*' && codes.includes(c);

function hasOpaque(cicn: PixelBuffer, r: QdRect): boolean {
  for (let y = Math.max(0, r.top); y < Math.min(cicn.height, r.bottom); y++)
    for (let x = Math.max(0, r.left); x < Math.min(cicn.width, r.right); x++) if (cicn.getPixel(x, y)[3] > 16) return true;
  return false;
}
