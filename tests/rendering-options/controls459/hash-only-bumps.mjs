// PR #540 is merged after upstream 608 (1.0.18) and 611 (1.0.19).
// Undo this newest hash-only note update first, then the unchanged 611/608
// helpers recover their exact historical receipts. Both document prose and
// the complete prior inventory are pinned; unrelated changes cannot peel.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const HASH_ONLY_BUMPS = [
  {
    "version": "1.0.20",
    "priorVersion": "1.0.19",
    "document": "docs/spec/kdef231-reference.md",
    "from": "bf390065139b311c00bd71b9f8c642798753cba14711ed6a52bca774f733441a",
    "to": "9c73533af785f4dec4c3c91b7ceb77f925156cc2e9990061bdaf31238d1efe91",
    "pins": 9,
    "priorFileSha256": "69165a16a8f7c5f82d5232efaa3a431fa163d07ac1dd304d91cba7a847e22493",
    "edit": {
      "before": "> resource is scheme metadata). **Scriptoscope shipped decision:** the exact marker\n> coordinate isn't reliably pinnable (the `0x6582(0)` body-rect corners don't\n> yield it; the decompile is truncated through `0x6582`/`0xfc5c`), AND every\n> corpus scheme draws the classic-Mac default anyway, so `renderWindow.ts` uses\n> black (grey when inactive) rather than sampling. The marker path is the\n> OVERRIDE for a colour-customising scheme; reopen with one as a test case. Full\n> write-up: `docs/tracking/title-text-color.md`.\n",
      "after": "> resource is scheme metadata). **Scriptoscope implements the sample (updated\n> 2026-10-31):** the text colour is the template pixel at the content rect's\n> top-left `(part0.left, part0.top)` and the shadow colour its right neighbour\n> (the popup family samples `(part0.left, part0.bottom − 1)` instead), read\n> through the palette with the mask ignored (`docs/spec/engine/window-widgets.md`\n> TC1–TC5, `windowTitleSamples` in `tools/theme-loader/buildThemeJson.js`). The\n> first-party authored schemes (`authoring/schemes/`) were the\n> colour-customising test cases. (This replaces an earlier \"use black\"\n> decision, made when the marker coordinate was not yet pinned.) Full\n> write-up: `docs/tracking/title-text-color.md`.\n"
    }
  }
];

const sha256 = s => createHash('sha256').update(s).digest('hex');

export function peelHashOnlyBumps(live) {
  let current = live;
  for (const bump of [...HASH_ONLY_BUMPS].reverse()) {
    if (current.inventoryVersion !== bump.version) continue;
    const prior = current.review.previousReview;
    assert.equal(current.review.inventoryVersion, bump.version);
    assert.equal(prior.inventoryVersion, bump.priorVersion, `${bump.version} archives the ${bump.priorVersion} review`);
    let swapped = 0;
    const cases = JSON.parse(JSON.stringify(current.cases), function (key, value) {
      if (key === 'documentSha256' && this.document === bump.document) {
        assert.equal(value, bump.to, `every ${bump.document} pin moved to the bumped hash`);
        swapped++;
        return bump.from;
      }
      return value;
    });
    assert.equal(swapped, bump.pins, `${bump.version} changes exactly the recorded document pins`);
    assert.equal(sha256(JSON.stringify(cases)), prior.inventorySha256, `${bump.version} is hash-only: peeled cases recover ${bump.priorVersion}`);
    current = { ...current, inventoryVersion: prior.inventoryVersion, inventorySha256: prior.inventorySha256, review: prior, cases };
    assert.equal(sha256(JSON.stringify(current, null, 2) + "\n"), bump.priorFileSha256, `${bump.version} restores the complete prior inventory byte for byte`);
  }
  return current;
}

/** Restore the exact source document seen by the earlier frozen proof. */
export function peelHashOnlyDocument(document, text) {
  let current = text;
  for (const bump of [...HASH_ONLY_BUMPS].reverse()) {
    if (bump.document !== document) continue;
    assert.equal(sha256(current), bump.to, `${bump.version} requires the exact current document`);
    assert.equal(current.split(bump.edit.after).length, 2, "the archived prose edit occurs exactly once");
    current = current.replace(bump.edit.after, () => bump.edit.before);
    assert.equal(sha256(current), bump.from, `${bump.version} restores the complete prior document byte for byte`);
  }
  return current;
}
