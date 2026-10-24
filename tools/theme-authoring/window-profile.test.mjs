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
const { getWindowProfile, applyWindowColor, resetWindowColor } =
  await server.ssrLoadModule(
    new URL("./window-profile.ts", import.meta.url).pathname,
  );
await server.close();
const base = await importSource(
  new Uint8Array(
    await readFile(new URL("../../themes/1138/scheme.rsrc", import.meta.url)),
  ),
  "1138.rsrc",
);
const theme = { manifest: convertChrome(decodeBytes(base.source.fork)).theme };
const profile = getWindowProfile(base, theme);

test("document title roles bind both actual renderer-selected source templates", () => {
  assert.equal(profile.bindings.length, 6, JSON.stringify(profile.unavailable));
  for (const state of ["active", "inactive"]) {
    const bindings = profile.bindings.filter((b) => b.state === state);
    assert.equal(bindings.length, 3);
    assert.ok(
      bindings.every(
        (b) => b.sourceId === (state === "active" ? -14335 : -14336),
      ),
    );
  }
  assert.deepEqual(
    profile.bindings.find((b) => b.state === "inactive" && b.role === "text")
      .coupledRoles,
    ["shadow"],
  );
});

test("window edits patch only admitted RGB16 bytes, preserve source and reopen exactly", async () => {
  const changed = applyWindowColor(
    base,
    profile,
    "background",
    ["active", "inactive"],
    [43210, 23456, 12345],
  );
  assert.equal(changed.edits.length, 2);
  const allowed = new Set();
  const resources = inventory(base);
  for (const edit of changed.edits) {
    const resource = resources[edit.occurrence];
    const start =
      resource.data.byteOffset +
      paletteFor(resource).offset +
      edit.record * 8 +
      2;
    for (let i = 0; i < 6; i++) allowed.add(start + i);
  }
  const before = workingFork(base),
    after = workingFork(changed);
  for (let i = 0; i < before.length; i++)
    if (before[i] !== after[i]) assert.ok(allowed.has(i));
  assert.equal(changed.source, base.source);
  assert.deepEqual(
    workingFork(await openProject(serializeProject(changed))),
    after,
  );
  const reset = resetWindowColor(
    changed,
    getWindowProfile(changed, theme),
    "background",
    ["active"],
  );
  assert.equal(reset.edits.length, 1);
  assert.equal(reset.edits[0].id, -14336);
});

test("shared title and shadow roles stay coupled, inactive edits leave active alone", () => {
  const changed = applyWindowColor(
    base,
    profile,
    "text",
    ["inactive"],
    [123, 456, 789],
  );
  const next = getWindowProfile(changed, theme);
  assert.deepEqual(
    next.bindings.find((b) => b.state === "inactive" && b.role === "shadow")
      .current,
    [123, 456, 789],
  );
  assert.deepEqual(
    next.bindings.find((b) => b.state === "active" && b.role === "text")
      .current,
    [0, 0, 0],
  );
});

test("rebuilding through the public loader updates the renderer's actual title samples", () => {
  const changed = applyWindowColor(
    base,
    profile,
    "text",
    ["active"],
    [43210, 12345, 23456],
  );
  const rebuilt = convertChrome(workingFork(changed)).theme.windowTypes[
    "document-window"
  ];
  assert.deepEqual(
    rebuilt.titleSamples.active.text.rgb16,
    [43210, 12345, 23456],
  );
  assert.deepEqual(
    rebuilt.titleSamples.inactive,
    theme.manifest.windowTypes["document-window"].titleSamples.inactive,
  );
});

test("ambiguous assets and mismatched original samples never become editable", () => {
  const duplicate = structuredClone(theme);
  const element = Object.values(duplicate.manifest.chromeElements).find(
    (e) =>
      e.asset ===
      duplicate.manifest.windowTypes["document-window"].chrome.active,
  );
  duplicate.manifest.chromeElements.extra = structuredClone(element);
  assert.equal(
    getWindowProfile(base, duplicate).bindings.filter(
      (b) => b.state === "active",
    ).length,
    0,
  );
  const mismatch = structuredClone(theme);
  mismatch.manifest.windowTypes[
    "document-window"
  ].titleSamples.active.text.rgb16 = [1, 2, 3];
  assert.ok(
    !getWindowProfile(base, mismatch).bindings.some(
      (b) => b.state === "active" && b.role === "text",
    ),
  );
});

test("unavailable states and stale profiles reject the complete operation", () => {
  const missing = {
    ...profile,
    bindings: profile.bindings.filter((b) => b.state !== "inactive"),
  };
  assert.throws(
    () =>
      applyWindowColor(
        base,
        missing,
        "text",
        ["active", "inactive"],
        [1, 2, 3],
      ),
    /verified/,
  );
  assert.equal(base.edits.length, 0);
  assert.throws(
    () =>
      applyWindowColor(
        base,
        { ...profile, forkSha256: "wrong" },
        "text",
        ["active"],
        [1, 2, 3],
      ),
    /different source/,
  );
  assert.throws(
    () => applyWindowColor(base, profile, "text", ["active"], [1.5, 2, 3]),
    /RGB16/,
  );
});

test("renderer state fallback remains a shared source binding rather than an invented independent state", () => {
  const fallback = structuredClone(theme);
  delete fallback.manifest.windowTypes["document-window"].chrome.inactive;
  const mapped = getWindowProfile(base, fallback);
  const active = mapped.bindings.find(
    (b) => b.state === "active" && b.role === "background",
  );
  const inactive = mapped.bindings.find(
    (b) => b.state === "inactive" && b.role === "background",
  );
  assert.equal(active.occurrence, inactive.occurrence);
  assert.equal(active.record, inactive.record);
  const changed = applyWindowColor(
    base,
    mapped,
    "background",
    ["inactive"],
    [123, 456, 789],
  );
  assert.equal(changed.edits.length, 1);
  assert.deepEqual(
    getWindowProfile(changed, fallback).bindings.find(
      (b) => b.state === "active" && b.role === "background",
    ).current,
    [123, 456, 789],
  );
});
