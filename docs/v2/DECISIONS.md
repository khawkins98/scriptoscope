# v2 decisions

Tracker: [#378](https://github.com/khawkins98/scriptoscope/issues/378). Plan: [PLAN.md](./PLAN.md) (architecture review, 2026-10-21).

| # | Decision | Status |
|---|---|---|
| 1 | Long-lived `v2` integration branch. `main` is frozen to hotfixes, docs, rule tables and evidence. main → v2 merge-sync every Monday and after any main runtime hotfix. | Adopted (PM default; maintainer may override) |
| 2 | Drivers are per message × family. Binary addresses appear only in table rows, doc comments and generated `coverage.json`; no address-named functions. | Adopted |
| 3 | PACH 130 is scoped to patched painters already cited in the contract: list-header draw/sort, and the EraseRect/FillRect/PaintRect helpers behind progress and body backgrounds. Menus/MDEF, dialogs, Finder, cursors and text patches are out of scope for 2.0; a v2.1 inventory issue tracks them. | Adopted |
| 4 | Scroll-bar `pressedPart?: 'up' \| 'down' \| 'pageUp' \| 'pageDown' \| 'thumb'` (native 20/21/22/23/129). `state: 'pressed'` without a part means `thumb`. `ControlState` is unchanged. | Approved by maintainer (2026-10-21) |
| 5 | Goldens are re-cut per family on v2. Control-panel fork cicns are not shipped; that ladder step is a recorded deliberate divergence. | Adopted |
| 6 | The v2 release is published as package version `0.2.0` (pre-1.0 minor; "v2" names the engine and branch). | Approved by maintainer (2026-10-21) |
| 7 | Engine resource adapter (`src/engine/resources/theme.ts`) policy, no spec row: a cicn's opaque icon-blit companion (`iconBlit.unmaskedAsset`, used for qd-primitives I3) is used only when it is the same occurrence as the element's `asset` (equal size and equal RGB at every mask-set pixel, `sameOccurrence`). **When it does not match** (for example a consumer replaced `asset`), the engine **falls back to the masked copy of the current `asset`** and records the fallback in the trace. It never draws stale hidden pixels and never draws nothing. | Approved by maintainer (2026-10-22), with the masked fallback |
| 8 | Cutover is incremental: v2 ships to main through per-family minor releases (0.2.0 first: engine core and scroll bar); v2 remains the integration branch between releases; "every family on the engine, no legacy drawer" is the 1.0 milestone. This supersedes PLAN §2's single 0.2.0 cut. | Approved by maintainer (2026-10-22) |
| 9 | Slider `state: 'pressed'` means the thumb is pressed (native hilite 129), mirroring DECISIONS #4. Add an optional `pressedPart: 'thumb' \| 'pageUp' \| 'pageDown'` (native 129 / 22 / 23); a page press gives pressed track art with the normal thumb. `ControlState` is unchanged. | Approved by maintainer (2026-10-22) |
