import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { importSource, inventory, setPalette, setGeometry } from "./project.ts";
import { readFile } from "node:fs/promises";

// Use the app's actual TS/bundler resolution for the shared engine table.
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
});
const { componentsFor, editedVariant, resetArtwork } =
  await server.ssrLoadModule(
    new URL("./components.ts", import.meta.url).pathname,
  );
await server.close();
const source = new Uint8Array(
  await readFile(new URL("../../themes/1138/scheme.rsrc", import.meta.url)),
);
const project = await importSource(source, "1138.rsrc");
const records = inventory(project);
const face = records.find((r) => r.type === "cicn" && r.id === -10239);
const geometry = records.find((r) => r.type === "cinf" && r.id === face.id);
const entry = (resourceIndex, asset = "face.png") => ({
  asset,
  sourceCicnId: -10239,
  cicnSource: { id: -10239, resourceIndex },
});

test("semantic mapping follows decoder occurrence, including duplicate IDs", () => {
  const duplicate = {
    ...face,
    occurrence: records.length,
    name: "Unrelated author label",
  };
  const resources = [...records, duplicate];
  const theme = {
    manifest: { chromeElements: { normal: entry(duplicate.occurrence) } },
  };
  const result = componentsFor(theme, resources, { active: "face.png" });
  assert.equal(result[1].variants[0].occurrence, duplicate.occurrence);
  assert.equal(result[0].variants[0].occurrence, duplicate.occurrence);
  assert.equal(result[1].variants[1].occurrence, null);
});

test("missing or inconsistent provenance never guesses raw IDs, labels or absent assets", () => {
  for (const element of [
    { asset: "face.png", sourceCicnId: -10239 },
    entry(records.findIndex((r) => r.type !== "cicn")),
    {
      ...entry(face.occurrence),
      cicnSource: { id: 123, resourceIndex: face.occurrence },
    },
    { cicnSource: { id: face.id, resourceIndex: face.occurrence } },
  ]) {
    const result = componentsFor(
      { manifest: { chromeElements: { normal: element } } },
      records,
    );
    assert.equal(result[1].variants[0].occurrence, null);
    assert.ok(result[1].variants[0].unavailable);
    assert.equal(result[0].variants[0].occurrence, null);
  }
});

test("artwork reset removes only selected palette and unique geometry edits", () => {
  const other = records.find((r) => r.type === "cicn" && r.id === -10238);
  let changed = setPalette(project, face.occurrence, 1, [1, 2, 3]);
  changed = setPalette(changed, other.occurrence, 1, [4, 5, 6]);
  changed = setGeometry(changed, geometry.occurrence, [3, 4]);
  const variant = { occurrence: face.occurrence };
  assert.equal(editedVariant(changed, variant, records), true);
  const reset = resetArtwork(changed, face.occurrence, geometry.occurrence);
  assert.equal(reset.source, project.source);
  assert.deepEqual(
    reset.edits,
    changed.edits.filter((e) => e.occurrence === other.occurrence),
  );
  assert.equal(editedVariant(reset, variant, records), false);
  assert.equal(changed.edits.length, 3);
  // Ambiguous matching geometry does not count as an admitted override.
  const geometryOnly = setGeometry(project, geometry.occurrence, [3, 4]);
  assert.equal(
    editedVariant(geometryOnly, variant, [
      ...records,
      { ...geometry, occurrence: records.length },
    ]),
    false,
  );
});

test("pixel picking uses admitted source indices, rejects ambiguous records and masked pixels", async () => {
  const { recordAtPixel } = await import("./source-picking.ts");
  const image = {
    pmap: { width: 3, height: 2 },
    mask: { width: 2, height: 2 },
    indices: new Uint8Array([7, 3, 9, 3, 7, 0]),
    maskAlpha: new Uint8Array([255, 0, 255, 255]),
    colorTable: {
      flags: 0,
      entries: [{ value: 3 }, { value: 7 }, { value: 9 }],
    },
  };
  assert.deepEqual(recordAtPixel(image, 0, 0), { index: 7, record: 1 });
  assert.match(recordAtPixel(image, 1, 0).reason, /Transparent/);
  // Outside mask bounds follows the decoder's opaque-outside compatibility policy.
  assert.deepEqual(recordAtPixel(image, 2, 0), { index: 9, record: 2 });
  assert.match(recordAtPixel(image, 2, 1).reason, /no matching/);
  for (const [x, y] of [
    [-1, 0],
    [3, 0],
    [0, 2],
    [0.5, 0],
  ])
    assert.match(recordAtPixel(image, x, y).reason, /inside/);
  const duplicate = {
    ...image,
    colorTable: { flags: 0, entries: [{ value: 7 }, { value: 7 }] },
  };
  assert.match(recordAtPixel(duplicate, 0, 0).reason, /duplicate/);
  const positional = {
    ...image,
    indices: new Uint8Array([1, 0, 2, 0, 1, 0]),
    colorTable: {
      flags: 0x8000,
      entries: [{ value: 7 }, { value: 7 }, { value: 7 }],
    },
  };
  assert.deepEqual(recordAtPixel(positional, 0, 0), { index: 1, record: 1 });
  assert.deepEqual(recordAtPixel(positional, 2, 0), { index: 2, record: 2 });
});
