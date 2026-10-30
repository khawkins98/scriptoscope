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
        wrap.append(button, Object.assign(document.createElement('span'), { id: 'press-away', tabIndex: 0, textContent: 'away', style: 'margin-left:40px' }));
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

      // A secondary-button press does not sink the face. Compared as inline face
      // styles, not pixels: a right-click also selects the label text.
      const faceStyle = () => button.evaluate(el => [el.style.background, el.style.boxShadow].join('|'));
      const restStyle = await faceStyle();
      await page.mouse.down({ button: 'right' });
      record.rightClickDoesNotPress = (await faceStyle()) === restStyle;
      await page.mouse.up({ button: 'right' });
      await button.evaluate(el => { el.blur(); getSelection().removeAllRanges(); });
      record.rightClickLeavesNormal = (await shot()).equals(normal);
      await page.mouse.move(cx, cy);

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
        await page.keyboard.down(key); // auto-repeat keydown
        record[`${key}HeldDiffers`] = !(await shot()).equals(focused);
        await page.keyboard.up(key);
        record[`${key}UpRestores`] = (await shot()).equals(focused);
        if (key === 'Space') await button.focus();
      }
      // Space held, then a pointer press and release on top: one press, so the
      // face is back at rest after both end. Compared as inline face styles,
      // because the mouse press changes focus-visible modality.
      await button.focus();
      await page.keyboard.down('Space');
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      record.spacePointerHeld = (await faceStyle()) !== restStyle;
      await page.mouse.up();
      await page.keyboard.up('Space');
      record.spacePointerRestores = (await faceStyle()) === restStyle;
      await page.mouse.move(0, 0);
      await button.focus();
      // Space held, then focus moves away before keyup: blur releases the face.
      const awayFocused = await (async () => { await page.locator('#press-away').focus(); return shot(); })();
      await button.focus();
      await page.keyboard.down('Space');
      record.blurHeldDiffers = !(await shot()).equals(focused);
      await page.locator('#press-away').focus();
      record.blurRestores = (await shot()).equals(awayFocused);
      await page.keyboard.up('Space');
      observations[slug] = record;
      pixels[slug] = { normal: sha(normal), held: sha(held) };
    }
    await attachObservations(testInfo, 'procedural-button-press', mode, { mode, observations, pixels });
    for (const slug of PROCEDURAL) expect(observations[slug], slug).toEqual({
      pointerHeldDiffers: true, pointerUpRestores: true, rightClickDoesNotPress: true, rightClickLeavesNormal: true, pointerLeaveRestores: true,
      pointerCancelHeldDiffers: true, pointerCancelRestores: true,
      SpaceHeldDiffers: true, SpaceUpRestores: true, EnterHeldDiffers: true, EnterUpRestores: true,
      spacePointerHeld: true, spacePointerRestores: true, blurHeldDiffers: true, blurRestores: true,
    });
    // Controls: the cicn painter path keeps its own press/release behaviour.
    for (const slug of CICN) expect(observations[slug], slug).toEqual(expect.objectContaining({
      pointerHeldDiffers: true, pointerUpRestores: true, pointerCancelRestores: true,
    }));
    await page.evaluate(() => { document.querySelector('#press-case')?.remove(); window.pressTheme?.dispose?.(); });
  });
}

// The public baselineButton must not rewrite consumer inline styles unless a press
// is active, and a release restores whatever was current when the press began.
for (const mode of ['source', 'built']) {
  test(`${mode}: baselineButton keeps consumer inline styles across hover, blur and press (#551)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async mode => {
      const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const b = runtime.baselineButton('OK', { default: true });
      document.body.append(b);
      b.style.background = 'red';
      b.style.boxShadow = 'none';
      const styles = () => [b.style.background, b.style.boxShadow];
      const consumer = styles();
      b.dispatchEvent(new PointerEvent('pointerenter'));
      b.dispatchEvent(new PointerEvent('pointerleave'));
      b.dispatchEvent(new PointerEvent('pointerup'));
      b.focus(); b.blur();
      b.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
      const afterIdle = styles();
      b.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
      const held = styles();
      b.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
      const afterRelease = styles();
      b.remove();
      return { consumer, afterIdle, held, afterRelease };
    }, mode);
    expect(result.afterIdle).toEqual(result.consumer);
    expect(result.held).not.toEqual(result.consumer);
    expect(result.afterRelease).toEqual(result.consumer);
  });
}

// Enter's native click fires on keydown, while the face is held. A consumer write
// made then must survive the keyup release.
for (const mode of ['source', 'built']) {
  test(`${mode}: baselineButton keeps a consumer style written during an Enter press (#551)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await page.evaluate(async mode => {
      const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const b = runtime.baselineButton('OK');
      b.id = 'consumer-write';
      b.addEventListener('click', () => { b.style.background = 'blue'; });
      document.body.append(b);
    }, mode);
    const button = page.locator('#consumer-write');
    await button.focus();
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    expect(await button.evaluate(el => el.style.background)).toBe('blue');
    await button.evaluate(el => el.remove());
  });
}
