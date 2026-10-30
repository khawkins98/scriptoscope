// #551: the procedural Platinum push button (baselineButton, used when a scheme
// has no admitted push face) must show a visible held state and return to its
// normal pixels on release, pointer leave/cancel and keyup. The held pixels are an
// interim compatibility policy, not decoded engine output (#218), so this checks
// only "differs while held, identical after release". Cicn-faced schemes are
// controls: they keep the painter path and their own pressed-cicn swap.
import { createHash } from 'node:crypto';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

const sha = buffer => createHash('sha256').update(buffer).digest('hex');

const PROCEDURAL = ['apple-platinum-2', 'platinum-8', 'black-platinum', 'slimes', 'system7-nostalgia-silver'];
const CICN = ['windows-95', 'beos-r503'];

for (const mode of ['source', 'built']) {
  test(`${mode}: procedural push buttons show a held state and release it (#551)`, async ({ page, servers }, testInfo) => {
    await openHarness(page, servers, mode);
    const observations = {}, pixels = {};
    for (const slug of [...PROCEDURAL, ...CICN]) {
      const kind = await page.evaluate(async ({ mode, slug }) => {
        const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        document.querySelector('#press-case')?.remove();
        window.pressTheme?.dispose?.();
        const theme = window.pressTheme = await runtime.loadTheme(`/themes/${slug}`);
        const wrap = document.createElement('div');
        wrap.id = 'press-case';
        Object.assign(wrap.style, { position: 'fixed', left: '20px', top: '20px', padding: '10px', background: '#ddd', zIndex: '10' });
        const button = await runtime.interactiveButton(theme, { label: 'Apply settings', default: true });
        button.id = 'press-button';
        wrap.append(button, Object.assign(document.createElement('span'), { id: 'press-away', textContent: 'away', style: 'margin-left:40px' }));
        document.body.append(wrap);
        return button.classList.contains('scriptoscope-button') ? 'painter' : 'baseline';
      }, { mode, slug });
      expect(kind, `${slug} button path`).toBe(PROCEDURAL.includes(slug) ? 'baseline' : 'painter');
      const button = page.locator('#press-button');
      const shot = () => page.locator('#press-case').screenshot({ animations: 'disabled', caret: 'hide' });
      const box = await button.boundingBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const away = await page.locator('#press-away').boundingBox();
      await page.mouse.move(cx, cy);
      const normal = await shot();
      const record = {};

      // Pointer press → release.
      await page.mouse.down();
      const held = await shot();
      await page.mouse.up();
      record.pointerHeldDiffers = !held.equals(normal);
      record.pointerUpRestores = (await shot()).equals(normal);

      // Pointer press → leave while held.
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(away.x + away.width / 2, away.y + away.height / 2);
      record.pointerLeaveRestores = (await shot()).equals(normal);
      await page.mouse.up();

      // Pointer press → cancel (the browser takes the pointer, e.g. a scroll gesture).
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      const heldAgain = await shot();
      await button.evaluate(el => el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 })));
      record.pointerCancelHeldDiffers = !heldAgain.equals(normal);
      record.pointerCancelRestores = (await shot()).equals(normal);
      await page.mouse.up();

      // Keyboard: Space and Enter, measured against the focused (focus-visible) baseline.
      await page.mouse.move(0, 0);
      await button.blur();
      await page.keyboard.press('Tab'); // establish keyboard modality, then focus the button
      await button.focus();
      const focused = await shot();
      for (const key of ['Space', 'Enter']) {
        await page.keyboard.down(key);
        record[`${key}HeldDiffers`] = !(await shot()).equals(focused);
        await page.keyboard.up(key);
        record[`${key}UpRestores`] = (await shot()).equals(focused);
        if (key === 'Space') await button.focus();
      }
      observations[slug] = record;
      pixels[slug] = { normal: sha(normal), held: sha(held) };
    }
    await attachObservations(testInfo, 'procedural-button-press', mode, { mode, observations, pixels });
    for (const slug of PROCEDURAL) expect(observations[slug], slug).toEqual({
      pointerHeldDiffers: true, pointerUpRestores: true, pointerLeaveRestores: true,
      pointerCancelHeldDiffers: true, pointerCancelRestores: true,
      SpaceHeldDiffers: true, SpaceUpRestores: true, EnterHeldDiffers: true, EnterUpRestores: true,
    });
    // Controls: the cicn painter path keeps its own press/release behaviour.
    for (const slug of CICN) expect(observations[slug], slug).toEqual(expect.objectContaining({
      pointerHeldDiffers: true, pointerUpRestores: true, pointerCancelRestores: true,
    }));
    await page.evaluate(() => { document.querySelector('#press-case')?.remove(); window.pressTheme?.dispose?.(); });
  });
}
