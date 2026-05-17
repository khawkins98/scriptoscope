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

    it('cv-mac-style call site constructs and mounts without errors', () => {
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
