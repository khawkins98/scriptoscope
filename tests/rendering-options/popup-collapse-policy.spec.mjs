import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

for (const mode of ['source', 'built']) {
  test(`${mode}: PF4/PM2 direct popup collapse keeps full content, four-side geometry and first strip row`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { widgetFamilyTheme } = await import('/tests/rendering-options/widget-family-fixture.mjs');
      const out = [];
      for (const [request, collapsed] of [['popup-window', false], ['popup-window', true], ['document-window', true]]) {
        const win = await api.renderWindow(widgetFamilyTheme(['popup-window']), { windowType: request, width: 160, height: 100, collapsed, pressedWidget: 'close' });
        const c = win._scriptoscopeComposed, content = win.querySelector('.scriptoscope-content');
        out.push({ collapsed: c.layout.flags.collapsed, popup: c.layout.flags.popupFamily, C: c.layout.C, size: [c.fullWidth, c.fullHeight],
          content: [content.style.width, content.style.height, content.hidden, content.inert],
          pixel: [...c.buffer.getPixel(7, 5)], hole: c.hitWidget(6, 4), ink: c.hitWidget(7, 4),
          region: [...c.structure().bits].reduce((hash, bit) => Math.imul(hash ^ bit, 16777619) >>> 0, 2166136261),
          placement: c.placement });
      }
      return out;
    }, mode);
    expect(rows[1]).toEqual(rows[0]);
    expect(rows[2], 'a fallback that actually renders popup obeys PM2 too').toEqual(rows[0]);
    expect(rows[1].collapsed).toBe(false);
    expect(rows[1].popup).toBe(true);
    expect(rows[1].size).toEqual([168, 124]);
    expect(rows[1].content).toEqual(['160px', '100px', false, false]);
    expect(rows[1].pixel).toEqual([208, 32, 48, 255]);
    expect([rows[1].hole, rows[1].ink]).toEqual([null, 'close']);
  });

  test(`${mode}: PM2 popup initial, apply and toggle keep effective expanded state and requested dimensions`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { widgetFamilyTheme } = await import('/tests/rendering-options/widget-family-fixture.mjs');
      const manager = new api.WindowManager(), theme = widgetFamilyTheme(['popup-window']);
      const host = await manager.add(theme, { windowType: 'popup-window', width: 160, height: 100, state: 'active' }, {}, { collapsed: true });
      document.body.append(host);
      const snapshot = label => {
        const win = host.shadowRoot.querySelector('.scriptoscope-window'), c = win._scriptoscopeComposed;
        const content = win.querySelector('.scriptoscope-content'), state = manager.describe(host);
        return { label, state: [state.width, state.height, state.collapsed], C: [c.layout.C.right - c.layout.C.left, c.layout.C.bottom - c.layout.C.top],
          flag: c.layout.flags.collapsed, content: [content.hidden, content.inert, content.style.width, content.style.height],
          size: [c.fullWidth, c.fullHeight], grow: (() => {
            const el = host.shadowRoot.querySelector('.scriptoscope-growbox');
            return el ? [el.style.width, el.style.height, el.style.right, el.style.bottom] : null;
          })() };
      };
      const rows = [snapshot('initial')];
      await manager.applyState(host, { collapsed: true, width: 190, height: 130 }); rows.push(snapshot('apply'));
      // Actual public frame gesture, with a fixed point on the synthetic top strip.
      const win = host.shadowRoot.querySelector('.scriptoscope-window'), box = win.getBoundingClientRect();
      win.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: box.left + 30, clientY: box.top + 2 }));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); rows.push(snapshot('toggle'));
      await manager.applyState(host, { collapsed: false }); rows.push(snapshot('expand'));
      // Retheme to an actual document fallback; retained requested dimensions must survive.
      await manager.retheme(widgetFamilyTheme(['document-window'])); rows.push(snapshot('document transition'));
      manager.remove(host); host.remove();
      return rows;
    }, mode);
    await attachObservations(info, 'popup-collapse-policy', mode, { mode, rows });
    rows.forEach((r, i) => {
      const [w, h] = i ? [190, 130] : [160, 100];
      expect.soft(r.state, r.label).toEqual([w, h, false]);
      expect.soft(r.C, r.label).toEqual([w, h]);
      expect.soft(r.flag, r.label).toBe(false);
      expect.soft(r.content, r.label).toEqual([false, false, `${w}px`, `${h}px`]);
      expect.soft(r.size, r.label).toEqual([w + 8, h + 24]);
      // Existing modern overlay policy: frame corner plus 15px gutters; not HG3.
      expect.soft(r.grow, r.label).toEqual(['19px', '19px', '0px', '0px']);
    });
  });

  test(`${mode}: PM1 collapse preserves the orthogonal axis and selects the second strip row only for ordinary windows`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { widgetFamilyTheme } = await import('/tests/rendering-options/widget-family-fixture.mjs');
      const out = [];
      for (const key of ['titled-utility-window', 'side-floating-utility-window']) {
        const side = key === 'side-floating-utility-window';
        const win = await api.renderWindow(widgetFamilyTheme([key]), { windowType: key, width: 160, height: 100, collapsed: true, pressedWidget: 'close' });
        const c = win._scriptoscopeComposed, x = side ? 4 : 6, y = side ? 6 : 4;
        out.push({ key, flags: [c.layout.flags.altWidgets, c.layout.flags.sideTitle, c.layout.flags.collapsed],
          C: [c.layout.C.right - c.layout.C.left, c.layout.C.bottom - c.layout.C.top], size: [c.fullWidth, c.fullHeight],
          pixel: [...c.buffer.getPixel(x + 2, y + 1)], first: c.hitWidget(x, y), second: c.hitWidget(x + 1, y) });
      }
      return out;
    }, mode);
    rows.forEach((r, i) => {
      expect.soft(r.flags, r.key).toEqual([true, !!i, true]);
      expect.soft(r.C, r.key).toEqual(i ? [0, 100] : [160, 0]);
      expect.soft(r.size, r.key).toEqual(i ? [24, 108] : [168, 24]);
      expect.soft(r.pixel, r.key).toEqual([224, 176, 16, 255]);
      expect.soft([r.first, r.second], r.key).toEqual(['close', null]);
    });
  });
}
