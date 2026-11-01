// HPT40 (hit-regions §9.5 HP26, PM ruling 2026-11-01): the Tab sequence through a recipe
// window's chrome and slotted content must match pre-#597 behaviour in both hit modes.
// The same in-page scenario records the reference (on the pre-#597 merge base, see
// frame-pass-through-tab-order.json) and runs the check, so the two cannot drift.

/** In-page: build the window between two page inputs. `hit` is omitted for the reference run. */
export const TAB_SCENARIO = async ({ mode, hit }) => {
  const css = document.createElement('link'); css.rel = 'stylesheet';
  css.href = mode === 'source' ? '/src/scriptoscope.css' : '/dist/scriptoscope.css';
  await new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; document.head.append(css); });
  const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
  const start = document.createElement('input'); start.id = 'tab-start'; document.body.append(start);
  const content = document.createElement('div');
  content.innerHTML = '<div style="width:900px"><p>Wide and tall</p>' + '<p>Line</p>'.repeat(30) + '<button id="in-content">inside</button></div>';
  Object.assign(content.style, { height: '100%', overflow: 'auto', boxSizing: 'border-box' });
  const manager = new api.WindowManager();
  const host = await manager.add(await api.loadTheme('/themes/dolphin-som'), { width: 320, height: 200, title: 'Tab order' },
    { onClose() {}, onZoom() {}, onCollapse() {} }, { contentEl: content, ...(hit ? { hit } : {}) });
  document.body.append(host);
  Object.assign(host.style, { position: 'absolute', left: '120px', top: '140px' });
  const end = document.createElement('input'); end.id = 'tab-end'; document.body.append(end);
  await new Promise(r => setTimeout(r, 300));
  window.__tabHost = host;
};

/** Tab from #tab-start until #tab-end; returns the deep active element labels. */
export async function tabSequence(page) {
  await page.evaluate(() => document.getElementById('tab-start').focus());
  const out = [];
  for (let i = 0; i < 30 && out.at(-1) !== 'tab-end'; i++) {
    await page.keyboard.press('Tab');
    out.push(await page.evaluate(() => {
      let a = document.activeElement;
      while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
      return a?.getAttribute?.('aria-label') ?? (a?.id || `${a?.tagName}.${a?.className}`);
    }));
  }
  return out;
}
