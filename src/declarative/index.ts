// Explicit promotion primitives. The caller owns attachment and lifetime.

export {
  SCRIPTOSCOPE_SLOT_CLASS, SCRIPTOSCOPE_READY_CLASS,
  SCRIPTOSCOPE_PROMOTED_ATTR, SCRIPTOSCOPE_LOADING_ATTR,
} from './markers.js';
export { ScriptoscopeWindow, type ScriptoscopeWindowDeps } from './ScriptoscopeWindow.js';
export {
  createThemeResolver, createOwnedThemeResolver,
  type ThemeResolver, type ThemeBootstrapOpts,
  type ThemeEntry,
  /** @deprecated use {@link ThemeEntry} */ type ThemeHint,
} from './theme.js';
export { promoteButton, promoteOwnedButton as promoteGuardedButton, restoreButton, disposePromotedButtonFace } from './button.js';
export { promoteControl, promoteGuardedControl, restoreControl } from './control.js';
export { promoteField, restoreField, isFieldEligible } from './field.js';
export { promoteIcon, promoteIconAsync, ICON_NAMES } from './icon.js';
export {
  promoteThemePicker, syncThemePickerActive,
  type PickerThemeEntry, type PickerDeps,
} from './themePicker.js';
export { promoteTabs, restoreTabs } from './tabs.js';
export {
  attachThemeDropZone,
  type ThemeDropZoneOptions, type ThemeDropZoneHandle,
} from './themeDropZone.js';
export {
  openModal,
  type OpenModalOptions, type OpenModalHandle,
} from './openModal.js';
export {
  parseWindowAttrs, parseButtonAttrs, resolveThemeRef, themeRefToUrl, isThemeUrl,
  type ParsedWindow, type ParsedButton, type SizeMode,
} from './parse.js';
