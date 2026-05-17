import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AaronWindow } from './AaronWindow.js';

describe('AaronWindow', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('applies sensible defaults with no options', () => {
      const w = new AaronWindow();
      expect(w.options.title).toBe('');
      expect(w.options.x).toBe(100);
      expect(w.options.y).toBe(100);
      expect(w.options.width).toBe(320);
      expect(w.options.height).toBe(200);
      expect(w.options.html).toBe('');
    });

    it('uses provided options when given', () => {
      const w = new AaronWindow({
        title: 'Hello',
        x: 50,
        y: 60,
        width: 400,
        height: 300,
      });
      expect(w.options.title).toBe('Hello');
      expect(w.options.x).toBe(50);
      expect(w.options.y).toBe(60);
      expect(w.options.width).toBe(400);
      expect(w.options.height).toBe(300);
    });

    it('does not touch the DOM at construction time', () => {
      const before = document.body.children.length;
      new AaronWindow({ title: 'Welcome' });
      expect(document.body.children.length).toBe(before);
    });

    it('freezes options to prevent mutation', () => {
      const w = new AaronWindow({ title: 'X' });
      expect(Object.isFrozen(w.options)).toBe(true);
    });

    it('isMounted is false before mount()', () => {
      const w = new AaronWindow();
      expect(w.isMounted).toBe(false);
      expect(w.element).toBeNull();
      expect(w.content).toBeNull();
    });
  });

  describe('mount()', () => {
    it('creates window DOM and appends to document.body by default', () => {
      const w = new AaronWindow({ title: 'Test' });
      w.mount();
      expect(w.isMounted).toBe(true);
      expect(w.element).not.toBeNull();
      expect(document.body.contains(w.element)).toBe(true);
    });

    it('appends to a provided parent element', () => {
      const parent = document.createElement('section');
      document.body.appendChild(parent);
      const w = new AaronWindow({ title: 'Scoped' });
      w.mount(parent);
      expect(parent.contains(w.element)).toBe(true);
      expect(document.body.firstElementChild).toBe(parent);
    });

    it('uses options.mount as the default parent when set', () => {
      const parent = document.createElement('aside');
      document.body.appendChild(parent);
      const w = new AaronWindow({ title: 'Sidebar', mount: parent });
      w.mount();
      expect(parent.contains(w.element)).toBe(true);
    });

    it('explicit parent argument overrides options.mount', () => {
      const optionParent = document.createElement('aside');
      const explicitParent = document.createElement('section');
      document.body.append(optionParent, explicitParent);
      const w = new AaronWindow({ title: 'Override', mount: optionParent });
      w.mount(explicitParent);
      expect(explicitParent.contains(w.element)).toBe(true);
      expect(optionParent.contains(w.element)).toBe(false);
    });

    it('returns this for chaining', () => {
      const w = new AaronWindow();
      expect(w.mount()).toBe(w);
    });

    it('is idempotent — double mount() is a no-op', () => {
      const w = new AaronWindow({ title: 'Once' });
      w.mount();
      const firstEl = w.element;
      w.mount();
      expect(w.element).toBe(firstEl);
      expect(document.querySelectorAll('[data-aaron-window]')).toHaveLength(1);
    });

    it('emits the documented chrome DOM structure', () => {
      const w = new AaronWindow({ title: 'Welcome' });
      w.mount();
      const el = w.element!;
      expect(el.classList.contains('aaron-window')).toBe(true);
      expect(el.getAttribute('data-aaron-window')).toBe('');
      expect(el.getAttribute('data-state')).toBe('active');
      expect(el.querySelector('.aaron-titlebar')).not.toBeNull();
      expect(el.querySelector('.aaron-titlebar__title')).not.toBeNull();
      expect(el.querySelector('.aaron-content')).not.toBeNull();
    });

    it('renders the title text', () => {
      const w = new AaronWindow({ title: 'Welcome' });
      w.mount();
      const titleText = w.element!.querySelector('.aaron-titlebar__title span')?.textContent;
      expect(titleText).toBe('Welcome');
    });

    it('renders html content into the body', () => {
      const w = new AaronWindow({ title: 'Doc', html: '<p>Hello <strong>world</strong></p>' });
      w.mount();
      const content = w.content!;
      expect(content.querySelector('strong')?.textContent).toBe('world');
    });

    it('applies x/y/width/height as inline styles', () => {
      const w = new AaronWindow({ x: 50, y: 60, width: 400, height: 300 });
      w.mount();
      const style = w.element!.style;
      expect(style.left).toBe('50px');
      expect(style.top).toBe('60px');
      expect(style.width).toBe('400px');
      expect(style.height).toBe('300px');
      expect(style.position).toBe('absolute');
    });
  });

  describe('unmount()', () => {
    it('removes the window from the DOM', () => {
      const w = new AaronWindow({ title: 'Bye' });
      w.mount();
      const el = w.element!;
      w.unmount();
      expect(document.body.contains(el)).toBe(false);
      expect(w.isMounted).toBe(false);
      expect(w.element).toBeNull();
      expect(w.content).toBeNull();
    });

    it('returns this for chaining', () => {
      const w = new AaronWindow();
      w.mount();
      expect(w.unmount()).toBe(w);
    });

    it('is idempotent — double unmount() is safe', () => {
      const w = new AaronWindow({ title: 'Twice' });
      w.mount();
      w.unmount();
      expect(() => w.unmount()).not.toThrow();
      expect(w.isMounted).toBe(false);
    });

    it('is safe to call without ever mounting', () => {
      const w = new AaronWindow();
      expect(() => w.unmount()).not.toThrow();
      expect(w.isMounted).toBe(false);
    });

    it('can be re-mounted after unmount()', () => {
      const w = new AaronWindow({ title: 'Cycle' });
      w.mount();
      w.unmount();
      w.mount();
      expect(w.isMounted).toBe(true);
      expect(document.querySelectorAll('[data-aaron-window]')).toHaveLength(1);
    });
  });

  describe('callbacks', () => {
    it('accepts an onclose callback option (not invoked here — close behaviour is issue #7)', () => {
      const onclose = vi.fn();
      const w = new AaronWindow({ onclose });
      expect(w.options.onclose).toBe(onclose);
      // The handler isn't invoked by mount/unmount; close() in issue #7 will.
      w.mount();
      w.unmount();
      expect(onclose).not.toHaveBeenCalled();
    });

    it('fires oncreate after mount() succeeds', () => {
      const oncreate = vi.fn();
      const w = new AaronWindow({ title: 'Cre', oncreate });
      expect(oncreate).not.toHaveBeenCalled();
      w.mount();
      expect(oncreate).toHaveBeenCalledTimes(1);
    });

    it('oncreate fires only once per mount, even with double mount()', () => {
      const oncreate = vi.fn();
      const w = new AaronWindow({ oncreate });
      w.mount();
      w.mount();
      expect(oncreate).toHaveBeenCalledTimes(1);
    });

    it('oncreate is invoked with `this` bound to the AaronWindow', () => {
      let captured: unknown = null;
      const w = new AaronWindow({
        oncreate(this: AaronWindow) {
          captured = this;
        },
      });
      w.mount();
      expect(captured).toBe(w);
    });

    it('accepts onfocus/onblur/onmove/onresize options (placeholders for #4/#5/#6)', () => {
      const onfocus = vi.fn();
      const onblur = vi.fn();
      const onmove = vi.fn();
      const onresize = vi.fn();
      const w = new AaronWindow({ onfocus, onblur, onmove, onresize });
      expect(w.options.onfocus).toBe(onfocus);
      expect(w.options.onblur).toBe(onblur);
      expect(w.options.onmove).toBe(onmove);
      expect(w.options.onresize).toBe(onresize);
    });
  });

  describe('WinBox option compatibility (issue #3)', () => {
    it('accepts root as an alias for mount', () => {
      const parent = document.createElement('aside');
      document.body.appendChild(parent);
      const w = new AaronWindow({ root: parent });
      w.mount();
      expect(parent.contains(w.element)).toBe(true);
    });

    it('mount wins over root if both provided', () => {
      const mountParent = document.createElement('aside');
      const rootParent = document.createElement('section');
      document.body.append(mountParent, rootParent);
      const w = new AaronWindow({ mount: mountParent, root: rootParent });
      w.mount();
      expect(mountParent.contains(w.element)).toBe(true);
      expect(rootParent.contains(w.element)).toBe(false);
    });

    it('applies background option as inline style', () => {
      const w = new AaronWindow({ background: 'rgb(10, 20, 30)' });
      w.mount();
      expect(w.element!.style.background).toBe('rgb(10, 20, 30)');
    });

    it('applies numeric border as `Npx solid`', () => {
      const w = new AaronWindow({ border: 3 });
      w.mount();
      // jsdom normalises border shorthand; check via cssText for robustness
      expect(w.element!.style.cssText).toContain('border: 3px solid');
    });

    it('applies string border as-is', () => {
      const w = new AaronWindow({ border: '2px dashed red' });
      w.mount();
      expect(w.element!.style.cssText).toContain('border: 2px dashed red');
    });

    it('accepts string class and adds class names', () => {
      const w = new AaronWindow({ class: 'foo bar' });
      w.mount();
      expect(w.element!.classList.contains('foo')).toBe(true);
      expect(w.element!.classList.contains('bar')).toBe(true);
      expect(w.element!.classList.contains('aaron-window')).toBe(true);
    });

    it('accepts array class and adds class names', () => {
      const w = new AaronWindow({ class: ['baz', 'qux'] });
      w.mount();
      expect(w.element!.classList.contains('baz')).toBe(true);
      expect(w.element!.classList.contains('qux')).toBe(true);
    });

  });

  describe('drag (issue #4)', () => {
    // Helper: dispatch a pointer event. jsdom doesn't fully implement
    // PointerEvent's constructor, so we synthesise one off MouseEvent and
    // tack on the pointer-specific properties.
    function pointer(type: string, target: EventTarget, opts: Partial<MouseEventInit & { pointerId: number }> = {}): void {
      const { pointerId = 1, ...mouseOpts } = opts;
      const e = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...mouseOpts,
      });
      Object.defineProperty(e, 'pointerId', { value: pointerId });
      target.dispatchEvent(e);
    }

    it('sets grab cursor on the titlebar', () => {
      const w = new AaronWindow({ title: 'Drag' });
      w.mount();
      const titlebar = w.element!.querySelector('.aaron-titlebar') as HTMLElement;
      expect(titlebar.style.cursor).toBe('grab');
    });

    it('pointerdown on titlebar starts drag; pointermove updates position', () => {
      const w = new AaronWindow({ title: 'Drag', x: 100, y: 80, width: 320, height: 200 });
      w.mount();
      const titlebar = w.element!.querySelector('.aaron-titlebar') as HTMLElement;
      // Stub getBoundingClientRect since jsdom layout is zero-sized by default
      vi.spyOn(w.element!, 'getBoundingClientRect').mockReturnValue({
        x: 100, y: 80, left: 100, top: 80, right: 420, bottom: 280,
        width: 320, height: 200, toJSON: () => ({}),
      });
      // Down at (200, 100) — grab offset = (200-100, 100-80) = (100, 20)
      pointer('pointerdown', titlebar, { clientX: 200, clientY: 100 });
      // Move to (300, 200) — new pos = (300-100, 200-20) = (200, 180)
      pointer('pointermove', document, { clientX: 300, clientY: 200 });
      expect(w.element!.style.left).toBe('200px');
      expect(w.element!.style.top).toBe('180px');
    });

    it('pointerup ends drag; further pointermove does nothing', () => {
      const w = new AaronWindow({ x: 100, y: 80 });
      w.mount();
      const titlebar = w.element!.querySelector('.aaron-titlebar') as HTMLElement;
      vi.spyOn(w.element!, 'getBoundingClientRect').mockReturnValue({
        x: 100, y: 80, left: 100, top: 80, right: 420, bottom: 280,
        width: 320, height: 200, toJSON: () => ({}),
      });
      pointer('pointerdown', titlebar, { clientX: 200, clientY: 100 });
      pointer('pointermove', document, { clientX: 300, clientY: 200 });
      pointer('pointerup', document);
      // Move after up — should NOT update position
      pointer('pointermove', document, { clientX: 500, clientY: 400 });
      expect(w.element!.style.left).toBe('200px');
      expect(w.element!.style.top).toBe('180px');
      // Cursor restored
      expect(titlebar.style.cursor).toBe('grab');
    });

    it('fires onmove with new coordinates during drag', () => {
      const onmove = vi.fn();
      const w = new AaronWindow({ x: 100, y: 80, onmove });
      w.mount();
      const titlebar = w.element!.querySelector('.aaron-titlebar') as HTMLElement;
      vi.spyOn(w.element!, 'getBoundingClientRect').mockReturnValue({
        x: 100, y: 80, left: 100, top: 80, right: 420, bottom: 280,
        width: 320, height: 200, toJSON: () => ({}),
      });
      pointer('pointerdown', titlebar, { clientX: 200, clientY: 100 });
      pointer('pointermove', document, { clientX: 250, clientY: 150 });
      expect(onmove).toHaveBeenCalledWith(150, 130);
    });

    it('ignores non-primary buttons (right click etc.)', () => {
      const w = new AaronWindow({ x: 100, y: 80 });
      w.mount();
      const titlebar = w.element!.querySelector('.aaron-titlebar') as HTMLElement;
      pointer('pointerdown', titlebar, { clientX: 200, clientY: 100, button: 2 });
      pointer('pointermove', document, { clientX: 500, clientY: 500 });
      // No drag should have started; left/top should remain unchanged
      expect(w.element!.style.left).toBe('100px');
    });

    it('ignores pointerdown on editable child elements', () => {
      const w = new AaronWindow({ x: 100, y: 80 });
      w.mount();
      const titlebar = w.element!.querySelector('.aaron-titlebar') as HTMLElement;
      const input = document.createElement('input');
      titlebar.appendChild(input);
      pointer('pointerdown', input, { clientX: 200, clientY: 100 });
      pointer('pointermove', document, { clientX: 500, clientY: 500 });
      expect(w.element!.style.left).toBe('100px');
    });

    it('ignores pointerdown on a chrome widget ([data-action] element)', () => {
      const w = new AaronWindow({ x: 100, y: 80 });
      w.mount();
      const titlebar = w.element!.querySelector('.aaron-titlebar') as HTMLElement;
      const closeBtn = document.createElement('button');
      closeBtn.setAttribute('data-action', 'close');
      titlebar.appendChild(closeBtn);
      pointer('pointerdown', closeBtn, { clientX: 200, clientY: 100 });
      pointer('pointermove', document, { clientX: 500, clientY: 500 });
      expect(w.element!.style.left).toBe('100px');
    });

    it('clamps the window position to stay onscreen', () => {
      const w = new AaronWindow({ x: 100, y: 80, width: 320, height: 200 });
      w.mount();
      const titlebar = w.element!.querySelector('.aaron-titlebar') as HTMLElement;
      vi.spyOn(w.element!, 'getBoundingClientRect').mockReturnValue({
        x: 100, y: 80, left: 100, top: 80, right: 420, bottom: 280,
        width: 320, height: 200, toJSON: () => ({}),
      });
      // jsdom default viewport is 1024x768. With window 320x200, max is (704, 568).
      pointer('pointerdown', titlebar, { clientX: 100, clientY: 80 });
      // Try to drag way off-screen to the right
      pointer('pointermove', document, { clientX: 5000, clientY: 5000 });
      const left = parseInt(w.element!.style.left, 10);
      const top = parseInt(w.element!.style.top, 10);
      expect(left).toBeLessThanOrEqual(704);
      expect(top).toBeLessThanOrEqual(568);
      // And negative direction
      pointer('pointermove', document, { clientX: -1000, clientY: -1000 });
      expect(parseInt(w.element!.style.left, 10)).toBe(0);
      expect(parseInt(w.element!.style.top, 10)).toBe(0);
    });

    it('detaches drag listeners on unmount (no stale callbacks)', () => {
      const onmove = vi.fn();
      const w = new AaronWindow({ x: 100, y: 80, onmove });
      w.mount();
      const titlebar = w.element!.querySelector('.aaron-titlebar') as HTMLElement;
      pointer('pointerdown', titlebar, { clientX: 200, clientY: 100 });
      w.unmount();
      // After unmount, a stray pointermove on document should not fire onmove
      pointer('pointermove', document, { clientX: 500, clientY: 500 });
      expect(onmove).not.toHaveBeenCalled();
    });

    describe('programmatic move()', () => {
      it('sets position and fires onmove', () => {
        const onmove = vi.fn();
        const w = new AaronWindow({ x: 100, y: 80, onmove });
        w.mount();
        w.move(150, 200);
        expect(w.element!.style.left).toBe('150px');
        expect(w.element!.style.top).toBe('200px');
        expect(onmove).toHaveBeenCalledWith(150, 200);
      });

      it('clamps move() coordinates', () => {
        const w = new AaronWindow({ x: 100, y: 80, width: 320, height: 200 });
        w.mount();
        w.move(-100, -100);
        expect(w.element!.style.left).toBe('0px');
        expect(w.element!.style.top).toBe('0px');
      });

      it('move() is a no-op before mount', () => {
        const w = new AaronWindow();
        expect(() => w.move(50, 50)).not.toThrow();
      });

      it('returns this for chaining', () => {
        const w = new AaronWindow();
        w.mount();
        expect(w.move(50, 50)).toBe(w);
      });
    });
  });

  describe('resize (issue #5)', () => {
    function pointer(type: string, target: EventTarget, opts: Partial<MouseEventInit & { pointerId: number }> = {}): void {
      const { pointerId = 1, ...mouseOpts } = opts;
      const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...mouseOpts });
      Object.defineProperty(e, 'pointerId', { value: pointerId });
      target.dispatchEvent(e);
    }
    function mockRect(el: HTMLElement, rect: { x: number; y: number; w: number; h: number }): void {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        x: rect.x, y: rect.y, left: rect.x, top: rect.y,
        width: rect.w, height: rect.h,
        right: rect.x + rect.w, bottom: rect.y + rect.h,
        toJSON: () => ({}),
      });
    }

    it('creates 8 resize handles with correct cursors and data-handle attributes', () => {
      const w = new AaronWindow({ title: 'Rz' });
      w.mount();
      const handles = w.element!.querySelectorAll('.aaron-window__resize');
      expect(handles).toHaveLength(8);
      const dirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
      for (const dir of dirs) {
        const h = w.element!.querySelector(`[data-handle="${dir}"]`) as HTMLElement;
        expect(h).not.toBeNull();
        expect(h.style.cursor).toBe(`${dir}-resize`);
      }
    });

    it('SE drag enlarges width and height', () => {
      const w = new AaronWindow({ x: 100, y: 80, width: 300, height: 200 });
      w.mount();
      mockRect(w.element!, { x: 100, y: 80, w: 300, h: 200 });
      const se = w.element!.querySelector('[data-handle="se"]') as HTMLElement;
      pointer('pointerdown', se, { clientX: 400, clientY: 280 });
      pointer('pointermove', document, { clientX: 500, clientY: 350 });
      expect(w.element!.style.width).toBe('400px');
      expect(w.element!.style.height).toBe('270px');
    });

    it('NW drag adjusts left/top + width/height (inverse)', () => {
      const w = new AaronWindow({ x: 200, y: 200, width: 400, height: 300 });
      w.mount();
      mockRect(w.element!, { x: 200, y: 200, w: 400, h: 300 });
      const nw = w.element!.querySelector('[data-handle="nw"]') as HTMLElement;
      pointer('pointerdown', nw, { clientX: 200, clientY: 200 });
      // Drag NW 50px right + down → window shrinks 50px on each axis,
      // and left/top move 50px right + down.
      pointer('pointermove', document, { clientX: 250, clientY: 250 });
      expect(w.element!.style.left).toBe('250px');
      expect(w.element!.style.top).toBe('250px');
      expect(w.element!.style.width).toBe('350px');
      expect(w.element!.style.height).toBe('250px');
    });

    it('S drag changes only height (no width or position change)', () => {
      const w = new AaronWindow({ x: 100, y: 100, width: 300, height: 200 });
      w.mount();
      mockRect(w.element!, { x: 100, y: 100, w: 300, h: 200 });
      const s = w.element!.querySelector('[data-handle="s"]') as HTMLElement;
      pointer('pointerdown', s, { clientX: 250, clientY: 300 });
      pointer('pointermove', document, { clientX: 250, clientY: 350 });
      expect(w.element!.style.height).toBe('250px');
      expect(w.element!.style.width).toBe('300px');
      expect(w.element!.style.left).toBe('100px');
    });

    it('W drag adjusts left + width', () => {
      const w = new AaronWindow({ x: 200, y: 100, width: 400, height: 200 });
      w.mount();
      mockRect(w.element!, { x: 200, y: 100, w: 400, h: 200 });
      const wHandle = w.element!.querySelector('[data-handle="w"]') as HTMLElement;
      pointer('pointerdown', wHandle, { clientX: 200, clientY: 200 });
      // Drag west handle 50px right → window shrinks 50px wide, left moves +50
      pointer('pointermove', document, { clientX: 250, clientY: 200 });
      expect(w.element!.style.left).toBe('250px');
      expect(w.element!.style.width).toBe('350px');
    });

    it('enforces minWidth/minHeight from options', () => {
      const w = new AaronWindow({ x: 100, y: 100, width: 200, height: 150, minWidth: 150, minHeight: 100 });
      w.mount();
      mockRect(w.element!, { x: 100, y: 100, w: 200, h: 150 });
      const se = w.element!.querySelector('[data-handle="se"]') as HTMLElement;
      pointer('pointerdown', se, { clientX: 300, clientY: 250 });
      // Try to shrink way below min
      pointer('pointermove', document, { clientX: 100, clientY: 100 });
      expect(w.element!.style.width).toBe('150px');
      expect(w.element!.style.height).toBe('100px');
    });

    it('enforces defaults minWidth=120 / minHeight=60', () => {
      const w = new AaronWindow({ x: 100, y: 100, width: 300, height: 200 });
      w.mount();
      expect(w.options.minWidth).toBe(120);
      expect(w.options.minHeight).toBe(60);
    });

    it('NW shrink stops left/top from sliding once min reached', () => {
      const w = new AaronWindow({ x: 200, y: 200, width: 300, height: 200, minWidth: 120, minHeight: 60 });
      w.mount();
      mockRect(w.element!, { x: 200, y: 200, w: 300, h: 200 });
      const nw = w.element!.querySelector('[data-handle="nw"]') as HTMLElement;
      pointer('pointerdown', nw, { clientX: 200, clientY: 200 });
      // Drag NW far enough to hit min on both axes.
      pointer('pointermove', document, { clientX: 1000, clientY: 1000 });
      // After hitting min, left should be at startLeft + (startWidth - minWidth)
      // = 200 + (300 - 120) = 380; same arithmetic for top = 200 + 140 = 340.
      expect(w.element!.style.width).toBe('120px');
      expect(w.element!.style.height).toBe('60px');
      expect(w.element!.style.left).toBe('380px');
      expect(w.element!.style.top).toBe('340px');
    });

    it('fires onresize during resize with new dimensions', () => {
      const onresize = vi.fn();
      const w = new AaronWindow({ x: 100, y: 100, width: 200, height: 150, onresize });
      w.mount();
      mockRect(w.element!, { x: 100, y: 100, w: 200, h: 150 });
      const se = w.element!.querySelector('[data-handle="se"]') as HTMLElement;
      pointer('pointerdown', se, { clientX: 300, clientY: 250 });
      pointer('pointermove', document, { clientX: 350, clientY: 280 });
      expect(onresize).toHaveBeenCalledWith(250, 180);
    });

    it('pointerup ends resize; further move does nothing', () => {
      const w = new AaronWindow({ x: 100, y: 100, width: 200, height: 150 });
      w.mount();
      mockRect(w.element!, { x: 100, y: 100, w: 200, h: 150 });
      const se = w.element!.querySelector('[data-handle="se"]') as HTMLElement;
      pointer('pointerdown', se, { clientX: 300, clientY: 250 });
      pointer('pointermove', document, { clientX: 350, clientY: 280 });
      pointer('pointerup', document);
      pointer('pointermove', document, { clientX: 500, clientY: 500 });
      expect(w.element!.style.width).toBe('250px');
      expect(w.element!.style.height).toBe('180px');
    });

    it('non-primary button does not start resize', () => {
      const w = new AaronWindow({ x: 100, y: 100, width: 200, height: 150 });
      w.mount();
      const se = w.element!.querySelector('[data-handle="se"]') as HTMLElement;
      pointer('pointerdown', se, { clientX: 300, clientY: 250, button: 2 });
      pointer('pointermove', document, { clientX: 500, clientY: 500 });
      expect(w.element!.style.width).toBe('200px');
    });

    it('detaches resize listeners on unmount', () => {
      const onresize = vi.fn();
      const w = new AaronWindow({ x: 100, y: 100, width: 200, height: 150, onresize });
      w.mount();
      const se = w.element!.querySelector('[data-handle="se"]') as HTMLElement;
      pointer('pointerdown', se, { clientX: 300, clientY: 250 });
      w.unmount();
      pointer('pointermove', document, { clientX: 500, clientY: 500 });
      expect(onresize).not.toHaveBeenCalled();
    });

    describe('programmatic resize()', () => {
      it('sets width/height and fires onresize', () => {
        const onresize = vi.fn();
        const w = new AaronWindow({ x: 100, y: 100, width: 200, height: 150, onresize });
        w.mount();
        mockRect(w.element!, { x: 100, y: 100, w: 200, h: 150 });
        w.resize(300, 250);
        expect(w.element!.style.width).toBe('300px');
        expect(w.element!.style.height).toBe('250px');
        expect(onresize).toHaveBeenCalledWith(300, 250);
      });

      it('clamps below min', () => {
        const w = new AaronWindow({ width: 200, height: 150, minWidth: 100, minHeight: 80 });
        w.mount();
        w.resize(50, 50);
        expect(w.element!.style.width).toBe('100px');
        expect(w.element!.style.height).toBe('80px');
      });

      it('resize() is a no-op before mount', () => {
        const w = new AaronWindow();
        expect(() => w.resize(300, 200)).not.toThrow();
      });

      it('returns this for chaining', () => {
        const w = new AaronWindow();
        w.mount();
        expect(w.resize(300, 200)).toBe(w);
      });
    });
  });

  describe('programmatic API (issue #7)', () => {
    describe('close()', () => {
      it('fires onclose then unmounts', () => {
        const onclose = vi.fn();
        const w = new AaronWindow({ onclose });
        w.mount();
        const el = w.element;
        w.close();
        expect(onclose).toHaveBeenCalledTimes(1);
        expect(w.isMounted).toBe(false);
        expect(document.body.contains(el)).toBe(false);
      });

      it('onclose has `this` bound to the AaronWindow', () => {
        let captured: unknown = null;
        const w = new AaronWindow({
          onclose(this: AaronWindow) { captured = this; },
        });
        w.mount();
        w.close();
        expect(captured).toBe(w);
      });

      it('is idempotent — calling on unmounted is a no-op', () => {
        const onclose = vi.fn();
        const w = new AaronWindow({ onclose });
        w.mount();
        w.close();
        w.close();
        expect(onclose).toHaveBeenCalledTimes(1);
      });

      it('returns this for chaining', () => {
        const w = new AaronWindow();
        w.mount();
        expect(w.close()).toBe(w);
      });
    });

    describe('minimize() / restore()', () => {
      it('minimize() sets data-state="collapsed" and isCollapsed=true', () => {
        const w = new AaronWindow();
        w.mount();
        expect(w.isCollapsed).toBe(false);
        w.minimize();
        expect(w.isCollapsed).toBe(true);
        expect(w.element!.getAttribute('data-state')).toBe('collapsed');
      });

      it('restore() returns data-state to "active" for focused window', () => {
        const w = new AaronWindow();
        w.mount();
        w.minimize();
        w.restore();
        expect(w.isCollapsed).toBe(false);
        expect(w.element!.getAttribute('data-state')).toBe('active');
      });

      it('restore() returns data-state to "inactive" for unfocused window', () => {
        const a = new AaronWindow();
        const b = new AaronWindow();
        a.mount(); b.mount(); // b is focused
        a.minimize();
        a.restore();
        expect(a.element!.getAttribute('data-state')).toBe('inactive');
      });

      it('minimize() is idempotent', () => {
        const w = new AaronWindow();
        w.mount();
        w.minimize();
        w.minimize();
        expect(w.isCollapsed).toBe(true);
      });

      it('restore() is idempotent on non-collapsed window', () => {
        const w = new AaronWindow();
        w.mount();
        expect(() => w.restore()).not.toThrow();
        expect(w.isCollapsed).toBe(false);
      });

      it('returns this for chaining', () => {
        const w = new AaronWindow();
        w.mount();
        expect(w.minimize()).toBe(w);
        expect(w.restore()).toBe(w);
      });

      it('minimize() before mount is a no-op', () => {
        const w = new AaronWindow();
        expect(() => w.minimize()).not.toThrow();
        expect(w.isCollapsed).toBe(false);
      });
    });

    describe('maximize() / unmaximize()', () => {
      it('maximize() sets window to viewport size', () => {
        const w = new AaronWindow({ x: 100, y: 80, width: 300, height: 200 });
        w.mount();
        w.maximize();
        expect(w.element!.style.left).toBe('0px');
        expect(w.element!.style.top).toBe('0px');
        expect(w.element!.style.width).toBe(`${window.innerWidth}px`);
        expect(w.element!.style.height).toBe(`${window.innerHeight}px`);
        expect(w.isMaximized).toBe(true);
      });

      it('unmaximize() restores previous position+size', () => {
        const w = new AaronWindow({ x: 100, y: 80, width: 300, height: 200 });
        w.mount();
        w.maximize();
        w.unmaximize();
        expect(w.element!.style.left).toBe('100px');
        expect(w.element!.style.top).toBe('80px');
        expect(w.element!.style.width).toBe('300px');
        expect(w.element!.style.height).toBe('200px');
        expect(w.isMaximized).toBe(false);
      });

      it('maximize() fires onresize and onmove with viewport dimensions', () => {
        const onmove = vi.fn();
        const onresize = vi.fn();
        const w = new AaronWindow({ x: 100, y: 80, width: 300, height: 200, onmove, onresize });
        w.mount();
        w.maximize();
        expect(onmove).toHaveBeenCalledWith(0, 0);
        expect(onresize).toHaveBeenCalledWith(window.innerWidth, window.innerHeight);
      });

      it('unmaximize() fires onmove and onresize with restored dimensions', () => {
        const onmove = vi.fn();
        const onresize = vi.fn();
        const w = new AaronWindow({ x: 100, y: 80, width: 300, height: 200, onmove, onresize });
        w.mount();
        w.maximize();
        onmove.mockClear();
        onresize.mockClear();
        w.unmaximize();
        expect(onmove).toHaveBeenCalledWith(100, 80);
        expect(onresize).toHaveBeenCalledWith(300, 200);
      });

      it('maximize is idempotent', () => {
        const w = new AaronWindow({ x: 100, y: 80, width: 300, height: 200 });
        w.mount();
        w.maximize();
        w.maximize();
        expect(w.element!.style.width).toBe(`${window.innerWidth}px`);
      });

      it('unmaximize on non-maximized window is a no-op', () => {
        const w = new AaronWindow({ x: 100, y: 80, width: 300, height: 200 });
        w.mount();
        expect(() => w.unmaximize()).not.toThrow();
        expect(w.element!.style.left).toBe('100px');
      });

      it('returns this for chaining', () => {
        const w = new AaronWindow();
        w.mount();
        expect(w.maximize()).toBe(w);
        expect(w.unmaximize()).toBe(w);
      });

      it('maximize before mount is a no-op', () => {
        const w = new AaronWindow();
        expect(() => w.maximize()).not.toThrow();
        expect(w.isMaximized).toBe(false);
      });
    });
  });

  describe('a11y (issue #9)', () => {
    describe('ARIA roles + attributes', () => {
      it('document type → role=dialog, no aria-modal', () => {
        const w = new AaronWindow({ title: 'Doc' });
        w.mount();
        expect(w.element!.getAttribute('role')).toBe('dialog');
        expect(w.element!.hasAttribute('aria-modal')).toBe(false);
      });

      it('modal type → role=dialog + aria-modal=true', () => {
        const w = new AaronWindow({ title: 'Modal', type: 'modal' });
        w.mount();
        expect(w.element!.getAttribute('role')).toBe('dialog');
        expect(w.element!.getAttribute('aria-modal')).toBe('true');
      });

      it('alert type → role=alertdialog + aria-modal=true', () => {
        const w = new AaronWindow({ title: 'Alert!', type: 'alert' });
        w.mount();
        expect(w.element!.getAttribute('role')).toBe('alertdialog');
        expect(w.element!.getAttribute('aria-modal')).toBe('true');
      });

      it('utility type → role=dialog, no aria-modal', () => {
        const w = new AaronWindow({ title: 'Util', type: 'utility' });
        w.mount();
        expect(w.element!.getAttribute('role')).toBe('dialog');
        expect(w.element!.hasAttribute('aria-modal')).toBe(false);
      });

      it('aria-labelledby points at the titlebar text', () => {
        const w = new AaronWindow({ title: 'Welcome' });
        w.mount();
        const labelledBy = w.element!.getAttribute('aria-labelledby');
        expect(labelledBy).not.toBeNull();
        const labelEl = document.getElementById(labelledBy!);
        expect(labelEl?.textContent).toBe('Welcome');
      });

      it('window has tabindex=-1 for programmatic focus fallback', () => {
        const w = new AaronWindow();
        w.mount();
        expect(w.element!.getAttribute('tabindex')).toBe('-1');
      });
    });

    describe('initial focus', () => {
      it('focuses the first focusable element inside content on mount', () => {
        const w = new AaronWindow({
          title: 'Form',
          html: '<input type="text" id="first" /><button>Cancel</button><button>OK</button>',
        });
        w.mount();
        expect(document.activeElement?.id).toBe('first');
      });

      it('focuses the window itself when content has no focusables', () => {
        const w = new AaronWindow({ title: 'Plain', html: '<p>Just text</p>' });
        w.mount();
        expect(document.activeElement).toBe(w.element);
      });
    });

    describe('Escape key (modal/alert)', () => {
      it('Escape closes a modal window', () => {
        const onclose = vi.fn();
        const w = new AaronWindow({ type: 'modal', onclose });
        w.mount();
        w.element!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(onclose).toHaveBeenCalledTimes(1);
        expect(w.isMounted).toBe(false);
      });

      it('Escape closes an alert window', () => {
        const onclose = vi.fn();
        const w = new AaronWindow({ type: 'alert', onclose });
        w.mount();
        w.element!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(onclose).toHaveBeenCalledTimes(1);
      });

      it('Escape on a document window does NOT close', () => {
        const onclose = vi.fn();
        const w = new AaronWindow({ type: 'document', onclose });
        w.mount();
        w.element!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(onclose).not.toHaveBeenCalled();
        expect(w.isMounted).toBe(true);
      });

      it('Escape on a utility window does NOT close', () => {
        const onclose = vi.fn();
        const w = new AaronWindow({ type: 'utility', onclose });
        w.mount();
        w.element!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(onclose).not.toHaveBeenCalled();
      });
    });

    describe('focus trap (modal/alert)', () => {
      it('Tab on last focusable wraps to first', () => {
        const w = new AaronWindow({
          type: 'modal',
          html: '<button id="b1">1</button><button id="b2">2</button><button id="b3">3</button>',
        });
        w.mount();
        const b3 = w.element!.querySelector<HTMLButtonElement>('#b3')!;
        b3.focus();
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        w.element!.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement?.id).toBe('b1');
      });

      it('Shift+Tab on first focusable wraps to last', () => {
        const w = new AaronWindow({
          type: 'modal',
          html: '<button id="b1">1</button><button id="b2">2</button><button id="b3">3</button>',
        });
        w.mount();
        const b1 = w.element!.querySelector<HTMLButtonElement>('#b1')!;
        b1.focus();
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        w.element!.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement?.id).toBe('b3');
      });

      it('Tab in middle of focus order is not trapped', () => {
        const w = new AaronWindow({
          type: 'modal',
          html: '<button id="b1">1</button><button id="b2">2</button><button id="b3">3</button>',
        });
        w.mount();
        const b2 = w.element!.querySelector<HTMLButtonElement>('#b2')!;
        b2.focus();
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        w.element!.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      });

      it('document type does NOT trap Tab', () => {
        const w = new AaronWindow({
          type: 'document',
          html: '<button id="b1">1</button><button id="b2">2</button>',
        });
        w.mount();
        const b2 = w.element!.querySelector<HTMLButtonElement>('#b2')!;
        b2.focus();
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        w.element!.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      });
    });

    describe('cleanup', () => {
      it('removes keydown listener on unmount', () => {
        const onclose = vi.fn();
        const w = new AaronWindow({ type: 'modal', onclose });
        w.mount();
        const el = w.element!;
        w.unmount();
        // Dispatch on the now-orphaned element — should not fire onclose
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(onclose).not.toHaveBeenCalled();
      });
    });
  });

  describe('back-compat: cv-mac style call site', () => {
    it('constructs and mounts without errors', () => {
      // Representative of the actual cv-mac call pattern from PRD §Architecture.
      const onclose = vi.fn();
      const oncreate = vi.fn();
      let w: AaronWindow | null = null;
      expect(() => {
        w = new AaronWindow({
          title: 'Hello',
          x: 100,
          y: 80,
          width: 380,
          height: 240,
          html: '<p>Created in JS.</p>',
          onclose,
          oncreate,
          background: '#eeeeee',
          border: 1,
          class: 'cv-mac-window',
        });
        w.mount();
      }).not.toThrow();
      expect(w!.isMounted).toBe(true);
      expect(oncreate).toHaveBeenCalledTimes(1);
      expect(w!.element!.classList.contains('cv-mac-window')).toBe(true);
    });
  });
});
