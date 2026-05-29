// Persistence — localStorage-backed layout save/restore for mountDeclarative consumers.
// Closes #165 (minimal viable). Opt-in via mountDeclarative({ persistKey: '<id>' }); without
// a persistKey, nothing is read or written.
//
// SCHEMA (versioned for forward-compat — see issue #167 framing comment):
//   { "version": 1, "windows": { "<id>": { x,y,w,h,collapsed,z } }, "activeTheme"?: "<slug>" }
//
// WINDOW IDENTITY:
//   data-scriptoscope-window-id="<id>" on the consumer's element → stable across DOM order changes
//   No id → DOM-source-ordinal ("<dom-ordinal-N>") — convenient for static pages but breaks if
//   windows reorder. Documented in the proposal at docs/superpowers/specs/2026-05-28-persistence-design.md.
//
// CROSS-TAB SYNC:
//   `storage` event listener applies layouts written by other tabs.
//
// SAFETY:
//   - localStorage may throw (quota exceeded, SecurityError in private browsing). All writes
//     wrapped in try/catch; the feature degrades to in-memory only without breaking the app.
//   - Reading a future-version snapshot (version > 1) returns null + logs a warning. We don't
//     attempt forward migration.
//   - All ops are debounced via rAF + a 200ms tail so a burst of changes coalesces into one write.

const SCHEMA_VERSION = 1;

export interface PersistedWindow {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  collapsed?: boolean;
  z?: number;
}

export interface PersistedLayout {
  version: number;
  windows: Record<string, PersistedWindow>;
  activeTheme?: string;
}

const STORAGE_PREFIX = 'scriptoscope:layout:';

/** Read the persisted layout for a key. Returns null if missing/unparsable/future-version. */
export function readLayout(persistKey: string): PersistedLayout | null {
  let raw: string | null;
  try { raw = localStorage.getItem(STORAGE_PREFIX + persistKey); }
  catch { return null; } // SecurityError in private browsing → silent degrade
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedLayout;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version > SCHEMA_VERSION) {
      console.warn(`[scriptoscope] persisted layout for "${persistKey}" is version ${parsed.version}; this build supports up to ${SCHEMA_VERSION}. Ignoring.`);
      return null;
    }
    return parsed;
  } catch { return null; }
}

/** Write a layout to storage. Silently no-ops on quota / SecurityError. */
export function writeLayout(persistKey: string, layout: PersistedLayout): void {
  try { localStorage.setItem(STORAGE_PREFIX + persistKey, JSON.stringify(layout)); }
  catch (err) {
    // Quota or SecurityError — log once and degrade. Don't crash the consumer.
    console.warn(`[scriptoscope] couldn't persist layout for "${persistKey}":`, err);
  }
}

/** A debounced writer — coalesces a burst of mutations into one localStorage write per ~250ms. */
export function createDebouncedWriter(persistKey: string): (layout: PersistedLayout) => void {
  let pending: PersistedLayout | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (layout: PersistedLayout): void => {
    pending = layout;
    if (timer) return;
    timer = setTimeout(() => {
      if (pending) writeLayout(persistKey, pending);
      timer = null;
      pending = null;
    }, 250);
  };
}

/** Subscribe to cross-tab updates for a persistKey. Calls cb when another tab writes the same key.
 *  Returns a teardown function. */
export function onCrossTabUpdate(persistKey: string, cb: (layout: PersistedLayout) => void): () => void {
  const fullKey = STORAGE_PREFIX + persistKey;
  const handler = (e: StorageEvent): void => {
    if (e.key !== fullKey || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as PersistedLayout;
      if (parsed?.version <= SCHEMA_VERSION) cb(parsed);
    } catch { /* ignore malformed cross-tab payload */ }
  };
  window.addEventListener('storage', handler);
  return () => { window.removeEventListener('storage', handler); };
}

/** Compute a window's identity for the persistence map. Stable id from data-scriptoscope-window-id when
 *  the consumer provided one; else a DOM-ordinal fallback so static pages get sensible behavior
 *  out of the box (with the documented caveat that reordering breaks the mapping). */
export function windowIdFor(el: HTMLElement, ordinal: number): string {
  return el.dataset.scriptoscopeWindowId || `dom-ordinal-${ordinal}`;
}

/** Read a host element's current geometry (position from host.style; size from entry.opts via
 *  the public manager API the caller passes in). */
export function readHostPosition(host: HTMLElement): { x: number; y: number } {
  return {
    x: Math.round(parseFloat(host.style.left) || 0),
    y: Math.round(parseFloat(host.style.top) || 0),
  };
}
