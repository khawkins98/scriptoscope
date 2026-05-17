import { describe, it, expect, beforeEach } from 'vitest';
import {
  scanForWindows,
  promoteElement,
  parseOptions,
  startScanner,
  stopScanner,
} from './scanner.js';
import { windowManager } from './WindowManager.js';

describe('Declarative scanner (issue #8)', () => {
  beforeEach(() => {
    // Auto-scanner may be running from the module import; stop it so
    // tests can drive scans explicitly.
    stopScanner();
    document.body.innerHTML = '';
    windowManager.reset();
  });

  describe('parseOptions', () => {
    it('parses data-aaron-title', () => {
      const el = document.createElement('div');
      el.setAttribute('data-aaron-title', 'Welcome');
      const opts = parseOptions(el);
      expect(opts.title).toBe('Welcome');
    });

    it('parses numeric positional attrs', () => {
      const el = document.createElement('div');
      el.setAttribute('data-aaron-x', '100');
      el.setAttribute('data-aaron-y', '80');
      el.setAttribute('data-aaron-width', '380');
      el.setAttribute('data-aaron-height', '240');
      const opts = parseOptions(el);
      expect(opts.x).toBe(100);
      expect(opts.y).toBe(80);
      expect(opts.width).toBe(380);
      expect(opts.height).toBe(240);
    });

    it('parses min-size attrs', () => {
      const el = document.createElement('div');
      el.setAttribute('data-aaron-min-width', '200');
      el.setAttribute('data-aaron-min-height', '150');
      const opts = parseOptions(el);
      expect(opts.minWidth).toBe(200);
      expect(opts.minHeight).toBe(150);
    });

    it('omits options for absent attributes', () => {
      const el = document.createElement('div');
      el.setAttribute('data-aaron-window', '');
      const opts = parseOptions(el);
      expect(opts.x).toBeUndefined();
      expect(opts.y).toBeUndefined();
      expect(opts.width).toBeUndefined();
    });

    it('captures innerHTML as html option (preserves nested markup)', () => {
      const el = document.createElement('div');
      el.innerHTML = '<p>Hello <strong>world</strong></p>';
      const opts = parseOptions(el);
      expect(opts.html).toBe('<p>Hello <strong>world</strong></p>');
    });

    it('omits html when innerHTML is empty / whitespace', () => {
      const el = document.createElement('div');
      el.innerHTML = '   \n  ';
      const opts = parseOptions(el);
      expect(opts.html).toBeUndefined();
    });

    it('passes through extra CSS classes via the class option', () => {
      const el = document.createElement('div');
      el.classList.add('aaron-window-source', 'my-window', 'other');
      const opts = parseOptions(el);
      expect(opts.class).toEqual(['my-window', 'other']);
    });

    it('omits class when only sentinel classes are present', () => {
      const el = document.createElement('div');
      el.classList.add('aaron-window-source');
      const opts = parseOptions(el);
      expect(opts.class).toBeUndefined();
    });
  });

  describe('promoteElement', () => {
    it('removes source element and mounts an AaronWindow at its parent', () => {
      const parent = document.createElement('section');
      const source = document.createElement('div');
      source.setAttribute('data-aaron-window', '');
      source.setAttribute('data-aaron-title', 'X');
      parent.appendChild(source);
      document.body.appendChild(parent);

      const win = promoteElement(source);

      expect(document.body.contains(source)).toBe(false);
      expect(parent.contains(win.element)).toBe(true);
      expect(win.options.title).toBe('X');
    });

    it('preserves child markup as the new window content', () => {
      const source = document.createElement('div');
      source.setAttribute('data-aaron-window', '');
      source.innerHTML = '<p>Hello</p>';
      document.body.appendChild(source);

      const win = promoteElement(source);
      const p = win.content!.querySelector('p');
      expect(p?.textContent).toBe('Hello');
    });

    it('the promoted window has the data-aaron-promoted sentinel', () => {
      const source = document.createElement('div');
      source.setAttribute('data-aaron-window', '');
      document.body.appendChild(source);
      const win = promoteElement(source);
      expect(win.element!.hasAttribute('data-aaron-promoted')).toBe(true);
    });
  });

  describe('scanForWindows', () => {
    it('finds and promotes all matching elements', () => {
      document.body.innerHTML = `
        <div data-aaron-window data-aaron-title="A">A</div>
        <div data-aaron-window data-aaron-title="B">B</div>
        <div data-aaron-window data-aaron-title="C">C</div>
      `;
      const windows = scanForWindows();
      expect(windows).toHaveLength(3);
      expect(windows[0]!.options.title).toBe('A');
      expect(windows[1]!.options.title).toBe('B');
      expect(windows[2]!.options.title).toBe('C');
    });

    it('also matches .aaron-window-source fallback class', () => {
      document.body.innerHTML = '<div class="aaron-window-source"><p>Hello</p></div>';
      const windows = scanForWindows();
      expect(windows).toHaveLength(1);
    });

    it('does NOT re-promote already-rendered windows', () => {
      document.body.innerHTML = `<div data-aaron-window data-aaron-title="X">X</div>`;
      scanForWindows();
      // Second scan should find 0 — the rendered window has data-aaron-promoted.
      const second = scanForWindows();
      expect(second).toHaveLength(0);
    });

    it('returns 0 windows when nothing matches', () => {
      document.body.innerHTML = '<div>plain div</div>';
      expect(scanForWindows()).toHaveLength(0);
    });

    it('can scan a subtree, not the whole document', () => {
      const section = document.createElement('section');
      section.innerHTML = `<div data-aaron-window data-aaron-title="A">A</div>`;
      document.body.appendChild(section);
      const outsider = document.createElement('div');
      outsider.setAttribute('data-aaron-window', '');
      outsider.setAttribute('data-aaron-title', 'OUTSIDE');
      document.body.appendChild(outsider);

      const windows = scanForWindows(section);
      expect(windows).toHaveLength(1);
      expect(windows[0]!.options.title).toBe('A');
      // The outside element is untouched
      expect(document.body.contains(outsider)).toBe(true);
    });
  });

  describe('startScanner / MutationObserver', () => {
    it('initial start promotes existing source elements', () => {
      document.body.innerHTML = '<div data-aaron-window data-aaron-title="Init"></div>';
      startScanner();
      const promoted = document.querySelectorAll('[data-aaron-promoted]');
      expect(promoted).toHaveLength(1);
    });

    it('dynamically added [data-aaron-window] gets promoted', async () => {
      startScanner();
      const fresh = document.createElement('div');
      fresh.setAttribute('data-aaron-window', '');
      fresh.setAttribute('data-aaron-title', 'Dynamic');
      document.body.appendChild(fresh);
      // MutationObserver fires asynchronously; await a microtask.
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(document.body.contains(fresh)).toBe(false);
      const rendered = document.querySelector('[data-aaron-promoted]');
      expect(rendered).not.toBeNull();
    });

    it('descendants of a dynamically added wrapper are also promoted', async () => {
      startScanner();
      const wrapper = document.createElement('section');
      wrapper.innerHTML = `
        <div data-aaron-window data-aaron-title="Nested1"></div>
        <div data-aaron-window data-aaron-title="Nested2"></div>
      `;
      document.body.appendChild(wrapper);
      await new Promise(resolve => setTimeout(resolve, 10));
      const promoted = wrapper.querySelectorAll('[data-aaron-promoted]');
      expect(promoted).toHaveLength(2);
    });

    it('stopScanner halts further promotions', async () => {
      startScanner();
      stopScanner();
      const fresh = document.createElement('div');
      fresh.setAttribute('data-aaron-window', '');
      document.body.appendChild(fresh);
      await new Promise(resolve => setTimeout(resolve, 10));
      // Source remains; nothing promoted
      expect(document.body.contains(fresh)).toBe(true);
      expect(fresh.hasAttribute('data-aaron-promoted')).toBe(false);
    });

    it('start is idempotent — calling twice does not double-watch', async () => {
      startScanner();
      startScanner();
      const fresh = document.createElement('div');
      fresh.setAttribute('data-aaron-window', '');
      fresh.setAttribute('data-aaron-title', 'Once');
      document.body.appendChild(fresh);
      await new Promise(resolve => setTimeout(resolve, 10));
      // Should be exactly one promotion, not two.
      expect(document.querySelectorAll('[data-aaron-promoted]')).toHaveLength(1);
    });
  });
});
