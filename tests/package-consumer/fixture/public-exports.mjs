// Explicit approved public surface. Keep unrelated renderer and host exports pinned.
export const rendererExports = [
  'VERSION', 'setDebug', 'isDebug', 'debug', 'assetUrl', 'findChromeElement', 'themeImageUrl',
  'renderWindow', 'PixelBuffer', 'loadCicnBuffer', 'rasterizeText',
  'platinumCheckable', 'platinumSlider', 'platinumButton', 'platinumScrollbar',
  'platinumDisclosure', 'platinumBevelButton', 'platinumMenuBar', 'platinumMenu',
  'platinumPopupMenu', 'platinumListHeader', 'composeScrollbar', 'composeSlider',
  'composeDisclosure', 'composeProgress', 'composeProgressFrame', 'composeTab',
  'composeButton', 'composeBevelButton', 'composeListHeader', 'composeHeaderSurface',
  'composeCheckable', 'composeGrowBox', 'bufferToCanvas', 'composeWindowChrome',
  'frameFromBody', 'partRole', 'prepareDisplayProfile', 'DisplayProfileError',
  'prepareBitmapFont', 'prepareCinfEnvironment', 'CinfEnvironmentError',
  'prepareCicnTransferResults', 'CicnTransferError',
].sort();
export const sharedHostExports = [
  'ScriptoscopeWindow', 'createThemeResolver', 'createOwnedThemeResolver',
  'promoteButton', 'promoteGuardedButton', 'restoreButton', 'disposePromotedButtonFace',
  'promoteControl', 'promoteGuardedControl', 'restoreControl',
  'promoteField', 'restoreField', 'isFieldEligible', 'promoteTabs', 'restoreTabs',
  'attachThemeDropZone', 'parseWindowAttrs', 'parseButtonAttrs', 'resolveThemeRef',
  'themeRefToUrl', 'isThemeUrl',
].sort();
export const rootExports = [...rendererExports, ...sharedHostExports,
  'baselineButton', 'baselineCheckable', 'bindButtonToContentPort', 'setButtonCompositionContext',
  'loadTheme', 'loadOwnedTheme', 'loadKaleidoscopeScheme', 'loadOwnedKaleidoscopeScheme',
  'interactiveButton', 'interactiveDisclosure', 'interactiveSlider', 'interactiveScrollbar',
  'WindowManager', 'titleWidgetHits', 'ProgressIdle', 'progressTickCount',
].sort();
export const declarativeExports = [...sharedHostExports,
  'SCRIPTOSCOPE_SLOT_CLASS', 'SCRIPTOSCOPE_READY_CLASS', 'SCRIPTOSCOPE_PROMOTED_ATTR', 'SCRIPTOSCOPE_LOADING_ATTR',
  'promoteIcon', 'promoteIconAsync', 'ICON_NAMES', 'promoteThemePicker', 'syncThemePickerActive', 'openModal',
].sort();
