import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AaronField, promoteFields } from './AaronField.js';
import { _resetEngineBaselineForTests } from './engineBaseline.js';

let mounted: AaronField[] = [];
function track(f: AaronField): AaronField { mounted.push(f); return f; }

beforeEach(() => { _resetEngineBaselineForTests(); });
afterEach(() => {
  for (const f of mounted) f.unmount();
  mounted = [];
  document.body.innerHTML = '';
});

describe('AaronField (input)', () => {
  it('wraps a bare <input> with .aaron-field', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    const f = track(new AaronField(input));
    expect(f.wrapper.classList.contains('aaron-field')).toBe(true);
    expect(f.wrapper.classList.contains('aaron-control')).toBe(true);
    expect(f.wrapper.contains(input)).toBe(true);
  });

  it('creates a fresh input when given options', () => {
    const f = track(new AaronField({ type: 'text', value: 'hello', placeholder: 'name' }));
    expect(f.element.tagName).toBe('INPUT');
    expect(f.value).toBe('hello');
    expect((f.element as HTMLInputElement).placeholder).toBe('name');
  });

  it('honours password/email/etc type', () => {
    const f = track(new AaronField({ type: 'password', value: 'secret' }));
    expect((f.element as HTMLInputElement).type).toBe('password');
  });

  it('block option adds .aaron-field--block', () => {
    const f = track(new AaronField({ block: true }));
    expect(f.wrapper.classList.contains('aaron-field--block')).toBe(true);
  });

  it('reuses an existing .aaron-field wrapper on re-construction', () => {
    document.body.innerHTML = `<span class="aaron-field"><input type="text"></span>`;
    const input = document.body.querySelector('input')!;
    const f = track(new AaronField(input));
    // Should NOT have nested wrapper inside the existing one.
    expect(f.wrapper.parentElement).toBe(document.body);
    expect(f.wrapper.children).toHaveLength(1);
  });
});

describe('AaronField (textarea)', () => {
  it('creates a <textarea> with rows', () => {
    const f = track(new AaronField({ type: 'textarea', rows: 4, value: 'multi\nline' }));
    expect(f.element.tagName).toBe('TEXTAREA');
    expect((f.element as HTMLTextAreaElement).rows).toBe(4);
    expect(f.value).toBe('multi\nline');
  });

  it('wraps an existing <textarea>', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    const f = track(new AaronField(ta));
    expect(f.element).toBe(ta);
    expect(f.wrapper.classList.contains('aaron-field')).toBe(true);
  });
});

describe('state + a11y', () => {
  it('setDisabled mirrors to wrapper aria-disabled', () => {
    const f = track(new AaronField({}));
    f.setDisabled(true);
    expect(f.disabled).toBe(true);
    expect(f.wrapper.getAttribute('aria-disabled')).toBe('true');
    f.setDisabled(false);
    expect(f.wrapper.hasAttribute('aria-disabled')).toBe(false);
  });

  it('setReadOnly toggles .aaron-field--readonly', () => {
    const f = track(new AaronField({}));
    f.setReadOnly(true);
    expect(f.readOnly).toBe(true);
    expect(f.wrapper.classList.contains('aaron-field--readonly')).toBe(true);
    f.setReadOnly(false);
    expect(f.wrapper.classList.contains('aaron-field--readonly')).toBe(false);
  });

  it('initial disabled/readOnly options propagate', () => {
    const f = track(new AaronField({ disabled: true, readOnly: true }));
    expect(f.wrapper.getAttribute('aria-disabled')).toBe('true');
    expect(f.wrapper.classList.contains('aaron-field--readonly')).toBe(true);
  });
});

describe('events', () => {
  it('onInput fires on input event', () => {
    const onInput = vi.fn();
    const f = track(new AaronField({ onInput }));
    f.setValue('typed');
    f.element.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onInput).toHaveBeenCalledWith('typed', f.element);
  });
});

describe('unmount', () => {
  it('clears Aaron UI classes + attributes', () => {
    const f = new AaronField({ block: true, disabled: true });
    f.unmount();
    expect(f.wrapper.classList.contains('aaron-field')).toBe(false);
    expect(f.wrapper.classList.contains('aaron-field--block')).toBe(false);
    expect(f.wrapper.hasAttribute('aria-disabled')).toBe(false);
    expect(f.wrapper.hasAttribute('data-aaron-promoted')).toBe(false);
  });
});

describe('promoteFields', () => {
  it('promotes [data-aaron-field] inputs + textareas', () => {
    document.body.innerHTML = `
      <input type="text" data-aaron-field>
      <textarea data-aaron-field></textarea>
      <input type="text">
    `;
    const promoted = promoteFields();
    promoted.forEach((f) => mounted.push(f));
    expect(promoted).toHaveLength(2);
  });

  it('idempotent', () => {
    document.body.innerHTML = `<input type="text" data-aaron-field>`;
    const first = promoteFields();
    first.forEach((f) => mounted.push(f));
    const second = promoteFields();
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it('warns + skips non-input/textarea elements', () => {
    document.body.innerHTML = `<div data-aaron-field>nope</div>`;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const promoted = promoteFields();
    promoted.forEach((f) => mounted.push(f));
    expect(promoted).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });
});
