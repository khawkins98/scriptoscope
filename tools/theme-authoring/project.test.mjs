import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseResourceFork } from "../theme-loader/resource-fork.js";
import { decodeCicn } from "../theme-loader/decoders/cicn.js";
import {
  decodeBytes,
  encodeBytes,
  importSource,
  inventory,
  openProject,
  paletteFor,
  serializeProject,
  setGeometry,
  setPalette,
  sha256,
  workingFork,
} from "./project.ts";

const source = new Uint8Array(
  await readFile(new URL("../../themes/1138/scheme.rsrc", import.meta.url)),
);
const base = await importSource(source, "1138.rsrc", {
  name: "1138",
  origin: { originalLicense: "preserved verbatim" },
});
const records = inventory(base);
const face = records.find((r) => r.type === "cicn" && r.id === -10239);

test("source-backed save/reopen preserves original bytes, metadata and all records", async () => {
  const saved = serializeProject(base);
  const reopened = await openProject(saved);
  assert.equal(serializeProject(reopened), saved);
  assert.deepEqual(decodeBytes(reopened.source.original), source);
  assert.deepEqual(workingFork(reopened), source);
  assert.equal(inventory(reopened).length, records.length);
  assert.deepEqual(reopened.source.meta, base.source.meta);
});

test("palette edit changes only six admitted bytes and survives a fresh reopen", async () => {
  const palette = paletteFor(face);
  const next = [12345, 23456, 34567];
  const edited = setPalette(base, face.occurrence, 1, next);
  const effective = workingFork(edited);
  const reopened = await openProject(serializeProject(edited));
  assert.deepEqual(workingFork(reopened), effective);
  assert.deepEqual(decodeBytes(edited.source.original), source);
  assert.equal(edited.source.originalSha256, await sha256(source));
  const offset = face.data.byteOffset + palette.offset + 8 + 2;
  const expected = new Uint8Array(source);
  const view = new DataView(expected.buffer);
  next.forEach((n, i) => view.setUint16(offset + i * 2, n, false));
  assert.deepEqual(effective, expected);
  const changed = parseResourceFork(effective);
  for (const [i, resource] of records.entries()) {
    if (i !== face.occurrence) assert.deepEqual(changed[i].data, resource.data);
  }
  const before = decodeCicn(face.data),
    after = decodeCicn(changed[face.occurrence].data);
  assert.notDeepEqual(before.rgba, after.rgba);
  assert.deepEqual(
    before.rgba.filter((_, i) => i % 4 === 3),
    after.rgba.filter((_, i) => i % 4 === 3),
  );
  assert.equal(
    setPalette(edited, face.occurrence, 1, palette.entries[1].rgb).edits.length,
    0,
  );
});

test("geometry edit preserves every byte except the two admitted cinf fields", () => {
  const geometry = records.find((r) => r.type === "cinf" && r.id === face.id);
  assert.ok(geometry);
  const edited = setGeometry(base, geometry.occurrence, [3, 2]);
  const expected = new Uint8Array(source);
  expected.set([3, 2], geometry.data.byteOffset);
  assert.deepEqual(workingFork(edited), expected);
  assert.deepEqual(workingFork(base), source);
});

test("StuffIt projects retain the full archive and verified selected fork", async () => {
  const archive = new Uint8Array(
    await readFile(new URL("../../themes/animals/scheme.sit", import.meta.url)),
  );
  const imported = await importSource(archive, "animals.sit");
  const reopened = await openProject(serializeProject(imported));
  assert.deepEqual(decodeBytes(reopened.source.original), archive);
  assert.equal(reopened.source.container, "stuffit");
  assert.equal(
    reopened.source.selection.policy,
    "largest-non-icon-resource-fork",
  );
  assert.ok(inventory(reopened).some((r) => r.type === "wnd#"));
});

test("duplicate type/ID resources keep occurrence identity during editing", async () => {
  // Make a synthetic duplicate ID in the public input's map; payloads stay distinct.
  const bytes = new Uint8Array(source);
  const view = new DataView(bytes.buffer);
  const map = view.getUint32(4, false);
  const types = map + view.getUint16(map + 24, false);
  let refs;
  for (let i = 0; i <= view.getUint16(types, false); i++) {
    const at = types + 2 + i * 8;
    if (String.fromCharCode(...bytes.subarray(at, at + 4)) === "cicn") {
      refs = types + view.getUint16(at + 6, false);
      break;
    }
  }
  assert.ok(refs);
  const id = view.getInt16(refs, false);
  view.setInt16(refs + 12, id, false);
  const project = await importSource(bytes, "duplicate.rsrc");
  const duplicates = inventory(project).filter(
    (r) => r.type === "cicn" && r.id === id,
  );
  assert.equal(duplicates.length, 2);
  const edited = setPalette(
    project,
    duplicates[1].occurrence,
    0,
    [12345, 456, 789],
  );
  const reopened = await openProject(serializeProject(edited));
  const output = parseResourceFork(workingFork(reopened));
  assert.deepEqual(output[duplicates[0].occurrence].data, duplicates[0].data);
  assert.notDeepEqual(
    output[duplicates[1].occurrence].data,
    duplicates[1].data,
  );
  assert.deepEqual(decodeBytes(reopened.source.original), bytes);
});

test("selection metadata is semantic, not dependent on JSON property order", async () => {
  const value = JSON.parse(serializeProject(base));
  value.source.selection = Object.fromEntries(
    Object.entries(value.source.selection).reverse(),
  );
  const reopened = await openProject(JSON.stringify(value));
  assert.deepEqual(workingFork(reopened), source);
});

test("reopen rejects tampered bytes, unrelated forks, unsupported profiles and invalid edits", async () => {
  const clone = () => JSON.parse(serializeProject(base));
  let p = clone();
  p.source.originalSha256 = "bad";
  await assert.rejects(openProject(JSON.stringify(p)), /hash mismatch/);
  p = clone();
  p.requiredProfiles = ["future-required-profile"];
  await assert.rejects(openProject(JSON.stringify(p)), /Unsupported project/);
  p = clone();
  p.edits = [{ kind: "raw-byte-patch", occurrence: 0 }];
  await assert.rejects(openProject(JSON.stringify(p)), /Unsupported edit/);
  const valid = setPalette(base, face.occurrence, 0, [123, 456, 789]);
  p = JSON.parse(serializeProject(valid));
  p.edits.push(p.edits[0]);
  await assert.rejects(openProject(JSON.stringify(p)), /Duplicate edit/);
  p = JSON.parse(serializeProject(valid));
  p.edits[0].id = 123;
  await assert.rejects(openProject(JSON.stringify(p)), /identity/);
  p = JSON.parse(serializeProject(valid));
  p.edits[0].before = [1, 2, 3];
  await assert.rejects(openProject(JSON.stringify(p)), /stale source/);
  for (const after of [
    [-1, 0, 0],
    [65536, 0, 0],
    [1.5, 0, 0],
    [0, 0],
  ]) {
    p = JSON.parse(serializeProject(valid));
    p.edits[0].after = after;
    await assert.rejects(openProject(JSON.stringify(p)), /RGB16/);
  }
  p = clone();
  const changed = workingFork(valid);
  p.source.fork = encodeBytes(changed);
  p.source.forkSha256 = await sha256(changed);
  await assert.rejects(
    openProject(JSON.stringify(p)),
    /does not match the original/,
  );
});
