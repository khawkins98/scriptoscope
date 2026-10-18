import { test, expect, openHarness, attachCase } from './fixtures.mjs';

for (const mode of ['source', 'built']) for (const slug of ['windows-95', 'system7-nostalgia-silver']) for (const layout of ['grid', 'flex']) {
  test(`${mode}: ${slug} ${layout} shadows follow visible chrome at native and 2x scale`, async ({ page, servers }, testInfo) => {
    await openHarness(page, servers, mode);
    let result;
    try {
      for (const scale of [1, 2]) {
        result = await page.evaluate(options => window.controlMatrix.runWindowLayout(options), { slug, layout, scale });
        expect(result.status, result.error).toBe('rendered');
        expect(result.windows).toHaveLength(2);
        for (const window of result.windows) {
          expect(window.boxShadow, 'a stretched host must not draw a ghost shadow rectangle').toBe('none');
          expect(window.part, 'both render paths expose the actual window part').not.toBeNull();
          expect(window.part.boxShadow, 'the visible frame receives the configured shadow').not.toBe('none');
          for (const axis of ['x', 'y', 'width', 'height']) {
            expect(window.part.rect[axis], `shadow ${axis} follows the rendered chrome`).toBeCloseTo(window.chromeCanvasRect[axis], 4);
          }
          for (const axis of ['width', 'height']) {
            expect(window.chromeCanvasRect[axis]).toBeCloseTo(window.chromeCanvasSize[axis] * window.requestedScale, 4);
          }
        }
        await page.emulateMedia({ media: 'print' });
        const printed = await page.evaluate(key => window.controlMatrix.readCase(key), result.recordKey);
        for (const window of printed.windows) expect(window.part.boxShadow, 'window shadows do not print').toBe('none');
        await page.emulateMedia({ media: 'screen' });
      }
    } catch (error) { await attachCase(page, testInfo, { mode, slug, layout, result }, error); throw error; }
  });
}
