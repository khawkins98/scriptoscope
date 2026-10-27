import { assetUrl } from './loadTheme.js';
import { WindowManager } from './interactive.js';
import { composeButton, composeCheckable, composeSlider, composeProgress, composeDisclosure, composeTab, composeBevelButton, composeListHeader, composeGrowBox } from './controls.js';
import type { LoadedTheme } from './types.js';
import { createThemeResolver, createOwnedThemeResolver, ScriptoscopeWindow, promoteButton, promoteGuardedButton, promoteControl, promoteGuardedControl, restoreButton, restoreControl, disposePromotedButtonFace, restoreField, restoreTabs } from './declarative/index.js';
import type { ManagedWindowState } from './interactive.js';
import { themeView, type ThemeInput, type OwnedTheme } from './ownedTheme.js';

function contracts(owned: OwnedTheme, loaded: LoadedTheme): void {
  createThemeResolver().register('legacy', loaded);
  createOwnedThemeResolver().register('owned', owned);
  createOwnedThemeResolver().register('legacy', loaded);
  const legacyLoad: Promise<LoadedTheme> = createThemeResolver().load('legacy');
  const ownedLoad: Promise<ThemeInput> = createOwnedThemeResolver().load('owned');
  const button = document.createElement('button');
  const input = document.createElement('input');
  const signal = new AbortController().signal;
  const direct: Promise<HTMLElement> = promoteButton(button, owned);
  const guarded: Promise<HTMLElement | null> = promoteGuardedButton(button, owned, signal, () => true);
  const control: Promise<HTMLElement | null> = promoteControl(input, loaded, signal);
  const guardedControl: Promise<HTMLElement | null> = promoteGuardedControl(input, owned, signal, () => true);
  const focused: boolean = restoreButton(button);
  restoreControl(input); restoreField(input); restoreTabs(button);
  disposePromotedButtonFace(button, button);
  // @ts-expect-error Guard predicates are synchronous.
  void promoteGuardedButton(button, owned, signal, async () => true);
  // @ts-expect-error Guarded controls require a host lifetime.
  void promoteGuardedControl(input, owned, undefined, () => true);
  void direct; void guarded; void control; void guardedControl; void focused;
  void legacyLoad; void ownedLoad;
  // @ts-expect-error Legacy resolvers retain their ready-image registration contract.
  createThemeResolver().register('owned', owned);
  void ScriptoscopeWindow.promote(document.createElement('div'), { manager: new WindowManager<OwnedTheme>(), theme: owned });
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
  const state: ManagedWindowState = { width: 320, height: 160, z: 900, collapsed: true };
  const committed: Promise<void> = ownedManager.applyState(host, state, signal);
  void committed;
  // @ts-expect-error Persisted state has a bounded public shape.
  void ownedManager.applyState(host, { position: [0, 0] });
  // @ts-expect-error Collapse state is boolean.
  void ownedManager.applyState(host, { collapsed: 1 });
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
