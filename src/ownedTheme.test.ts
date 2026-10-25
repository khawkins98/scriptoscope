import { assetUrl } from './loadTheme.js';
import { composeButton } from './controls.js';
import type { LoadedTheme } from './types.js';
import type { OwnedTheme } from './ownedTheme.js';

function contracts(owned: OwnedTheme, loaded: LoadedTheme): void {
  assetUrl(loaded, 'image.png');
  void composeButton(owned);
  // @ts-expect-error Owned resources are not a ready-image theme.
  assetUrl(owned.source, 'image.png');
  // @ts-expect-error The owned loading contract is structurally distinct.
  assetUrl(owned, 'image.png');
}
void contracts;
