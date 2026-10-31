import { expect } from '@playwright/test';
import { test, openHarness } from './fixtures.mjs';

// #569: a host that is already out of flow (absolute or fixed) but has no
// inline left/top sits where consumer CSS or its static position put it. The
// first title-bar drag or arrow-key move must start from that spot, not from
// (0, 0), and must not insert the in-flow drag placeholder. A press alone
// still moves nothing (#561).

const CSS = `
  #o-stage { position: absolute; left: 20px; top: 20px; z-index: 1000; width: 900px; height: 640px;
    margin: 0; padding: 10px; border: 3px solid #888; background: #fff; }
  #o-stage.scaled { transform: scale(0.75); transform-origin: 0 0; }
  #o-stage .o-spacer { height: 40px; }
  .o-abs { position: absolute; }
  .o-fix { position: fixed; }
  .o-px { left: 16px; top: 16px; }
  .o-pct { left: 10%; top: 5%; }
  .o-fixed { left: 1000px; top: 200px; }
`;

// Each case builds one window: imperative hosts come from manager.add, which
// sets an inline position: absolute and no left/top; the declarative one is in
// flow by default, so the consumer's class makes it absolute.
const CASES = {
  'consumer CSS left/top in px': { cls: 'o-px' },
  'consumer CSS left/top in %': { cls: 'o-pct' },
  'left/top auto (static position)': { cls: '' },
  'consumer CSS px under a scale(0.75) ancestor': { cls: 'o-px', scaled: true },
  'declarative window made absolute by a consumer class': { cls: 'o-abs o-px', declarative: true },
  'position: fixed host on a scrolled page': { cls: 'o-fixed', fixed: true },
  'declarative window made fixed by a consumer class on a scrolled page': { cls: 'o-fix o-fixed', declarative: true, fixed: true },
};

async function setup(page, servers, mode) {
  await openHarness(page, servers, mode);
  await page.evaluate(async ({ mode, css }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const declarative = await import(mode === 'source' ? '/src/declarative/index.ts' : '/dist/declarative.js');
    const theme = await api.loadTheme('/themes/windows-95');
    const manager = new api.WindowManager();
    const changes = new Map();
    manager.setChangeListener(host => changes.set(host, (changes.get(host) ?? 0) + 1));
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    const tall = document.createElement('div');
    tall.style.cssText = 'height: 4000px';
    document.body.append(tall);
    const settle = async () => {
      await new Promise(r => setTimeout(r, 300));
      for (let i = 0; i < 2; i++) await new Promise(r => requestAnimationFrame(r));
    };
    let dispose = () => {};
    const make = async ({ cls, scaled, declarative: decl, fixed }) => {
      dispose();
      scrollTo(0, fixed ? 60 : 0);
      const stage = document.createElement('div');
      stage.id = 'o-stage';
      if (scaled) stage.classList.add('scaled');
      stage.innerHTML = '<div class="o-spacer"></div>';
      document.body.prepend(stage);
      let host, unmount;
      if (decl) {
        const source = document.createElement('article');
        source.className = cls;
        source.dataset.scriptoscopeWindow = '';
        source.dataset.scriptoscopeTitle = 'Declarative';
        source.style.cssText = 'width: 220px; height: 120px';
        source.textContent = 'Absolute by class';
        stage.append(source);
        const win = await declarative.ScriptoscopeWindow.promote(source, { manager, theme });
        host = win.host; unmount = () => win.unmount();
      } else {
        const content = document.createElement('div');
        content.textContent = 'Imperative';
        host = await manager.add(theme, { title: 'Imperative', width: 220, height: 120 }, {}, { contentEl: content });
        if (cls) host.className = cls;
        if (fixed) host.style.position = 'fixed';
        (fixed ? document.body : stage).append(host);
        unmount = () => manager.remove(host);
      }
      dispose = () => { unmount(); host.remove(); stage.remove(); };
      await settle();
      changes.clear();
      window.__host = host;
    };
    const read = () => {
      const host = window.__host;
      const r = host.getBoundingClientRect();
      const grip = host.shadowRoot.querySelector('.scriptoscope-movehandle').getBoundingClientRect();
      return {
        x: r.x, y: r.y, left: host.style.left, top: host.style.top,
        position: getComputedStyle(host).position,
        grip: { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 },
        placeholders: document.querySelectorAll('[data-scriptoscope-placeholder]').length,
        changes: changes.get(host) ?? 0,
      };
    };
    const key = async k => {
      window.__host.shadowRoot.querySelector('.scriptoscope-movehandle')
        .dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      await settle();
    };
    window.__o = { make, read, key, settle };
  }, { mode, css: CSS });
}

const read = page => page.evaluate(() => window.__o.read());
const settle = page => page.evaluate(() => window.__o.settle());

function expectAt(after, before, dx, dy, why) {
  expect.soft(after.x - before.x, `${why}: x moved by`).toBeCloseTo(dx, 1);
  expect.soft(after.y - before.y, `${why}: y moved by`).toBeCloseTo(dy, 1);
  expect.soft(after.placeholders, `${why}: placeholder inserted for an out-of-flow host`).toBe(before.placeholders);
  expect.soft(after.position, `${why}: computed position`).toBe(before.position);
}

for (const mode of ['source', 'built']) {
  for (const [name, spec] of Object.entries(CASES)) {
    test(`${mode}: ${name}: first drag and arrow key start from where the window sits (#569)`, async ({ page, servers }) => {
      await setup(page, servers, mode);
      // Screen pixels per CSS pixel: a local step of 8 shows as 6 under scale(0.75).
      const s = spec.scaled ? 0.75 : 1;

      // Arrow keys on a fresh window: one step each from its real place, one commit each.
      await page.evaluate(c => window.__o.make(c), spec);
      let before = await read(page);
      expect(before.left, `${name}: no inline left before the move`).toBe('');
      expect(before.position).toBe(spec.fixed ? 'fixed' : 'absolute');
      await page.evaluate(() => window.__o.key('ArrowRight'));
      let after = await read(page);
      expectAt(after, before, 8 * s, 0, `${name} ArrowRight`);
      expect.soft(after.changes, `${name} ArrowRight: commits once`).toBe(1);
      await page.evaluate(() => window.__o.key('ArrowDown'));
      expectAt(await read(page), before, 8 * s, 8 * s, `${name} ArrowRight then ArrowDown`);

      // Pointer on a fresh window: a press moves nothing; the drag follows the pointer exactly.
      await page.evaluate(c => window.__o.make(c), spec);
      before = await read(page);
      expect(before.left, `${name}: no inline left before the drag`).toBe('');
      const p = before.grip;
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await settle(page);
      const pressed = await read(page);
      expectAt(pressed, before, 0, 0, `${name} pointerdown`);
      expect.soft([pressed.left, pressed.top], `${name} pointerdown: left/top written`).toEqual(['', '']);
      await page.mouse.move(p.x + 15, p.y + 12, { steps: 3 });
      await page.mouse.move(p.x + 30, p.y + 24, { steps: 3 });
      expectAt(await read(page), before, 30, 24, `${name} mid-drag`);
      await page.mouse.up();
      await settle(page);
      after = await read(page);
      expectAt(after, before, 30, 24, `${name} after release`);
      expect.soft(after.changes, `${name} drag: commits once`).toBe(1);
    });
  }
}
