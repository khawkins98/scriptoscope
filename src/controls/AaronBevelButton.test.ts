import { describe, expect, it } from 'vitest';
import { AaronBevelButton, promoteBevelButtons } from './AaronBevelButton.js';

describe('AaronBevelButton', () => {
  it('mounts with default size normal + value off', () => {
    const b = new AaronBevelButton();
    expect(b.element.classList.contains('aaron-button')).toBe(true);
    expect(b.element.classList.contains('aaron-button--bevel')).toBe(true);
    expect(b.element.getAttribute('data-size')).toBe('normal');
    expect(b.element.getAttribute('data-value')).toBe('off');
    expect(b.element.getAttribute('aria-pressed')).toBe('false');
  });

  it('applies label when none present', () => {
    const b = new AaronBevelButton({ label: 'Bold' });
    expect(b.element.textContent).toBe('Bold');
  });

  it('initial size + value reflect in attrs', () => {
    const b = new AaronBevelButton({ size: 'large', value: 'on' });
    expect(b.element.getAttribute('data-size')).toBe('large');
    expect(b.element.getAttribute('data-value')).toBe('on');
    expect(b.element.getAttribute('aria-pressed')).toBe('true');
  });

  it('setValue toggles + aria-pressed mapping', () => {
    const b = new AaronBevelButton();
    b.setValue('on');
    expect(b.element.getAttribute('aria-pressed')).toBe('true');
    b.setValue('mixed');
    expect(b.element.getAttribute('aria-pressed')).toBe('mixed');
    b.setValue('off');
    expect(b.element.getAttribute('aria-pressed')).toBe('false');
    expect(b.value).toBe('off');
  });

  it('initial disabled stamps aria-disabled + native disabled', () => {
    const b = new AaronBevelButton({ disabled: true });
    expect(b.element.disabled).toBe(true);
    expect(b.element.getAttribute('aria-disabled')).toBe('true');
  });

  it('setDisabled toggles both', () => {
    const b = new AaronBevelButton();
    b.setDisabled(true);
    expect(b.element.disabled).toBe(true);
    expect(b.element.getAttribute('aria-disabled')).toBe('true');
    b.setDisabled(false);
    expect(b.element.disabled).toBe(false);
    expect(b.element.hasAttribute('aria-disabled')).toBe(false);
  });

  it('unmount removes promotion + classes', () => {
    const b = new AaronBevelButton();
    b.unmount();
    expect(b.element.classList.contains('aaron-button--bevel')).toBe(false);
    expect(b.element.hasAttribute('data-aaron-promoted')).toBe(false);
  });

  it('promoteBevelButtons wraps existing buttons; idempotent', () => {
    document.body.innerHTML = `
      <button data-aaron-button-bevel>Tool 1</button>
      <button data-aaron-button-bevel data-size="small">Tool 2</button>
      <button>Untouched</button>
    `;
    const promoted = promoteBevelButtons(document.body);
    expect(promoted.length).toBe(2);
    expect(promoteBevelButtons(document.body).length).toBe(0);
    document.body.innerHTML = '';
  });
});
