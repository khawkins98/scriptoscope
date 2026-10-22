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
| 7 | Engine resource adapter (`src/engine/resources/theme.ts`) policy, no spec row: a cicn's opaque icon-blit companion (`iconBlit.unmaskedAsset`, used for qd-primitives I3) is used only when it is the same occurrence as the element's `asset`, i.e. equal size and equal RGB at every mask-set pixel (`sameOccurrence`). Otherwise it is dropped and the I3 copy is traced unavailable, so a consumer who replaces `asset` never gets stale hidden pixels. | Proposed (v2 L6, engine prep) |
