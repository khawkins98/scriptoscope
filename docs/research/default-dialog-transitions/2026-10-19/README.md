# System7 default-item transitions: partial observations

**QUARANTINED_PARTIAL.** Two automated-agent experiments on separate copied
System7.5.5/Kaleidoscope2.3.1 media observed public default-item changes. This is
factual research preservation, not an accepted reference or renderer assessment.
The [summary](summary.json) binds included and external artifacts explicitly;
original executables, engine/OS/ROM/font bytes and private paths are not included.

Both fixtures used `NewColorDialog(procID:0)` with two empty 80×20 DITL buttons,
`GetStdFilterProc`, and actual standard-filter event processing. The 160×80 port,
active dialog, item rectangles, actual variants/hilites, full effective clip,
white background, configured scheme, palette and gamma were recorded. Eight
before/after condition payloads were equal in each capture. Complete raw producer
planes equalled the 640×480 PNGs; port images were integer-coordinate crops.

| Run | Public sequence | Settled output |
| --- | --- | --- |
| v11 | Setter, `EraseRect`/`DrawDialog`, then standard-filter events; actual default 1→2→1 | Three selected complete port planes identical |
| v11b | Initial `DrawDialog` only; setters 1→2→1→2, with no post-setter erase/redraw | Three selected complete port planes identical |

Every setter returned noErr; every selected capture had positive post-setter
standard-filter calls. In v11, sequence2 records the genuine 1→2 transition;
input delivery also caused duplicate 2→2 sequence3, whose frame was selected.
Both native logs are retained and separately hashed. v11b has three genuine
switches, with 90/60/84 settled calls and no duplicate capture.

The following is the exact v11b default-item1 port (sequence2). All six selected
ports have the same decoded RGBA hash. There are **zero changed pixels** between
selected default-item states; no additional surrounding border is visible here.

![Exact 160×80 System7 dialog port with two empty buttons](representative-port.png)

This does not identify an internal PACH/kDEF painter or establish a Scriptoscope
bug. The explicit erase in v11 could remove setter-painted output; v11b removes
that operation but still does not explain the different border recorded by the
[earlier v6 experiment](../../default-dialog-observations/2026-10-18/README.md).
Those v6 observations remain unchanged and unresolved. Return/Enter was not
additionally tested in v11/v11b. Font, private selected-provider/cache order and
complete transfer semantics remain unknown; opaque output does not prove masks.

Astra's independent AI review checked these new facts and crop/producer joins;
its external receipt hash is retained, without implying human attestation. The
private disks and complete evidence remain external. Original inputs and prior
records were preserved; owned browser/server stopped and HFS unmounted. Clean
guest shutdown acknowledgment remains unknown. No new intake, ledger, golden or
compatibility-authority record follows from this note.

A separate [published modern comparison](modern-comparison.json) used the explicit
measured profile and public module at commit `6356ab35`. Requesting a direct
control-painter ring on either item changed 628 pixels relative to these original
ports: 624 outside the faces and four face-corner pixels, only around the selected
item. The module hash was checked before/after execution. This compares different
caller contracts, not a proven rendering bug. Its similarity to the earlier v6
624+4 count does not explain v6 or attribute either original painter.
