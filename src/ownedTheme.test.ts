import { assetUrl } from './loadTheme.js';
import { WindowManager } from './interactive.js';
import { composeButton, composeCheckable, composeSlider, composeProgress, composeDisclosure, composeTab, composeBevelButton, composeListHeader, composeGrowBox } from './controls.js';
import type { LoadedTheme } from './types.js';
import { themeView, type OwnedTheme } from './ownedTheme.js';

function contracts(owned: OwnedTheme, loaded: LoadedTheme): void {
  assetUrl(loaded, 'image.png');
  void composeButton(owned);
  void composeCheckable(owned, 'checkbox');
  void composeSlider(owned);
  void composeProgress(owned);
  void composeDisclosure(owned);
  void composeTab(owned);
  void composeBevelButton(owned);
  void composeListHeader(owned);
  void composeGrowBox(owned);
  const legacyManager = new WindowManager();
  const ownedManager = new WindowManager<OwnedTheme>();
  const host = document.createElement('div');
  const legacyIdentity: LoadedTheme | undefined = legacyManager.describe(host)?.theme;
  const ownedIdentity: OwnedTheme | undefined = ownedManager.describe(host)?.theme;
  void legacyIdentity; void ownedIdentity;
  void ownedManager.add(owned);
  // @ts-expect-error Default managers preserve their LoadedTheme contract.
  void legacyManager.add(owned);
  // @ts-expect-error Internal capabilities do not expose ready images or ownership.
  assetUrl(themeView(owned), 'image.png');
  // @ts-expect-error Owned resources are not a ready-image theme.
  assetUrl(owned.source, 'image.png');
  // @ts-expect-error The owned loading contract is structurally distinct.
  assetUrl(owned, 'image.png');
}
void contracts;
