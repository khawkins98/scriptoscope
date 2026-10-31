// Content colour of dialog and alert windows (procedural-frame §3.6).
//
// Kaleidoscope gives an alert, and a themed dialog, a colour table whose entry 0
// (the content colour) comes from `actb` / `dctb` -14336: the scheme's own copy,
// else the copy in Kaleidoscope's control-panel file (#DDDE / #DDDD grey). A
// document window keeps the application's colour table, white by default. Both
// the body fill (renderWindow) and the built-in frame's gap (§5A) read this.
import type { ThemeView } from './ownedTheme.js';
import { resolveInChain } from './baseChain.js';
import { DIALOG_CONTENT, dialogContentTable, type ContentTableType } from './engine/tables/dialogContent.js';
import { colorTableEntry } from './engine/families/proceduralFrame.js';
import { realizeRgb16 } from '../tools/theme-loader/display-profile.js';

type Rgb = readonly [number, number, number];

export interface DialogContentColour {
  readonly table: ContentTableType;
  /** Entry 0, stored 16-bit channels, for equality tests. */
  readonly rgb16: Rgb;
  /** Entry 0 as a display colour under the owner's display policy. */
  readonly rgb: Rgb;
  /** Entry 2 (the dialog/alert text colour) as a display colour. */
  readonly text: Rgb;
  /** `scheme`: the bundle (or a base) ships the table; `kaleidoscope`: Kaleidoscope's own copy. */
  readonly from: 'scheme' | 'kaleidoscope';
}

/** The content colour for a canonical window-type slug, or null when the slug is not a dialog or alert kind. */
export function dialogContentColour(theme: ThemeView, slug: string): DialogContentColour | null {
  const table = dialogContentTable(slug);
  if (!table) return null;
  const own = DIALOG_CONTENT.kaleidoscope[table];
  const realize = (rgb16: Rgb): Rgb => {
    const [r, g, b] = realizeRgb16(rgb16, theme.manifest.displayProfile);
    return [r!, g!, b!];
  };
  const shipped = resolveInChain(theme, t => t.inspector?.colorTables?.[`${table}:${DIALOG_CONTENT.id}`]);
  const content = shipped ? colorTableEntry(shipped, DIALOG_CONTENT.entry).entry : null;
  if (shipped && content) {
    // Entry 2 by exact value; a table without one keeps Kaleidoscope's black.
    const text = shipped.entries.find(e => e.value === DIALOG_CONTENT.textEntry);
    return { table, rgb16: content.rgb16, rgb: content.rgb, text: text ? text.rgb : realize(own.text), from: 'scheme' };
  }
  return { table, rgb16: own.content, rgb: realize(own.content), text: realize(own.text), from: 'kaleidoscope' };
}

/** `#rrggbb` for a display colour. */
export function rgbHex(rgb: readonly [number, number, number]): string {
  return `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
