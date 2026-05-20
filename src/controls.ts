import type { LoadedTheme } from './types.js';
import { assetUrl } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { PixelBuffer } from './pixelBuffer.js';
import { rasterizeText } from './textRaster.js';

/** 9-slice corner inset for a control cicn — matches the kDEF's ~6px for
 *  a 15px button face (FUN_30a8): floor((min(w,h)-3)/2). */
function sliceInset(w: number, h: number): number {
  return Math.max(2, Math.floor((Math.min(w, h) - 3) / 2));
}

/**
 * Measure a border-ring cicn's border thickness: scan in from the middle
 * row/column until alpha drops out (the transparent interior begins). Used
 * to inset a progress track inside its frame and to size the frame's
 * 9-slice corners. Falls back to a small inset if the cicn has no
 * transparent interior.
 */
function frameBorder(buf: PixelBuffer): number {
  const my = buf.height >> 1;
  let l = 0;
  while (l < buf.width && buf.getPixel(l, my)[3] >= 40) l++;
  const mx = buf.width >> 1;
  let t = 0;
  while (t < buf.height && buf.getPixel(mx, t)[3] >= 40) t++;
  if (l >= buf.width >> 1 || t >= buf.height >> 1) return Math.max(1, Math.min(2, (Math.min(buf.width, buf.height) - 1) >> 1));
  return Math.max(1, Math.min(l, t));
}

/**
 * Look up a chromeElement by its bundle key (e.g.
 * `'normal-horizontal-scrollbar'`) and load its cicn into a PixelBuffer.
 * Returns null if the scheme doesn't ship that element (→ baseline path).
 */
async function loadByKey(theme: LoadedTheme, key: string): Promise<PixelBuffer | null> {
  const el = theme.manifest.chromeElements?.[key];
  if (!el?.asset) return null;
  return loadCicnBuffer(assetUrl(theme, el.asset));
}

/**
 * Look up a chromeElement by its Kaleidoscope RESOURCE ID and load it.
 * The id is the authoritative selector the kDEF uses (e.g. -8286 = the
 * horizontal scrollbar track); bundle slugs for the same resource vary
 * wildly between schemes ("normal-horizontal-scrollbar" vs
 * "horizontal-scrollbar-active" vs "horizontal-scroll-bar-track-arrows"),
 * so resolving by id is the only thing that works across every theme.
 * Asset filenames encode the id as `cicn-n8286-...` / `cicn--10240-...`;
 * control resources are all negative, so we match on the absolute value.
 */
async function loadById(theme: LoadedTheme, id: number): Promise<PixelBuffer | null> {
  const abs = Math.abs(id);
  const ce = theme.manifest.chromeElements ?? {};
  for (const v of Object.values(ce)) {
    const m = /cicn-n?-?(\d+)/.exec(v.asset ?? '');
    if (m && parseInt(m[1]!, 10) === abs) return loadCicnBuffer(assetUrl(theme, v.asset));
  }
  return null;
}

export type Orientation = 'horizontal' | 'vertical';
export type ControlState = 'normal' | 'pressed' | 'disabled' | 'inactive';

export interface ScrollbarOptions {
  orientation?: Orientation;
  /** Length along the scroll axis, in px (thickness is fixed by the cicn). */
  length?: number;
  /** Thumb position, 0..1. */
  value?: number;
  /** Thumb size as a fraction of the track, 0..1. */
  thumbExtent?: number;
  state?: ControlState;
}

/**
 * Compose a scrollbar into a pixel buffer (kdef-layout-recipes §3):
 * stretch the track cicn along the axis, stamp the thumb at the
 * value-proportional position. 7 Le ships an empty (white) track + a
 * blue striped thumb; arrows are OS-baseline (not in the bundle).
 *
 * Returns null if the scheme ships no scrollbar cicns (baseline path).
 */
export async function composeScrollbar(
  theme: LoadedTheme,
  opts: ScrollbarOptions = {},
): Promise<PixelBuffer | null> {
  const orientation = opts.orientation ?? 'vertical';
  const length = Math.max(16, opts.length ?? 120);
  const value = Math.min(1, Math.max(0, opts.value ?? 0));
  const state = opts.state ?? 'normal';

  const horiz = orientation === 'horizontal';

  // Track cicn by RESOURCE ID (kdef-layout-recipes §3). Slugs vary per
  // scheme; the id is stable. h: -8286 normal / -8285 pressed / -8288
  // disabled · v: -8278 / -8277 / -8280.
  const idN = horiz ? 8286 : 8278;
  const idP = horiz ? 8285 : 8277;
  const idD = horiz ? 8288 : 8280;
  const wantId = state === 'pressed' ? idP : state === 'disabled' ? idD : idN;
  const track = (await loadById(theme, wantId)) ?? (await loadById(theme, idN));
  if (!track) return null; // baseline path

  // Thumb by resource id: -10206 h / -10208 v (pressed -10205 / -10207).
  const thumb = await loadById(theme, horiz ? (state === 'pressed' ? 10205 : 10206) : state === 'pressed' ? 10207 : 10208);

  const thickness = horiz ? track.height : track.width;
  const longSrc = horiz ? track.width : track.height;
  const out = horiz ? PixelBuffer.alloc(length, thickness) : PixelBuffer.alloc(thickness, length);

  // Two cicn FORMATS (empirically, by aspect ratio):
  //  • wide composite (48×16, 43×16, 33×16 …) — the arrow boxes are baked
  //    into the two ends and the track sits between them. Render as a
  //    3-slice along the long axis: copy each end 1:1, stretch the middle.
  //    Arrows are part of the bitmap; we never stamp them separately.
  //  • single track cell (7 Le, 16×16) — square, no baked arrows (those
  //    are left to the OS). Stretch one interior slice for a clean track.
  const composite = longSrc >= thickness * 2;
  let trackStart = 0;
  let trackLen = length;

  if (composite) {
    const end = Math.min(thickness, Math.floor((longSrc - 1) / 2));
    const mid = longSrc - end * 2;
    const dmid = length - end * 2;
    if (horiz) {
      out.copyBits(track, { x: 0, y: 0, w: end, h: thickness }, { x: 0, y: 0, w: end, h: thickness });
      out.copyBits(track, { x: longSrc - end, y: 0, w: end, h: thickness }, { x: length - end, y: 0, w: end, h: thickness });
      out.copyBits(track, { x: end, y: 0, w: mid, h: thickness }, { x: end, y: 0, w: dmid, h: thickness });
    } else {
      out.copyBits(track, { x: 0, y: 0, w: thickness, h: end }, { x: 0, y: 0, w: thickness, h: end });
      out.copyBits(track, { x: 0, y: longSrc - end, w: thickness, h: end }, { x: 0, y: length - end, w: thickness, h: end });
      out.copyBits(track, { x: 0, y: end, w: thickness, h: mid }, { x: 0, y: end, w: thickness, h: dmid });
    }
    trackStart = end;
    trackLen = Math.max(0, length - end * 2);
  } else if (horiz) {
    const sx = Math.max(1, Math.min(track.width - 2, track.width >> 1));
    out.copyBits(track, { x: sx, y: 0, w: 1, h: track.height }, { x: 0, y: 0, w: length, h: thickness });
  } else {
    const sy = Math.max(1, Math.min(track.height - 2, track.height >> 1));
    out.copyBits(track, { x: 0, y: sy, w: track.width, h: 1 }, { x: 0, y: 0, w: thickness, h: length });
  }

  // ── thumb: positioned by value within the track region (between arrows) ──
  if (thumb) {
    const thumbLen = horiz ? thumb.width : thumb.height;
    const pos = trackStart + Math.round(value * Math.max(0, trackLen - thumbLen));
    if (horiz) {
      out.copyBits(thumb, { x: 0, y: 0, w: thumb.width, h: thumb.height }, { x: pos, y: Math.round((thickness - thumb.height) / 2), w: thumb.width, h: thumb.height });
    } else {
      out.copyBits(thumb, { x: 0, y: 0, w: thumb.width, h: thumb.height }, { x: Math.round((thickness - thumb.width) / 2), y: pos, w: thumb.width, h: thumb.height });
    }
  }

  return out;
}

export interface SliderOptions {
  orientation?: Orientation;
  length?: number;
  value?: number;
  state?: ControlState;
}

/**
 * Compose a slider (kdef-layout-recipes §8): stretch the groove track
 * along the axis, stamp the thumb at the value position. 7 Le's thumb
 * cicns are 15×64 sprite sheets — 4 stacked 15×16 states
 * (blank / normal / pressed / disabled).
 */
export async function composeSlider(
  theme: LoadedTheme,
  opts: SliderOptions = {},
): Promise<PixelBuffer | null> {
  const orientation = opts.orientation ?? 'horizontal';
  const length = Math.max(32, opts.length ?? 120);
  const value = Math.min(1, Math.max(0, opts.value ?? 0.5));
  const state = opts.state ?? 'normal';
  const horiz = orientation === 'horizontal';

  // Resolve by RESOURCE ID (slugs vary per scheme; ids are stable). The
  // non-directional slider: horizontal track -10131 (pressed -10130 /
  // inactive -10132) + thumbs -10129 · vertical track -10115 (-10114 /
  // -10116) + thumbs -10113.
  const tA = horiz ? 10131 : 10115;
  const tP = horiz ? 10130 : 10114;
  const tI = horiz ? 10132 : 10116;
  const tId = state === 'pressed' ? tP : state === 'disabled' || state === 'inactive' ? tI : tA;
  const track = (await loadById(theme, tId)) ?? (await loadById(theme, tA));
  if (!track) return null;
  const thumbs = await loadById(theme, horiz ? 10129 : 10113);

  const thickness = horiz ? track.height : track.width;
  const longSrc = horiz ? track.width : track.height;
  const out = horiz ? PixelBuffer.alloc(length, thickness) : PixelBuffer.alloc(thickness, length);

  // groove: 3-slice along the axis — keep the rounded end caps 1:1, stretch
  // the uniform middle. (Full-stretch would smear the caps.) Cap width is a
  // few px; clamp so two caps fit.
  const end = Math.min(6, Math.floor((longSrc - 1) / 2));
  const mid = longSrc - end * 2;
  const dmid = length - end * 2;
  if (horiz) {
    out.copyBits(track, { x: 0, y: 0, w: end, h: thickness }, { x: 0, y: 0, w: end, h: thickness });
    out.copyBits(track, { x: longSrc - end, y: 0, w: end, h: thickness }, { x: length - end, y: 0, w: end, h: thickness });
    out.copyBits(track, { x: end, y: 0, w: mid, h: thickness }, { x: end, y: 0, w: dmid, h: thickness });
  } else {
    out.copyBits(track, { x: 0, y: 0, w: thickness, h: end }, { x: 0, y: 0, w: thickness, h: end });
    out.copyBits(track, { x: 0, y: longSrc - end, w: thickness, h: end }, { x: 0, y: length - end, w: thickness, h: end });
    out.copyBits(track, { x: 0, y: end, w: thickness, h: mid }, { x: 0, y: end, w: thickness, h: dmid });
  }

  // thumb: pick the state row from the sprite sheet, stamp at value
  if (thumbs) {
    const stateRow = state === 'pressed' ? 2 : state === 'disabled' || state === 'inactive' ? 3 : 1;
    const tw = horiz ? thumbs.width : thumbs.width; // thumb cell is the short dimension wide
    // sheet stacks 4 states along the LONG axis
    const cells = 4;
    if (horiz) {
      const cellH = Math.floor(thumbs.height / cells);
      const thumbW = thumbs.width;
      const pos = Math.round(value * Math.max(0, length - thumbW));
      out.copyBits(thumbs, { x: 0, y: stateRow * cellH, w: thumbW, h: cellH }, { x: pos, y: 0, w: thumbW, h: cellH });
    } else {
      const cellW = Math.floor(thumbs.width / cells);
      const thumbH = thumbs.height;
      const pos = Math.round(value * Math.max(0, length - thumbH));
      out.copyBits(thumbs, { x: stateRow * cellW, y: 0, w: cellW, h: thumbH }, { x: 0, y: pos, w: cellW, h: thumbH });
    }
    void tw;
  }
  return out;
}

export interface DisclosureOptions {
  direction?: 'right' | 'down';
  state?: ControlState;
}

/** Compose a disclosure triangle: a fixed 12×12 state glyph, stamped 1:1. */
export async function composeDisclosure(
  theme: LoadedTheme,
  opts: DisclosureOptions = {},
): Promise<PixelBuffer | null> {
  const dir = opts.direction ?? 'right';
  const state = opts.state ?? 'normal';
  const prefix = state === 'pressed' ? 'pressed-' : state === 'disabled' || state === 'inactive' ? 'inactive-' : '';
  // note: the bundle has a typo "tringle" for inactive-right
  const keys = [
    `${prefix}${dir}-pointing-disclosure-triangle`,
    `${prefix}${dir}-pointing-disclosure-tringle`,
    `${dir}-pointing-disclosure-triangle`,
  ];
  for (const k of keys) {
    const g = await loadByKey(theme, k);
    if (g) return g;
  }
  return null;
}

export interface ProgressOptions {
  length?: number;
  value?: number;
  state?: ControlState;
}

/**
 * Compose a determinate progress bar (kdef-layout-recipes §4): stretch
 * the unfilled track across the bar, overlay the fill cicn across the
 * 0..value portion (inset to the interior), cap with the frame ends.
 */
export async function composeProgress(
  theme: LoadedTheme,
  opts: ProgressOptions = {},
): Promise<PixelBuffer | null> {
  const length = Math.max(16, opts.length ?? 160);
  const value = Math.min(1, Math.max(0, opts.value ?? 0.5));
  const active = (opts.state ?? 'normal') !== 'inactive';

  // Resolve by RESOURCE ID (kdef-layout-recipes §4): frame -10080/-10077,
  // unfilled track -10078/-10075, fill section -10079/-10076. Bundle slugs
  // for these differ across schemes ("progress-bar-frame-active" vs
  // "progress-indicator-frame"); the id is the stable selector.
  const frame = await loadById(theme, active ? 10080 : 10077);
  const track = await loadById(theme, active ? 10078 : 10075);
  const fill = (await loadById(theme, active ? 10079 : 10076)) ?? (await loadById(theme, 10079));
  if (!frame && !track) return null;

  const h = frame ? frame.height : track!.height;
  const out = PixelBuffer.alloc(length, h);

  // The frame is a border ring with a transparent interior; its border
  // thickness (the inset where alpha drops out) sets where the track/fill
  // live and the 9-slice corner size. Measure it from the cicn itself.
  const border = frame ? frameBorder(frame) : 1;
  const ix = border;
  const iw = Math.max(0, length - border * 2);
  const iy = border;
  const ih = Math.max(0, h - border * 2);

  // 1) unfilled track stretched across the interior (the empty look for
  //    schemes whose frame has a transparent interior, e.g. 1990).
  if (track && iw > 0 && ih > 0) {
    out.copyBits(track, { x: 0, y: 0, w: track.width, h: track.height }, { x: ix, y: iy, w: iw, h: ih });
  }

  // 2) frame border: 9-slice so corners stay crisp. Some schemes' frames
  //    have a transparent interior (track shows through), others an opaque
  //    one (big-blue is solid white) — either way the fill goes on TOP next.
  if (frame) {
    out.nineSlice(frame, { x: 0, y: 0, w: frame.width, h: frame.height }, { l: border, t: border, r: border, b: border }, { x: 0, y: 0, w: length, h });
  }

  // 3) fill across 0..value of the interior, ON TOP of the frame — 3-slice
  //    along the bar: keep the section's rounded end caps 1:1, stretch the
  //    middle (NOT tiled — tiling repeats the section into visible chevrons).
  if (fill && value > 0 && iw > 0 && ih > 0) {
    const fw = Math.round(value * iw);
    if (fw > 0 && fw <= fill.width) {
      out.copyBits(fill, { x: 0, y: 0, w: fill.width, h: fill.height }, { x: ix, y: iy, w: fw, h: ih });
    } else if (fw > 0) {
      // cap = the rounded-corner width (~a few px); keep it small so a
      // non-empty middle remains even for narrow (12px) fill sections.
      const cap = Math.min(4, Math.max(1, (fill.width - 2) >> 1));
      const fmid = fill.width - cap * 2;
      out.copyBits(fill, { x: 0, y: 0, w: cap, h: fill.height }, { x: ix, y: iy, w: cap, h: ih });
      out.copyBits(fill, { x: fill.width - cap, y: 0, w: cap, h: fill.height }, { x: ix + fw - cap, y: iy, w: cap, h: ih });
      out.copyBits(fill, { x: cap, y: 0, w: fmid, h: fill.height }, { x: ix + cap, y: iy, w: fw - cap * 2, h: ih });
    }
  }
  return out;
}

export interface ButtonOptions {
  label?: string;
  default?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  minWidth?: number;
  /** Title color (themed buttons carry no text-color metadata yet). */
  fg?: string;
}

/**
 * Compose a THEMED push button (kdef-layout-recipes §2, FUN_30a8):
 * 9-slice the `push-button-{active|pressed|inactive}` face into the
 * button rect; for the default button wrap the `push-button-ring`
 * around it; rasterize the label centered. Returns null if the scheme
 * ships no push-button cicns (→ baselineButton).
 */
export async function composeButton(theme: LoadedTheme, opts: ButtonOptions = {}): Promise<PixelBuffer | null> {
  const stateKey = opts.disabled ? 'inactive' : opts.pressed ? 'pressed' : 'active';
  const face = (await loadByKey(theme, `push-button-${stateKey}`)) ?? (await loadByKey(theme, 'push-button-active'));
  if (!face) return null; // baseline path
  const ring = opts.default ? await loadByKey(theme, 'push-button-ring-active') : null;

  const label = opts.label ?? '';
  const fIns = sliceInset(face.width, face.height);
  const faceIns = { l: fIns, t: fIns, r: fIns, b: fIns };
  // The face center carries a 1px text-color MARKER sentinel (like the
  // window-title marker), so we sample a CLEAN interior pixel at the slice
  // inset for both the fill color and the label-contrast decision — the
  // center pixel would mislead (acid's marker is light on a black face).
  const [cr, cg, cb, ca] = face.getPixel(fIns, fIns);
  const lum = 0.299 * cr + 0.587 * cg + 0.114 * cb;
  // Disabled buttons gray the label (the inactive face cicn is often
  // identical to the active one, so the dimmed label is the only cue).
  const fg = opts.fg ?? (opts.disabled ? '#808080' : lum < 128 ? '#ffffff' : '#000000');
  const glyphs = label ? rasterizeText(label, Math.max(8, Math.round(face.height * 0.6)), fg) : null;
  const padX = 10;
  const innerW = Math.max(opts.minWidth ?? 52, (glyphs ? glyphs.width : 0) + padX * 2);
  const innerH = face.height;

  let out: PixelBuffer;
  let fx = 0;
  let fy = 0;
  if (ring) {
    const pad = Math.max(2, Math.round((ring.width - face.width) / 2));
    out = PixelBuffer.alloc(innerW + pad * 2, innerH + pad * 2);
    const rIns = sliceInset(ring.width, ring.height);
    out.nineSlice(ring, { x: 0, y: 0, w: ring.width, h: ring.height }, { l: rIns, t: rIns, r: rIns, b: rIns }, { x: 0, y: 0, w: out.width, h: out.height });
    fx = pad;
    fy = pad;
  } else {
    out = PixelBuffer.alloc(innerW, innerH);
  }
  out.nineSlice(face, { x: 0, y: 0, w: face.width, h: face.height }, faceIns, { x: fx, y: fy, w: innerW, h: innerH });
  // Flatten the interior to a solid fill: the button face is flat (bevels
  // live in the border, handled by the 9-slice edges/corners), and this
  // erases the smeared center marker that the stretch would otherwise turn
  // into a cross through the label.
  if (ca > 0) {
    const cw = innerW - fIns * 2;
    const ch = innerH - fIns * 2;
    if (cw > 0 && ch > 0) out.fillRect({ x: fx + fIns, y: fy + fIns, w: cw, h: ch }, cr, cg, cb, 255);
  }
  if (glyphs) out.drawOver(glyphs, fx + Math.round((innerW - glyphs.width) / 2), fy + Math.round((innerH - glyphs.height) / 2));
  return out;
}

/**
 * Compose a THEMED checkbox/radio glyph + label into a buffer. Stamps
 * the fixed-size state cicn 1:1 (radio: `radio-buttons-{on|off}-...`;
 * checkbox: `normal-{on|off}-...`). Returns null → baselineCheckable.
 */
export async function composeCheckable(
  theme: LoadedTheme,
  kind: 'checkbox' | 'radio',
  opts: { label?: string; checked?: boolean; disabled?: boolean; fg?: string } = {},
): Promise<PixelBuffer | null> {
  const on = opts.checked ? 'on' : 'off';
  const glyph =
    kind === 'radio'
      ? (await loadByKey(theme, `radio-buttons-${on}-${opts.disabled ? 'inactive' : 'active'}`))
      : (await loadByKey(theme, `normal-${on}-${opts.disabled ? 'disabled' : 'normal'}`));
  if (!glyph) return null;
  const label = opts.label ?? '';
  const glyphs = label ? rasterizeText(label, 9, opts.fg ?? '#000000') : null;
  const gap = 5;
  const w = glyph.width + (glyphs ? gap + glyphs.width : 0);
  const h = Math.max(glyph.height, glyphs ? glyphs.height : 0);
  const out = PixelBuffer.alloc(w, h);
  out.copyBits(glyph, { x: 0, y: 0, w: glyph.width, h: glyph.height }, { x: 0, y: Math.round((h - glyph.height) / 2), w: glyph.width, h: glyph.height });
  if (glyphs) out.drawOver(glyphs, glyph.width + gap, Math.round((h - glyphs.height) / 2));
  return out;
}

// ─── Baseline (procedural Platinum) controls ───────────────────────────
// Kaleidoscope leaves standard controls to the OS unless the scheme ships
// cicns (kdef-findings §2.2). 7 Le ships none, so these render as the
// Platinum default — DOM elements with procedural styling, not cicn
// composites. Accessible + the faithful path for cicn-less schemes.

export interface BaselineButtonOptions {
  default?: boolean;
  disabled?: boolean;
  /** Minimum button width in px (default 62). Use a small value for compact
   *  buttons like a segmented On/Off pair. */
  minWidth?: number;
}

export function baselineButton(label: string, opts: BaselineButtonOptions = {}): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.disabled = !!opts.disabled;
  // Platinum push button: rounded face with a top-light gradient, a dark
  // outer frame, a white top-inner highlight + soft bottom-inner shadow.
  // The default button gets the classic black ring (1px light gap, then a
  // 2px black rounded outline) via stacked box-shadows.
  const bevel = 'inset 0 1px 0 #ffffff, inset 0 -1px 1px rgba(0,0,0,0.14)';
  Object.assign(b.style, {
    font: '12px Charcoal, Chicago, Geneva, sans-serif',
    padding: '3px 16px',
    minWidth: `${opts.minWidth ?? 62}px`,
    margin: '3px',
    color: opts.disabled ? '#9a9a9a' : '#000',
    background: opts.disabled ? '#e0e0e0' : 'linear-gradient(180deg, #fefefe 0%, #ececec 48%, #cdcdcd 100%)',
    border: '1px solid #5a5a5a',
    borderRadius: '10px',
    boxShadow: opts.default ? `${bevel}, 0 0 0 1px #d4d4d4, 0 0 0 3px #000000` : bevel,
    cursor: opts.disabled ? 'default' : 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);
  return b;
}

export function baselineCheckable(
  kind: 'checkbox' | 'radio',
  label: string,
  opts: { checked?: boolean; disabled?: boolean } = {},
): HTMLLabelElement {
  const wrap = document.createElement('label');
  Object.assign(wrap.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    font: '12px Chicago, Charcoal, Geneva, sans-serif',
    color: opts.disabled ? '#888' : '#000',
  } satisfies Partial<CSSStyleDeclaration>);
  const box = document.createElement('span');
  Object.assign(box.style, {
    width: '12px',
    height: '12px',
    background: 'linear-gradient(#ffffff, #dcdcdc)',
    border: '1px solid #555555',
    borderRadius: kind === 'radio' ? '50%' : '2px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    lineHeight: '1',
  } satisfies Partial<CSSStyleDeclaration>);
  if (opts.checked) box.textContent = kind === 'radio' ? '●' : '✓';
  const text = document.createElement('span');
  text.textContent = label;
  wrap.append(box, text);
  return wrap;
}

/** Blit a composed control buffer to a CSS-scaled, pixelated canvas. */
export function bufferToCanvas(buf: PixelBuffer, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = buf.width;
  canvas.height = buf.height;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.putImageData(buf.toImageData(), 0, 0);
  Object.assign(canvas.style, {
    width: `${buf.width * scale}px`,
    height: `${buf.height * scale}px`,
    imageRendering: 'pixelated',
    display: 'block',
  } satisfies Partial<CSSStyleDeclaration>);
  return canvas;
}
