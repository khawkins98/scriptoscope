import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AaronButton, promoteButtons } from './AaronButton.js';
import { _resetEngineBaselineForTests } from './engineBaseline.js';

let buttons: AaronButton[] = [];

function track(b: AaronButton): AaronButton {
  buttons.push(b);
  return b;
}

beforeEach(() => {
  _resetEngineBaselineForTests();
});

afterEach(() => {
  for (const b of buttons) b.unmount();
  buttons = [];
  document.body.innerHTML = '';
});

describe('AaronButton', () => {
  describe('construction', () => {
    it('wraps an existing <button>', () => {
      const el = document.createElement('button');
      el.textContent = 'Click';
      document.body.appendChild(el);
      const btn = track(new AaronButton(el));
      expect(btn.element).toBe(el);
      expect(el.classList.contains('aaron-control')).toBe(true);
      expect(el.classList.contains('aaron-button')).toBe(true);
    });

    it('creates a new <button> when given options', () => {
      const btn = track(new AaronButton({ label: 'OK' }));
      expect(btn.element.tagName).toBe('BUTTON');
      expect(btn.element.textContent).toBe('OK');
    });

    it('label option does not overwrite existing text content', () => {
      const el = document.createElement('button');
      el.textContent = 'Original';
      const btn = track(new AaronButton(el));
      expect(btn.element.textContent).toBe('Original');
    });

    it('defaults type=button (not submit) to avoid form-submit surprise', () => {
      const btn = track(new AaronButton({ label: 'OK' }));
      expect(btn.element.type).toBe('button');
    });

    it('preserves an explicit type attribute on existing element', () => {
      const el = document.createElement('button');
      el.type = 'submit';
      const btn = track(new AaronButton(el));
      expect(btn.element.type).toBe('submit');
    });
  });

  describe('default button variant', () => {
    it('defaults to non-default button', () => {
      const btn = track(new AaronButton({ label: 'OK' }));
      expect(btn.defaultButton).toBe(false);
      expect(btn.element.classList.contains('aaron-button--default')).toBe(false);
    });

    it('opts.defaultButton sets the variant + adds the class', () => {
      const btn = track(new AaronButton({ label: 'OK', defaultButton: true }));
      expect(btn.defaultButton).toBe(true);
      expect(btn.element.classList.contains('aaron-button--default')).toBe(true);
    });

    it('detects [data-aaron-button-default] attribute on existing element', () => {
      const el = document.createElement('button');
      el.setAttribute('data-aaron-button-default', '');
      const btn = track(new AaronButton(el));
      expect(btn.defaultButton).toBe(true);
      expect(el.classList.contains('aaron-button--default')).toBe(true);
    });
  });

  describe('state', () => {
    it('sets data-state="normal" on mount', () => {
      const btn = track(new AaronButton({ label: 'OK' }));
      expect(btn.element.getAttribute('data-state')).toBe('normal');
    });

    it('setDisabled(true) sets aria-disabled + native disabled', () => {
      const btn = track(new AaronButton({ label: 'OK' }));
      btn.setDisabled(true);
      expect(btn.element.disabled).toBe(true);
      expect(btn.element.getAttribute('aria-disabled')).toBe('true');
    });

    it('setDisabled(false) clears both', () => {
      const btn = track(new AaronButton({ label: 'OK', disabled: true }));
      btn.setDisabled(false);
      expect(btn.element.disabled).toBe(false);
      expect(btn.element.hasAttribute('aria-disabled')).toBe(false);
    });

    it('opts.disabled sets initial disabled state', () => {
      const btn = track(new AaronButton({ label: 'OK', disabled: true }));
      expect(btn.disabled).toBe(true);
      expect(btn.element.getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('activation', () => {
    it('fires onActivate when programmatically clicked', () => {
      const onActivate = vi.fn();
      const btn = track(new AaronButton({ label: 'OK', onActivate }));
      btn.click();
      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('disabled buttons do not fire onActivate', () => {
      const onActivate = vi.fn();
      const btn = track(new AaronButton({ label: 'OK', disabled: true, onActivate }));
      btn.click();
      expect(onActivate).not.toHaveBeenCalled();
    });

    it('Enter key fires onActivate (via state machine)', () => {
      const onActivate = vi.fn();
      const btn = track(new AaronButton({ label: 'OK', onActivate }));
      btn.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('Space key fires onActivate', () => {
      const onActivate = vi.fn();
      const btn = track(new AaronButton({ label: 'OK', onActivate }));
      btn.element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('aria-disabled mid-life suppresses activation', () => {
      const onActivate = vi.fn();
      const btn = track(new AaronButton({ label: 'OK', onActivate }));
      btn.setDisabled(true);
      btn.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onActivate).not.toHaveBeenCalled();
    });
  });

  describe('unmount', () => {
    it('removes Aaron UI classes', () => {
      const el = document.createElement('button');
      el.textContent = 'OK';
      const btn = new AaronButton(el);
      btn.unmount();
      expect(el.classList.contains('aaron-control')).toBe(false);
      expect(el.classList.contains('aaron-button')).toBe(false);
    });

    it('detaches state machine — post-unmount keypress does nothing', () => {
      const onActivate = vi.fn();
      const btn = new AaronButton({ label: 'OK', onActivate });
      btn.unmount();
      btn.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onActivate).not.toHaveBeenCalled();
    });
  });
});

describe('promoteButtons', () => {
  it('promotes [data-aaron-button] elements to AaronButton instances', () => {
    document.body.innerHTML = `
      <button data-aaron-button>One</button>
      <button data-aaron-button>Two</button>
      <button>Not promoted</button>
    `;
    const promoted = promoteButtons();
    promoted.forEach(b => buttons.push(b));
    expect(promoted).toHaveLength(2);
    expect(promoted[0]!.element.textContent).toBe('One');
    expect(promoted[1]!.element.textContent).toBe('Two');
  });

  it('promotes [data-aaron-button-default] as default variant', () => {
    document.body.innerHTML = `
      <button data-aaron-button-default>OK</button>
    `;
    const promoted = promoteButtons();
    promoted.forEach(b => buttons.push(b));
    expect(promoted).toHaveLength(1);
    expect(promoted[0]!.defaultButton).toBe(true);
  });

  it('idempotent: re-running skips already-promoted', () => {
    document.body.innerHTML = `<button data-aaron-button>X</button>`;
    const first = promoteButtons();
    first.forEach(b => buttons.push(b));
    const second = promoteButtons();
    second.forEach(b => buttons.push(b));
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it('warns + skips non-button elements with the attribute', () => {
    document.body.innerHTML = `<div data-aaron-button>not a button</div>`;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const promoted = promoteButtons();
    promoted.forEach(b => buttons.push(b));
    expect(promoted).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('requires a <button>');
  });

  it('scoped to a specific root', () => {
    document.body.innerHTML = `
      <button data-aaron-button>Outside</button>
      <div id="scope">
        <button data-aaron-button>Inside</button>
      </div>
    `;
    const scope = document.getElementById('scope')!;
    const promoted = promoteButtons(scope);
    promoted.forEach(b => buttons.push(b));
    expect(promoted).toHaveLength(1);
    expect(promoted[0]!.element.textContent).toBe('Inside');
  });
});
