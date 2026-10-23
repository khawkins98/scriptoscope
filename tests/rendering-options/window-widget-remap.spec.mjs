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
