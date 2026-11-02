# Native compatibility smoke

Tested 2026-11-02 in System 7.5.5 / Kaleidoscope 2.3.1 / Basilisk II,
640×480 at the seed's default 8 bpp, 64 MB RAM, `nosound true`.
Compatibility smoke only; these captures are not admitted fidelity evidence.

| Build | MacBinary SHA-256 | Resource-fork SHA-256 | Native scope |
| --- | --- | --- | --- |
| Final | `4f4b224bda6bbd477acba785df522c787968b49700d626d777ab2c9d6409f15a` | `3afd7266845216f36751828842fac50b09999863e60ef3097fe56d6ddfe56ad9` | Fresh boot: native selection, normal document frame maker mark, About text/icon and scheme picker identity/icon. |
| Earlier | `234b1223544f93675e11b42c018cdc93a6a233cbc0e87127168d14e7fbac6d14` | `e8684360872570b904f0b76f70b071c2fd55e889a9ce58c05cbbd36b5a1fe242` | Broader state checks below, before correcting only the logo's tile geometry. |

Both resource forks contain 341 resources and 145,993 bytes. The final change
corrects the maker mark to the source CSS's rectangular tracks; frame allocation,
controls, cursor and About text are unchanged. The broader state checks were not
repeated on the final hash.

Native selection, About and picker passed. The earlier build passed Finder
document normal (~414 px), wide (~506 px), narrow (~230 px), active/inactive,
close/zoom/collapse pressed, collapse and restore checks; utility close pressed,
File menu and desktop cursor checks also passed. No native failure was observed.
The title still fit at the smallest tested width, so truncation was not exercised.
The shareware utility has no caption; utility title rendering was not tested.
Sounds were not audibly tested, and no progress control was exercised.

`document-normal-final.png`, `about-final.png` and `scheme-picker-final.png`
show the final build. All `earlier-*.png` captures show the earlier build and its
broader checks, including its superseded logo.

Each run used fresh immutable-seed copies, with helper apps quit before scheme
selection. Exact frozen MacBinary files were staged with `hcopy -m` while stopped;
HFS was unmounted before boot. After stopping each owned browser/server, stopped
exports matched every frozen resource byte and both immutable seed hashes were
unchanged. HFS was left unmounted.

Private raw receipts (captures, logs, frozen packages, stopped exports and
`run.json`) remain outside this repository under
`~/Documents/Scriptoscope-maintainer-assets/`:

- `scriptoscope-reference-native-20261102-eewf3pla` — broader earlier run.
- `scriptoscope-reference-final-20261102-wsz3l54h` — focused final run.
