import { test, expect, type Page } from '@playwright/test';

// Behavioral test suite for the WM core (issue #10). Verifies the full
// Phase 1 behavior surface against the AaronWindow class as it runs in
// a real browser. Where AaronWindow.test.ts is the white-box unit
// coverage, this file is the black-box behavioral coverage — what a
// downstream consumer actually experiences.

function toBeCloseToLoose(actual: number, expected: number, tolerance = 5): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

// Single-time setup — fresh fixture load per test, ensures clean WM state.
async function freshFixture(page: Page): Promise<void> {
  await page.goto('/wm-fixture.html');
  await page.evaluate(() => (window as unknown as { clearEvents: () => void }).clearEvents());
}

test.describe('WM core behavior (issue #10)', () => {
  test.describe('8-direction resize', () => {
    const cases: Array<{ dir: string; dx: number; dy: number; expectW: number; expectH: number; expectLeftDelta: number; expectTopDelta: number }> = [
      { dir: 'se', dx:  60, dy:  40, expectW:  60, expectH:  40, expectLeftDelta: 0,  expectTopDelta: 0 },
      { dir: 'sw', dx: -60, dy:  40, expectW:  60, expectH:  40, expectLeftDelta: -60, expectTopDelta: 0 },
      { dir: 'ne', dx:  60, dy: -40, expectW:  60, expectH:  40, expectLeftDelta: 0,  expectTopDelta: -40 },
      { dir: 'nw', dx: -60, dy: -40, expectW:  60, expectH:  40, expectLeftDelta: -60, expectTopDelta: -40 },
      { dir: 'e',  dx:  60, dy:   0, expectW:  60, expectH:   0, expectLeftDelta: 0,  expectTopDelta: 0 },
      { dir: 'w',  dx: -60, dy:   0, expectW:  60, expectH:   0, expectLeftDelta: -60, expectTopDelta: 0 },
      { dir: 's',  dx:   0, dy:  40, expectW:   0, expectH:  40, expectLeftDelta: 0,  expectTopDelta: 0 },
      { dir: 'n',  dx:   0, dy: -40, expectW:   0, expectH:  40, expectLeftDelta: 0,  expectTopDelta: -40 },
    ];
    for (const c of cases) {
      test(`drag ${c.dir} handle`, async ({ page }) => {
        await freshFixture(page);
        // Use window A — focus it first so it's on top
        const a = page.locator('.aaron-window').first();
        await a.click({ position: { x: 20, y: 20 } });
        const before = await a.boundingBox();
        const handle = a.locator(`[data-handle="${c.dir}"]`);
        const hb = await handle.boundingBox();
        expect(hb).not.toBeNull();
        const fromX = hb!.x + hb!.width / 2;
        const fromY = hb!.y + hb!.height / 2;
        await page.mouse.move(fromX, fromY);
        await page.mouse.down();
        await page.mouse.move(fromX + c.dx, fromY + c.dy, { steps: 5 });
        await page.mouse.up();
        const after = await a.boundingBox();
        toBeCloseToLoose(after!.width - before!.width, c.expectW);
        toBeCloseToLoose(after!.height - before!.height, c.expectH);
        toBeCloseToLoose(after!.x - before!.x, c.expectLeftDelta);
        toBeCloseToLoose(after!.y - before!.y, c.expectTopDelta);
      });
    }
  });

  test.describe('close', () => {
    test('close() removes the window from DOM and fires onclose', async ({ page }) => {
      await freshFixture(page);
      await expect(page.locator('.aaron-window')).toHaveCount(3);
      await page.evaluate(() => (window as unknown as { windows: { a: { close: () => void } } }).windows.a.close());
      await expect(page.locator('.aaron-window')).toHaveCount(2);
      const events = await page.evaluate(() => (window as unknown as { events: unknown[] }).events);
      const closeEvents = (events as Array<{ type: string }>).filter(e => e.type === 'close');
      expect(closeEvents).toHaveLength(1);
    });

    test('unmount() removes but does NOT fire onclose', async ({ page }) => {
      await freshFixture(page);
      await page.evaluate(() => (window as unknown as { windows: { a: { unmount: () => void } } }).windows.a.unmount());
      const events = await page.evaluate(() => (window as unknown as { events: unknown[] }).events);
      const closeEvents = (events as Array<{ type: string }>).filter(e => e.type === 'close');
      expect(closeEvents).toHaveLength(0);
    });
  });

  test.describe('windowshade (minimize/restore)', () => {
    test('minimize() sets data-state="collapsed"', async ({ page }) => {
      await freshFixture(page);
      const a = page.locator('.aaron-window').first();
      await page.evaluate(() => (window as unknown as { windows: { a: { minimize: () => void } } }).windows.a.minimize());
      await expect(a).toHaveAttribute('data-state', 'collapsed');
    });

    test('restore() returns data-state to active/inactive', async ({ page }) => {
      await freshFixture(page);
      const a = page.locator('.aaron-window').first();
      await page.evaluate(() => {
        const w = (window as unknown as { windows: { a: { minimize: () => void; restore: () => void; focus: () => void } } }).windows.a;
        w.minimize();
        w.focus(); // ensure focused so restore goes to "active"
        w.restore();
      });
      await expect(a).toHaveAttribute('data-state', 'active');
    });
  });

  test.describe('z-order / raise-on-click', () => {
    test('clicking a buried window raises it + flips data-state', async ({ page }) => {
      await freshFixture(page);
      const a = page.locator('.aaron-window').first();
      const c = page.locator('.aaron-window').nth(2);
      await expect(c).toHaveAttribute('data-state', 'active');
      await a.click({ position: { x: 20, y: 20 } });
      await expect(a).toHaveAttribute('data-state', 'active');
      await expect(c).toHaveAttribute('data-state', 'inactive');
      // Z-index ordering
      const aZ = await a.evaluate(el => parseInt((el as HTMLElement).style.zIndex || '0', 10));
      const cZ = await c.evaluate(el => parseInt((el as HTMLElement).style.zIndex || '0', 10));
      expect(aZ).toBeGreaterThan(cZ);
    });
  });

  test.describe('stress', () => {
    test('rapid-fire drag does not crash or lose position', async ({ page }) => {
      await freshFixture(page);
      const a = page.locator('.aaron-window').first();
      await a.click({ position: { x: 20, y: 20 } });
      const before = await a.boundingBox();
      const tb = a.locator('.aaron-titlebar');
      const tbBox = await tb.boundingBox();
      expect(tbBox).not.toBeNull();
      const fromX = tbBox!.x + tbBox!.width / 2;
      const fromY = tbBox!.y + tbBox!.height / 2;
      await page.mouse.move(fromX, fromY);
      await page.mouse.down();
      // 30 rapid micro-moves in a zigzag
      for (let i = 0; i < 30; i++) {
        const ox = (i % 2 === 0) ? 5 : -5;
        const oy = (i % 3 === 0) ? 5 : -5;
        await page.mouse.move(fromX + ox * (i + 1), fromY + oy * (i + 1));
      }
      await page.mouse.move(fromX + 50, fromY + 50);
      await page.mouse.up();
      const after = await a.boundingBox();
      // Final position should reflect the last move, not anything in the middle.
      toBeCloseToLoose(after!.x - before!.x, 50, 10);
      toBeCloseToLoose(after!.y - before!.y, 50, 10);
    });
  });

  test.describe('callbacks', () => {
    test('onmove fires during drag', async ({ page }) => {
      await freshFixture(page);
      const a = page.locator('.aaron-window').first();
      await a.click({ position: { x: 20, y: 20 } });
      await page.evaluate(() => (window as unknown as { clearEvents: () => void }).clearEvents());
      const tb = a.locator('.aaron-titlebar');
      const tbBox = await tb.boundingBox();
      expect(tbBox).not.toBeNull();
      const fromX = tbBox!.x + tbBox!.width / 2;
      const fromY = tbBox!.y + tbBox!.height / 2;
      await page.mouse.move(fromX, fromY);
      await page.mouse.down();
      await page.mouse.move(fromX + 50, fromY + 50, { steps: 5 });
      await page.mouse.up();
      const moveEvents = await page.evaluate(() => {
        const events = (window as unknown as { events: Array<{ type: string }> }).events;
        return events.filter(e => e.type === 'move').length;
      });
      expect(moveEvents).toBeGreaterThan(0);
    });

    test('onresize fires during resize', async ({ page }) => {
      await freshFixture(page);
      const a = page.locator('.aaron-window').first();
      await a.click({ position: { x: 20, y: 20 } });
      await page.evaluate(() => (window as unknown as { clearEvents: () => void }).clearEvents());
      const se = a.locator('[data-handle="se"]');
      const hb = await se.boundingBox();
      expect(hb).not.toBeNull();
      const fromX = hb!.x + hb!.width / 2;
      const fromY = hb!.y + hb!.height / 2;
      await page.mouse.move(fromX, fromY);
      await page.mouse.down();
      await page.mouse.move(fromX + 50, fromY + 50, { steps: 5 });
      await page.mouse.up();
      const resizeEvents = await page.evaluate(() => {
        const events = (window as unknown as { events: Array<{ type: string }> }).events;
        return events.filter(e => e.type === 'resize').length;
      });
      expect(resizeEvents).toBeGreaterThan(0);
    });
  });
});
