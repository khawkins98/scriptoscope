// Dialog and alert content colour (docs/spec/engine/procedural-frame.md §3.6).
//
// Kaleidoscope 2.3.1's 68k patches (PACH 130) intercept GetResource. When an
// alert has no colour table of its own, the `actb` handler (0x1193e) returns
// Kaleidoscope's template table with entry 0 (the content colour) set to entry 0
// of `actb` -14336. The `dctb` handler (0x119d4) does the same for themed
// dialogs with `dctb` -14336. Both -14336 tables are read through the scheme
// file first, then Kaleidoscope's own control-panel file, which ships them
// (0x20d0..0x21e8). This is how the alert body becomes grey in real
// Kaleidoscope while a document window stays white.

export type ContentTableType = 'actb' | 'dctb';

export const DIALOG_CONTENT = {
  /** Window-type slug → the colour table the patch gives the window. Other slugs keep their own body rule. */
  slugs: { alert: 'actb', 'movable-alert': 'actb', dialog: 'dctb', 'movable-modal': 'dctb' } as Readonly<Record<string, ContentTableType>>,
  id: -14336,
  /** The content colour is entry 0, found by value (§3.5 CT1–CT3). */
  entry: 0,
  /**
   * The text colour is entry 2 of the same table: the patch copies it with
   * entry 0, and its GetThemeTextColor answers DialogActive (1) and
   * AlertActive (3) with it (0xb47c, 0xb4d0).
   */
  textEntry: 2,
  /**
   * Entries 0 and 2 of Kaleidoscope 2.3.1's own `actb` / `dctb` -14336
   * (control-panel resource fork), used when the scheme ships none. Stored
   * 16-bit channels.
   */
  kaleidoscope: {
    actb: { content: [0xddde, 0xddde, 0xddde], text: [0, 0, 0] },
    dctb: { content: [0xdddd, 0xdddd, 0xdddd], text: [0, 0, 0] },
  } as Readonly<Record<ContentTableType, { readonly content: readonly [number, number, number]; readonly text: readonly [number, number, number] }>>,
  source: 'PACH 130 0x1193e (actb), 0x119d4..0x11a8e (dctb), 0x20d0..0x21e8 (tables), 0xb3b4 (text colours); Kaleidoscope 2.3.1 actb/dctb -14336',
} as const;

/** The colour table that supplies `slug`'s content colour, or null when the slug is not a dialog or alert kind. */
export function dialogContentTable(slug: string): ContentTableType | null {
  return DIALOG_CONTENT.slugs[slug] ?? null;
}
