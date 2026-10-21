# v2 decisions

Tracker: [#378](https://github.com/khawkins98/scriptoscope/issues/378). Plan: [PLAN.md](./PLAN.md) (architecture review, 2026-10-21).

| # | Decision | Status |
|---|---|---|
| 1 | Long-lived `v2` integration branch. `main` is frozen to hotfixes, docs, rule tables and evidence. main → v2 merge-sync every Monday and after any main runtime hotfix. | Adopted (PM default; maintainer may override) |
| 2 | Drivers are per message × family. Binary addresses appear only in table rows, doc comments and generated `coverage.json`; no address-named functions. | Adopted |
| 3 | PACH 130 is scoped to patched painters already cited in the contract: list-header draw/sort, and the EraseRect/FillRect/PaintRect helpers behind progress and body backgrounds. Menus/MDEF, dialogs, Finder, cursors and text patches are out of scope for 2.0; a v2.1 inventory issue tracks them. | Adopted |
| 4 | Scroll-bar `pressedPart?: 'up' \| 'down' \| 'pageUp' \| 'pageDown' \| 'thumb'` (native 20/21/22/23/129). `state: 'pressed'` without a part means `thumb`. `ControlState` is unchanged. | Approved by maintainer (2026-10-21) |
| 5 | Goldens are re-cut per family on v2. Control-panel fork cicns are not shipped; that ladder step is a recorded deliberate divergence. | Adopted |
| 6 | Package version for the v2 release: `0.2.0` (plan recommendation) vs `2.0.0`. | **Open: maintainer to confirm** |
