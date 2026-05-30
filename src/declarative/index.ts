// Public entry for the DECLARATIVE consumption layer — the `data-scriptoscope-*` front door. Separate from
// the runtime entry (`src/index.ts`), which is left untouched; this imports the runtime pieces
// directly. Drop a `<div data-scriptoscope-window>` on a page, call mountDeclarative(), get Mac windows.

export {
  mountDeclarative,
  type MountOptions, type MountHandle, type MountStats, type PromoteError, type MountEventMap,
} from './scanner.js';
export {
  SCRIPTOSCOPE_SLOT_CLASS, SCRIPTOSCOPE_READY_CLASS,
  SCRIPTOSCOPE_PROMOTED_ATTR, SCRIPTOSCOPE_LOADING_ATTR,
} from './markers.js';
export { ScriptoscopeWindow, type ScriptoscopeWindowDeps } from './ScriptoscopeWindow.js';
export {
  createThemeResolver,
  type ThemeResolver, type ThemeBootstrapOpts,
  type ThemeEntry,
  /** @deprecated use {@link ThemeEntry} */ type ThemeHint,
} from './theme.js';
export { promoteButton } from './button.js';
export { promoteField, isFieldEligible } from './field.js';
export { promoteIcon, ICON_NAMES } from './icon.js';
export {
  promoteThemePicker, syncThemePickerActive,
  type PickerThemeEntry, type PickerDeps,
} from './themePicker.js';
export { promoteTabs } from './tabs.js';
export {
  attachThemeDropZone,
  type ThemeDropZoneOptions, type ThemeDropZoneHandle,
} from './themeDropZone.js';
export {
  parseWindowAttrs, parseButtonAttrs, resolveThemeRef, themeRefToUrl, isThemeUrl,
  type ParsedWindow, type ParsedButton, type SizeMode,
} from './parse.js';
