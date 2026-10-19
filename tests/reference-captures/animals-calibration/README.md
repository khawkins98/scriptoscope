# Animals finite display calibration

`measurement.json` retains 418 actual public Color2Index/Index2Color observations
for 209 exact joint RGB16 inputs, their original native log line numbers and
hashes of omitted lines. The complete 70,125-byte ordinary stopped-HFS log remains
private. Engine, ROM, OS and font bytes are not distributed here.

The independently reviewed observations supply
[`measured-display-profile-animals.json`](../../decoder-fixtures/measured-display-profile-animals.json).
Its palette uses actual positional indices; its producer channels repeat the
recorded one-channel 256-byte gamma table under the explicit high-byte policy.
No mappings are inferred or interpolated. Whole-load coverage describes the
current converter's retained input inventory, not independent decoder proof.

Calibration conditions bracket the mapping batch after a normal draw. Separate
three-state observations bracket Draw1Control/HiliteControl and retain their
fixed order, fresh controls and shared boot. Matching recorded device, palette,
gamma and producer fields allow this finite comparison; they do not establish
private provider/cache identity, pattern origin or order independence. The
calibration lacks `widMax`, which the state logs report as 14. Worker poweroff
acknowledgment remains unknown; browser/server closure and ordinary export are
recorded separately.

These data remain a `QUARANTINED_PARTIAL` compatibility-profile input. Original
capture eligibility and actual source/built pixel equality are separate checks;
the calibration review alone establishes neither.
