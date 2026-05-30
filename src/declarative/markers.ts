// Published structural-marker class names — the seams CONSUMER CSS scopes off.
// These are part of the public API contract: stable across minor versions, and
// guaranteed to be present after promotion / mount completes. Use them instead
// of hand-managing your own "skinned" / "ready" classes (which the runtime can
// neither see nor guarantee correct ordering for).
//
// Why constants instead of just documenting the class names?
//   - Auto-complete + grep-ability in TS consumer code.
//   - Whitespace-safe (consumers don't accidentally type "scriptoscope_slot").
//   - One place to bump if we ever rename (back-compat aliases would land here).

/** Added by ScriptoscopeWindow.promote to the inner content wrapper inside each
 *  promoted window. Use as a CSS hook for "this card is now wearing chrome":
 *  `.scriptoscope-slot .my-icon { display: none; }`. Fires after rect capture,
 *  so it's safe to use with layout-affecting CSS (the runtime has already
 *  measured the original element). */
export const SCRIPTOSCOPE_SLOT_CLASS = 'scriptoscope-slot';

/** Added by mountDeclarative to the `root` element AFTER the initial scan +
 *  all promotions resolve (success or partial). Removed in `disconnect()`.
 *  Lets consumer CSS gate "show the bare-HTML fallback" panels on whether
 *  the runtime is live, without juggling a custom class:
 *  `.scriptoscope-ready .pre-mount-fallback { display: none; }` */
export const SCRIPTOSCOPE_READY_CLASS = 'scriptoscope-ready';

/** Added by ScriptoscopeWindow.promote to the consumer's ORIGINAL element
 *  BEFORE its children are moved into the slot. Used as a re-entrancy guard
 *  by the scanner's MutationObserver so it doesn't re-promote elements
 *  mid-mount. Consumers should NOT set this themselves — it's an internal
 *  stamp, exported here only so a consumer doing static SSR can avoid
 *  accidentally setting it. */
export const SCRIPTOSCOPE_PROMOTED_ATTR = 'data-scriptoscope-promoted';

/** Added by mountDeclarative to the `root` element from invocation until the
 *  `ready` event fires. CSS hooks in scriptoscope.css scope off this attr to
 *  paint loading affordances (chrome wipe-in, dotted picker-tile placeholders,
 *  watch cursor). Removed once the page is settled. Suppressed entirely when
 *  the consumer passes `{ bootAffordance: 'none' }`. */
export const SCRIPTOSCOPE_LOADING_ATTR = 'data-scriptoscope-loading';
