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
      // A named-role task must succeed before opening the advanced source editor.
      await page.waitForFunction(
        () => document.querySelectorAll(".gallery-control canvas").length === 3,
      );
      assert.equal(
        await page
          .getByRole("main", { name: "Theme properties", exact: true })
          .isVisible(),
        true,
      );
      assert.equal(
        await page
          .getByText("Project only · reopen in Studio", { exact: true })
          .isVisible(),
        true,
      );
      const galleryPixels = () =>
        page
          .locator(".gallery-control canvas")
          .evaluateAll((canvases) =>
            canvases.map((canvas) => canvas.toDataURL()),
          );
      const originalGallery = await galleryPixels();
      const windowPixels = (target = page) =>
        target
          .locator(".scene-window .scene-frame > div > canvas")
          .evaluateAll((canvases) =>
            canvases.map((canvas) => canvas.toDataURL()),
          );
      const waitWindows = (pixels, target = page) =>
        target.waitForFunction(
          (before) =>
            JSON.stringify(
              [
                ...document.querySelectorAll(
                  ".scene-window .scene-frame > div > canvas",
                ),
              ].map((canvas) => canvas.toDataURL()),
            ) === JSON.stringify(before),
          pixels,
        );
      await page.waitForFunction(
        () =>
          document.querySelectorAll(".scene-window .scene-frame > div > canvas")
            .length === 2,
      );
      const originalWindows = await windowPixels();
      assert.equal(
        await page
          .getByRole("heading", { name: "Shape the whole scene", exact: true })
          .isVisible(),
        true,
      );
      // Pick actual chrome; the keyboard-accessible window label offers the same action.
      await page
        .locator('.scene-window[data-state="active"] .scene-frame > div')
        .click({ position: { x: 140, y: 8 } });
      assert.equal(
        await page
          .getByRole("group", { name: "Window state scope", exact: true })
          .getByRole("button", { name: "Active", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      const titleColor = page.getByRole("textbox", {
        name: "Title bar color hex color",
        exact: true,
      });
      await titleColor.fill("#9f6b20");
      await titleColor.press("Enter");
      await page.waitForFunction((before) => {
        const canvases = [
          ...document.querySelectorAll(
            ".scene-window .scene-frame > div > canvas",
          ),
        ];
        return (
          canvases.length === 2 &&
          canvases[0].toDataURL() !== before[0] &&
          canvases[1].toDataURL() === before[1]
        );
      }, originalWindows);
      const activeWindows = await windowPixels();
      assert.deepEqual(await galleryPixels(), originalGallery);
      await page.getByRole("button", { name: "Original", exact: true }).click();
      await waitWindows(originalWindows);
      assert.equal(await titleColor.isDisabled(), true);
      assert.equal(
        await page
          .getByRole("button", {
            name: "Reset Active window colors",
            exact: true,
          })
          .isDisabled(),
        true,
      );
      await page.getByRole("button", { name: "Working", exact: true }).click();
      await waitWindows(activeWindows);
      await page
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      await waitWindows(originalWindows);
      await page
        .getByRole("button", { name: "Redo edit", exact: true })
        .click();
      await waitWindows(activeWindows);
      await page
        .getByRole("button", {
          name: "Edit Inactive window properties",
          exact: true,
        })
        .click();
      const titleText = page.getByRole("textbox", {
        name: "Window title text hex color",
        exact: true,
      });
      await titleText.fill("#523577");
      await titleText.press("Enter");
      await page.waitForFunction((before) => {
        const canvases = [
          ...document.querySelectorAll(
            ".scene-window .scene-frame > div > canvas",
          ),
        ];
        return (
          canvases.length === 2 &&
          canvases[0].toDataURL() === before[0] &&
          canvases[1].toDataURL() !== before[1]
        );
      }, activeWindows);
      const editedWindows = await windowPixels();
      assert.equal(
        await page
          .getByRole("textbox", {
            name: "Title shadow color hex color",
            exact: true,
          })
          .inputValue(),
        await titleText.inputValue(),
      );
      assert.match(
        await page
          .getByRole("region", { name: "Window title text", exact: true })
          .innerText(),
        /Coupled with Title shadow color/,
      );
      const windowDownload = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Save project", exact: false })
        .click();
      const windowFile = await windowDownload;
      const windowPath = resolve(dir, "window-project.json");
      await windowFile.saveAs(windowPath);
      const windowSaved = await openProject(await readFile(windowPath, "utf8"));
      assert.equal(windowSaved.edits.length, 2);
      const windowContext = await browser.newContext();
      const windowReopen = await windowContext.newPage();
      windowReopen.on("pageerror", (error) => errors.push(error.message));
      await windowReopen.goto(url);
      await windowReopen
        .getByLabel("Open project file", { exact: true })
        .setInputFiles(windowPath);
      await waitWindows(editedWindows, windowReopen);
      await windowReopen.setViewportSize({ width: 390, height: 844 });
      await windowReopen
        .getByRole("group", { name: "Authoring panels", exact: true })
        .getByRole("button", { name: "Preview", exact: true })
        .click();
      await windowReopen
        .getByRole("button", {
          name: "Edit Inactive window properties",
          exact: true,
        })
        .click();
      assert.equal(
        await windowReopen
          .getByRole("group", { name: "Window state scope", exact: true })
          .getByRole("button", { name: "Inactive", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await windowReopen
          .getByRole("textbox", {
            name: "Window title text hex color",
            exact: true,
          })
          .isVisible(),
        true,
      );
      assert.equal(
        await windowReopen.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await windowContext.close();
      await page
        .getByRole("button", { name: "Both states", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Reset all window colors", exact: true })
        .click();
      await waitWindows(originalWindows);
      await page
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      await waitWindows(editedWindows);
      await page
        .getByRole("navigation", { name: "Property groups", exact: true })
        .getByRole("button", { name: "Text & selection", exact: true })
        .click();
      assert.equal(await page.getByRole("textbox").count(), 0);
      assert.equal(
        await page
          .getByText(
            "No verified source binding for document selection. The sample highlight is fixed preview content.",
            { exact: true },
          )
          .isVisible(),
        true,
      );
      // Return to a fresh source before the established button/advanced acceptance flow.
      await page
        .getByRole("button", { name: "Start with 1138", exact: true })
        .click();
      await waitWindows(originalWindows);
      await page
        .getByRole("navigation", { name: "Property groups", exact: true })
        .getByRole("button", { name: "Controls", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Apply amber variation", exact: true })
        .click();
      await page.waitForFunction((before) => {
        const canvases = [
          ...document.querySelectorAll(".gallery-control canvas"),
        ];
        return (
          canvases.length === 3 &&
          canvases.every(
            (canvas, index) => canvas.toDataURL() !== before[index],
          )
        );
      }, originalGallery);
      const amberGallery = await galleryPixels();
      await page
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      await page.waitForFunction(
        (before) =>
          JSON.stringify(
            [...document.querySelectorAll(".gallery-control canvas")].map(
              (canvas) => canvas.toDataURL(),
            ),
          ) === JSON.stringify(before),
        originalGallery,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Undo edit", exact: true })
          .isDisabled(),
        true,
      );
      await page
        .getByRole("button", { name: "Redo edit", exact: true })
        .click();
      await page.waitForFunction(
        (before) =>
          JSON.stringify(
            [...document.querySelectorAll(".gallery-control canvas")].map(
              (canvas) => canvas.toDataURL(),
            ),
          ) === JSON.stringify(before),
        amberGallery,
      );
      await page.getByRole("button", { name: "Original", exact: true }).click();
      await page.waitForFunction(
        (before) =>
          JSON.stringify(
            [...document.querySelectorAll(".gallery-control canvas")].map(
              (canvas) => canvas.toDataURL(),
            ),
          ) === JSON.stringify(before),
        originalGallery,
      );
      assert.equal(
        await page
          .getByRole("textbox", {
            name: "Button face color hex color",
            exact: true,
          })
          .isDisabled(),
        true,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Reset all button colors", exact: true })
          .isDisabled(),
        true,
      );
      await page.getByRole("button", { name: "Working", exact: true }).click();
      await page
        .getByRole("button", {
          name: "Edit Pressed button properties",
          exact: true,
        })
        .click();
      assert.equal(
        await page
          .getByRole("group", { name: "Property state scope", exact: true })
          .getByRole("button", { name: "Pressed", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Reset Pressed colors", exact: true })
          .isEnabled(),
        true,
      );
      const faceHex = page.getByRole("textbox", {
        name: "Button face color hex color",
        exact: true,
      });
      await faceHex.fill("#996633");
      await faceHex.press("Enter");
      await page.waitForFunction((before) => {
        const canvases = [
          ...document.querySelectorAll(".gallery-control canvas"),
        ];
        return (
          canvases.length === 3 &&
          canvases[1].toDataURL() !== before[1] &&
          canvases[0].toDataURL() === before[0] &&
          canvases[2].toDataURL() === before[2]
        );
      }, amberGallery);
      await page
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      await page
        .getByRole("button", { name: "All states", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Reset Button face color", exact: true })
        .click();
      await page.waitForFunction((before) => {
        const canvases = [
          ...document.querySelectorAll(".gallery-control canvas"),
        ];
        return (
          canvases.length === 3 &&
          canvases[0].toDataURL() === before[0] &&
          canvases[1].toDataURL() === before[1] &&
          canvases[2].toDataURL() !== before[2]
        );
      }, originalGallery);
      const withoutFaces = await galleryPixels();
      assert.equal(withoutFaces[0], originalGallery[0]);
      assert.equal(withoutFaces[1], originalGallery[1]);
      assert.notEqual(withoutFaces[2], originalGallery[2]); // Disabled label override is retained.
      await page
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Reset all button colors", exact: true })
        .click();
      await page.waitForFunction(
        (before) =>
          JSON.stringify(
            [...document.querySelectorAll(".gallery-control canvas")].map(
              (canvas) => canvas.toDataURL(),
            ),
          ) === JSON.stringify(before),
        originalGallery,
      );
      await page
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      await page.waitForFunction(
        (before) =>
          JSON.stringify(
            [...document.querySelectorAll(".gallery-control canvas")].map(
              (canvas) => canvas.toDataURL(),
            ),
          ) === JSON.stringify(before),
        amberGallery,
      );
      const semanticDownload = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Save project", exact: false })
        .click();
      const semanticFile = await semanticDownload;
      const semanticPath = resolve(dir, "amber-project.json");
      await semanticFile.saveAs(semanticPath);
      const semanticSaved = await openProject(
        await readFile(semanticPath, "utf8"),
      );
      assert.equal(semanticSaved.edits.length, 4);
      const semanticContext = await browser.newContext();
      const semanticReopen = await semanticContext.newPage();
      semanticReopen.on("pageerror", (error) => errors.push(error.message));
      await semanticReopen.goto(url);
      await semanticReopen.waitForFunction(
        () => document.querySelectorAll(".gallery-control canvas").length === 3,
      );
      await semanticReopen
        .getByLabel("Open project file", { exact: true })
        .setInputFiles(semanticPath);
      await semanticReopen.waitForFunction(
        (before) =>
          JSON.stringify(
            [...document.querySelectorAll(".gallery-control canvas")].map(
              (canvas) => canvas.toDataURL(),
            ),
          ) === JSON.stringify(before),
        amberGallery,
      );
      await semanticReopen
        .getByRole("navigation", { name: "Property groups", exact: true })
        .getByRole("button", { name: "Controls", exact: true })
        .click();
      await semanticReopen.setViewportSize({ width: 390, height: 844 });
      const authoringPanels = semanticReopen.getByRole("group", {
        name: "Authoring panels",
        exact: true,
      });
      assert.equal(
        await semanticReopen
          .getByRole("main", { name: "Theme properties", exact: true })
          .isVisible(),
        true,
      );
      assert.equal(
        await semanticReopen.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await authoringPanels
        .getByRole("button", { name: "Preview", exact: true })
        .click();
      assert.equal(
        await semanticReopen
          .getByRole("complementary", {
            name: "Theme preview gallery",
            exact: true,
          })
          .isVisible(),
        true,
      );
      await semanticReopen
        .getByRole("button", { name: "Original", exact: true })
        .click();
      await authoringPanels
        .getByRole("button", { name: "Properties", exact: true })
        .click();
      assert.equal(
        await semanticReopen
          .getByRole("textbox", {
            name: "Button face color hex color",
            exact: true,
          })
          .isDisabled(),
        true,
      );
      await semanticReopen
        .getByRole("button", { name: "Return to working", exact: true })
        .click();
      await authoringPanels
        .getByRole("button", { name: "Preview", exact: true })
        .click();
      await semanticReopen
        .getByRole("button", {
          name: "Edit Pressed button properties",
          exact: true,
        })
        .click();
      assert.equal(
        await semanticReopen
          .getByRole("main", { name: "Theme properties", exact: true })
          .isVisible(),
        true,
      );
      await authoringPanels
        .getByRole("button", { name: "Bases", exact: true })
        .click();
      assert.equal(
        await semanticReopen
          .getByRole("button", { name: "Start with Animals", exact: true })
          .isVisible(),
        true,
      );
      assert.equal(
        await semanticReopen.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await semanticContext.close();
      await page
        .getByRole("button", { name: "Start with 1138", exact: true })
        .click();
      await page
        .getByRole("group", { name: "Workspace mode", exact: true })
        .getByRole("button", { name: "Advanced source", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelectorAll(".specimen-row canvas").length === 3,
      );
      const pixelSnapshot = () =>
        page
          .locator(".specimen-row canvas")
          .first()
          .evaluate((el) => el.toDataURL());
      const original = await pixelSnapshot();
      assert.equal(
        await page
          .getByRole("button", { name: "Preview + source", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await page
          .getByRole("region", { name: "Live theme preview", exact: true })
          .isVisible(),
        true,
      );
      assert.equal(
        await page
          .getByRole("region", { name: "Source artwork editor", exact: true })
          .isVisible(),
        true,
      );
      assert.equal(await page.locator(".selection-note").count(), 0);

      // The state rail uses composed controls, rather than stretching source templates.
      await page.waitForFunction(
        () => document.querySelectorAll(".state-thumbnail canvas").length === 3,
      );
      assert.equal(
        await page
          .locator(".scope-card")
          .getByText("Used by 1 mapped state", { exact: true })
          .isVisible(),
        true,
      );
      await page
        .getByRole("button", { name: "Focus source", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Pixel grid", exact: true })
        .click();
      assert.equal(await page.locator(".pixel-grid").count(), 1);
      const sourceCanvas = page.getByRole("button", {
        name: "Selected source artwork",
        exact: true,
      });
      // Normal face pixel (0, 0) is source index 15, record 6. Keyboard walks exact indices.
      await sourceCanvas.click({ position: { x: 4, y: 4 } });
      assert.equal(
        await page
          .getByRole("button", { name: "Palette record 6", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      await sourceCanvas.focus();
      await page.keyboard.press("Enter");
      assert.match(
        await page.locator(".pixel-readout").textContent(),
        /Pixel 0, 0 → color record 6/,
      );
      await page.keyboard.press("ArrowRight");
      assert.match(
        await page.locator(".pixel-readout").textContent(),
        /Pixel 1, 0/,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Undo edit", exact: true })
          .isEnabled(),
        false,
      );
      await page
        .getByRole("button", { name: "Back to specimen", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Expand source ↗", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("button", { name: "Focus source", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      await page
        .getByRole("button", { name: "Back to specimen", exact: true })
        .click();

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
        .getByRole("button", { name: "Overrides 1", exact: true })
        .click();
      const overrides = page.getByRole("region", {
        name: "Selected artwork overrides",
        exact: true,
      });
      assert.equal(
        await overrides
          .getByText("Color record 1", { exact: true })
          .isVisible(),
        true,
      );
      await overrides
        .getByRole("button", { name: "Reset color record 1", exact: true })
        .click();
      assert.equal(
        await overrides
          .getByText("Matches the original", { exact: true })
          .isVisible(),
        true,
      );
      await page
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Appearance", exact: true })
        .click();
      assert.equal(await red.inputValue(), "45000");

      await page.getByRole("button", { name: /^Changes/ }).click();
      assert.equal(await page.locator(".change-list > button").count(), 1);
      await page.locator(".change-list > button").click();
      assert.equal(
        await page
          .getByRole("button", { name: "State: Normal", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );

      assert.equal(await red.inputValue(), "45000");
      await page
        .getByRole("button", { name: "Edit push button: Normal", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Palette record 1", exact: true })
        .click();
      // History shortcuts work outside text fields without stealing native field undo.
      await page
        .getByRole("button", { name: "Preview only", exact: true })
        .focus();
      await page.keyboard.press("Control+z");
      await page.waitForFunction(
        (before) =>
          document.querySelector(".specimen-row canvas")?.toDataURL() ===
          before,
        original,
      );
      await page.keyboard.press("Control+Shift+z");
      await page.waitForFunction(
        (before) =>
          document.querySelector(".specimen-row canvas")?.toDataURL() ===
          before,
        edited,
      );

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
      await page
        .getByRole("button", { name: "Overrides 1", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("button", { name: "Reset color record 1", exact: true })
          .isDisabled(),
        true,
      );
      await page
        .getByRole("button", { name: "Appearance", exact: true })
        .click();

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
      await page
        .getByRole("button", { name: "Focus source", exact: true })
        .click();
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
      await page
        .getByRole("combobox", { name: "Artwork zoom", exact: true })
        .selectOption("16");
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
        .getByRole("button", { name: "Preview only", exact: true })
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
      await reopened
        .getByRole("group", { name: "Workspace mode", exact: true })
        .getByRole("button", { name: "Advanced source", exact: true })
        .click();
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
        .fill("Push button Pressed");
      assert.equal(await page.locator(".resource-list button").count(), 1);
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

      const panels = page.getByRole("group", {
        name: "Editor panels",
        exact: true,
      });
      assert.equal(await page.getByRole("main").isVisible(), true);
      await panels
        .getByRole("button", { name: "Properties", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("complementary", {
            name: "Artwork inspector",
            exact: true,
          })
          .isVisible(),
        true,
      );
      assert.equal(await page.getByRole("main").isVisible(), false);
      assert.equal(
        await page
          .getByRole("spinbutton", { name: "Corner size", exact: true })
          .inputValue(),
        "6",
      );
      await panels
        .getByRole("button", { name: "Explorer", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Components", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Push button: Normal", exact: true })
        .click();
      assert.equal(await page.getByRole("main").isVisible(), true);
      await panels
        .getByRole("button", { name: "Properties", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector("#geometry-0")?.value === "2",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      await page
        .getByRole("button", { name: "Open source artwork", exact: true })
        .click();
      assert.equal(await page.getByRole("main").isVisible(), true);
      await page
        .getByRole("button", { name: "Edit color record 0 →", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("complementary", {
            name: "Artwork inspector",
            exact: true,
          })
          .isVisible(),
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
