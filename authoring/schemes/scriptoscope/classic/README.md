# Native compatibility smoke

Tested 2026-11-02: System 7.5.5 / Kaleidoscope 2.3.1 / Basilisk II,
640×480 at the seed's default 8 bpp, 64 MB RAM, `nosound true`.
Compatibility smoke only; these captures are not admitted fidelity evidence.

Frozen build (341 resources; 189,449 resource bytes):

- MacBinary SHA-256: `dd1bc32b74de88ec6f18c778d102bf54f5f36a95483374b4ebe7b1bbddfd24b0`
- Resource-fork SHA-256: `7a56bf429f21f26dc63ce19c7bf1ac19787dcd317a2f1398e7b58b033fc89eb7`

Native selection, About text/icon and scheme-picker identity/icon passed. Finder
document frames passed normal (~414 px), wide (~506 px), narrow (~230 px),
active/inactive, close/zoom/collapse pressed, collapse and restore checks.
Narrow titles truncate cleanly. Chamfered corners expose the underlying window
or desktop; layered rails, maker mark, matte texture and muted inactive treatment
remain intact. The compact shareware utility's close pressed state also passed.

The picker default Open/Select button retains its square face and label inside
a complete dashed brass ring, including while pressed. Short Cancel and disabled
Eject faces remain intact. The control panel, File menu and desktop cursor are
legible. No native failure was observed.

Captures use descriptive filenames: `document-*.png` cover frame states;
`about.png`, `control-panel.png`, `scheme-picker.png`,
`picker-default-pressed.png`, `utility-close-pressed.png`, `menu-file.png` and
`cursor-desktop.png` cover the other checks.

Sounds were not audibly tested. No progress or slider control was exercised.
The shareware utility has no caption, so utility title rendering was not tested.
This uses an existing maintainer environment, not a clean-machine restore.

Fresh immutable-seed copies were used; helper apps were quit before selection.
The exact frozen MacBinary was staged with `hcopy -m` while stopped, and HFS was
unmounted before boot. After stopping the owned browser/server, the stopped
export matched all 189,449 frozen resource bytes. Both immutable seed hashes
were unchanged, and HFS was left unmounted.

Private raw receipts, frozen packages and stopped exports remain at
`~/Documents/Scriptoscope-maintainer-assets/scriptoscope-reference-chamfer-20261102-_diye3ea/`.
