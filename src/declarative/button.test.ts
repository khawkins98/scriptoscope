// Compile-only public API contract, included by typecheck and excluded from the
// published declarations. Direct off-DOM preparation cannot return null; owned
// scanner work must handle cancellation explicitly.
import { promoteButton } from './button.js';
import type { LoadedTheme } from '../types.js';

export function assertPromotionTypes(el: HTMLElement, theme: LoadedTheme, signal: AbortSignal): void {
  const direct: Promise<HTMLElement> = promoteButton(el, theme);
  const owned: Promise<HTMLElement | null> = promoteButton(el, theme, signal);
  // @ts-expect-error a lifetime signal permits cancellation before commit
  const unchecked: Promise<HTMLElement> = promoteButton(el, theme, signal);
  void direct; void owned; void unchecked;
}
