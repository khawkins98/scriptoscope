# Platinum controls — faithfulness ledger (Phase-B contract)

*Seeded sibling to [`kdef-faithfulness-ledger.md`](./kdef-faithfulness-ledger.md).
One row per control kind × feature, mapping it to its decode/data source and a
faithfulness status. Phase-B may only build on `confirmed` / `data` /
`model-reuse` rows; `could-NOT-pin` rows must be resolved (or explicitly waived)
before they are rendered. Divergence is detected against this ledger +
`npm run lint:themes`, not by eyeballing renders.*

**Status legend:** `confirmed` (instruction-decoded) · `data` (extracted clut/cctb
value) · `model-reuse` (reuses the verified WDEF-125 bevel model) ·
`could-NOT-pin` (ambiguous — gates Phase-B). Sources: `CDEF -63 0xADDR` (track) ·
`CDEF -1` (button family, TODO) · `AppearanceLib off` (PPC) · `cctb`/clut (data) ·
`platinum-palette.json`.

| control kind | feature | source | status | planned Phase-B impl |
|---|---|---|---|---|
| scrollbar/slider/indicator | message dispatch | `CDEF -63` table @ `0xf8` | confirmed | n/a (renderer state) |
| scrollbar/slider/indicator | thumb/track geometry | `CDEF -63` `0xa6c` (+10..17, +50/52/54) | confirmed | generator: thumb len = (track − reserve), clamp 4..6 glyph |
| scrollbar/slider/indicator | thumb glyph size | `CDEF -63` `0xcb6`/`0xcc2` (clamp 4..6) | confirmed | generator: glyph = (+54>>2), 4..6 |
| scrollbar/slider/indicator | arrow/cap box | `CDEF -63` `0x11b6` (+54+3) | confirmed | generator: cap = thickness+3 |
| scrollbar/slider/indicator | inset frame | `CDEF -63` `0x11fa` (+3,+3 / +1,+1) | confirmed | generator: inset frame |
| scrollbar/slider/indicator | active/inactive state | `CDEF -63` `contrlHilite` 255/1 | confirmed | generator: dim on inactive |
| scrollbar/slider/indicator | sub-type (bar vs slider) | — | could-NOT-pin | resolve vs reference render |
| scrollbar/slider/indicator | part pixels (bevel/fill) | runtime proc + AppearanceLib | model-reuse | WDEF-125 bevel model + cctb grays |
| push button / default ring | geometry | `CDEF -1` | could-NOT-pin (TODO) | decode `CDEF -1`, then generator |
| bevel button | geometry | `CDEF -1` | could-NOT-pin (TODO) | decode `CDEF -1`, then generator |
| checkbox | geometry + glyph | `CDEF -1` | could-NOT-pin (TODO) | decode `CDEF -1`; glyph from ics4 |
| radio | geometry + glyph | `CDEF -1` | could-NOT-pin (TODO) | decode `CDEF -1`; glyph from ics4 |
| popup button | geometry | `CDEF -1` | could-NOT-pin (TODO) | decode `CDEF -1`, then generator |
| tab | geometry | `CDEF -1` | could-NOT-pin (TODO) | decode `CDEF -1`, then generator |
| progress bar | geometry + fill | `CDEF -1` / accent | could-NOT-pin (TODO) | decode `CDEF -1`; fill = accent |
| all controls | drawing model | `AppearanceLib DrawThemeButton 0x2ee4` → vtable `+0xCC` | confirmed (dispatcher); drawer model-reuse | generic bevel drawer (WDEF model), theme-data-driven — mirrors Apple's data/drawer split |
| all controls | neutral grays | `cctb` id=0 (13 slots) | data | `platinum-palette.json` |
| all controls | highlight tint | `cctb` slots 13/14 (lavender/indigo) | data | `platinum-palette.json` |
| all controls | accent variants (×21) | accent cluts 200–220 | data | `platinum-palette.json`; per-control application could-NOT-pin |
