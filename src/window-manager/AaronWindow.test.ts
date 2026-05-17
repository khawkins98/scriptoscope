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
