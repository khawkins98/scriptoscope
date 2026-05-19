import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AaronWindowHeader, promoteWindowHeaders } from './AaronWindowHeader.js';
import { themeRegistry } from '../themes/runtime/ThemeRegistry.js';

beforeEach(() => themeRegistry.reset());
afterEach(() => themeRegistry.reset());

describe('AaronWindowHeader', () => {
  it('mounts with class + data-state=active by default', () => {
    const h = new AaronWindowHeader();
    expect(h.element.classList.contains('aaron-window-header')).toBe(true);
    expect(h.element.getAttribute('data-state')).toBe('active');
  });

  it('respects active=false in options', () => {
    const h = new AaronWindowHeader({ active: false });
    expect(h.element.getAttribute('data-state')).toBe('inactive');
  });

  it('renders html into a fresh element', () => {
    const h = new AaronWindowHeader({ html: '<span>Name</span><span>Size</span>' });
    expect(h.element.querySelectorAll('span').length).toBe(2);
  });

  it('preserves existing content when wrapping an existing div', () => {
    const div = document.createElement('div');
    div.innerHTML = '<span>Existing</span>';
    const h = new AaronWindowHeader(div);
    expect(h.element.querySelector('span')?.textContent).toBe('Existing');
  });

  it('setActive flips data-state', () => {
    const h = new AaronWindowHeader();
    h.setActive(false);
    expect(h.element.getAttribute('data-state')).toBe('inactive');
    h.setActive(true);
    expect(h.element.getAttribute('data-state')).toBe('active');
  });

  it('unmount removes promotion + class', () => {
    const h = new AaronWindowHeader();
    h.unmount();
    expect(h.element.classList.contains('aaron-window-header')).toBe(false);
    expect(h.element.hasAttribute('data-aaron-promoted')).toBe(false);
  });

  it('promoteWindowHeaders wraps existing divs; idempotent', () => {
    document.body.innerHTML = `
      <div data-aaron-window-header><span>A</span></div>
      <div data-aaron-window-header><span>B</span></div>
      <div>Untouched</div>
    `;
    const promoted = promoteWindowHeaders(document.body);
    expect(promoted.length).toBe(2);
    expect(promoteWindowHeaders(document.body).length).toBe(0);
    document.body.innerHTML = '';
  });
});
