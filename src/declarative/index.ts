// Public entry for the DECLARATIVE consumption layer — the `data-scriptoscope-*` front door. Separate from
// the runtime entry (`src/index.ts`), which is left untouched; this imports the runtime pieces
// directly. Drop a `<div data-scriptoscope-window>` on a page, call mountDeclarative(), get Mac windows.

export { mountDeclarative, type MountOptions } from './scanner.js';
export { ScriptoscopeWindow, type ScriptoscopeWindowDeps } from './ScriptoscopeWindow.js';
export { createThemeResolver, type ThemeResolver, type ThemeBootstrapOpts } from './theme.js';
export { promoteButton } from './button.js';
export { promoteField, isFieldEligible } from './field.js';
export { promoteTabs } from './tabs.js';
export {
  attachThemeDropZone,
  type ThemeDropZoneOptions, type ThemeDropZoneHandle,
} from './themeDropZone.js';
export {
  parseWindowAttrs, parseButtonAttrs, resolveThemeRef, themeRefToUrl, isThemeUrl,
  type ParsedWindow, type ParsedButton, type SizeMode,
} from './parse.js';
