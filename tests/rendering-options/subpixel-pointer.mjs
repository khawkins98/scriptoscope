// Sub-pixel moves of a pressed mouse (#577, #579, #588).
//
// Playwright's Chromium mouse keeps fractional CSS px: page.mouse.move(x + 0.4)
// arrives with clientX x + 0.4. Its Firefox and WebKit mice floor to whole CSS
// px, so x + 0.4 arrives as x and x - 0.4 as x - 1: a real 1 px move. A spec
// that means "jitter under the rounding threshold" would then test a 1 px drag.
//
// The capability is probed, not assumed from the browser name (Chromium must keep
// fractions, so a probe that sends it down the synthetic path fails the test). Where the mouse
// keeps the fraction, the moves go through page.mouse unchanged. Where it does
// not, they are sent as the pressed pointer's own PointerEvents (its pointerId,
// buttons 1) at the element it pressed, offset from its pointerdown position.
// The product rounds whatever clientX it receives, so both paths exercise the
// same threshold.

import { expect } from '@playwright/test';

const keepsFractions = new WeakMap();

/** Whether page.mouse delivers fractional clientX. Probed once per page by hovering a whole px near `p`, then + 0.4 px. */
export async function mouseKeepsFractions(page, p) {
  if (keepsFractions.has(page)) return keepsFractions.get(page);
  // From a whole px, so a floored mouse can never land within tolerance of x + 0.4.
  const x = Math.floor(p.x);
  await page.mouse.move(x, p.y);
  await page.evaluate(() => {
    const xs = [], on = e => xs.push(e.clientX);
    addEventListener('pointermove', on, true);
    window.__subpixelProbe = () => { removeEventListener('pointermove', on, true); delete window.__subpixelProbe; return xs; };
  });
  await page.mouse.move(x + 0.4, p.y);
  const xs = await page.evaluate(() => window.__subpixelProbe());
  await page.mouse.move(p.x, p.y);
  // A floored mouse reports a whole px, or no move at all when the floors are equal.
  const keeps = xs.some(cx => Math.abs(cx - (x + 0.4)) < 0.05);
  if (page.context().browser()?.browserType().name() === 'chromium')
    expect(keeps, 'Chromium mouse keeps fractional clientX (else sub-pixel moves would silently go synthetic)').toBe(true);
  keepsFractions.set(page, keeps);
  return keeps;
}

/** Press the primary button at `p`, recording the pointerdown so `movePressed` can follow it. */
export async function pressAt(page, p) {
  await mouseKeepsFractions(page, p);
  await page.mouse.move(p.x, p.y);
  await page.evaluate(() => {
    window.__subpixelDown = undefined;
    addEventListener('pointerdown', e => {
      window.__subpixelDown = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, target: e.composedPath()[0] };
    }, { capture: true, once: true });
  });
  await page.mouse.down();
}

/** Move the pressed pointer to `p` + each [dx, dy] in turn (`p` is where `pressAt` pressed). */
export async function movePressed(page, p, offsets) {
  if (await mouseKeepsFractions(page, p)) {
    for (const [dx, dy] of offsets) await page.mouse.move(p.x + dx, p.y + dy);
    return;
  }
  await page.evaluate(offsets => {
    const down = window.__subpixelDown;
    if (!down) throw Error('movePressed: no recorded pointerdown (press with pressAt)');
    const { pointerId, x, y, target } = down;
    for (const [dx, dy] of offsets) target.dispatchEvent(new PointerEvent('pointermove', { pointerId, pointerType: 'mouse',
      isPrimary: true, buttons: 1, clientX: x + dx, clientY: y + dy, bubbles: true, composed: true }));
  }, offsets);
}
