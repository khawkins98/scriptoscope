import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { convertChrome } from "../theme-loader/convert.js";
import {
  importSource,
  inventory,
  workingFork,
  decodeBytes,
  serializeProject,
  openProject,
  paletteFor,
} from "./project.ts";
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true },
});
const {
  getAuthoringProfile,
  applyRoleColor,
  resetRoleColor,
  applyAmberVariation,
} = await server.ssrLoadModule(
  new URL("./profile.ts", import.meta.url).pathname,
);
await server.close();
const base = await importSource(
  new Uint8Array(
    await readFile(new URL("../../themes/1138/scheme.rsrc", import.meta.url)),
  ),
  "1138.rsrc",
);
const theme = { manifest: convertChrome(decodeBytes(base.source.fork)).theme };
const profile = getAuthoringProfile(base, theme);

test("real renderer sample declarations bind named roles across different state palettes", () => {
  for (const state of ["normal", "pressed", "disabled"]) {
    for (const role of ["face", "text"])
      assert.ok(
        profile.bindings.find((b) => b.state === state && b.role === role),
        `${state} ${role}: ${JSON.stringify(profile.unavailable)}`,
      );
  }
  assert.equal(
    paletteFor(
      inventory(base)[
        profile.bindings.find((b) => b.state === "normal").occurrence
      ],
    ).entries.length,
    7,
  );
  assert.equal(
    paletteFor(
      inventory(base)[
        profile.bindings.find((b) => b.state === "pressed").occurrence
      ],
    ).entries.length,
    8,
  );
});

test("multi-state recipe is source-only, preserves untouched bytes, and reopens exactly", async () => {
  const changed = applyAmberVariation(base, profile, [
    "normal",
    "pressed",
    "disabled",
  ]);
  assert.equal(base.edits.length, 0);
  assert.equal(changed.source, base.source);
  const reopened = await openProject(serializeProject(changed));
  assert.deepEqual(workingFork(reopened), workingFork(changed));
  const allowed = new Set();
  const original = inventory(base);
  for (const edit of changed.edits) {
    assert.equal(edit.kind, "palette");
    const source = original[edit.occurrence];
    const offset =
      source.data.byteOffset + paletteFor(source).offset + edit.record * 8 + 2;
    for (let byte = 0; byte < 6; byte++) allowed.add(offset + byte);
  }
  const before = workingFork(base),
    after = workingFork(changed);
  for (let byte = 0; byte < before.length; byte++)
    if (before[byte] !== after[byte])
      assert.ok(allowed.has(byte), `Unexpected byte ${byte}`);
  assert.deepEqual(
    decodeBytes(changed.source.original),
    decodeBytes(base.source.original),
  );
});

test("role reset restores independent state originals and retains unrelated role changes", () => {
  const changed = applyAmberVariation(base, profile, [
    "normal",
    "pressed",
    "disabled",
  ]);
  const updated = getAuthoringProfile(changed, theme);
  const reset = resetRoleColor(changed, updated, "face", [
    "normal",
    "pressed",
    "disabled",
  ]);
  const current = getAuthoringProfile(reset, theme);
  for (const b of current.bindings.filter((b) => b.role === "face"))
    assert.deepEqual(b.current, b.original);
  assert.ok(
    reset.edits.some(
      (e) =>
        e.record ===
        profile.bindings.find(
          (b) => b.state === "disabled" && b.role === "text",
        ).record,
    ),
  );
  assert.deepEqual(
    current.bindings.find((b) => b.state === "disabled" && b.role === "text")
      .current,
    [10023, 8224, 5911],
  );
});

test("missing declarations and mismatched samples remain unavailable; apply never silently skips a state", () => {
  const unknown = getAuthoringProfile(base, null);
  assert.equal(unknown.bindings.length, 0);
  assert.throws(
    () => applyAmberVariation(base, unknown, ["normal", "pressed", "disabled"]),
    /not safely editable/,
  );
  const altered = structuredClone(theme);
  for (const e of Object.values(altered.manifest.chromeElements))
    if (e.sourceCicnId === -10239) e.textAnchor = [32000, 32000];
  const invalid = getAuthoringProfile(base, altered);
  assert.equal(
    invalid.bindings.find((b) => b.state === "normal" && b.role === "text"),
    undefined,
  );
  assert.throws(
    () =>
      applyRoleColor(base, invalid, "text", ["pressed", "normal"], [1, 2, 3]),
    /not safely editable/,
  );
  assert.equal(base.edits.length, 0);
});

test("stale sources and conflicting linked assignments reject atomically", () => {
  assert.throws(
    () =>
      applyRoleColor(
        base,
        { ...profile, forkSha256: "other" },
        "face",
        ["normal"],
        [1, 2, 3],
      ),
    /different source/,
  );
  const normal = profile.bindings.find(
    (b) => b.state === "normal" && b.role === "face",
  );
  const coupled = {
    ...profile,
    bindings: profile.bindings.map((b) =>
      b.state === "normal" && b.role === "text"
        ? { ...normal, role: "text" }
        : b,
    ),
  };
  assert.throws(
    () => applyAmberVariation(base, coupled, ["normal"]),
    /Linked source roles/,
  );
  assert.equal(base.edits.length, 0);
});

test("declared color sampling ignores masks while ambiguous palette bindings remain unsupported", async () => {
  const raw = workingFork(base);
  const faceBinding = profile.bindings.find(
    (b) => b.state === "normal" && b.role === "face",
  );
  const source = inventory(base)[faceBinding.occurrence];
  const { readCicnIndexed } = await import("../theme-loader/decoders/cicn.js");
  const image = readCicnIndexed(source.data);
  const palette = paletteFor(source);
  raw.fill(
    0,
    source.data.byteOffset + 82,
    source.data.byteOffset + 82 + image.mask.rowBytes * image.mask.height,
  );
  const masked = await importSource(raw, "masked.rsrc");
  const maskedProfile = getAuthoringProfile(masked, {
    manifest: convertChrome(raw).theme,
  });
  assert.ok(
    maskedProfile.bindings.find(
      (b) => b.state === "normal" && b.role === "face",
    ),
  );
  // A duplicate explicit index cannot be promoted to a uniquely editable role.
  const ambiguous = workingFork(base);
  const view = new DataView(ambiguous.buffer);
  const existingIndex = palette.entries[faceBinding.record].value;
  const otherRecord = faceBinding.record === 0 ? 1 : 0;
  view.setUint16(
    source.data.byteOffset + palette.offset + otherRecord * 8,
    existingIndex,
    false,
  );
  const duplicate = await importSource(ambiguous, "duplicate-index.rsrc");
  const duplicateProfile = getAuthoringProfile(duplicate, {
    manifest: convertChrome(ambiguous).theme,
  });
  assert.equal(
    duplicateProfile.bindings.find(
      (b) => b.state === "normal" && b.role === "face",
    ),
    undefined,
  );
  assert.throws(
    () => applyAmberVariation(duplicate, duplicateProfile, ["normal"]),
    /not safely editable/,
  );
});

test("amber recipe keeps label and face separated under the current display policy", async () => {
  const { macRgbToSrgb } = await import("../theme-loader/mac-gamma.js");
  const luminance = (color) =>
    macRgbToSrgb(color.map((n) => n >> 8))
      .map((n) => n / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
      .reduce((value, n, i) => value + n * [0.2126, 0.7152, 0.0722][i], 0);
  const changed = applyAmberVariation(base, profile, [
    "normal",
    "pressed",
    "disabled",
  ]);
  const effective = getAuthoringProfile(changed, theme);
  for (const state of ["normal", "pressed", "disabled"]) {
    const face = luminance(
      effective.bindings.find((b) => b.state === state && b.role === "face")
        .current,
    );
    const text = luminance(
      effective.bindings.find((b) => b.state === state && b.role === "text")
        .current,
    );
    assert.ok(
      (Math.max(face, text) + 0.05) / (Math.min(face, text) + 0.05) >= 4.5,
      state,
    );
  }
  assert.equal(
    applyAmberVariation(changed, effective, ["normal", "pressed", "disabled"]),
    changed,
    "unchanged recipe is a no-op",
  );
});

test("display color authoring has explicit nearest-source quantization and never rewrites untouched roles", async () => {
  const { displayHex, sourceFromDisplayHex } = await import("./colors.ts");
  const { macRgbToSrgb } = await import("../theme-loader/mac-gamma.js");
  const levels = Array.from(
    { length: 256 },
    (_, source) => macRgbToSrgb([source, source, source])[0],
  );
  for (let target = 0; target < 256; target++) {
    const hex = "#" + target.toString(16).padStart(2, "0").repeat(3);
    const source = sourceFromDisplayHex(hex);
    assert.equal(source[0] % 257, 0);
    const actual = parseInt(displayHex(source).slice(1, 3), 16);
    assert.equal(
      Math.abs(actual - target),
      Math.min(...levels.map((n) => Math.abs(n - target))),
    );
  }
  assert.throws(() => sourceFromDisplayHex("red"), /six-digit/);
  const changed = applyRoleColor(
    base,
    profile,
    "face",
    ["normal"],
    sourceFromDisplayHex("#A56B16"),
  );
  const effective = getAuthoringProfile(changed, theme);
  for (const binding of effective.bindings.filter((b) => b.state !== "normal"))
    assert.deepEqual(binding.current, binding.original);
  assert.deepEqual(
    decodeBytes(changed.source.original),
    decodeBytes(base.source.original),
  );
});
