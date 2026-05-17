import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AaronCheckbox,
  AaronRadio,
  promoteCheckboxes,
  promoteRadios,
} from './AaronCheckable.js';
import { _resetEngineBaselineForTests } from './engineBaseline.js';

let mounted: Array<AaronCheckbox | AaronRadio> = [];

function track<T extends AaronCheckbox | AaronRadio>(c: T): T {
  mounted.push(c);
  return c;
}

beforeEach(() => {
  _resetEngineBaselineForTests();
});

afterEach(() => {
  for (const c of mounted) c.unmount();
  mounted = [];
  document.body.innerHTML = '';
});

describe('AaronCheckbox', () => {
  describe('construction from existing input', () => {
    it('wraps a bare input in a <label> if not already wrapped', () => {
      const input = document.createElement('input');
      input.type = 'checkbox';
      document.body.appendChild(input);
      const cb = track(new AaronCheckbox(input));
      expect(cb.label.tagName).toBe('LABEL');
      expect(cb.label.contains(input)).toBe(true);
      expect(cb.label.classList.contains('aaron-control')).toBe(true);
      expect(cb.label.classList.contains('aaron-checkbox')).toBe(true);
    });

    it('reuses an existing wrapping label', () => {
      document.body.innerHTML = `<label><input type="checkbox"> Agree</label>`;
      const input = document.body.querySelector('input')!;
      const originalLabel = input.closest('label')!;
      const cb = track(new AaronCheckbox(input));
      expect(cb.label).toBe(originalLabel);
    });

    it('inserts the chrome span as a sibling of the input', () => {
      const input = document.createElement('input');
      input.type = 'checkbox';
      document.body.appendChild(input);
      const cb = track(new AaronCheckbox(input));
      expect(cb.chrome.classList.contains('aaron-checkbox__chrome')).toBe(true);
      expect(cb.chrome.getAttribute('aria-hidden')).toBe('true');
      expect(cb.label.contains(cb.chrome)).toBe(true);
    });

    it('rejects non-checkbox input', () => {
      const input = document.createElement('input');
      input.type = 'text';
      expect(() => new AaronCheckbox(input)).toThrow(/expected.*checkbox/);
    });
  });

  describe('construction from options', () => {
    it('creates a fresh input + label + chrome + label text', () => {
      const cb = track(new AaronCheckbox({ label: 'I agree', checked: true }));
      expect(cb.element.type).toBe('checkbox');
      expect(cb.checked).toBe(true);
      expect(cb.label.textContent).toContain('I agree');
    });

    it('options propagate to the underlying input', () => {
      const cb = track(new AaronCheckbox({ name: 'agree', value: 'yes', disabled: true }));
      expect(cb.element.name).toBe('agree');
      expect(cb.element.value).toBe('yes');
      expect(cb.disabled).toBe(true);
      expect(cb.label.getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('state', () => {
    it('setChecked + change event', () => {
      const onChange = vi.fn();
      const cb = track(new AaronCheckbox({ onChange }));
      cb.setChecked(true);
      expect(cb.checked).toBe(true);
      expect(onChange).toHaveBeenCalledWith(true, cb.element);
    });

    it('setDisabled flips aria-disabled', () => {
      const cb = track(new AaronCheckbox({}));
      cb.setDisabled(true);
      expect(cb.label.getAttribute('aria-disabled')).toBe('true');
      cb.setDisabled(false);
      expect(cb.label.hasAttribute('aria-disabled')).toBe(false);
    });
  });

  describe('unmount', () => {
    it('removes Aaron UI classes + attributes', () => {
      const cb = new AaronCheckbox({ label: 'X' });
      cb.unmount();
      expect(cb.label.classList.contains('aaron-control')).toBe(false);
      expect(cb.label.classList.contains('aaron-checkbox')).toBe(false);
      expect(cb.label.hasAttribute('data-aaron-promoted')).toBe(false);
    });
  });
});

describe('AaronRadio', () => {
  it('renders an input type=radio', () => {
    const r = track(new AaronRadio({ label: 'One' }));
    expect(r.element.type).toBe('radio');
    expect(r.label.classList.contains('aaron-radio')).toBe(true);
  });

  it('shared name groups radios (native browser behaviour)', () => {
    const a = track(new AaronRadio({ name: 'g', value: '1' }));
    const b = track(new AaronRadio({ name: 'g', value: '2' }));
    document.body.append(a.label, b.label);
    a.setChecked(true);
    expect(a.checked).toBe(true);
    expect(b.checked).toBe(false);
    b.element.click();
    expect(a.checked).toBe(false);
    expect(b.checked).toBe(true);
  });

  it('rejects non-radio input', () => {
    const input = document.createElement('input');
    input.type = 'text';
    expect(() => new AaronRadio(input)).toThrow(/expected.*radio/);
  });
});

describe('promoteCheckboxes', () => {
  it('promotes [data-aaron-checkbox] inputs', () => {
    document.body.innerHTML = `
      <label><input type="checkbox" data-aaron-checkbox> One</label>
      <label><input type="checkbox" data-aaron-checkbox> Two</label>
      <label><input type="checkbox"> Not promoted</label>
    `;
    const promoted = promoteCheckboxes();
    promoted.forEach((c) => mounted.push(c));
    expect(promoted).toHaveLength(2);
    expect(promoted[0]!.label.classList.contains('aaron-checkbox')).toBe(true);
  });

  it('idempotent: re-running skips already-promoted', () => {
    document.body.innerHTML = `<label><input type="checkbox" data-aaron-checkbox></label>`;
    const first = promoteCheckboxes();
    first.forEach((c) => mounted.push(c));
    const second = promoteCheckboxes();
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it('scoped to a specific root', () => {
    document.body.innerHTML = `
      <label><input type="checkbox" data-aaron-checkbox> Outside</label>
      <div id="scope">
        <label><input type="checkbox" data-aaron-checkbox> Inside</label>
      </div>
    `;
    const scope = document.getElementById('scope')!;
    const promoted = promoteCheckboxes(scope);
    promoted.forEach((c) => mounted.push(c));
    expect(promoted).toHaveLength(1);
  });
});

describe('promoteRadios', () => {
  it('promotes [data-aaron-radio] inputs preserving the name attribute', () => {
    document.body.innerHTML = `
      <label><input type="radio" name="g" data-aaron-radio value="a"> A</label>
      <label><input type="radio" name="g" data-aaron-radio value="b"> B</label>
    `;
    const promoted = promoteRadios();
    promoted.forEach((r) => mounted.push(r));
    expect(promoted).toHaveLength(2);
    expect(promoted[0]!.element.name).toBe('g');
    expect(promoted[1]!.element.name).toBe('g');
    // Group behaviour intact.
    promoted[0]!.element.click();
    expect(promoted[0]!.checked).toBe(true);
    expect(promoted[1]!.checked).toBe(false);
  });
});
