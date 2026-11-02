// Implementation-owned browser regression for app-layer corner policy (#640).
// Run against Vite or the built demo with SCRIPTOSCOPE_CORNER_URL set.
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const base = process.env.SCRIPTOSCOPE_CORNER_URL;
const built = process.env.SCRIPTOSCOPE_CORNER_BUILT === '1';
const source = `/@fs${fileURLToPath(new URL('./index.ts', import.meta.url))}`;

test('single-axis bars fill the content edge; frame resizing and artwork survive retheme', { skip: !base }, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  try {
    await page.goto(`${base}/showcase.html`);
    await page.evaluate(async ({ base, built, source }) => {
      const api = await import(built ? `${base}/scriptoscope.js` : `${base}${source}`);
      document.body.replaceChildren();
      document.body.style.cssText = 'margin:0; min-height:100vh';
      window.cornerCase = { api, themes: {}, events: 0 };
      for (const slug of ['windows-31', 'beos-r503', 'system7-nostalgia-silver']) {
        window.cornerCase.themes[slug] = await api.loadTheme(`${base}/themes/${slug}`);
      }
    }, { base, built, source });
    for (const scale of [1, 2]) for (const hit of ['box', 'region']) {
      for (const axes of ['vertical', 'horizontal', 'both']) {
        await page.evaluate(async ({ scale, hit, axes }) => {
          const c = window.cornerCase;
          c.manager?.remove(c.host); c.host?.remove();
          c.manager = new c.api.WindowManager();
          c.content = document.createElement('div');
          c.content.style.cssText = 'width:100%;height:100%;box-sizing:border-box;overflow:auto';
          const child = document.createElement('div');
          child.style.width = axes === 'vertical' ? '20px' : '1600px';
          child.style.height = axes === 'horizontal' ? '20px' : '1600px';
          c.content.append(child);
          c.host = await c.manager.add(c.themes['windows-31'], { title: 'Corner regression', width: 240, height: 160, scale }, {}, { contentEl: c.content, hit });
          c.host.style.left = '30px'; c.host.style.top = '30px';
          document.body.append(c.host);
          c.host.addEventListener('scriptoscope:userresize', () => c.events++);
        }, { scale, hit, axes });
        // Same host and overlays traverse no artwork -> artwork -> no artwork.
        for (const slug of ['windows-31', 'system7-nostalgia-silver', 'beos-r503', 'windows-31']) {
          await page.evaluate(async slug => {
            const c = window.cornerCase;
            await c.manager.retheme(c.themes[slug]);
          }, slug);
          await page.waitForFunction(axes => {
            const root = window.cornerCase.host.shadowRoot;
            return ['vertical', 'horizontal'].every(axis => (axes === 'both' || axes === axis)
              ? !!root.querySelector(`[aria-orientation=${axis}] canvas`) : !root.querySelector(`[aria-orientation=${axis}]`));
          }, axes);
          const measured = await page.evaluate(() => {
            const c = window.cornerCase, root = c.host.shadowRoot;
            const win = root.querySelector('.scriptoscope-window'), composed = win._scriptoscopeComposed;
            const rect = el => el.getBoundingClientRect().toJSON();
            const bars = [...root.querySelectorAll('[role=scrollbar]')].map(el => ({ axis: el.getAttribute('aria-orientation'), ...rect(el) }));
            const content = rect(root.querySelector('.scriptoscope-content'));
            const grow = composed.growBox;
            return { bars, content, artwork: grow ? { x: grow.x, y: grow.y } : null, window: rect(win), events: c.events,
              clip: root.querySelector('button.scriptoscope-growbox').style.clipPath };
          });
          for (const bar of measured.bars) {
            const vertical = bar.axis === 'vertical';
            const edge = vertical ? 'bottom' : 'right';
            const artworkEdge = measured.artwork && (vertical
              ? measured.window.top + measured.artwork.y * scale
              : measured.window.left + measured.artwork.x * scale);
            const expected = Math.min(measured.content[edge] - (axes === 'both' ? 15 * scale : 0), artworkEdge ?? Infinity);
            assert.ok(Math.abs(bar[edge] - expected) <= 1, `${slug}/${scale}/${hit}/${axes}: ${bar.axis} ends at ${bar[edge]}, expected ${expected}`);
            // Pointer at the painted end remains a scrollbar owner (#524).
            const x = vertical ? bar.left + bar.width / 2 : bar.right - 2 * scale;
            const y = vertical ? bar.bottom - 2 * scale : bar.top + bar.height / 2;
            assert.equal(await page.evaluate(({ x, y }) => window.cornerCase.host.shadowRoot.elementFromPoint(x, y)?.closest('[role=scrollbar]')?.getAttribute('aria-orientation'), { x, y }), bar.axis);
            const before = await page.evaluate(vertical => window.cornerCase.content[vertical ? 'scrollTop' : 'scrollLeft'], vertical);
            await page.mouse.click(x, y);
            await page.waitForFunction(({ vertical, before }) => window.cornerCase.content[vertical ? 'scrollTop' : 'scrollLeft'] > before, { vertical, before });
            assert.equal(await page.evaluate(() => window.cornerCase.events), measured.events, 'arrow must not resize');
          }
          if (!measured.artwork) {
            // Exercise BOTH arms of the no-art L, away from its tiny outer square.
            for (const arm of ['bottom', 'right']) {
              const p = await page.evaluate(({ arm, scale }) => {
                const c = window.cornerCase, r = c.host.getBoundingClientRect();
                const x = r.right - (arm === 'bottom' ? 10 : 2) * scale;
                const y = r.bottom - (arm === 'right' ? 10 : 2) * scale;
                return { x, y, owner: !!c.host.shadowRoot.elementFromPoint(x, y)?.closest('button.scriptoscope-growbox'), width: r.width, height: r.height, events: c.events };
              }, { arm, scale });
              assert.equal(p.owner, true, `${slug}/${hit}: ${arm} frame strip resizes`);
              await page.mouse.move(p.x, p.y); await page.mouse.down();
              await page.mouse.move(p.x + 10 * scale, p.y + 8 * scale); await page.mouse.up();
              await page.waitForFunction(events => window.cornerCase.events > events, p.events);
              const after = await page.evaluate(() => { const r = window.cornerCase.host.getBoundingClientRect(); return { width: r.width, height: r.height }; });
              assert.ok(after.width > p.width && after.height > p.height, `${slug}: ${arm} drag changes size`);
            }
          } else {
            assert.equal(measured.clip, '', 'artwork retheme resets the retained button clip');
            const owner = await page.evaluate(({ x, y }) => {
              const c = window.cornerCase;
              return !!c.host.shadowRoot.elementFromPoint(x, y)?.closest('button.scriptoscope-growbox');
            }, { x: measured.window.left + measured.artwork.x * scale + 5 * scale,
              y: measured.window.top + measured.artwork.y * scale + 5 * scale });
            assert.equal(owner, true, 'artwork corner keeps its resize target');
          }
          await page.keyboard.press('Tab');
          const keyboardBefore = await page.evaluate(() => {
            const c = window.cornerCase, button = c.host.shadowRoot.querySelector('button.scriptoscope-growbox');
            button.focus();
            return { width: c.host.getBoundingClientRect().width, events: c.events,
              focused: button === c.host.shadowRoot.activeElement, visible: button.matches(':focus-visible') };
          });
          assert.equal(keyboardBefore.focused && keyboardBefore.visible, true, 'resize button remains keyboard-focusable with visible focus');
          await page.waitForFunction(() => !window.cornerCase.host.shadowRoot.querySelector('.scriptoscope-focus-ring').hidden);
          await page.keyboard.press('ArrowRight');
          await page.waitForFunction(events => window.cornerCase.events > events, keyboardBefore.events);
          await page.waitForFunction(width => window.cornerCase.host.getBoundingClientRect().width === width, keyboardBefore.width + 8 * scale);
        }
      }
    }
  } finally { await browser.close(); }
});
