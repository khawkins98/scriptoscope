import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AaronPlacard, promotePlacards } from './AaronPlacard.js';
import { themeRegistry } from '../themes/runtime/ThemeRegistry.js';

beforeEach(() => themeRegistry.reset());
afterEach(() => themeRegistry.reset());

describe('AaronPlacard', () => {
  it('mounts with class + data-state=normal', () => {
    const p = new AaronPlacard();
    expect(p.element.classList.contains('aaron-placard')).toBe(true);
    expect(p.element.getAttribute('data-state')).toBe('normal');
    expect(p.element.hasAttribute('data-aaron-promoted')).toBe(true);
  });

  it('applies label text to a fresh element', () => {
    const p = new AaronPlacard({ label: 'Ready' });
    expect(p.element.textContent).toBe('Ready');
  });

  it('preserves existing content when wrapping an existing div', () => {
    const div = document.createElement('div');
    div.textContent = 'Already here';
    const p = new AaronPlacard(div);
    expect(p.element.textContent).toBe('Already here');
  });

  it('initial pressed state is honored', () => {
    const p = new AaronPlacard({ pressed: true });
    expect(p.element.getAttribute('data-state')).toBe('pressed');
  });

  it('initial disabled state stamps aria-disabled', () => {
    const p = new AaronPlacard({ disabled: true });
    expect(p.element.getAttribute('aria-disabled')).toBe('true');
  });

  it('setDisabled toggles aria-disabled', () => {
    const p = new AaronPlacard();
    p.setDisabled(true);
    expect(p.element.getAttribute('aria-disabled')).toBe('true');
    p.setDisabled(false);
    expect(p.element.hasAttribute('aria-disabled')).toBe(false);
  });

  it('setPressed toggles data-state', () => {
    const p = new AaronPlacard();
    p.setPressed(true);
    expect(p.element.getAttribute('data-state')).toBe('pressed');
    p.setPressed(false);
    expect(p.element.getAttribute('data-state')).toBe('normal');
  });

  it('unmount removes promotion + class', () => {
    const p = new AaronPlacard();
    p.unmount();
    expect(p.element.classList.contains('aaron-placard')).toBe(false);
    expect(p.element.hasAttribute('data-aaron-promoted')).toBe(false);
  });

  it('promotePlacards wraps existing divs; idempotent', () => {
    document.body.innerHTML = `
      <div data-aaron-placard>One</div>
      <div data-aaron-placard>Two</div>
      <div>Untouched</div>
    `;
    const promoted = promotePlacards(document.body);
    expect(promoted.length).toBe(2);
    expect(document.body.querySelectorAll('[data-aaron-promoted]').length).toBe(2);
    expect(promotePlacards(document.body).length).toBe(0);
    document.body.innerHTML = '';
  });
});
