# Explicit page host

`explicit-host.mjs` is application example code. The package runtime exposes
promotion and restoration primitives; it does not discover, move or retry DOM.
The helper captures a finite initial selection, or accepts `sources` returned by
`selectPageSources(root)`. Later native buttons and controls are explicit:

```js
await handle.attach({buttons: [saveButton], controls: [checkbox]});
await handle.whenReady();
handle.detach({buttons: [saveButton], controls: [checkbox]});
```

Detach before removing, moving or replacing these sources. Disconnect the whole
host before replacing its root. Attach and retheme completion include the selected
promotions and post-attachment scrollbar refreshes. Superseded requests cannot
publish completion. The source nodes remain native form and accessibility owners.

Each preparation has a guard and lifetime. A successful button replacement
transfers focus and disposes its previous face. A failed or stale replacement
retains the prior committed face. Detach/disconnect abort before restoration;
window, field, tab and control dependents release before the resolver. Registered
themes and their base chains remain borrowed. Drop owners release their themes
only after disconnecting the consuming host.

Boot failures reject with `PagePromotionError`, retaining the underlying `cause`
and collected `failures`. With `rejectOnEmptyMount`, a nonempty selection with no
successful promotion rejects. Partial target failures preserve usable results,
append to `handle.failures`, invoke `onPromoteError(detail)` and emit the handle
and bubbling source `promoteError` events. Retheme load/window errors reject;
per-target errors retain their preceding faces and are reported as partial work.
`ready` is delivered on the next task after boot, so callers can subscribe after
awaiting the handle. `retheme` fires after the current explicit work completes.

The host preserves nearest authored theme ancestry. URL state, cycling, boot
animation and persistence belong to the application. Persisted geometry uses
`applyState` and `setPosition`; committed dimensions also use `acceptUserSize`,
so content-fit does not grow a restored size after expansion. No widget click or
content remount is used for persisted z/collapsed state.

Responsive examples explicitly disconnect and remount at width changes. At an
unchanged width, committed content height is reused only when the authored height
is absent and the theme, natural dimensions, scroll dimensions and font metrics
still match the native baseline sampled at teardown. All source measurements are
captured before promotion starts. Changed content/fonts and changed widths use
fresh natural layout. There is no mutation observer or continuous scan service.

## Publishing

`copy-demo-assets.mjs` publishes both helper modules with imports rewritten to the
matching copied root/declarative entries. Every emitted runtime chunk is copied
opaquely by the existing build. The installation page contains executable complete,
custom-theme and persistent desktop examples; the helper is a separate import.
The imperative advertisement remains unchanged.

## Consumer integration verification

Owned probes exercised all twelve built pages/starters, explicit late controls,
FormData, native required validation/submit callbacks, field/tab/control identities,
failed/superseded rethemes, focused button replacement, failed button preparation,
borrowed-theme survival, cancelled attach, typed boot failure and teardown.
The personal form shows Thanks after valid submission and retains the same form,
input and button across width changes. An actual dropped BeOS archive rethemed the
custom starter; teardown left zero observed live object URLs in that probe.
A real second tab restored arbitrary z/collapse and then omitted dimensions while
expanding; 231×123 content dimensions and the original native input survived.

Desktop 1138 at 1280×900: eight hosts, 348px cascade reservation, 1658px document.
Mobile BeOS at 390×844: eight hosts, 436px reservation, 2461px document.
Same-width teardown/remount matched all eight rectangles. Added visible multiline
content and changed fonts grew the remounted window; authored height stayed 70px.
The picker restored authored node identity, rebuilt tiles and switched after remount.

Build, demo build and cleanroom passed during integration. The initial retired-scanner typecheck failure was resolved by the independent
test owner; final consumer typecheck passed. Independent test source was neither
read nor edited by this owner. Independent exact-head tests,
package checks and review remain coordinator gates. These observations do not
establish universal asset, refresh, transient-race or reclamation guarantees.

## Source accounting

New helpers contain 431/69 physical lines and 417/65 syntax-token occupied JS
lines respectively: 500 physical and 482 JS lines total. The full current drop
helper is 59 JS lines; responsive helper 122; retained advertisement 180. These
existing helpers receive no deletion credit. Complete/custom/persistent published
starter scripts are conservatively charged in full at 6/32/23 JS lines (61 total);
the hosted-archive supplement adds 15 JS lines.
The publishing script change adds 10 and removes 1 physical line. All adapter,
inline animation, persistence and new method wiring is included in these files;
no new CSS, dependency, lock change or generated asset is introduced.

The original author-bound 2387 consumer JS / 974 CSS / 1498 markup / 177 catalog
lines remain retained with zero deletion credit. No old arithmetic ceiling is
claimed as a final saving. Runtime source-author accounting is separate: the first
runtime commit reports 2711→1860 lexical occupied lines and 193010→123076 bytes;
restorers add 164/remove 38 physical lines. Across both runtime commits, the
filename/count-only aggregate is 246 added/1357 removed physical source lines.
The two lexical/physical measures cannot be subtracted from each other. A combined
effective compatible net remains pending an authorized recount and independent review.

Consumer-only physical changes: 121 added/70 removed in existing demo/publishing
files, 82 added/63 removed in README, plus the 500 new helper lines above.
This handoff contains 104 physical lines and is charged separately.
Total consumer-owned additions/removals including prose are 807/133 physical lines.
