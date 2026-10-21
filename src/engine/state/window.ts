// Window state normalisation. The window draw takes one chrome state (the
// cicn the window type ships for `active` or `inactive`) and whether the
// window is collapsed (compositor-spec "Window type selection before
// composition": a collapsed window uses an authored collapsed type, else the
// expanded type at zero body height). Defaults: active, expanded.

export type WindowChromeState = 'active' | 'inactive';

export interface WindowStateInput {
  state?: WindowChromeState;
  collapsed?: boolean;
}

export interface NormalizedWindowState {
  state: WindowChromeState;
  collapsed: boolean;
}

export function normalizeWindowState(input: WindowStateInput = {}): NormalizedWindowState {
  const state = input.state ?? 'active';
  if (state !== 'active' && state !== 'inactive') throw new TypeError(`normalizeWindowState: unknown state ${String(state)}`);
  return { state, collapsed: input.collapsed === true };
}
