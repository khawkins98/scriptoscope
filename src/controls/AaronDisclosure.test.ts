import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AaronDisclosure, promoteDisclosures } from './AaronDisclosure.js';
import { themeRegistry } from '../themes/runtime/ThemeRegistry.js';

beforeEach(() => themeRegistry.reset());
afterEach(() => themeRegistry.reset());

describe('AaronDisclosure', () => {
  it('mounts with right-facing default + aria-expanded=false', () => {
    const d = new AaronDisclosure();
    expect(d.element.getAttribute('data-facing')).toBe('right');
    expect(d.element.getAttribute('aria-expanded')).toBe('false');
    expect(d.element.classList.contains('aaron-disclosure')).toBe(true);
    expect(d.expanded).toBe(false);
  });

  it('respects initial facing: down + sets aria-expanded=true', () => {
    const d = new AaronDisclosure({ facing: 'down' });
    expect(d.element.getAttribute('data-facing')).toBe('down');
    expect(d.element.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders label text', () => {
    const d = new AaronDisclosure({ label: 'Show details' });
    const label = d.element.querySelector('.aaron-disclosure__label');
    expect(label?.textContent).toBe('Show details');
  });

  it('aria-controls is set when controls option is provided', () => {
    const d = new AaronDisclosure({ controls: 'panel-1' });
    expect(d.element.getAttribute('aria-controls')).toBe('panel-1');
  });

  it('clicking toggles aria-expanded + data-facing', () => {
    const d = new AaronDisclosure();
    d.element.dispatchEvent(new MouseEvent('click'));
    expect(d.element.getAttribute('aria-expanded')).toBe('true');
    expect(d.element.getAttribute('data-facing')).toBe('down');
    d.element.dispatchEvent(new MouseEvent('click'));
    expect(d.element.getAttribute('aria-expanded')).toBe('false');
    expect(d.element.getAttribute('data-facing')).toBe('right');
  });

  it('disabled clicks do not toggle', () => {
    const d = new AaronDisclosure({ disabled: true });
    d.element.dispatchEvent(new MouseEvent('click'));
    expect(d.element.getAttribute('aria-expanded')).toBe('false');
  });

  it('fires onToggle callback with new expanded value', () => {
    const onToggle = vi.fn();
    const d = new AaronDisclosure({ onToggle });
    d.element.dispatchEvent(new MouseEvent('click'));
    expect(onToggle).toHaveBeenCalledWith(true, d.element);
    d.element.dispatchEvent(new MouseEvent('click'));
    expect(onToggle).toHaveBeenLastCalledWith(false, d.element);
  });

  it('setExpanded flips both aria-expanded + data-facing', () => {
    const d = new AaronDisclosure();
    d.setExpanded(true);
    expect(d.element.getAttribute('aria-expanded')).toBe('true');
    expect(d.element.getAttribute('data-facing')).toBe('down');
  });

  it('setDisabled toggles aria-disabled + the disabled attribute', () => {
    const d = new AaronDisclosure();
    d.setDisabled(true);
    expect(d.element.disabled).toBe(true);
    expect(d.element.getAttribute('aria-disabled')).toBe('true');
    d.setDisabled(false);
    expect(d.element.disabled).toBe(false);
    expect(d.element.hasAttribute('aria-disabled')).toBe(false);
  });

  it('unmount removes promotion + class', () => {
    const d = new AaronDisclosure();
    d.unmount();
    expect(d.element.classList.contains('aaron-disclosure')).toBe(false);
    expect(d.element.hasAttribute('data-aaron-promoted')).toBe(false);
  });

  it('promoteDisclosures wraps existing buttons + is idempotent', () => {
    document.body.innerHTML = `
      <button data-aaron-disclosure>One</button>
      <button data-aaron-disclosure>Two</button>
      <button>Untouched</button>
    `;
    const promoted = promoteDisclosures(document.body);
    expect(promoted.length).toBe(2);
    expect(document.body.querySelectorAll('[data-aaron-promoted]').length).toBe(2);
    // Idempotent — second call returns nothing (already promoted).
    const second = promoteDisclosures(document.body);
    expect(second.length).toBe(0);
    document.body.innerHTML = '';
  });

  it('pointer down/up cycles data-state through pressed → normal', () => {
    // jsdom doesn't define PointerEvent — fall back to MouseEvent which
    // dispatches as the same event type for our listener purposes.
    const PE = (globalThis as { PointerEvent?: typeof Event }).PointerEvent ?? MouseEvent;
    const d = new AaronDisclosure();
    d.element.dispatchEvent(new PE('pointerdown'));
    expect(d.element.getAttribute('data-state')).toBe('pressed');
    d.element.dispatchEvent(new PE('pointerup'));
    expect(d.element.getAttribute('data-state')).toBe('normal');
  });
});
