import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

// Public DOM behavior, independent of native title/font or golden pixel claims.
// Place verbatim at tests/rendering-options/collapsed-utility-dom.spec.mjs.
const SCHEMES = ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];
for (const mode of ['source', 'built']) {
  test(`${mode}: collapsed utility content is hidden and cannot receive focus`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, schemes }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rows = [];
      for (const scheme of schemes) {
        const theme = await api.loadTheme(`/themes/${scheme}`);
        try {
          for (const windowType of ['no-title-utility-window', 'collapsed-no-title-utility-window', 'collapsed-no-title-utility']) {
            for (const state of ['active', 'inactive']) for (const scale of [1, 2]) {
              const win = await api.renderWindow(theme, { windowType, title: 'Inspector', width: 160, height: 90, state, scale });
              document.body.append(win);
              try {
                const content = win.querySelector('.scriptoscope-content');
                if (!content) throw new Error('Public window has no content container');
                const button = document.createElement('button');
                button.textContent = 'Consumer content';
                button.style.cssText = 'display:block;width:80px;height:20px;margin:0;background:#ff00ff';
                content.append(button);
                button.focus();
                const rect = win.getBoundingClientRect(), body = content.getBoundingClientRect();
                const canvas = win.querySelector('canvas.scriptoscope-chrome');
                if (!canvas) throw new Error('Public window has no chrome canvas');
                // Account for display/visibility and clipping by any ancestor. A visible
                // overflow body remains visible even when the root's height is collapsed.
                let top = body.top, bottom = body.bottom, left = body.left, right = body.right;
                let shown = content.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
                for (let node = content; node; node = node.parentElement) {
                  const style = getComputedStyle(node), box = node.getBoundingClientRect();
                  if (['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
                  if (['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
                }
                shown = shown && right > left && bottom > top;
                rows.push({ scheme, windowType, state, scale, buffer: [canvas.width, canvas.height],
                  root: [rect.width, rect.height], contentHeight: body.height, visibleContent: shown,
                  consumerCanFocus: document.activeElement === button });
              } finally { win.remove(); }
            }
          }
        } finally { theme.dispose?.(); }
      }
      return rows;
    }, { mode, schemes: SCHEMES });
    await attachObservations(info, 'collapsed-utility-dom', mode, { mode, rows });
    expect(rows).toHaveLength(60);
    const expanded = rows.filter(row => row.windowType === 'no-title-utility-window');
    expect(expanded).toHaveLength(20);
    for (const row of expanded) {
      const label = JSON.stringify(row);
      expect(row.visibleContent, `expanded content visible: ${label}`).toBe(true);
      expect(row.consumerCanFocus, `expanded content focusable: ${label}`).toBe(true);
      expect(row.contentHeight, `expanded content size: ${label}`).toBe(90 * row.scale);
    }
    const collapsed = rows.filter(row => row.windowType !== 'no-title-utility-window');
    expect(collapsed).toHaveLength(40);
    for (const row of collapsed) {
      const label = JSON.stringify(row);
      expect(row.buffer, `collapsed chrome: ${label}`).toEqual([169, 15]);
      expect(row.root, `collapsed root: ${label}`).toEqual([169 * row.scale, 15 * row.scale]);
    }
    expect(collapsed.filter(row => row.visibleContent || row.consumerCanFocus),
      'Collapsed content must be hidden and consumer descendants must not receive focus').toEqual([]);
  });
}
