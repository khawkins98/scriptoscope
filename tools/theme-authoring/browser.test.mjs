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
      await page
        .getByText("Precise source color (RGB16)", { exact: true })
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

      // Comparison is source-original, read-only, and does not mutate the draft.
      await page.getByRole("button", { name: "Original", exact: true }).click();
      await page.waitForFunction(
        (before) =>
          document.querySelector(".specimen-row canvas")?.toDataURL() ===
          before,
        original,
      );
      assert.equal(await red.isDisabled(), true);
      assert.equal(await red.inputValue(), originalRed);
      await page.getByRole("button", { name: "Working", exact: true }).click();
      await page.waitForFunction(
        (before) =>
          document.querySelector(".specimen-row canvas")?.toDataURL() ===
          before,
        edited,
      );
      await page
        .getByRole("button", { name: "Reset color", exact: true })
        .click();
      await page.waitForFunction(
        (before) =>
          document.querySelector(".specimen-row canvas")?.toDataURL() ===
          before,
        original,
      );
      await page
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      await page.waitForFunction(
        (before) =>
          document.querySelector(".specimen-row canvas")?.toDataURL() ===
          before,
        edited,
      );

      // The live gallery, state strip and component tree select the same artwork.
      await page
        .getByRole("button", { name: "Edit push button: Pressed", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('button[aria-label="Push button: Pressed"]')
            ?.getAttribute("aria-pressed") === "true",
      );
      assert.equal(
        await page
          .getByRole("button", { name: "State: Pressed", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      await page
        .getByRole("button", {
          name: "Edit document window: Active",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "State: Inactive", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Edit document window: Inactive",
          exact: true,
        })
        .waitFor();
      await page
        .getByRole("button", { name: "Push button: Normal", exact: true })
        .click();
      await page.getByRole("button", { name: "Active", exact: true }).click();
      await page
        .getByRole("button", { name: "Palette record 1", exact: true })
        .click();
      await page.waitForFunction(
        (before) =>
          document.querySelector(".specimen-row canvas")?.toDataURL() ===
          before,
        edited,
      );

      // Guides draft locally during a pointer gesture and commit a single undo step.
      await page.getByRole("button", { name: "Artwork", exact: true }).click();
      const corner = page.getByRole("slider", {
        name: "Corner guide",
        exact: true,
      });
      const cornerInput = page.getByRole("spinbutton", {
        name: "Corner size",
        exact: true,
      });
      const initialCorner = Number(await cornerInput.inputValue());
      await corner.focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(
        (value) =>
          document.querySelector("#geometry-0")?.value === String(value),
        initialCorner + 1,
      );
      await page
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      await page.waitForFunction(
        (value) =>
          document.querySelector("#geometry-0")?.value === String(value),
        initialCorner,
      );
      const handle = await corner.boundingBox();
      await page.mouse.move(
        handle.x + handle.width / 2,
        handle.y + handle.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        handle.x + handle.width / 2 + 32,
        handle.y + handle.height / 2,
      );
      assert.equal(await cornerInput.inputValue(), String(initialCorner));
      await page.mouse.up();
      await page.waitForFunction(
        (value) =>
          document.querySelector("#geometry-0")?.value === String(value),
        initialCorner + 2,
      );
      await page
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      await page.waitForFunction(
        (value) =>
          document.querySelector("#geometry-0")?.value === String(value),
        initialCorner,
      );
      await page.mouse.move(
        handle.x + handle.width / 2,
        handle.y + handle.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        handle.x + handle.width / 2 + 16,
        handle.y + handle.height / 2,
      );
      await page.keyboard.press("Escape");
      await page.mouse.up();
      assert.equal(await cornerInput.inputValue(), String(initialCorner));
      assert.equal(
        await page
          .getByRole("button", { name: "Redo edit", exact: true })
          .isEnabled(),
        true,
      );

      // Cancellation and loss of capture discard the temporary guide as well.
      for (const event of ["pointercancel", "lostpointercapture"]) {
        await page.mouse.move(
          handle.x + handle.width / 2,
          handle.y + handle.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
          handle.x + handle.width / 2 + 16,
          handle.y + handle.height / 2,
        );
        await corner.dispatchEvent(event);
        await page.mouse.up();
        assert.equal(await cornerInput.inputValue(), String(initialCorner));
        assert.equal(
          await page
            .getByRole("button", { name: "Redo edit", exact: true })
            .isEnabled(),
          true,
        );
      }

      // Per-field reset retains other edits; whole-artwork reset is undoable.
      const sideInput = page.getByRole("spinbutton", {
        name: "Side thickness",
        exact: true,
      });
      const initialSide = await sideInput.inputValue();
      await cornerInput.fill("3");
      await sideInput.fill("5");
      await page
        .getByRole("button", { name: "Reset corner size", exact: true })
        .click();
      assert.equal(await cornerInput.inputValue(), String(initialCorner));
      assert.equal(await sideInput.inputValue(), "5");
      assert.equal(await red.inputValue(), "45000");
      await page
        .getByRole("button", { name: "Reset selected artwork", exact: true })
        .click();
      assert.equal(await sideInput.inputValue(), initialSide);
      assert.equal(await red.inputValue(), originalRed);
      for (let i = 0; i < 4; i++)
        await page
          .getByRole("button", { name: "Undo edit", exact: true })
          .click();
      assert.equal(await sideInput.inputValue(), initialSide);
      assert.equal(await cornerInput.inputValue(), String(initialCorner));
      assert.equal(await red.inputValue(), "45000");
      await page
        .getByRole("button", { name: "Theme preview", exact: true })
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
      await reopened
        .getByText("Precise source color (RGB16)", { exact: true })
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
        .getByRole("button", { name: "Push button: Pressed", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector("#geometry-0")?.value === "6",
      );
      assert.equal(
        await page
          .getByRole("spinbutton", { name: "Side thickness", exact: true })
          .inputValue(),
        "4",
      );
      await page
        .getByRole("button", { name: "Resources", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Search source artwork", exact: true })
        .fill("-10238");
      assert.equal(await page.locator(".resource-list button").count(), 1);
      await page.locator(".resource-list button").click();
      assert.match(
        await page.locator(".asset-subtitle").textContent(),
        /-10238/,
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
