import { test, expect, openHarness } from './fixtures.mjs';

// Promotion measures the source element. Under a rotated ancestor its
// bounding rect is the tilted box's screen bounds, which are larger than its
// layout size; the window must take the layout size (#519).
for (const mode of ['source', 'built']) {
  test(`${mode}: a window promoted inside a rotated ancestor takes its layout size (#519)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const sizes = await page.evaluate(async ({ mode }) => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const declarative = await import(mode === 'source' ? '/src/declarative/index.ts' : '/dist/declarative.js');
      const theme = await api.loadTheme('/themes/windows-95');
      const manager = new api.WindowManager();
      const sizes = {};
      for (const tilt of [0, 10]) {
        const tilted = document.createElement('div');
        tilted.style.cssText = `transform: rotate(${tilt}deg); margin: 40px`;
        tilted.innerHTML = '<article data-scriptoscope-window data-scriptoscope-title="Tilt" style="width: 300px; height: 120px">Text</article>';
        document.body.append(tilted);
        const win = await declarative.ScriptoscopeWindow.promote(tilted.firstElementChild, { manager, theme });
        const frame = win.host.shadowRoot.querySelector('.scriptoscope-window');
        sizes[tilt] = [frame.offsetWidth, frame.offsetHeight];
        win.unmount(); tilted.remove();
      }
      return sizes;
    }, { mode });
    expect(sizes[10]).toEqual(sizes[0]);
  });
}
