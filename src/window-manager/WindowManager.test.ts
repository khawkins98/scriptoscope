import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AaronWindow } from './AaronWindow.js';
import { windowManager } from './WindowManager.js';

describe('WindowManager (issue #6)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    windowManager.reset();
  });

  describe('register / unregister', () => {
    it('newly-mounted window joins the stack and becomes focused', () => {
      const w = new AaronWindow({ title: 'A' });
      w.mount();
      expect(windowManager.all).toContain(w);
      expect(windowManager.focusedWindow).toBe(w);
      expect(windowManager.topWindow).toBe(w);
    });

    it('z-index ascends with stack position', () => {
      const a = new AaronWindow({ title: 'A' });
      const b = new AaronWindow({ title: 'B' });
      const c = new AaronWindow({ title: 'C' });
      a.mount(); b.mount(); c.mount();
      const za = parseInt(a.element!.style.zIndex, 10);
      const zb = parseInt(b.element!.style.zIndex, 10);
      const zc = parseInt(c.element!.style.zIndex, 10);
      expect(za).toBeLessThan(zb);
      expect(zb).toBeLessThan(zc);
    });

    it('unmount removes from stack and re-focuses next-highest', () => {
      const a = new AaronWindow();
      const b = new AaronWindow();
      a.mount(); b.mount();
      expect(windowManager.focusedWindow).toBe(b);
      b.unmount();
      expect(windowManager.all).not.toContain(b);
      expect(windowManager.focusedWindow).toBe(a);
    });

    it('unmount with no other windows leaves no focus', () => {
      const w = new AaronWindow();
      w.mount();
      w.unmount();
      expect(windowManager.focusedWindow).toBeNull();
      expect(windowManager.all).toHaveLength(0);
    });

    it('re-mount after unmount registers fresh on top', () => {
      const a = new AaronWindow();
      const b = new AaronWindow();
      a.mount(); b.mount();
      a.unmount();
      a.mount();
      expect(windowManager.topWindow).toBe(a);
      expect(windowManager.focusedWindow).toBe(a);
    });
  });

  describe('raise + focus', () => {
    it('raise() moves a buried window to the top', () => {
      const a = new AaronWindow();
      const b = new AaronWindow();
      const c = new AaronWindow();
      a.mount(); b.mount(); c.mount();
      expect(windowManager.topWindow).toBe(c);
      a.focus();
      expect(windowManager.topWindow).toBe(a);
      expect(windowManager.focusedWindow).toBe(a);
    });

    it('raise updates z-index on all affected windows', () => {
      const a = new AaronWindow();
      const b = new AaronWindow();
      const c = new AaronWindow();
      a.mount(); b.mount(); c.mount();
      a.focus();
      const za = parseInt(a.element!.style.zIndex, 10);
      const zb = parseInt(b.element!.style.zIndex, 10);
      const zc = parseInt(c.element!.style.zIndex, 10);
      // After raising a: order is b, c, a → b lowest, a highest
      expect(zb).toBeLessThan(zc);
      expect(zc).toBeLessThan(za);
    });

    it('raise on already-top window is a no-op', () => {
      const a = new AaronWindow();
      a.mount();
      const before = a.element!.style.zIndex;
      a.focus();
      expect(a.element!.style.zIndex).toBe(before);
    });

    it('focus() returns this for chaining', () => {
      const w = new AaronWindow();
      w.mount();
      expect(w.focus()).toBe(w);
    });

    it('focus() before mount is a no-op', () => {
      const w = new AaronWindow();
      expect(() => w.focus()).not.toThrow();
      expect(w.hasFocus).toBe(false);
    });

    it('hasFocus reflects current focused state', () => {
      const a = new AaronWindow();
      const b = new AaronWindow();
      a.mount(); b.mount();
      expect(b.hasFocus).toBe(true);
      expect(a.hasFocus).toBe(false);
      a.focus();
      expect(a.hasFocus).toBe(true);
      expect(b.hasFocus).toBe(false);
    });
  });

  describe('data-state attribute', () => {
    it('newly-mounted window has data-state="active"', () => {
      const w = new AaronWindow();
      w.mount();
      expect(w.element!.getAttribute('data-state')).toBe('active');
    });

    it('previously-focused window flips to "inactive" when raise() moves focus', () => {
      const a = new AaronWindow();
      const b = new AaronWindow();
      a.mount();
      expect(a.element!.getAttribute('data-state')).toBe('active');
      b.mount();
      expect(a.element!.getAttribute('data-state')).toBe('inactive');
      expect(b.element!.getAttribute('data-state')).toBe('active');
      a.focus();
      expect(a.element!.getAttribute('data-state')).toBe('active');
      expect(b.element!.getAttribute('data-state')).toBe('inactive');
    });
  });

  describe('onfocus / onblur', () => {
    it('mount fires onfocus on the new window', () => {
      const onfocus = vi.fn();
      const w = new AaronWindow({ onfocus });
      w.mount();
      expect(onfocus).toHaveBeenCalledTimes(1);
    });

    it('mounting a second window fires onblur on the first + onfocus on the second', () => {
      const aBlur = vi.fn();
      const bFocus = vi.fn();
      const a = new AaronWindow({ onblur: aBlur });
      const b = new AaronWindow({ onfocus: bFocus });
      a.mount();
      b.mount();
      expect(aBlur).toHaveBeenCalledTimes(1);
      expect(bFocus).toHaveBeenCalledTimes(1);
    });

    it('callbacks have `this` bound to the AaronWindow', () => {
      let capturedFocus: unknown = null;
      let capturedBlur: unknown = null;
      const a = new AaronWindow({
        onblur(this: AaronWindow) { capturedBlur = this; },
      });
      const b = new AaronWindow({
        onfocus(this: AaronWindow) { capturedFocus = this; },
      });
      a.mount();
      b.mount();
      expect(capturedFocus).toBe(b);
      expect(capturedBlur).toBe(a);
    });

    it('does not fire onfocus on already-focused window when raise is a no-op', () => {
      const onfocus = vi.fn();
      const w = new AaronWindow({ onfocus });
      w.mount();
      onfocus.mockClear();
      w.focus(); // no-op since already focused
      expect(onfocus).not.toHaveBeenCalled();
    });
  });

  describe('raise on pointerdown', () => {
    function pointer(type: string, target: EventTarget, opts: Partial<MouseEventInit & { pointerId: number }> = {}): void {
      const { pointerId = 1, ...mouseOpts } = opts;
      const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...mouseOpts });
      Object.defineProperty(e, 'pointerId', { value: pointerId });
      target.dispatchEvent(e);
    }

    it('pointerdown anywhere on a buried window raises it', () => {
      const a = new AaronWindow();
      const b = new AaronWindow();
      a.mount(); b.mount();
      // b is on top. Click on a (buried).
      pointer('pointerdown', a.element!);
      expect(windowManager.topWindow).toBe(a);
      expect(windowManager.focusedWindow).toBe(a);
    });

    it('pointerdown on titlebar raises + then drag works', () => {
      const a = new AaronWindow({ x: 100, y: 100, width: 300, height: 200 });
      const b = new AaronWindow();
      a.mount(); b.mount();
      vi.spyOn(a.element!, 'getBoundingClientRect').mockReturnValue({
        x: 100, y: 100, left: 100, top: 100, right: 400, bottom: 300,
        width: 300, height: 200, toJSON: () => ({}),
      });
      const titlebar = a.element!.querySelector('.aaron-titlebar') as HTMLElement;
      // Click on titlebar should both raise AND start drag.
      pointer('pointerdown', titlebar, { clientX: 200, clientY: 110 });
      expect(windowManager.topWindow).toBe(a);
      pointer('pointermove', document, { clientX: 250, clientY: 130 });
      expect(a.element!.style.left).toBe('150px');
    });
  });
});
