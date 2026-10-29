// Built-in window frame family driver: Kaleidoscope 2.3.1 kDEF 0's own window
// definition for schemes with neither a `wnd#` recipe nor a replacement `WDEF`
// (docs/spec/engine/procedural-frame.md). Document family `0x11c58..0x1525a`:
// message 0 draw (`0x12b88`), 1 hit (`0x1295e`), 6 grow icon (`0x14286`),
// 7 features (`0x11cfa`), 8 get region (`0x11d7e`); per-call setup
// `0x11ee2..0x1215a`, geometry `0x124d0..0x14b5e`. Utility family
// `0x152be..0x17452` (§9): draw `0x15ca2`, hit `0x15ae4`, grow icon `0x16d60`.
//
// Every literal comes from tables/proceduralFrame.ts; every branch names its
// spec row in the trace. Not implemented, by declaration or pending spec
// answers (v2-lanes/family2/SPEC-QUESTIONS.md, ROUND2-NOTES.md):
//   - the kind-5 procedural grow box GB4–GB6 / GL1–GL4 (region rasterisation is
//     QuickDraw's, §10.4; reached only with thin and grow, which no slug sets);
//   - Gestalt `WdrB` (§10.2), the proxy icon (§6.5) and Finder windows (declared absent);
//   - `lowDepth` / black-and-white ports (§2, declared clear);
//   - messages 2–5 beyond the regions they report; utility messages 7 and 8 (§9.10).
import type { Pixmap, QdPoint, QdRect, Rgba } from '../qd/types.js';
import type { EngineTrace } from '../trace.js';
import type { ResourceChain, ResourceHit } from '../resources/chain.js';
import type { IconSource } from '../../raster.js';
import { emptyRect, insetRect, rect, rectHeight, rectWidth } from '../qd/rect.js';
import { getPixel, setPixel } from '../../raster.js';
import { transferBits } from '../../raster.js';
import { fillPattern } from '../../raster.js';
import { iconBlit, newRegion, regionAddRect, regionSubtractRect, type Region } from '../../raster.js';
import { axisLine, solidRect } from '../../raster.js';
import { drawSlices } from '../qd/slice.js';
import { pixmapBounds } from '../qd/axis.js';
import { icsImagePixmap } from './scrollbar.js';
import { ENGINE_LOADER_NEEDS } from '../tables/loaderNeeds.js';
import { expandIdGrid } from '../resources/ids.js';
import {
  PF_ALERT, PF_ALERT_TABLE, PF_ART, PF_COLOR_LOOKUP, PF_COPY, PF_DECLARED, PF_DIALOG, PF_DIALOG_SETUP, PF_DOC_FRAME, PF_DRAW_PARTS,
  PF_DRAW_PART_NONE, PF_FEATURES, PF_GAP, PF_GROW, PF_GROW_RECT, PF_HIT, PF_HIT_CONSTANTS, PF_KIND, PF_KINDS, PF_MESSAGE6, PF_PROXY,
  PF_REGIONS, PF_RING, PF_SHADOW, PF_STRIPES, PF_STRUCTURE, PF_STRUCTURE_COLLAPSED, PF_TITLE_BAR, PF_TITLE_DRAW, PF_TITLE_HEIGHT,
  PF_TITLE_LIMITS, PF_TITLE_TEXT, PF_TOGGLE, PF_UTILITY_ART, PF_UTILITY_DRAW_PARTS, PF_UTILITY_FRAME_COLLAPSED,
  PF_UTILITY_FRAME_HORIZONTAL, PF_UTILITY_FRAME_SIDE, PF_UTILITY_FRAME_TAIL, PF_UTILITY_GEOMETRY, PF_UTILITY_GLYPH, PF_UTILITY_GROW,
  PF_UTILITY_HIT, PF_UTILITY_HIT_CONSTANTS, PF_UTILITY_INPUTS, PF_UTILITY_MESSAGE6, PF_UTILITY_PAINT, PF_UTILITY_PRESENCE,
  PF_UTILITY_STRIPES, PF_UTILITY_TITLE_TEXT, PF_UTILITY_TOGGLE, PF_UTILITY_WIDGET_IDS, PF_VARIATION, PF_WIDGET_DROPS,
  PF_WIDGET_GLYPH, PF_WIDGET_IDS, PF_WIDGET_PRESENCE, PF_WIDGET_RECTS, PF_WINDOW_SLUGS, PF_MESSAGES,
  type PfAt, type PfColorTableEntry, type PfDrawPartRow, type PfFamily, type PfRegionName, type PfUtilityFrameShape,
  type PfWidgetIdRow, type PfWindowSlugRow,
} from '../tables/proceduralFrame.js';

export type PfWidget = 'close' | 'zoom' | 'collapse';

/** A colour table resource (`actb`, `clut`) as the adapter supplies it: entries in position order. */
export interface PfColorTable {
  readonly entries: readonly PfColorTableEntry[];
}

/** An `ics#` resource value: its raw planes (image then mask). */
export interface PfIconMask {
  readonly planes: readonly number[];
}

/** One title-text pass handed to the caller's text renderer (§5.1). */
export interface PfTextPass {
  /** Pen position: x and the baseline y. */
  x: number;
  y: number;
  rgb: Rgba;
  /** Background colour of the main pass (the fill colour). */
  background: Rgba | null;
  clip: QdRect;
  pass: 'shadow' | 'main';
  /** Utility (UT3): the face became bold + condensed, and the title is truncated at its end to this width (TruncString truncEnd). */
  condensed?: boolean;
  truncateTo?: number;
}

export interface ProceduralFrameInput {
  /** The content rect C, in port coordinates. */
  content: QdRect;
  /** Document: the WDEF variation code (§3.1). Utility: the §9 bits. */
  variation: number;
  family?: PfFamily;
  /** WindowRecord `hilited`. */
  hilited: boolean;
  /** WindowRecord `goAwayFlag`. */
  goAway: boolean;
  /** Kaleidoscope's collapse-box option (Gestalt `Aarn` bit 0). */
  shadeOn: boolean;
  collapsed?: boolean;
  visible?: boolean;
  /** The window's colour table: the alert colour table (`actb` −14336) or the default. */
  colorTable?: 'actb' | 'default';
  /** StringWidth(title): document in the system font, utility in the UI9 font (bold); 0 or absent for an empty title. */
  titleWidth?: number;
  /** Utility UT1: StringWidth(title) in bold + condensed. Absent: the bold width stands (traced). */
  titleWidthCondensed?: number;
  /**
   * Font metrics: document, the system font (§3.2; default the declared Chicago 12);
   * utility, the UI9 font (no default: without them the title passes are traced, not drawn).
   */
  font?: { ascent: number; descent: number };
  /** §6.4 record flag; default: set for grow windows (the application has called DrawGrowIcon). */
  growFlag?: boolean;
}

export interface ProceduralFrameState {
  family: PfFamily;
  kind: number;
  kindRow: string;
  zoom: boolean;
  thin: boolean;
  alertBit: boolean;
  grow: boolean;
  titled: boolean;
  movable: boolean;
  modal: boolean;
  canCollapse: boolean;
  hilited: boolean;
  goAway: boolean;
  collapsed: boolean;
  shadeOn: boolean;
  visible: boolean;
  /** Utility UI6: drawn in the active state (UI1 alwaysActive, or hilited). Document: hilited. */
  drawnActive: boolean;
  side: boolean;
  smallGrow: boolean;
}

export interface ProceduralFrameGeometry {
  state: ProceduralFrameState;
  H: number;
  ascent: number;
  descent: number;
  C: QdRect;
  /** Structure before the shadow, and the structure region as a rect union. */
  structureBox: QdRect;
  structure: readonly QdRect[];
  /** Bounding box of the structure region (shadow included). */
  bounds: QdRect;
  /** Content region: C (empty when collapsed) minus `contentMinus`. */
  content: QdRect;
  contentMinus: QdRect | null;
  T: QdRect | null;
  widgets: Record<PfWidget, QdRect>;
  shown: Record<PfWidget, boolean>;
  grow: QdRect;
  growBelongs: boolean;
  L: number;
  R: number;
  titleText: QdRect;
  alert: boolean;
  alertRow: string;
  rows: string[];
  /** Utility only (§9.2, §9.3): bar thickness t, flags after UP1–UP4, and whether UT1 re-measured condensed. */
  utility?: { t: number; zoom: boolean; shadeOn: boolean; condensed: boolean; boldWidth: number };
}

const bit = (v: number, n: number): boolean => ((v >> n) & 1) === 1;
const intersects = (a: QdRect, b: QdRect): boolean =>
  !emptyRect(a) && !emptyRect(b) && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const inRect = (r: QdRect, p: QdPoint): boolean => p.x >= r.left && p.x < r.right && p.y >= r.top && p.y < r.bottom;
const outset = (r: QdRect, n: number): QdRect => rect(r.top - n, r.left - n, r.bottom + n, r.right + n);
const offset = (r: QdRect, dh: number, dv: number): QdRect => rect(r.top + dv, r.left + dh, r.bottom + dv, r.right + dh);
const union = (a: QdRect, b: QdRect): QdRect =>
  rect(Math.min(a.top, b.top), Math.min(a.left, b.left), Math.max(a.bottom, b.bottom), Math.max(a.right, b.right));
const EMPTY: QdRect = rect(0, 0, 0, 0);

function req(trace?: EngineTrace, row?: string): { trace?: EngineTrace; row?: string } {
  return { ...(trace ? { trace } : {}), ...(row ? { row } : {}) };
}

/** The declared window record for a public window-type slug (PF_WINDOW_SLUGS), or null. */
export function proceduralFrameSlug(slug: string): PfWindowSlugRow | null {
  return PF_WINDOW_SLUGS.find(r => r.slug === slug) ?? null;
}

/** §3.1 window kind and flags (document family), §9 flags (utility family). */
export function proceduralFrameState(input: ProceduralFrameInput): ProceduralFrameState {
  const family = input.family ?? 'document';
  const v = input.variation;
  const collapsed = input.collapsed === true;
  const visible = input.visible ?? true;
  if (family === 'utility') {
    // §9.1 UI1–UI8, UI11. "Titled" has no meaning here beyond H (UI10); canCollapse is the
    // collapse box's shown-when flag before the drops (§9.3).
    const U = PF_UTILITY_INPUTS;
    const alwaysActive = !bit(v, U.alwaysActive.bit);
    return {
      family, kind: -1, kindRow: `${U.alwaysActive.id},${U.grow.id},${U.zoom.id},${U.side.id},${U.smallGrow.id},${U.active.id},${U.goAway.id},${U.shadeOn.id},${U.collapsed.id}`,
      zoom: bit(v, U.zoom.bit), thin: false, alertBit: false, grow: bit(v, U.grow.bit),
      titled: true, movable: false, modal: false, canCollapse: input.shadeOn, hilited: input.hilited, goAway: input.goAway,
      collapsed, shadeOn: input.shadeOn, visible,
      drawnActive: alwaysActive || input.hilited, side: bit(v, U.side.bit), smallGrow: bit(v, U.smallGrow.bit),
    };
  }
  const V = PF_VARIATION;
  const kind = v & V.kindMask;
  const row = PF_KINDS.find(k => k.kind === kind);
  if (!row) throw new RangeError(`proceduralFrameState: variation ${v} names kind ${kind}, which §3.1 does not define`);
  return {
    family, kind, kindRow: row.id,
    zoom: bit(v, V.zoomBit), thin: bit(v, V.thinBit), alertBit: bit(v, V.alertBit),
    grow: bit(v, V.growBit) || row.impliesGrow,
    titled: row.titled, movable: row.movable, modal: row.modal, canCollapse: row.titled && !row.movable,
    hilited: input.hilited, goAway: input.goAway, collapsed, shadeOn: input.shadeOn, visible,
    drawnActive: input.hilited, side: false, smallGrow: false,
  };
}

/** §3.2 title-bar height from the system font metrics. */
export function proceduralFrameTitleHeight(font: { ascent: number; descent: number } = PF_DECLARED.systemFont):
  { H: number; ascent: number; descent: number } {
  const P = PF_TITLE_HEIGHT;
  let H = font.ascent + font.descent + P.extra;
  if (H % 2 === 0) H -= 1;
  let ascent = font.ascent;
  if (H < P.floor) { ascent += Math.trunc((P.floor - H) / 2); H = P.floor; }
  return { H, ascent, descent: font.descent };
}

/** §3.5 CT1–CT3: "entry n" of a colour table, found by value. Null when the position does not exist. */
export function colorTableEntry(t: PfColorTable, n: number): { entry: PfColorTableEntry | null; row: string } {
  const L = PF_COLOR_LOOKUP, e = t.entries, last = e.length - 1;
  if (n <= last && e[n]?.value === n) return { entry: e[n]!, row: L.byPosition.id };
  if (last >= 0 && e[last]!.value === 0) return { entry: e[n] ?? null, row: L.lastZero.id };
  for (let i = last; i >= 0; i--) if (e[i]!.value === n) return { entry: e[i]!, row: L.search.id };
  return { entry: e[0] ?? null, row: L.search.id };
}

/** §3.5 alert colouring (document family), first matching row. */
function alertColouring(st: ProceduralFrameState, chain: ResourceChain, colorTable: 'actb' | 'default', trace?: EngineTrace):
  { alert: boolean; row: string; actb: PfColorTable | null } {
  let actb: PfColorTable | null = null;
  for (const r of PF_ALERT) {
    switch (r.when) {
      case 'thin': if (st.thin) return { alert: st.alertBit, row: r.id, actb }; break;
      case 'auxFlag': if (PF_DECLARED.auxAlertFlag) return { alert: true, row: r.id, actb }; break;
      case 'kindGate': if (st.kind !== PF_KIND.dBox && !st.movable) return { alert: false, row: r.id, actb }; break;
      case 'actbAbsent': {
        actb = chain.getResource<PfColorTable>(PF_ALERT_TABLE.type, PF_ALERT_TABLE.id, req(trace, r.id))?.value ?? null;
        if (!actb) return { alert: false, row: r.id, actb };
        break;
      }
      case 'colorTable': {
        // The window's colour table is either actb itself or the default table (entry 0 declared white).
        // "Entry 0" is found by value (CT1–CT3); the comparison is the stored 16-bit channels (CT4).
        const theirs = colorTableEntry(actb!, PF_ALERT_TABLE.entry);
        const mine = colorTable === 'actb' ? theirs.entry?.rgb16 : PF_DECLARED.defaultContent.rgb16;
        const equal = !!theirs.entry && !!mine && theirs.entry.rgb16.every((c, i) => c === mine[i]);
        return { alert: equal, row: `${r.id},${theirs.row},${PF_COLOR_LOOKUP.stored.id}`, actb };
      }
    }
  }
  return { alert: false, row: PF_ALERT[PF_ALERT.length - 1]!.id, actb };
}

function documentGeometry(input: ProceduralFrameInput, st: ProceduralFrameState, chain: ResourceChain | null, trace?: EngineTrace): ProceduralFrameGeometry {
  const C = input.content;
  const { H, ascent, descent } = proceduralFrameTitleHeight(input.font);
  const rows: string[] = [st.kindRow];
  // §3.3 structure.
  let box: QdRect;
  let shadow: 'line' | 'none' | 'shifted';
  const collapsedTitled = st.collapsed && st.titled;
  if (collapsedTitled) {
    const S = PF_STRUCTURE_COLLAPSED;
    box = rect(C.top - H, C.left - S.side, C.top, C.right + S.side); // WdrB declared absent: no extra rows
    shadow = S.shadow;
    rows.push(S.id);
  } else {
    const row = PF_STRUCTURE.find(r => r.kinds.includes(st.kind))!;
    const o = st.thin && row.thinOutset !== undefined ? row.thinOutset : row.outset;
    box = outset(C, o);
    if (row.top === 'title') box = rect(C.top - H, box.left, box.bottom, box.right);
    if (row.top === 'raise') box = rect(box.top - (H - row.raiseLess!), box.left, box.bottom, box.right);
    shadow = row.shadow;
    rows.push(row.id);
  }
  const structure: QdRect[] = [box];
  if (shadow === 'line') structure.push(rect(box.top + PF_SHADOW.shift, box.left + PF_SHADOW.shift,
    box.bottom + PF_SHADOW.shift - PF_SHADOW.shorten, box.right + PF_SHADOW.shift - PF_SHADOW.shorten));
  if (shadow === 'shifted') structure.push(offset(box, PF_SHADOW.shift, PF_SHADOW.shift));
  const bounds = structure.reduce(union);
  // §3.3 title bar.
  let T: QdRect | null = null;
  if (st.titled) {
    const tr = PF_TITLE_BAR.find(r => r.kinds.includes(st.kind))!;
    const g = st.thin && tr.thin ? tr.thin : tr;
    T = rect(C.top - g.above - H, C.left - g.side, C.top - g.above, C.right + g.side);
    rows.push(tr.id);
  }
  // §3.3 widget rects and presence.
  const W = PF_WIDGET_RECTS;
  const t = T ?? rect(C.top, C.left, C.top, C.left);
  const wy = t.top + Math.trunc((H + 1 - W.topIcon) / 2) - W.topLess;
  const at = (x: number): QdRect => rect(wy, x, wy + W.size, x + W.size);
  const close = at(t.left + W.closeFromLeft);
  const collapse = at(t.right - W.collapseFromRight);
  const zoomAt = (withCollapse: boolean): QdRect => at(t.right - (withCollapse ? W.zoomFromRightWithCollapse : W.zoomFromRight));
  // Shown-when (§3.3), then the narrow-window drops WP1–WP4, always against the computed close rect.
  let collapseShown = st.titled && st.shadeOn && !st.movable;
  let zoomShown = st.titled && st.zoom;
  const D = PF_WIDGET_DROPS;
  if (st.goAway && st.zoom) {
    rows.push(D.goAwayZoom.id);
    if (intersects(zoomAt(collapseShown), close)) {
      collapseShown = false;
      if (intersects(zoomAt(false), close)) zoomShown = false;
      rows.push(`${D.goAwayZoom.id}:dropped`);
    }
  } else if (st.goAway) {
    rows.push(D.goAwayOnly.id);
    if (collapseShown && intersects(collapse, close)) { collapseShown = false; rows.push(`${D.goAwayOnly.id}:dropped`); }
  } else if (st.zoom && st.shadeOn) {
    rows.push(D.zoomShade.id);
    if (collapseShown && intersects(collapse, close)) { collapseShown = false; rows.push(`${D.zoomShade.id}:dropped`); }
  } else rows.push(D.none.id);
  const zoom = zoomAt(collapseShown);
  const closeShown = st.titled && st.goAway;
  // §3.3 grow rect, §6.4 ownership.
  const G = PF_GROW_RECT;
  let grow = rect(C.bottom - G.inside, C.right - G.inside, C.bottom + G.outside, C.right + G.outside);
  if (st.kind === PF_KIND.movable && !st.thin) grow = offset(grow, G.kind5Offset, G.kind5Offset);
  const growFlag = input.growFlag ?? (PF_DECLARED.growFlagAfterDrawGrowIcon && st.grow);
  const growBelongs = (st.thin && st.grow) || (st.titled && !st.movable && growFlag);
  // §3.3 title limits and text.
  const Lm = PF_TITLE_LIMITS;
  const L = st.goAway ? close.left + Lm.closeAdvance : t.left + Lm.leftInset;
  const R = st.zoom ? zoom.left - Lm.widgetGap : collapseShown ? collapse.left - Lm.widgetGap : t.right - Lm.rightInset;
  const w = (input.titleWidth ?? 0) + (PF_DECLARED.proxy ? Lm.proxyWidth : 0);
  let titleText = EMPTY;
  if (T && (input.titleWidth ?? 0) > 0) {
    const left = Math.max(L, T.left + Math.trunc((rectWidth(T) - w) / 2));
    titleText = rect(T.top + Lm.textInsetV, left, T.bottom - Lm.textInsetV, left + w);
  }
  // §3.5 alert colouring.
  const a = chain ? alertColouring(st, chain, input.colorTable ?? 'default', trace) : { alert: false, row: PF_ALERT[0]!.id };
  rows.push(a.row);
  const content = st.collapsed ? EMPTY : C;
  return {
    state: st, H, ascent, descent, C, structureBox: box, structure, bounds,
    content, contentMinus: !st.collapsed && growBelongs && st.grow ? grow : null,
    T, widgets: { close, zoom, collapse }, shown: { close: closeShown, zoom: zoomShown, collapse: collapseShown },
    grow, growBelongs, L, R, titleText, alert: a.alert, alertRow: a.row, rows,
  };
}

function utilityGeometry(input: ProceduralFrameInput, st: ProceduralFrameState): ProceduralFrameGeometry {
  const C = input.content;
  const I = PF_UTILITY_INPUTS, U = PF_UTILITY_GEOMETRY, P = PF_UTILITY_PRESENCE;
  const rows: string[] = [st.kindRow];
  // UI10 bar height; UG1 title bar, thickness t = H + 1.
  const titleWidth = input.titleWidth ?? 0;
  const H = st.side ? I.barHeight.side : titleWidth > 0 ? I.barHeight.titled : I.barHeight.untitled;
  rows.push(I.barHeight.id, U.bar.id);
  const o = U.bar.outset;
  const T = st.side
    ? rect(C.top - o, C.left - H - U.bar.extra, C.bottom + o, C.left)
    : rect(C.top - H - U.bar.extra, C.left - o, C.top, C.right + o);
  const t = H + U.bar.extra;
  // UG2 / UG3 structure, then the shadow.
  let box: QdRect;
  if (st.collapsed) { box = T; rows.push(U.collapsed.id); } else {
    const b = outset(C, U.structure.outset), more = H - U.structure.raiseLess;
    box = st.side ? rect(b.top, b.left - more, b.bottom, b.right) : rect(b.top - more, b.left, b.bottom, b.right);
    rows.push(U.structure.id);
  }
  const structure = [box, rect(box.top + PF_SHADOW.shift, box.left + PF_SHADOW.shift,
    box.bottom + PF_SHADOW.shift - PF_SHADOW.shorten, box.right + PF_SHADOW.shift - PF_SHADOW.shorten)];
  const bounds = structure.reduce(union);
  // UG5–UG7 widget boxes: across the bar centred, along it from its start / end.
  const n = U.close.box;
  const cross = (st.side ? T.left : T.top) + Math.trunc((t + U.close.centreExtra - n) / 2);
  const start = st.side ? T.top : T.left, end = st.side ? T.bottom : T.right;
  const boxAt = (a: number): QdRect => st.side ? rect(a, cross, a + n, cross + n) : rect(cross, a, cross + n, a + n);
  const close = boxAt(start + U.close.fromStart);
  const collapse = boxAt(end - U.collapse.fromEnd);
  const zoomAt = (shade: boolean): QdRect => boxAt(end - U.collapse.fromEnd - (shade ? U.zoom.shift : 0));
  rows.push(U.close.id, U.collapse.id, U.zoom.id);
  // §9.3 UP1–UP4: the drops test rects outset by 7 (the recomputed zoom box in UP1 is not outset).
  let shadeOn = st.shadeOn, zoom = st.zoom;
  const out = (r: QdRect): QdRect => outset(r, P.outset);
  const closeOut = out(close);
  if (st.goAway && zoom) {
    rows.push(P.goAwayZoom.id);
    if (intersects(out(zoomAt(shadeOn)), closeOut)) {
      shadeOn = false;
      if (intersects(zoomAt(false), closeOut)) zoom = false;
      rows.push(`${P.goAwayZoom.id}:dropped`);
    }
  } else if (st.goAway) {
    rows.push(P.goAwayOnly.id);
    if (shadeOn && intersects(out(collapse), closeOut)) { shadeOn = false; rows.push(`${P.goAwayOnly.id}:dropped`); }
  } else if (zoom && shadeOn) {
    rows.push(P.zoomShadeOnly.id);
    if (intersects(out(collapse), closeOut)) { shadeOn = false; rows.push(`${P.zoomShadeOnly.id}:dropped`); }
  } else rows.push(P.none.id);
  const zoomBox = zoomAt(shadeOn);
  // UG8 / UG9 title limits.
  const lead = (r: QdRect): number => (st.side ? r.top : r.left);
  const trail = (r: QdRect): number => (st.side ? r.bottom : r.right);
  const Lu = st.goAway ? trail(close) + U.leftLimit.gap : start + U.leftLimit.inset;
  const Ru = zoom ? lead(zoomBox) - U.rightLimit.gap : shadeOn ? lead(collapse) - U.rightLimit.gap : end - U.rightLimit.inset;
  rows.push(U.leftLimit.id, U.rightLimit.id);
  // UG10 grow rect; UG4 content.
  const inside = st.smallGrow ? U.grow.smallInside : U.grow.inside;
  const grow = rect(C.bottom - inside, C.right - inside, C.bottom + U.grow.outside, C.right + U.grow.outside);
  rows.push(U.grow.id, U.content.id);
  const content = st.collapsed ? (st.side ? rect(C.top, C.left, C.bottom, C.left) : rect(C.top, C.left, C.top, C.right)) : C;
  // UT1 title text rect (empty when side or the width is ≤ 0).
  const X = PF_UTILITY_TITLE_TEXT;
  let titleText = EMPTY, condensed = false;
  if (!st.side && titleWidth > 0) {
    let w = titleWidth;
    let left = T.left + Math.trunc((rectWidth(T) - w) / 2);
    if (left < Lu || left + w > Ru) {
      condensed = true;
      w = input.titleWidthCondensed ?? titleWidth;
      left = Math.max(T.left + Math.trunc((rectWidth(T) - w) / 2), Lu);
    }
    titleText = rect(T.top + X.rect.insetV, left, T.bottom - X.rect.insetV, left + w);
    rows.push(X.rect.id);
  }
  return {
    state: st, H, ascent: input.font?.ascent ?? 0, descent: input.font?.descent ?? 0, C, structureBox: box, structure, bounds,
    content, contentMinus: !st.collapsed && st.smallGrow && st.grow ? grow : null,
    T, widgets: { close, zoom: zoomBox, collapse }, shown: { close: st.goAway, zoom, collapse: shadeOn },
    grow, growBelongs: st.grow, L: Lu, R: Ru, titleText, alert: false, alertRow: '', rows,
    utility: { t, zoom, shadeOn, condensed, boldWidth: titleWidth },
  };
}

/** §3 per-call setup and geometry. `chain` is needed for §3.5 alert colouring (document family). */
export function proceduralFrameGeometry(chain: ResourceChain | null, input: ProceduralFrameInput, trace?: EngineTrace): ProceduralFrameGeometry {
  const st = proceduralFrameState(input);
  const g = st.family === 'utility' ? utilityGeometry(input, st) : documentGeometry(input, st, chain, trace);
  if (trace) {
    trace.rects.C = g.C; trace.rects.structureBox = g.structureBox; trace.rects.bounds = g.bounds; trace.rects.grow = g.grow;
    if (g.T) trace.rects.T = g.T;
    if (!emptyRect(g.titleText)) trace.rects.titleText = g.titleText;
    for (const k of ['close', 'zoom', 'collapse'] as const) if (g.shown[k]) trace.rects[k] = g.widgets[k];
  }
  return g;
}

/** §3.1 message 7: the feature bits. Utility message 7 is not described (§9.10): traced `unimplemented`, #412's shape returned. */
export function proceduralFrameFeatures(input: ProceduralFrameInput, trace?: EngineTrace): number {
  const st = proceduralFrameState(input);
  if (st.family === 'utility') trace?.drawOps.push({ op: 'features', row: '§9.10', unimplemented: 'utility message 7 (0x1535c) is not described; document-family bit shape returned' });
  const F = PF_FEATURES;
  let f = F.always.reduce((x, y) => x | y, 0);
  if (st.grow) f |= F.grow;
  if (st.zoom) f |= F.zoom;
  if (st.canCollapse) f |= F.canCollapse;
  if (st.modal) f |= F.modal;
  if (st.titled) f |= F.titled;
  return f;
}

/** §3.4 message 8: the rect for a region code (null for an undefined code; empty when the region is empty). */
export function proceduralFrameRegion(g: ProceduralFrameGeometry, code: number): { rect: QdRect; row: string } | null {
  const row = PF_REGIONS.find(r => r.code === code);
  if (!row) return null;
  const pick: Record<PfRegionName, () => QdRect> = {
    titleBar: () => g.T ?? EMPTY,
    titleText: () => (emptyRect(g.titleText) ? EMPTY : rect(g.titleText.top - 1, g.titleText.left, g.titleText.bottom + 1, g.titleText.right)),
    close: () => g.widgets.close,
    zoom: () => g.widgets.zoom,
    grow: () => g.grow,
    collapse: () => g.widgets.collapse,
    structure: () => g.bounds,
    content: () => g.content,
  };
  return { rect: pick[row.region](), row: row.id };
}

/** §6.2 point-in-icon (IconDispatch PtInIconID): the `ics#` mask bit under the point in a 16 × 16 slot. */
function ptInIcon(chain: ResourceChain, id: number, r: QdRect, p: QdPoint, trace?: EngineTrace, row?: string): boolean {
  if (!inRect(r, p)) return false;
  const mask = chain.getResource<PfIconMask>(PF_WIDGET_GLYPH.maskType, id, req(trace, row));
  if (!mask) return false;
  const P = PF_WIDGET_GLYPH.planes;
  const x = Math.floor(((p.x - r.left) * P.size) / rectWidth(r)), y = Math.floor(((p.y - r.top) * P.size) / rectHeight(r));
  return (((mask.value.planes[P.maskOffset + y * P.rowBytes + (x >> 3)] ?? 0) >> (7 - (x & 7))) & 1) === 1;
}

/** §9.9 message 1 hit test (utility family), UH1–UH8. Widget hits are the box inset 1, no mask. */
function utilityPartAt(g: ProceduralFrameGeometry, p: QdPoint): { part: number; row: string } {
  const st = g.state, K = PF_UTILITY_HIT_CONSTANTS, T = g.T!;
  const inStructure = g.structure.some(r => inRect(r, p));
  const inBar = inRect(T, p) && st.drawnActive;
  const onBox = (w: PfWidget): boolean => inRect(insetRect(g.widgets[w], K.boxInset, K.boxInset), p);
  for (const row of PF_UTILITY_HIT) {
    switch (row.test) {
      case 'outside': if (!st.visible || !inStructure) return { part: row.part, row: row.id }; break;
      case 'grow':
        if (st.drawnActive && st.grow && !st.collapsed && inRect(rect(g.grow.top, g.grow.left, g.bounds.bottom, g.bounds.right), p))
          return { part: row.part, row: row.id };
        break;
      case 'content':
        if (inRect(g.content, p) && !(g.contentMinus && inRect(g.contentMinus, p))) return { part: row.part, row: row.id };
        break;
      case 'close': if (inBar && g.shown.close && onBox('close')) return { part: row.part, row: row.id }; break;
      case 'zoom':
        if (inBar && g.shown.zoom && onBox('zoom')) return { part: PF_DECLARED.utilityAtZoomState ? K.zoomAtStored : row.part, row: row.id };
        break;
      case 'collapse': if (inBar && g.shown.collapse && onBox('collapse')) return { part: row.part, row: row.id }; break;
      case 'drag': {
        const b = rect(g.bounds.top, g.bounds.left, g.bounds.bottom - 1, g.bounds.right - 1);
        const i = insetRect(b, K.frameBand, K.frameBand);
        const bar = rect(T.top, T.left, T.bottom + K.titleExtraRows, T.right);
        if ((inRect(b, p) && !inRect(i, p)) || inRect(bar, p)) return { part: row.part, row: row.id };
        break;
      }
      case 'otherwise': return { part: row.part, row: row.id };
    }
  }
  return { part: PF_UTILITY_HIT[0]!.part, row: PF_UTILITY_HIT[0]!.id };
}

/** Message 1 hit test: the part code at port point `p` (§6.3 HT1–HT9 document, §9.9 UH1–UH8 utility). */
export function proceduralFramePartAt(g: ProceduralFrameGeometry, chain: ResourceChain, p: QdPoint, trace?: EngineTrace): { part: number; row: string } {
  const st = g.state;
  if (st.family === 'utility') return utilityPartAt(g, p);
  const K = PF_HIT_CONSTANTS;
  const inStructure = g.structure.some(r => inRect(r, p));
  const ids = (w: PfWidget): PfWidgetIdRow => PF_WIDGET_IDS.find(r => r.widget === w)!;
  const T = g.T;
  for (const row of PF_HIT) {
    switch (row.test) {
      case 'outside': if (!st.visible || !inStructure) return { part: row.part, row: row.id }; break;
      case 'grow':
        if (st.grow && !st.collapsed && inRect(rect(g.grow.top, g.grow.left, g.bounds.bottom, g.bounds.right), p))
          return { part: st.hilited ? row.part : K.growInactive, row: row.id };
        break;
      case 'content':
        if (inRect(g.content, p) && !(g.contentMinus && inRect(g.contentMinus, p))) return { part: row.part, row: row.id };
        break;
      case 'untitled': if (!st.titled || !T) return { part: row.part, row: row.id }; break;
      case 'close':
        if (st.hilited && g.shown.close && inRect(T!, p) && (ptInIcon(chain, ids('close').normal, g.widgets.close, p, trace, row.id)
          || (p.x === T!.left + K.exactX && p.y === T!.top + K.exactY))) return { part: row.part, row: row.id };
        break;
      case 'zoom':
        if (st.hilited && g.shown.zoom && inRect(T!, p) && (ptInIcon(chain, ids('zoom').normal, g.widgets.zoom, p, trace, row.id)
          || (p.x === T!.right - K.exactX && p.y === T!.top + K.exactY)))
          return { part: PF_DECLARED.atZoomRect ? K.zoomAtStored : row.part, row: row.id };
        break;
      case 'collapse':
        if (st.hilited && g.shown.collapse && inRect(T!, p) && ptInIcon(chain, ids('collapse').normal, g.widgets.collapse, p, trace, row.id))
          return { part: row.part, row: row.id };
        break;
      case 'drag': {
        const b = g.structureBox, i = rect(b.top + K.frameBand, b.left + K.frameBand, b.bottom - K.frameBand, b.right - K.frameBand);
        const bar = rect(T!.top, T!.left, T!.bottom + K.titleExtraRows, T!.right);
        if ((inRect(b, p) && !inRect(i, p)) || inRect(bar, p)) return { part: row.part, row: row.id };
        break;
      }
      case 'otherwise': return { part: row.part, row: row.id };
    }
  }
  return { part: PF_HIT[0]!.part, row: PF_HIT[0]!.id };
}

// ── drawing helpers ──────────────────────────────────────────────────────────

/** P(x, y): the frame cicn's colour at (x, y), mask not consulted (§3.5 "Sampling"). Null outside the icon (qd S5). */
function sample(icon: IconSource, x: number, y: number): Rgba | null {
  // The opaque companion keeps the stored colour under a clear mask; the masked pixmap may not.
  const px = getPixel(icon.unmasked ?? icon.pixmap, x, y);
  return px ? { r: px.r, g: px.g, b: px.b, a: px.a } : null;
}

function line(port: Pixmap, c: Rgba | null, x0: number, y0: number, x1: number, y1: number, trace: EngineTrace | undefined, row: string): void {
  if (!c) { trace?.drawOps.push({ op: 'line', row, unspecified: 'sample point outside the cicn (qd-primitives S5); line not drawn' }); return; }
  trace?.drawOps.push({ op: 'line', row, from: { x: x0, y: y0 }, to: { x: x1, y: y1 }, rgb: { r: c.r, g: c.g, b: c.b } });
  axisLine(port, c, x0, y0, x1, y1);
}

function paintRect(port: Pixmap, r: QdRect, c: { r: number; g: number; b: number }, trace: EngineTrace | undefined, row: string): void {
  if (emptyRect(r)) return;
  trace?.drawOps.push({ op: 'paintRect', row, dst: r, rgb: { r: c.r, g: c.g, b: c.b } });
  solidRect(port, r, c);
}

function copy1to1(port: Pixmap, icon: IconSource, src: { top: number; left: number; bottom: number; right: number }, x: number, y: number,
  trace: EngineTrace | undefined, row: string): void {
  const s = rect(src.top, src.left, src.bottom, src.right);
  iconBlit(port, icon, s, rect(y, x, y + rectHeight(s), x + rectWidth(s)), trace, row);
}

/**
 * GB3 masked copy: the cicn's pixel image through its mask (CopyMask), 1:1 at (x, y). Masked-off
 * pixels keep what is underneath.
 */
function copyMasked(port: Pixmap, icon: IconSource, src: QdRect, x: number, y: number, trace: EngineTrace | undefined, row: string): void {
  const dst = rect(y, x, y + rectHeight(src), x + rectWidth(src));
  if (emptyRect(src)) return;
  trace?.drawOps.push({ op: 'copyMask', row: `${row},${PF_COPY.masked.id}`, src, dst });
  transferBits(port, icon.pixmap, src, dst, 'copyMask');
}

const sect = (a: QdRect, b: QdRect): QdRect => {
  const r = rect(Math.max(a.top, b.top), Math.max(a.left, b.left), Math.min(a.bottom, b.bottom), Math.min(a.right, b.right));
  return emptyRect(r) ? EMPTY : r;
};

function getCicn(chain: ResourceChain, id: number, trace: EngineTrace | undefined, row: string): IconSource | null {
  return chain.getResource<IconSource>('cicn', id, req(trace, row))?.value ?? null;
}

/** §6.1 widget glyph: `ics#` required, `ics8` from the same file, copied through the `ics#` mask. */
function drawWidgetGlyph(port: Pixmap, chain: ResourceChain, id: number, r: QdRect, trace: EngineTrace | undefined, row: string): boolean {
  const Wg = PF_WIDGET_GLYPH;
  const mask: ResourceHit<PfIconMask> | null = chain.getResource<PfIconMask>(Wg.maskType, id, req(trace, `${row},${Wg.required.id}`));
  if (!mask) { trace?.drawOps.push({ op: 'widget', row: `${row},${Wg.required.id}`, id, drawn: false }); return false; }
  const color = chain.get1Resource<Pixmap>(Wg.colorType, id, mask.provider, req(trace, `${row},${Wg.color.id}`));
  const icon = color ? color.value : icsImagePixmap(mask.value.planes);
  const drawRow = `${row},${color ? Wg.copy8.id : Wg.copy1.id}`;
  trace?.drawOps.push({ op: 'widget', row: drawRow, id, src: pixmapBounds(icon), dst: r, transfer: 'copyMask' });
  transferBits(port, icon, pixmapBounds(icon), r, 'copyMask');
  return true;
}

// ── §5 title bar ─────────────────────────────────────────────────────────────

export interface ProceduralFrameDrawOptions {
  /** Message 0 draw part (§2); default 0, the whole frame. */
  part?: number;
  /** The per-window toggle bit before this call (§2); default clear. */
  toggle?: boolean;
  /** Text renderer for the title (§5.1): called once per pass, shadow first. */
  renderTitle?: (port: Pixmap, pass: PfTextPass) => void;
}

function frameCicnFor(g: ProceduralFrameGeometry, chain: ResourceChain, dialog: boolean, trace: EngineTrace | undefined):
  { icon: IconSource | null; row: string } {
  const A = dialog ? (g.alert ? PF_ART.dialogAlert : PF_ART.dialog) : PF_ART.document;
  const id = g.state.hilited ? A.hilited : A.normal;
  return { icon: getCicn(chain, id, trace, A.id), row: A.id };
}

function drawTitleBar(port: Pixmap, chain: ResourceChain, g: ProceduralFrameGeometry, opts: ProceduralFrameDrawOptions, trace?: EngineTrace): void {
  const st = g.state, T = g.T!;
  const D = PF_TITLE_DRAW;
  const kind5 = st.kind === PF_KIND.movable;
  const { icon: F, row: artRow } = frameCicnFor(g, chain, kind5, trace);
  // Mode (§5 table): kind 5 box; kinds 0/4 joined unless collapsed (WdrB declared absent → box).
  const box = kind5 || (st.collapsed && !PF_DECLARED.wdrb);
  const mode = box ? 'box' : 'joined';
  trace?.drawOps.push({ op: 'titleMode', row: `${D.mode.id},${artRow}`, mode });
  let fill: Rgba | null = null, text: Rgba | null = null, shadow: Rgba | null = null;
  if (F) {
    fill = sample(F, D.samples.fill.x, D.samples.fill.y);
    text = sample(F, D.samples.text.x, D.samples.text.y);
    shadow = sample(F, D.samples.shadow.x, D.samples.shadow.y);
    trace?.drawOps.push({ op: 'sample', row: D.samples.id, fill, text, shadow });
    copy1to1(port, F, D.topLeft.src, T.left, T.top, trace, D.topLeft.id);
    copy1to1(port, F, D.topRight.src, T.right - D.corner, T.top, trace, D.topRight.id);
    if (box) {
      copy1to1(port, F, D.boxBottomLeft.src, T.left, T.bottom - D.corner, trace, D.boxBottomLeft.id);
      copy1to1(port, F, D.boxBottomRight.src, T.right - D.corner, T.bottom - D.corner, trace, D.boxBottomRight.id);
    } else {
      copy1to1(port, F, D.joinLeft.src, T.left + D.joinLeft.dx, T.bottom - D.joinHeight, trace, D.joinLeft.id);
      copy1to1(port, F, D.joinRight.src, T.right - D.joinRight.dxFromRight, T.bottom - D.joinHeight, trace, D.joinRight.id);
    }
    const S = D.sides;
    const end = T.bottom - (box ? S.boxEnd : S.joinedEnd);
    for (let i = 0; i < S.count; i++) {
      line(port, sample(F, i, S.sampleY), T.left + i, T.top + S.fromTop, T.left + i, end, trace, S.id);
      line(port, sample(F, S.sampleXFrom - i, S.sampleY), T.right - 1 - i, T.top + S.fromTop, T.right - 1 - i, end, trace, S.id);
    }
    const Tr = D.topRows;
    for (let i = 0; i < Tr.count; i++) line(port, sample(F, Tr.sampleX, i), T.left + Tr.inset, T.top + i, T.right - 1 - Tr.inset, T.top + i, trace, Tr.id);
    const Br = box ? D.boxBottomRows : D.joinedBottomRows;
    for (let i = 0; i < Br.count; i++)
      line(port, sample(F, Br.sampleX, Br.sampleYFrom - i), T.left + Br.inset, T.bottom - 1 - i, T.right - 1 - Br.inset, T.bottom - 1 - i, trace, Br.id);
  } else {
    trace?.drawOps.push({ op: 'skip', row: D.absent.id, reason: 'frame cicn absent: rows 1–7 skipped' });
  }
  const I = D.interior;
  const interior = rect(T.top + I.insetV, T.left + I.insetH, T.bottom - I.insetV, T.right - I.insetH);
  if (fill) paintRect(port, interior, fill, trace, I.id);
  else trace?.drawOps.push({ op: 'paintRect', row: `${I.id},${D.absent.id}`, dst: interior, unspecified: 'fill colour never sampled (quirk with no defined colour); not painted' });
  if (PF_DECLARED.proxy) trace?.drawOps.push({ op: 'proxy', row: PF_PROXY.id, unimplemented: 'proxy icon' });
  // §5.1 title text.
  if (!emptyRect(g.titleText)) {
    const X = PF_TITLE_TEXT;
    const clip = rect(T.top, g.L, T.bottom, g.R);
    const x = g.titleText.left + (PF_DECLARED.proxy ? PF_TITLE_LIMITS.proxyWidth : 0);
    const y = g.titleText.top + Math.trunc((rectHeight(g.titleText) - (g.ascent + g.descent)) / 2) + g.ascent;
    const same = !!shadow && !!text && shadow.r === text.r && shadow.g === text.g && shadow.b === text.b;
    if (shadow && text && !same) {
      const pass: PfTextPass = { x: x + X.shadowPass.dx, y: y + X.shadowPass.dy, rgb: shadow, background: null, clip, pass: 'shadow' };
      trace?.drawOps.push({ op: 'text', row: `${D.text.id},${X.clip.id},${X.shadowPass.id}`, ...pass });
      opts.renderTitle?.(port, pass);
    }
    if (text) {
      const pass: PfTextPass = { x, y, rgb: text, background: fill, clip, pass: 'main' };
      trace?.drawOps.push({ op: 'text', row: `${D.text.id},${X.clip.id},${X.pen.id},${X.baseline.id},${X.mainPass.id}`, ...pass });
      opts.renderTitle?.(port, pass);
    } else {
      trace?.drawOps.push({ op: 'text', row: `${D.text.id},${D.absent.id}`, unspecified: 'text colour never sampled; title not drawn' });
    }
  }
  if (!st.hilited) { trace?.drawOps.push({ op: 'skip', row: `${D.stripes.id},${D.widgets.id}`, reason: 'not hilited: no stripes, no widgets' }); return; }
  drawStripes(port, chain, g, trace);
  for (const r of PF_WIDGET_IDS) if (g.shown[r.widget]) drawWidgetGlyph(port, chain, r.normal, g.widgets[r.widget], trace, `${D.widgets.id},${r.id}`);
}

/** §5.2 stripes: pattern layer, then the scheme's own cicn three-slice-stretched over it. */
function drawStripes(port: Pixmap, chain: ResourceChain, g: ProceduralFrameGeometry, trace?: EngineTrace): void {
  const S = PF_STRIPES;
  const kind5 = g.state.kind === PF_KIND.movable;
  const id = kind5 ? (g.alert ? PF_ART.stripesMovable.alert : PF_ART.stripesMovable.normal) : PF_ART.stripesDocument.stripes;
  const artRow = kind5 ? PF_ART.stripesMovable.id : PF_ART.stripesDocument.id;
  const top = g.widgets.close.top, bottom = top + S.bandRows.rows;
  const segs: [number, number][] = emptyRect(g.titleText)
    ? [[g.L, g.R]]
    : [[g.L, g.titleText.left - S.segments.gap], [g.titleText.right + S.segments.gap, g.R]];
  const archive = chain.providers.find(p => p.tier === 'archive') ?? null;
  for (const [l, r] of segs) {
    const seg = rect(top, l, bottom, r);
    if (r - l <= S.minimum.maxSkipped) { trace?.drawOps.push({ op: 'stripes', row: `${S.minimum.id}`, dst: seg, drawn: false }); continue; }
    const pat = chain.getResource<Pixmap>(S.pattern.type, id, req(trace, `${S.pattern.id},${artRow}`));
    if (pat) fillPattern(port, seg, pat.value, { x: seg.left, y: seg.top }, trace, S.pattern.id);
    const cicn = archive ? chain.get1Resource<IconSource>(S.cicn.type, id, archive, req(trace, `${S.cicn.id},${artRow}`)) : null;
    if (cicn) drawSlices(port, true, cicn.value.pixmap, pixmapBounds(cicn.value.pixmap), seg, S.cicn.sliceMode,
      { modeZeroCap: 0, row: S.cicn.id, ...(trace ? { trace } : {}) });
    trace?.drawOps.push({ op: 'stripes', row: `${S.bandRows.id},${S.segments.id}`, dst: seg, pattern: !!pat, cicn: !!cicn });
  }
}

// ── §4 document frame, §5A dialog frames ─────────────────────────────────────

function drawShadow(port: Pixmap, g: ProceduralFrameGeometry, c: Rgba | null, trace: EngineTrace | undefined, row: string): void {
  // Row along the structure's bottom from 2 px in to its right edge; column along its right edge from 2 px down (§4 row 6, §3.3).
  const b = g.structureBox, inset = PF_DOC_FRAME.shadow.inset;
  line(port, c, b.left + inset, b.bottom, b.right, b.bottom, trace, row);
  line(port, c, b.right, b.top + inset, b.right, b.bottom, trace, row);
}

/** §6.4 GB1 / GB2: the grow cicn whole, natural size, top-left at the grow rect, through its mask (GB3). */
function drawGrowBox(port: Pixmap, chain: ResourceChain, g: ProceduralFrameGeometry, trace?: EngineTrace): void {
  const kind5 = g.state.kind === PF_KIND.movable;
  const A = kind5 ? PF_ART.growMovable : PF_ART.growDocument;
  const icon = getCicn(chain, g.state.hilited ? A.hilited : A.normal, trace, A.id);
  if (icon) { copyMasked(port, icon, pixmapBounds(icon.pixmap), g.grow.left, g.grow.top, trace, kind5 ? PF_GROW.movable.id : PF_GROW.document.id); return; }
  if (kind5) {
    trace?.drawOps.push({ op: 'growBox', row: `${PF_GROW.movable.id},${PF_GROW.procedural.id}`, dst: g.grow,
      unimplemented: 'procedural kind-5 grow box GB4–GB6 / GL1–GL4: the erased region is QuickDraw region rasterisation (§10.4)' });
    return;
  }
  trace?.drawOps.push({ op: 'growBox', row: PF_GROW.document.id, dst: g.grow, drawn: false });
}

function drawDocumentFrame(port: Pixmap, chain: ResourceChain, g: ProceduralFrameGeometry, trace?: EngineTrace): void {
  const Df = PF_DOC_FRAME;
  const { icon: F } = frameCicnFor(g, chain, false, trace);
  if (!F) { trace?.drawOps.push({ op: 'skip', row: Df.absent.id, reason: 'document cicn absent' }); return; }
  const C = g.C, n = Df.band;
  const L = C.left - n;
  const skipEdges = g.state.collapsed && !PF_DECLARED.wdrb;
  if (skipEdges) trace?.drawOps.push({ op: 'skip', row: Df.collapsedSkip.id, reason: 'collapsed: rows 1–5 and the grow box skipped' });
  else {
    copy1to1(port, F, Df.bottomLeft.src, L, C.bottom, trace, Df.bottomLeft.id);
    copy1to1(port, F, Df.bottomRight.src, C.right, C.bottom, trace, Df.bottomRight.id);
    trace?.drawOps.push({ op: 'note', row: Df.fontSentinel.id, unspecified: `port text font holds ${Df.fontSentinel.value} during the bottom band; its effect is outside this unit (§10.1)` });
    for (let i = 0; i < n; i++) line(port, sample(F, Df.bottomBand.sampleX, Df.bottomBand.sampleYFrom - i), C.left, C.bottom + n - 1 - i, C.right - 1, C.bottom + n - 1 - i, trace, Df.bottomBand.id);
    for (let i = 0; i < n; i++) line(port, sample(F, i, Df.leftBand.sampleY), L + i, C.top, L + i, C.bottom - 1, trace, Df.leftBand.id);
    for (let i = 0; i < n; i++) line(port, sample(F, Df.rightBand.sampleXFrom - i, Df.rightBand.sampleY), C.right + n - 1 - i, C.top, C.right + n - 1 - i, C.bottom - 1, trace, Df.rightBand.id);
  }
  drawShadow(port, g, sample(F, Df.shadow.sample.x, Df.shadow.sample.y), trace, Df.shadow.id);
  if (!skipEdges && g.growBelongs) drawGrowBox(port, chain, g, trace);
}

function drawDialogFrame(port: Pixmap, chain: ResourceChain, g: ProceduralFrameGeometry, actbEntry0: Rgba | null, trace?: EngineTrace): void {
  const st = g.state;
  const { icon: Dc } = frameCicnFor(g, chain, true, trace);
  const Ds = PF_DIALOG_SETUP;
  if (!Dc) { trace?.drawOps.push({ op: 'skip', row: Ds.absent.id, reason: 'dialog cicn absent' }); return; }
  const fg = sample(Dc, Ds.foreground.sample.x, Ds.foreground.sample.y);
  const row = PF_DIALOG.find(r => r.kind === st.kind)!;
  const C = g.C;
  for (const el of row.elements) {
    switch (el) {
      case 'shadow': drawShadow(port, g, fg, trace, `${row.id},shadow`); break;
      case 'ring': drawRing(port, Dc, outset(C, st.thin ? PF_RING.thinOutset : PF_RING.outset), trace); break;
      case 'gap': {
        if (st.thin) break;
        const outer = outset(C, PF_GAP.outset);
        const c = actbEntry0 ?? PF_DECLARED.defaultContent.rgb;
        for (const r of [rect(outer.top, outer.left, C.top, outer.right), rect(C.bottom, outer.left, outer.bottom, outer.right),
          rect(C.top, outer.left, C.bottom, C.left), rect(C.top, C.right, C.bottom, outer.right)]) paintRect(port, r, c, trace, PF_GAP.id);
        break;
      }
      case 'grow': if (g.growBelongs) drawGrowBox(port, chain, g, trace); break;
      case 'frameRect': {
        const b = outset(C, Ds.frameOutset);
        line(port, fg, b.left, b.top, b.right - 1, b.top, trace, row.id);
        line(port, fg, b.left, b.bottom - 1, b.right - 1, b.bottom - 1, trace, row.id);
        line(port, fg, b.left, b.top, b.left, b.bottom - 1, trace, row.id);
        line(port, fg, b.right - 1, b.top, b.right - 1, b.bottom - 1, trace, row.id);
        break;
      }
      case 'frameRectShadow': {
        const b = outset(C, Ds.frameOutset), S = Ds.frameRectShadow;
        if (!fg) break;
        paintRect(port, rect(b.bottom, b.left + S.inset, b.bottom + S.width, b.right + S.width), fg, trace, S.id);
        paintRect(port, rect(b.top + S.inset, b.right, b.bottom + S.width, b.right + S.width), fg, trace, S.id);
        break;
      }
    }
  }
}

function drawRing(port: Pixmap, Dc: IconSource, o: QdRect, trace?: EngineTrace): void {
  const Rg = PF_RING, k = Rg.thickness, e = Rg.endInset;
  const Cn = Rg.corners;
  copy1to1(port, Dc, Cn.topLeft, o.left, o.top, trace, Cn.id);
  copy1to1(port, Dc, Cn.topRight, o.right - k, o.top, trace, Cn.id);
  copy1to1(port, Dc, Cn.bottomLeft, o.left, o.bottom - k, trace, Cn.id);
  copy1to1(port, Dc, Cn.bottomRight, o.right - k, o.bottom - k, trace, Cn.id);
  for (let i = 0; i < k; i++) line(port, sample(Dc, Rg.left.sampleXFrom + i, Rg.left.sampleY), o.left + i, o.top + k, o.left + i, o.bottom - e, trace, Rg.left.id);
  for (let i = 0; i < k; i++) line(port, sample(Dc, Rg.right.sampleXFrom - i, Rg.right.sampleY), o.right - 1 - i, o.top + k, o.right - 1 - i, o.bottom - e, trace, Rg.right.id);
  for (let i = 0; i < k; i++) line(port, sample(Dc, Rg.top.sampleX, Rg.top.sampleYFrom + i), o.left + k, o.top + i, o.right - e, o.top + i, trace, Rg.top.id);
  for (let i = 0; i < k; i++) line(port, sample(Dc, Rg.bottom.sampleX, Rg.bottom.sampleYFrom - i), o.left + k, o.bottom - 1 - i, o.right - e, o.bottom - 1 - i, trace, Rg.bottom.id);
}

// ── §9 utility family ────────────────────────────────────────────────────────

/** Fl/Ft/Fr/Fb (§9.4: the structure bounding box, r − 1 and b − 1) and C's edges, by anchor name. */
function anchors(g: ProceduralFrameGeometry): Record<PfAt[0], number> {
  const b = g.bounds, C = g.C;
  return { Fl: b.left, Ft: b.top, Fr: b.right - 1, Fb: b.bottom - 1, Cl: C.left, Ct: C.top, Cr: C.right, Cb: C.bottom };
}

/** §9.4 frame rows of one shape (UFC / UFH / UFS): corner and join pieces (GB3), then the line groups. Returns the UW1 interior rect. */
function drawUtilityShape(port: Pixmap, Q: IconSource, g: ProceduralFrameGeometry, shape: PfUtilityFrameShape, trace?: EngineTrace): QdRect {
  const A = anchors(g);
  const at = (a: PfAt): number => A[a[0]] + a[1];
  for (const pc of shape.pieces) copyMasked(port, Q, rect(pc.src.top, pc.src.left, pc.src.bottom, pc.src.right), at(pc.x), at(pc.y), trace, pc.id);
  for (const grp of shape.groups) {
    for (let i = 0; i < grp.count; i++) {
      for (const ln of grp.lines) {
        const fixed = at(ln.at) + ln.step * i;
        const from = at(Array.isArray(ln.from[0]) ? (ln.from as readonly PfAt[])[i]! : (ln.from as PfAt)), to = at(ln.to);
        const c = sample(Q, ln.sample[0] + ln.sample[1] * i, ln.sample[2] + ln.sample[3] * i);
        if (ln.row) line(port, c, from, fixed, to, fixed, trace, ln.id);
        else line(port, c, fixed, from, fixed, to, trace, ln.id);
      }
    }
  }
  const I = shape.interior;
  return rect(at(I.t), at(I.l), at(I.b), at(I.r));
}

/** §9.7 UGB1 / UGB2: the utility grow box, masked copy (GB3) at the grow rect's top-left. */
function drawUtilityGrow(port: Pixmap, chain: ResourceChain, g: ProceduralFrameGeometry, trace?: EngineTrace): void {
  const st = g.state, G = PF_UTILITY_GROW;
  if (st.smallGrow) {
    const small = getCicn(chain, st.drawnActive ? G.small.active : G.small.inactive, trace, G.small.id);
    if (small) { copyMasked(port, small, pixmapBounds(small.pixmap), g.grow.left, g.grow.top, trace, G.small.id); return; }
  }
  const icon = getCicn(chain, st.drawnActive ? G.normal.active : G.normal.inactive, trace, G.normal.id);
  if (!icon) { trace?.drawOps.push({ op: 'growBox', row: G.normal.id, dst: g.grow, drawn: false }); return; }
  const [num, den] = G.normal.crop;
  const src = st.smallGrow
    ? rect(0, 0, Math.trunc((icon.pixmap.height * num!) / den!), Math.trunc((icon.pixmap.width * num!) / den!))
    : pixmapBounds(icon.pixmap);
  copyMasked(port, icon, src, g.grow.left, g.grow.top, trace, G.normal.id);
}

/** Opaque 1:1 copy (GB3a, the icon blit) of `src` to (x, y), trimmed to `clip`. */
function blitClipped(port: Pixmap, icon: IconSource, src: QdRect, x: number, y: number, clip: QdRect, trace: EngineTrace | undefined, row: string): void {
  const dst = sect(rect(y, x, y + rectHeight(src), x + rectWidth(src)), clip);
  if (emptyRect(dst)) return;
  const s = rect(src.top + dst.top - y, src.left + dst.left - x, src.top + dst.bottom - y, src.left + dst.right - x);
  iconBlit(port, icon, s, dst, trace, `${row},${PF_COPY.opaque.id}`);
}

/** §9.5 stripes US1–US6 into the interior region. */
function drawUtilityStripes(port: Pixmap, chain: ResourceChain, g: ProceduralFrameGeometry, interior: Region, interiorRect: QdRect,
  fill: Rgba | null, trace?: EngineTrace): void {
  const st = g.state, T = g.T!, S = PF_UTILITY_STRIPES, u = g.utility!;
  const c0 = (st.side ? T.left : T.top) + Math.trunc((u.t - S.band.crossLess) / 2);
  const band = st.side ? rect(g.L, c0, g.R, c0 + S.band.rows) : rect(c0, g.L, c0 + S.band.rows, g.R);
  const clip = sect(interiorRect, band);
  let cicn: IconSource | null = null;
  for (const id of st.side ? S.art.side : S.art.horizontal) { cicn = getCicn(chain, id, trace, S.art.id); if (cicn) break; }
  if (!cicn) trace?.drawOps.push({ op: 'stripes', row: S.art.id, dst: band, drawn: false });
  else if ((st.side ? rectHeight(band) : rectWidth(band)) < S.narrow.minAlong) {
    if (fill) paintRect(port, clip, fill, trace, `${S.narrow.id},${S.clip.id}`);
    else trace?.drawOps.push({ op: 'paintRect', row: `${S.narrow.id},${PF_UTILITY_ART.absent.id}`, dst: clip, unspecified: 'fill colour never sampled; not painted' });
  } else {
    const pm = cicn.pixmap;
    trace?.drawOps.push({ op: 'stripes', row: `${S.band.id},${S.clip.id},${S.tile.id}`, dst: band, clip });
    if (st.side) {
      const src = rect(0, 0, pm.height, S.tile.extent);
      for (let y = band.top; pm.height > 0 && y < band.bottom; y += pm.height) blitClipped(port, cicn, src, band.left, y, clip, trace, S.tile.id);
    } else {
      const src = rect(0, 0, S.tile.extent, pm.width);
      for (let x = band.left; pm.width > 0 && x < band.right; x += pm.width) blitClipped(port, cicn, src, x, band.top, clip, trace, S.tile.id);
    }
  }
  regionSubtractRect(interior, band);
  trace?.drawOps.push({ op: 'regionSubtract', row: S.remove.id, dst: band });
}

/** §9.6.1 title text UT2–UT8 (horizontal bars only, UW3). */
function drawUtilityTitle(port: Pixmap, g: ProceduralFrameGeometry, input: ProceduralFrameInput, interior: Region, colours: { fill: Rgba | null; text: Rgba | null; shadow: Rgba | null },
  opts: ProceduralFrameDrawOptions, trace?: EngineTrace): void {
  const X = PF_UTILITY_TITLE_TEXT, tt = g.titleText;
  const r = rect(tt.top, tt.left, tt.bottom + X.bottomExtra, tt.right);
  if (emptyRect(tt) || r.left + X.skip.minLeft > g.R) { trace?.drawOps.push({ op: 'skip', row: X.skip.id, reason: 'empty title, or r.l + 2 > Ru' }); return; }
  // UT3: StringWidth in bold wider than r → condensed for the rest of the call, truncated to Ru − r.l.
  const u = g.utility!;
  const fitRow = u.boldWidth > rectWidth(r) ? X.fit.id : '';
  if (u.condensed && input.titleWidthCondensed === undefined)
    trace?.drawOps.push({ op: 'note', row: X.rect.id, unspecified: 'condensed width not supplied; the bold width stands' });
  const clip = rect(r.top, g.L, r.bottom, g.R);
  const { fill, text, shadow } = colours;
  const e = rect(r.top, r.left - X.erase.widen, r.bottom, r.right + X.erase.widen);
  if (fill) {
    trace?.drawOps.push({ op: 'erase', row: `${X.erase.id},${X.clip.id}`, dst: sect(e, clip), rgb: { r: fill.r, g: fill.g, b: fill.b } });
    paintRect(port, sect(e, clip), fill, undefined, X.erase.id);
  } else trace?.drawOps.push({ op: 'erase', row: `${X.erase.id},${PF_UTILITY_ART.absent.id}`, dst: sect(e, clip), unspecified: 'fill colour never sampled; not erased' });
  regionSubtractRect(interior, sect(e, clip));
  if (!input.font) { trace?.drawOps.push({ op: 'text', row: `${PF_UTILITY_INPUTS.font.id},${X.pen.id}`, unspecified: 'UI9 font metrics not supplied; title passes not drawn' }); return; }
  const x = r.left;
  const y = r.top + Math.trunc((rectHeight(r) - 1 - (g.ascent + g.descent)) / 2) + g.ascent;
  const face = fitRow ? { condensed: true, truncateTo: g.R - r.left } : {};
  if (!text || !fill || !shadow) { trace?.drawOps.push({ op: 'text', row: `${X.mainPass.id},${PF_UTILITY_ART.absent.id}`, unspecified: 'text colours never sampled; title not drawn' }); return; }
  const same = shadow.r === fill.r && shadow.g === fill.g && shadow.b === fill.b;
  if (!same) {
    const pass: PfTextPass = { x: x + X.shadowPass.dx, y: y + X.shadowPass.dy, rgb: shadow, background: null, clip, pass: 'shadow', ...face };
    trace?.drawOps.push({ op: 'text', row: [X.clip.id, X.pen.id, X.shadowPass.id, fitRow].filter(Boolean).join(','), ...pass });
    opts.renderTitle?.(port, pass);
  }
  const pass: PfTextPass = { x, y, rgb: text, background: fill, clip, pass: 'main', ...face };
  trace?.drawOps.push({ op: 'text', row: [X.clip.id, X.pen.id, X.mainPass.id, fitRow].filter(Boolean).join(','), ...pass });
  opts.renderTitle?.(port, pass);
}

/** Message 0 part 0 (UM1): the frame (§9.4), then stripes, title, widgets and the interior fill (§9.6). */
function drawUtility(port: Pixmap, chain: ResourceChain, g: ProceduralFrameGeometry, input: ProceduralFrameInput, opts: ProceduralFrameDrawOptions,
  trace?: EngineTrace): void {
  const st = g.state, W = PF_UTILITY_PAINT, A = st.side ? PF_UTILITY_ART.frameSide : PF_UTILITY_ART.frame;
  // UFA1 / UFA2.
  let Q = getCicn(chain, st.drawnActive ? A.active : A.inactive, trace, A.id);
  if (!Q && !st.drawnActive) Q = getCicn(chain, A.active, trace, PF_UTILITY_ART.inactiveFallback.id);
  const interior = newRegion(port);
  let interiorRect: QdRect;
  const colours: { fill: Rgba | null; text: Rgba | null; shadow: Rgba | null } = { fill: null, text: null, shadow: null };
  if (!Q) {
    // UFA3: nothing in §9.4; the fill would cover the whole structure in leftover colours (no defined colour).
    trace?.drawOps.push({ op: 'skip', row: PF_UTILITY_ART.absent.id, reason: 'utility frame cicn absent: frame not drawn, no colours sampled' });
    interiorRect = g.structureBox;
  } else {
    const shape = st.collapsed ? PF_UTILITY_FRAME_COLLAPSED : st.side ? PF_UTILITY_FRAME_SIDE : PF_UTILITY_FRAME_HORIZONTAL;
    interiorRect = drawUtilityShape(port, Q, g, shape, trace);
    const Tl = PF_UTILITY_FRAME_TAIL, sp = st.side ? Tl.samples.side : Tl.samples.horizontal;
    colours.fill = sample(Q, sp.fill.x, sp.fill.y);
    colours.text = sample(Q, sp.text.x, sp.text.y);
    colours.shadow = sample(Q, sp.shadow.x, sp.shadow.y);
    trace?.drawOps.push({ op: 'sample', row: Tl.samples.id, ...colours });
    if (st.smallGrow && st.grow && !(st.collapsed && PF_DECLARED.utilityCollapsedSkipsSmallGrow)) drawUtilityGrow(port, chain, g, trace);
    else if (st.smallGrow && st.grow) trace?.drawOps.push({ op: 'skip', row: `${Tl.smallGrow.id},declared`, reason: 'collapsed: the grow rect is outside the structure (declared policy utilityCollapsedSkipsSmallGrow)' });
    const Aa = anchors(g), c = sample(Q, Tl.shadow.sample.x, Tl.shadow.sample.y);
    line(port, c, Aa.Fl + Tl.shadow.inset, Aa.Fb, Aa.Fr, Aa.Fb, trace, Tl.shadow.id);
    line(port, c, Aa.Fr, Aa.Fb, Aa.Fr, Aa.Ft + Tl.shadow.inset, trace, Tl.shadow.id);
  }
  regionAddRect(interior, interiorRect);
  trace?.drawOps.push({ op: 'interior', row: W.interior.id, dst: interiorRect });
  // UW2 stripes, UW3 title, UW4 widgets.
  if (st.drawnActive) drawUtilityStripes(port, chain, g, interior, interiorRect, colours.fill, trace);
  else trace?.drawOps.push({ op: 'skip', row: W.stripes.id, reason: 'not active: no stripes' });
  if (!st.side) drawUtilityTitle(port, g, input, interior, colours, opts, trace);
  if (st.drawnActive) {
    const portRect = rect(0, 0, port.height, port.width);
    for (const r of PF_UTILITY_WIDGET_IDS) {
      if (!g.shown[r.widget]) continue;
      const b = g.widgets[r.widget];
      if (PF_DECLARED.utilityClipIsPort && !intersects(b, portRect)) continue;
      drawWidgetGlyph(port, chain, r.normal, rect(b.top, b.left, b.top + PF_UTILITY_GLYPH.plot, b.left + PF_UTILITY_GLYPH.plot), trace, `${W.widgets.id},${r.id}`);
      regionSubtractRect(interior, b);
    }
  } else trace?.drawOps.push({ op: 'skip', row: W.widgets.id, reason: 'not active: no widgets' });
  // UW5 fill: PaintRgn of what is left.
  if (colours.fill) paintRegion(port, interior, colours.fill, trace, W.fill.id);
  else trace?.drawOps.push({ op: 'paintRgn', row: `${W.fill.id},${PF_UTILITY_ART.absent.id}`, unspecified: 'fill colour never sampled (quirk with no defined colour); not painted' });
}

function paintRegion(port: Pixmap, rgn: Region, c: Rgba, trace: EngineTrace | undefined, row: string): void {
  let n = 0;
  for (let y = 0; y < rgn.height; y++) for (let x = 0; x < rgn.width; x++) {
    if (rgn.bits[y * rgn.width + x] !== 1) continue;
    setPixel(port, x, y, c.r, c.g, c.b, 255); n++;
  }
  trace?.drawOps.push({ op: 'paintRgn', row, pixels: n, rgb: { r: c.r, g: c.g, b: c.b } });
}

// ── message 0 ────────────────────────────────────────────────────────────────

export interface ProceduralFrameDrawResult {
  geometry: ProceduralFrameGeometry;
  drawn: boolean;
  /** The per-window toggle bit after the call (§2). */
  toggle: boolean;
}

/** §2 TG1: a part below 4 (signed) clears the shared toggle bit before the draw. */
function toggleBefore(part: number, toggle: boolean, trace?: EngineTrace): boolean {
  if (part < PF_TOGGLE.clear.clearBelow) {
    trace?.drawOps.push({ op: 'toggle', row: PF_TOGGLE.clear.id, part, before: toggle, after: false });
    return false;
  }
  return toggle;
}

/** TG2 / UM1: one widget alone in the toggled state (pressed when the bit is clear). TG3 / UM2: flip after a listed part. */
function drawToggledWidget(port: Pixmap, chain: ResourceChain, g: ProceduralFrameGeometry, row: PfDrawPartRow, idRows: readonly PfWidgetIdRow[],
  toggle: boolean, plot: (r: QdRect) => QdRect, flipRow: string, presence: (w: PfWidget) => string, trace?: EngineTrace): boolean {
  if (row.action !== 'none') {
    const w = row.action as PfWidget;
    const ids = idRows.find(r => r.widget === w)!;
    const pressed = !toggle;
    if (g.shown[w]) drawWidgetGlyph(port, chain, pressed ? ids.pressed : ids.normal, plot(g.widgets[w]), trace, `${row.id},${PF_TOGGLE.pressed.id},${ids.id}`);
    else trace?.drawOps.push({ op: 'widget', row: `${row.id},${presence(w)}`, drawn: false });
  }
  if (!row.toggles) return toggle;
  trace?.drawOps.push({ op: 'toggle', row: flipRow, part: row.parts[0], before: toggle, after: !toggle });
  return !toggle;
}

/** Message 0: draw `part` of the frame into `port` (§2, §4, §5, §5A, §6; utility §9.8). */
export function drawProceduralFrame(port: Pixmap, chain: ResourceChain, input: ProceduralFrameInput, opts: ProceduralFrameDrawOptions = {},
  trace?: EngineTrace): ProceduralFrameDrawResult {
  const g = proceduralFrameGeometry(chain, input, trace);
  const st = g.state;
  const part = opts.part ?? 0;
  let toggle = opts.toggle ?? !PF_DECLARED.toggleStartsClear;
  if (!st.visible) { trace?.drawOps.push({ op: 'skip', row: 'draw-guard', reason: 'invisible window' }); return { geometry: g, drawn: false, toggle }; }
  toggle = toggleBefore(part, toggle, trace);
  if (st.family === 'utility') {
    // UM1 / UM2: parts 0, 4, 5/6, 9; 258 and the rest draw nothing and do not flip the bit.
    const urow = PF_UTILITY_DRAW_PARTS.find(r => r.parts.includes(part));
    if (!urow) { trace?.drawOps.push({ op: 'skip', row: `${PF_UTILITY_DRAW_PARTS[0]!.id},${PF_UTILITY_TOGGLE.id}`, part }); return { geometry: g, drawn: false, toggle }; }
    if (urow.action === 'frame') { drawUtility(port, chain, g, input, opts, trace); return { geometry: g, drawn: true, toggle }; }
    const P = PF_UTILITY_GLYPH.plot;
    toggle = drawToggledWidget(port, chain, g, urow, PF_UTILITY_WIDGET_IDS, toggle, b => rect(b.top, b.left, b.top + P, b.left + P), PF_UTILITY_TOGGLE.id,
      w => PF_UTILITY_PRESENCE[w].id, trace);
    return { geometry: g, drawn: true, toggle };
  }
  const row = PF_DRAW_PARTS.find(r => r.parts.includes(part));
  if (!row) { trace?.drawOps.push({ op: 'skip', row: PF_DRAW_PART_NONE.id, part }); return { geometry: g, drawn: false, toggle }; }
  if (row.action === 'frame') {
    if (st.titled) drawTitleBar(port, chain, g, opts, trace);
    // §5A gap colour: entry 0 of the window colour table (actb, or the declared default), found by value (CT1–CT3).
    let gap: Rgba | null = null;
    if (input.colorTable === 'actb') {
      const t = chain.getResource<PfColorTable>(PF_ALERT_TABLE.type, PF_ALERT_TABLE.id, req(trace, PF_GAP.id))?.value ?? null;
      const e = t ? colorTableEntry(t, PF_GAP.entry) : null;
      if (e?.entry) gap = { r: e.entry.rgb[0], g: e.entry.rgb[1], b: e.entry.rgb[2], a: 255 };
    }
    if (st.kind === PF_KIND.document || st.kind === PF_KIND.noGrowDocument) drawDocumentFrame(port, chain, g, trace);
    else drawDialogFrame(port, chain, g, gap, trace);
    return { geometry: g, drawn: true, toggle };
  }
  // Parts 4, 5/6, 9 (one widget in the toggled state) and 258 (TG3: nothing drawn, the bit flips).
  toggle = drawToggledWidget(port, chain, g, row, PF_WIDGET_IDS, toggle, b => b, PF_TOGGLE.flip.id,
    w => PF_WIDGET_PRESENCE.find(p => p.widget === w)!.id, trace);
  return { geometry: g, drawn: row.action !== 'none', toggle };
}

/**
 * Message 6: draw the grow icon. Document family (§6.4 M6L1–M6L6): the two
 * scroll-bar lines in the window's port (portRect = the content rect C), then
 * the grow box; sets the record flag. Utility family (UM4): the grow box only.
 */
export function drawProceduralFrameGrowIcon(port: Pixmap, chain: ResourceChain, input: ProceduralFrameInput, trace?: EngineTrace): { geometry: ProceduralFrameGeometry; growFlag: boolean } {
  if ((input.family ?? 'document') === 'utility') {
    const g = proceduralFrameGeometry(chain, input, trace);
    const st = g.state;
    if (!st.visible || !st.grow || st.collapsed) trace?.drawOps.push({ op: 'skip', row: PF_UTILITY_MESSAGE6.id, reason: 'not visible, no grow box or collapsed' });
    else drawUtilityGrow(port, chain, g, trace);
    return { geometry: g, growFlag: input.growFlag ?? false };
  }
  const M = PF_MESSAGE6;
  const before = proceduralFrameState(input);
  const g0 = proceduralFrameGeometry(chain, input);
  if (!before.visible || !before.titled || before.collapsed) {
    trace?.drawOps.push({ op: 'skip', row: M.guard.id, reason: 'not visible, untitled or collapsed' });
    return { geometry: proceduralFrameGeometry(chain, input, trace), growFlag: g0.growBelongs };
  }
  if (before.kind === PF_KIND.movable) {
    const g = proceduralFrameGeometry(chain, input, trace);
    trace?.drawOps.push({ op: 'note', row: M.movable.id, reason: 'kind 5: grow box only, no lines' });
    if (g.growBelongs) drawGrowBox(port, chain, g, trace);
    return { geometry: g, growFlag: input.growFlag ?? false };
  }
  // M6L1–M6L4: pen reset, colour P(0, 0) of the document frame cicn, lines clipped to the port rectangle.
  const C = input.content;
  const A = PF_ART.document;
  const F = getCicn(chain, before.hilited ? A.hilited : A.normal, trace, `${M.colour.id},${A.id}`);
  trace?.drawOps.push({ op: 'note', row: M.pen.id, reason: 'PenNormal; clip and visible region left as they are' });
  if (F) {
    const c = sample(F, M.colour.sample.x, M.colour.sample.y);
    const yH = C.bottom - M.horizontal.inset, xV = C.right - M.vertical.inset;
    // The end pixel at column portRect.r lies outside the port rectangle (clipped).
    line(port, c, C.left, yH, C.right - 1, yH, trace, M.horizontal.id);
    line(port, c, xV, C.top, xV, yH, trace, M.vertical.id);
  } else trace?.drawOps.push({ op: 'line', row: `${M.colour.id},${M.horizontal.id},${M.vertical.id}`, unspecified: 'frame cicn absent: the pen-reset foreground is not stated; lines not drawn' });
  // M6L5: the record flag is set (titled, non-movable), which can make the grow box belong to the frame.
  const g = proceduralFrameGeometry(chain, { ...input, growFlag: true }, trace);
  trace?.drawOps.push({ op: 'note', row: M.recordFlag.id, growFlag: true, contentMinus: g.contentMinus });
  if (g.growBelongs) drawGrowBox(port, chain, g, trace);
  trace?.drawOps.push({ op: 'note', row: M.growBox.id, reason: 'Window Manager port, ClipAbove; off-screen skip not modelled (one port)' });
  return { geometry: g, growFlag: true };
}

/** cicn ids the family draws with the icon blit (corners, grow boxes; qd-primitives I1–I3), from its loader-needs row. */
export function proceduralFrameIconBlitCicnIds(): number[] {
  return [...new Set(ENGINE_LOADER_NEEDS.filter(n => n.family === 'proceduralFrame').flatMap(n => n.iconBlitCicns.flatMap(expandIdGrid)))];
}

/** Every (type, id) the family's tables can request, so an asynchronous adapter can preload a synchronous chain. */
export function proceduralFrameResourceIds(): { type: string; id: number }[] {
  const out: { type: string; id: number }[] = proceduralFrameIconBlitCicnIds().map(id => ({ type: 'cicn', id }));
  const A = PF_ART;
  for (const id of [A.stripesDocument.stripes, A.stripesMovable.alert, A.stripesMovable.normal]) out.push({ type: 'cicn', id }, { type: 'ppat', id });
  for (const id of [...PF_UTILITY_STRIPES.art.side, PF_UTILITY_GROW.small.active, PF_UTILITY_GROW.small.inactive]) out.push({ type: 'cicn', id });
  for (const r of [...PF_WIDGET_IDS, ...PF_UTILITY_WIDGET_IDS]) for (const id of [r.normal, r.pressed])
    out.push({ type: PF_WIDGET_GLYPH.maskType, id }, { type: PF_WIDGET_GLYPH.colorType, id });
  out.push({ type: PF_ALERT_TABLE.type, id: PF_ALERT_TABLE.id });
  return out;
}

/** The message numbers this driver answers (PF_MESSAGES), for diagnostics. */
export const PROCEDURAL_FRAME_MESSAGES = PF_MESSAGES;
