import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

// WindowManager hit overlays come from the 0x5cb6 template → placed remap
// (docs/spec/engine/window-widgets.md RM1–RM8): a widget's top-left moves by
// the near-edge delta and its bottom-right by the far-edge delta (RM6) of the
// side segment that contains it, on every side. The side-floating utility
// windows below keep their collapse widget in the LEFT side's code-10 cell,
// after a code-8 grower, so it moves with height. Below the template the
// side is too short (TS1), the code-10 cell is dropped, and RM6 empties the
// box: no press area, no hit (finding F1).
const CASES = [['1138', 'scheme.rsrc'], ['apple-lisa', 'scheme.sit']];
for (const mode of ['source', 'built']) {
  test(`${mode}: left-side widget hit overlays follow the 0x5cb6 remap across growth and below the template`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'window.widget-remap' });
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, cases }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rows = [];
      for (const [slug] of cases) {
        const theme = await api.loadTheme(`/themes/${slug}`);
        const wt = theme.manifest.windowTypes['side-floating-utility-window'];
        const [l, t, r, b] = wt.parts['part-0'].rect, [cl, ct, cr, cb] = wt.parts['part-3'].rect;
        for (const grow of [-12, 0, 50]) {
          const manager = new api.WindowManager();
          // Width +60 keeps the bottom-right grow-box overlay clear of the left strip;
          // width does not move left-side segments.
          const host = await manager.add(theme, { width: r - l + 60, height: Math.max(0, b - t + grow), windowType: 'side-floating-utility-window', scale: 1 },
            { onClose() {}, onZoom() {}, onCollapse() {} });
          document.body.append(host);
          const win = host.shadowRoot.querySelector('.scriptoscope-window') ?? host.shadowRoot.firstElementChild;
          const composed = win._scriptoscopeComposed;
          const ten = composed.placement.find(p => p.edge === 'left' && p.code === 10);
          const btn = host.shadowRoot.querySelector('.scriptoscope-titlewidget-collapse');
          const box = btn?.getBoundingClientRect(), origin = win.querySelector('canvas.scriptoscope-chrome')?.getBoundingClientRect();
          // Interaction: the point at the overlay's centre resolves to the collapse button.
          const hitEl = box ? host.shadowRoot.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) : null;
          // The old collapse point (the near-edge reading): what a press there reaches.
          const at = win.querySelector('canvas.scriptoscope-chrome')?.getBoundingClientRect();
          const old = at && ten ? host.shadowRoot.elementFromPoint(at.x + (cl + cr) / 2, at.y + ten.rects[0].y + (ct - ten.src.y) + (cb - ct) / 2) : null;
          rows.push({ slug, grow, template: [cl, ct, cr - cl, cb - ct], tenSrcY: ten?.src.y, tenDstY: ten?.rects[0].y, tenH: ten?.rects[0].h,
            oldPointIsCollapse: !!old?.classList?.contains('scriptoscope-titlewidget-collapse'),
            overlay: btn ? [Number.parseFloat(btn.style.left), Number.parseFloat(btn.style.top), Number.parseFloat(btn.style.width), Number.parseFloat(btn.style.height)] : null,
            screen: box && origin ? [box.x - origin.x, box.y - origin.y] : null, hitIsButton: hitEl === btn, hit: hitEl?.className ?? String(hitEl) });
          manager.remove(host);
        }
        theme.dispose?.();
      }
      return rows;
    }, { mode, cases: CASES });
    await attachObservations(info, 'window-widget-remap', mode, { mode, rows });
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      const [cl, ct, w, h] = row.template;
      if (row.grow < 0) continue;
      // 0x5cb6: both corners lie in the kept code-10 cell, so the rect is translated by its delta.
      expect(row.overlay, `${row.slug} ${row.grow}`).toEqual([cl, ct + row.tenDstY - row.tenSrcY, w, h]);
      expect(row.screen, `${row.slug} ${row.grow}`).toEqual(row.overlay.slice(0, 2));
      expect(row.hitIsButton, `${row.slug} ${row.grow}: ${row.hit}`).toBe(true);
    }
    for (const slug of ['1138', 'apple-lisa']) {
      const at = g => rows.find(r => r.slug === slug && r.grow === g);
      expect(at(50).overlay[1] - at(0).overlay[1], slug).toBe(50);
      // Below the template the code-10 cell is dropped (TS1) and RM6 empties the collapse box:
      // no overlay with an area, and the old collapse point does not reach a collapse button.
      expect(at(-12).tenH, slug).toBe(0);
      expect(at(-12).overlay === null || at(-12).overlay[2] <= 0 || at(-12).overlay[3] <= 0, `${slug}: ${JSON.stringify(at(-12).overlay)}`).toBe(true);
      expect(at(-12).oldPointIsCollapse, slug).toBe(false);
      expect(at(0).oldPointIsCollapse, `${slug}: the same probe reaches the kept box`).toBe(true);
    }
  });
}

// WM381 is modern public WindowManager policy, not decoded native precedence.
// The frozen policy names 1138's 2x35 template-content case. Its collapse
// part-3 is [4,30,12,38]; probe (8,34) comes from that input, never the overlay
// being tested. HG1–HG5's original numeric intersection remains unknown.
for (const mode of ['source', 'built']) {
  test(`${mode}: template-width widgets act exclusively over resize, with ordinary pointer and keyboard resize preserved`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = [];
    for (const state of ['active', 'inactive']) for (const scale of [1, 2]) {
      await page.evaluate(async ({ mode, state, scale }) => {
        const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
        const theme = await api.loadTheme('/themes/1138');
        const manager = new api.WindowManager(), actions = [], resize = [], targets = [];
        const host = await manager.add(theme, { windowType: 'side-floating-utility-window', width: 2, height: 35, scale, state },
          { onClose() { actions.push('close'); }, onZoom() { actions.push('zoom'); }, onCollapse() { actions.push('collapse'); } });
        host.style.left = '100px'; host.style.top = '120px'; document.body.append(host);
        host.addEventListener('scriptoscope:userresize', e => resize.push(e.detail));
        host.shadowRoot.addEventListener('pointerdown', e => targets.push(e.target.className), true);
        window.wm381 = { api, theme, manager, host, actions, resize, targets };
      }, { mode, state, scale });
      // #614 IP1: the first press on an inactive window's widget only activates it.
      // The widget still owns the point (the press reaches the collapse button, not
      // the grow box), and the next click on the now active window acts.
      let activation = null;
      if (state === 'inactive') {
        await page.mouse.click(100 + 8 * scale, 120 + 34 * scale);
        activation = await page.evaluate(async () => {
          const { manager, host, actions, resize } = window.wm381;
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const d = manager.describe(host);
          return { actions: [...actions], resize: [...resize], active: d.active, size: [d.width, d.height] };
        });
      }
      // Fixed input-space point, with the consumer's explicit host origin.
      await page.mouse.click(100 + 8 * scale, 120 + 34 * scale);
      const click = await page.evaluate(() => ({ actions: [...window.wm381.actions], resize: [...window.wm381.resize] }));
      await page.mouse.move(100 + 8 * scale, 120 + 34 * scale);
      await page.mouse.down();
      await page.mouse.move(100 + 14 * scale, 120 + 38 * scale, { steps: 3 });
      await page.mouse.up();
      const row = await page.evaluate(async ({ state, scale }) => {
        const { manager, host, actions, resize, targets, theme } = window.wm381;
        const btn = host.shadowRoot.querySelector('.scriptoscope-titlewidget-collapse');
        const keyboard = { label: btn?.getAttribute('aria-label'), disabled: btn?.disabled, tabIndex: btn?.tabIndex };
        btn?.focus(); keyboard.focused = host.shadowRoot.activeElement === btn;
        const result = { state, scale, actions: [...actions], resize: [...resize], targets: [...targets], keyboard,
          width: manager.describe(host).width, height: manager.describe(host).height };
        return result;
      }, { state, scale });
      await page.keyboard.press('Enter');
      const keyboardAction = await page.evaluate(() => { const { manager, host, theme, actions } = window.wm381; const result = [...actions]; manager.remove(host); host.remove(); theme.dispose?.(); return result; });
      rows.push({ ...row, click, keyboardAction, activation });
    }
    // A larger ordinary window has an uncovered bottom-right grow target.
    // Its measured root corner is an interaction location only: expected size
    // changes are specified by the independent input deltas below.
    await page.evaluate(async ({ mode }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const theme = await api.loadTheme('/themes/1138'), manager = new api.WindowManager();
      const actions = [], resize = [];
      const host = await manager.add(theme, { windowType: 'side-floating-utility-window', width: 160, height: 100, scale: 1 },
        { onClose() { actions.push('close'); }, onZoom() { actions.push('zoom'); }, onCollapse() { actions.push('collapse'); } });
      host.style.left = '100px'; host.style.top = '120px'; document.body.append(host);
      host.addEventListener('scriptoscope:userresize', e => resize.push(e.detail));
      window.wm381 = { theme, manager, host, actions, resize };
    }, { mode });
    const corner = await page.evaluate(() => { const b = window.wm381.host.getBoundingClientRect(); return { x: b.right - 2, y: b.bottom - 2 }; });
    await page.mouse.move(corner.x, corner.y); await page.mouse.down();
    await page.mouse.move(corner.x + 24, corner.y + 16, { steps: 3 }); await page.mouse.up();
    await page.waitForFunction(() => window.wm381.host.shadowRoot.querySelector('.scriptoscope-growbox'));
    const pointer = await page.evaluate(() => { const { manager, host, actions, resize } = window.wm381; const { width, height } = manager.describe(host); return { width, height, actions: [...actions], resize: [...resize] }; });
    await page.locator('[data-scriptoscope-window-host]').getByRole('button', { name: 'Resize window' }).focus();
    await page.keyboard.press('ArrowRight');
    const keyboardResize = await page.evaluate(() => { const { manager, host, actions, resize, theme } = window.wm381; const { width, height } = manager.describe(host); const out = { width, height, actions: [...actions], resize: [...resize] }; manager.remove(host); host.remove(); theme.dispose?.(); return out; });
    await attachObservations(info, 'window-widget-collision', mode, { mode, policy: 'WM381 modern compatibility; original numeric overlap unknown', rows, pointer, keyboardResize });
    for (const row of rows) {
      const label = `${row.state} scale ${row.scale}`;
      if (row.state === 'inactive')
        expect(row.activation, `${label}: the first click only activates (#614 IP1)`).toEqual({ actions: [], resize: [], active: true, size: [2, 35] });
      else expect(row.activation, label).toBeNull();
      expect(row.click, `${label}: one stationary click, one title action`).toEqual({ actions: ['collapse'], resize: [] });
      expect(row.keyboardAction, `${label}: keyboard activation remains available`).toEqual([...row.actions, 'collapse']);
      expect(row.targets.every(target => target.includes('titlewidget-collapse')), label).toBe(true);
      expect(row.actions[0], label).toBe('collapse');
      expect(row.actions.every(action => action === 'collapse'), label).toBe(true);
      expect(row.actions.length, label).toBeGreaterThanOrEqual(1);
      expect(row.actions.length, label).toBeLessThanOrEqual(2);
      expect(row.resize, `${label}: widget press/drag must not start resize`).toEqual([]);
      expect([row.width, row.height], label).toEqual([2, 35]);
      expect(row.keyboard, label).toEqual({ label: 'Collapse window', disabled: false, tabIndex: 0, focused: true });
    }
    expect(pointer).toEqual({ width: 184, height: 116, actions: [], resize: [{ w: 184, h: 116 }] });
    expect(keyboardResize).toEqual({ width: 192, height: 116, actions: [], resize: [{ w: 184, h: 116 }, { w: 192, h: 116 }] });
  });
}
