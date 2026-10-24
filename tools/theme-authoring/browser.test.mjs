import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { decodeBytes, openProject, sha256 } from "./project.ts";

test(
  "real browser edit → undo/redo → download → fresh-session reopen",
  { timeout: 120_000 },
  async () => {
    const root = resolve(import.meta.dirname, "../..");
    const server = spawn(
      process.execPath,
      [
        resolve(root, "node_modules/vite/bin/vite.js"),
        "--config",
        resolve(import.meta.dirname, "vite.config.ts"),
        "--host",
        "127.0.0.1",
        "--port",
        "5184",
        "--strictPort",
      ],
      { cwd: import.meta.dirname, stdio: "pipe" },
    );
    let log = "";
    server.stdout.on("data", (data) => {
      log += data;
    });
    server.stderr.on("data", (data) => {
      log += data;
    });
    const url = "http://127.0.0.1:5184/";
    let browser;
    const dir = await mkdtemp(
      resolve(tmpdir(), "scriptoscope-authoring-browser-"),
    );
    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (server.exitCode !== null) throw new Error(log);
        try {
          if ((await fetch(url)).ok) break;
        } catch {
          /* server is starting */
        }
        await new Promise((done) => setTimeout(done, 100));
        if (attempt === 99) throw new Error(`Server did not start: ${log}`);
      }
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1080 },
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("dialog", (dialog) => dialog.accept());
      await page.goto(url);
      await page.waitForFunction(
        () => document.querySelectorAll(".specimen-row canvas").length === 3,
      );
      const pixelSnapshot = () =>
        page
          .locator(".specimen-row canvas")
          .first()
          .evaluate((el) => el.toDataURL());
      const original = await pixelSnapshot();
      await page
        .getByRole("button", { name: "Palette record 1", exact: true })
        .click();
      const red = page.getByRole("spinbutton", { name: "Red (RGB16)" });
      const originalRed = await red.inputValue();
      await red.fill("45000");
      await page.waitForFunction((before) => {
        const canvases = document.querySelectorAll(".specimen-row canvas");
        return canvases.length === 3 && canvases[0].toDataURL() !== before;
      }, original);
      const edited = await pixelSnapshot();
      await page
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      await page.waitForFunction(
        (before) =>
          document.querySelector(".specimen-row canvas")?.toDataURL() ===
          before,
        original,
      );
      assert.equal(await red.inputValue(), originalRed);
      await page
        .getByRole("button", { name: "Redo edit", exact: true })
        .click();
      await page.waitForFunction(
        (before) =>
          document.querySelector(".specimen-row canvas")?.toDataURL() ===
          before,
        edited,
      );

      await page
        .getByRole("spinbutton", { name: "Corner size", exact: true })
        .fill("3");
      await page.waitForFunction((before) => {
        const canvases = document.querySelectorAll(".specimen-row canvas");
        return canvases.length === 3 && canvases[0].toDataURL() !== before;
      }, edited);
      await page
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      await page.waitForFunction(
        (before) =>
          document.querySelector(".specimen-row canvas")?.toDataURL() ===
          before,
        edited,
      );

      const downloaded = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Save project", exact: false })
        .click();
      const projectDownload = await downloaded;
      const path = resolve(dir, "saved-project.json");
      await projectDownload.saveAs(path);
      const saved = await openProject(await readFile(path, "utf8"));
      assert.equal(saved.edits.length, 1);
      assert.equal(saved.edits[0].after[0], 45000);
      const rawSource = new Uint8Array(
        await readFile(resolve(root, "themes/1138/scheme.rsrc")),
      );
      assert.equal(saved.source.originalSha256, await sha256(rawSource));

      const recovery = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Recover original", exact: false })
        .click();
      const recovered = await recovery;
      assert.deepEqual(
        new Uint8Array(await readFile(await recovered.path())),
        rawSource,
      );

      const context = await browser.newContext();
      const reopened = await context.newPage();
      reopened.on("pageerror", (error) => errors.push(error.message));
      await reopened.goto(url);
      await reopened.waitForFunction(
        () => document.querySelectorAll(".specimen-row canvas").length === 3,
      );
      await reopened
        .getByLabel("Open project file", { exact: true })
        .setInputFiles(path);
      await reopened
        .getByRole("status")
        .filter({ hasText: "Project reopened" })
        .waitFor();
      await reopened.waitForFunction(
        (before) =>
          document.querySelector(".specimen-row canvas")?.toDataURL() ===
          before,
        edited,
      );
      await reopened
        .getByRole("button", { name: "Palette record 1", exact: true })
        .click();
      assert.equal(
        await reopened
          .getByRole("spinbutton", { name: "Red (RGB16)" })
          .inputValue(),
        "45000",
      );
      await reopened
        .getByLabel("Open project file", { exact: true })
        .setInputFiles({
          name: "invalid.json",
          mimeType: "application/json",
          buffer: Buffer.from('{"format":"unsupported"}'),
        });
      await reopened
        .getByRole("alert")
        .filter({ hasText: "Unsupported project" })
        .waitFor();
      assert.equal(
        await reopened
          .locator(".specimen-row canvas")
          .first()
          .evaluate((el) => el.toDataURL()),
        edited,
      );

      await page.getByLabel("Start with a scheme").selectOption("1");
      await page.waitForFunction(
        () =>
          document.querySelector("h1")?.textContent?.includes("Animals") &&
          document.querySelectorAll(".specimen-row canvas").length === 3,
      );
      assert.equal(
        await page
          .getByRole("spinbutton", { name: "Corner size", exact: true })
          .inputValue(),
        "2",
      );
      await page
        .getByRole("button", { name: "Pressed -10238", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("spinbutton", { name: "Corner size", exact: true })
          .inputValue(),
        "6",
      );
      assert.equal(
        await page
          .getByRole("spinbutton", { name: "Side thickness", exact: true })
          .inputValue(),
        "4",
      );
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      assert.equal(decodeBytes(saved.source.original).length, rawSource.length);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      server.kill("SIGTERM");
      await rm(dir, { recursive: true, force: true });
    }
  },
);
