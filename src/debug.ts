// Lightweight debug-logging facility for the runtime. Off by default; consumers
// opt in via `setDebug(true)` (or `setDebug({ categories: ['render', 'scrollbar'] })`
// to filter). When off, `debug()` is a single cheap branch — no string formatting,
// no object construction in callers (use eager arguments; the call sites only fire
// during user-relevant events like render / focus / drag, not in hot loops).
//
// CATEGORIES (used by the runtime):
//   render      — every WindowManager.render() entry, with title + dims + state
//   scrollbar   — wire / teardown / no-overflow / retry-on-zero / V-attach / H-attach
//   focus       — focus events + active-state flips (records when render is skipped)
//   drag        — title-bar drag start/end; grow-box pointer + keyboard start/end
//   theme       — retheme calls + per-window resolution
//   promote     — declarative promotion (window / button / control)
//   unmount     — ScriptoscopeWindow unmount + manager.remove
//   shadow      — shadow root attach + light-DOM slot operations
//
// USAGE FROM A DEMO/CONSUMER:
//   import { setDebug } from 'scriptoscope';
//   setDebug(true);                                 // all categories
//   setDebug({ categories: ['scrollbar','drag'] });  // filtered
//   setDebug(false);                                 // off
//
// URL-DRIVEN (the runtime does NOT read URL params on its own — the demo wires this):
//   ?scriptoscope-debug=1                              → all
//   ?scriptoscope-debug=scrollbar,drag                 → filtered

let enabled = false;
let allowed: Set<string> | null = null; // null = "all categories"

/** Public option shape for setDebug. */
export interface DebugOpts {
  /** Restrict logging to the named categories. Omit (or pass 'all') to enable everything. */
  categories?: readonly string[] | 'all';
}

/**
 * Enable / disable debug logging. Accepts a boolean (all-or-nothing) or an options
 * object (`{ categories: [...] }`) to filter. Persists in module scope; cheap to call.
 */
export function setDebug(on: boolean | DebugOpts): void {
  if (typeof on === 'boolean') {
    enabled = on;
    allowed = null;
    return;
  }
  enabled = true;
  if (!on.categories || on.categories === 'all') allowed = null;
  else allowed = new Set(on.categories);
}

/** True if debug logging is on AND the given category is allowed by the filter. */
export function isDebug(category?: string): boolean {
  if (!enabled) return false;
  if (!category || !allowed) return true;
  return allowed.has(category);
}

/**
 * Emit a debug line. No-op when disabled or filtered out.
 *
 * The label is the human-scannable headline ("render: Welcome 320×240 active");
 * data is an optional bag of fields (printed after the headline by console.log
 * so dev tools render it inline-collapsible).
 */
export function debug(category: string, label: string, data?: object): void {
  if (!isDebug(category)) return;
  if (data !== undefined) console.log(`[scriptoscope:${category}] ${label}`, data);
  else console.log(`[scriptoscope:${category}] ${label}`);
}
