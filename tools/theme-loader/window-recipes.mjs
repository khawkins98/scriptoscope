// tools/theme-loader/window-recipes.mjs
// THE single per-type window recipe — the canonical title-bar height, widget set,
// and collapsed flag for each Platinum-family window type, keyed by canonical slug.
//
// Imported by BOTH consumers that used to keep hand-synced copies:
//   • tools/theme-loader/buildThemeJson.js (CORNER_SPRITE_WINDOWS) — adds the
//     SHIPPED-cicn wiring (active/inactive corner cicns, pinstripe, grow box) on top.
//   • scripts/generate-platinum/window-types.mjs (WINDOW_TYPES) — adds the
//     PROCEDURAL drawing params (titlePlate, bottomFrame, titleEdge, ref) on top.
//
// Those two copies had DRIFTED (the thing this consolidation fixes):
//   • document/collapsed-document titleH: 19 (builder, decode) vs 20 (generator).
//   • no-title-utility: a dotted DRAG BAR w/ widgets (builder, reference-matched)
//     vs a title-LESS frame (generator).
//   • titled-utility / collapsed-titled-utility widgets: [close,collapse] (builder)
//     vs [close] (generator).
// The values here are the DECODE-GROUNDED ones (WDEF 125 + the runtime composer in
// src/composeCornerSprite.ts), i.e. the builder's values — so the builder stays
// byte-identical and the generator reconciles to them (the replica is regenerated).
//
// titleH: title-bar height in px (0 ⇒ title-LESS frame — just the 1px ring).
// widgets: title-bar widget glyphs, left→right (close anchors left; collapse/zoom
//          anchor right). [] ⇒ no widgets.
// collapsed: title-bar-only window (no body).

/** @typedef {{ titleH: number, widgets: ('close'|'collapse'|'zoom')[], collapsed: boolean }} WindowRecipe */

/** @type {Record<string, WindowRecipe>} */
export const WINDOW_RECIPES = {
  'document-window':              { titleH: 19, widgets: ['close', 'collapse', 'zoom'], collapsed: false },
  'collapsed-document-window':    { titleH: 19, widgets: ['close', 'collapse', 'zoom'], collapsed: true  },
  'dialog':                       { titleH: 0,  widgets: [],                            collapsed: false },
  'alert':                        { titleH: 0,  widgets: [],                            collapsed: false },
  'movable-modal':                { titleH: 16, widgets: ['close'],                     collapsed: false },
  'movable-alert':                { titleH: 16, widgets: ['close'],                     collapsed: false },
  'titled-utility-window':        { titleH: 11, widgets: ['close', 'collapse'],         collapsed: false },
  'collapsed-titled-utility':     { titleH: 11, widgets: ['close', 'collapse'],         collapsed: true  },
  'side-floating-utility-window': { titleH: 11, widgets: [],                            collapsed: false },
  'collapsed-side-utility':       { titleH: 11, widgets: [],                            collapsed: true  },
  // No-title utility = a tool-palette DRAG BAR (dotted -14314 + close/collapse), NOT
  // a title-less frame — the references show this dotted bar (title TEXT is already
  // suppressed for every utility window by renderWindow's isUtility).
  'no-title-utility-window':      { titleH: 11, widgets: ['close', 'collapse'],         collapsed: false },
  'collapsed-no-title-utility':   { titleH: 0,  widgets: [],                            collapsed: true  },
  'popup-window':                 { titleH: 14, widgets: [],                            collapsed: false },
};

/** The compositor's default widget set (src/composeCornerSprite.ts); a window type
 *  whose widgets equal this can OMIT the field in theme.json (the compositor fills
 *  it), keeping the emitted JSON minimal. */
export const DEFAULT_WIDGETS = ['close', 'collapse', 'zoom'];

/** True when `widgets` equals DEFAULT_WIDGETS (same glyphs, same order). */
export function isDefaultWidgets(widgets) {
  return Array.isArray(widgets)
    && widgets.length === DEFAULT_WIDGETS.length
    && widgets.every((w, i) => w === DEFAULT_WIDGETS[i]);
}
