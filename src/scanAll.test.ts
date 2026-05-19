import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanAll, startUnifiedScanner, stopUnifiedScanner } from './scanAll.js';

describe('scanAll (one-shot)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('promotes a mixed set of families in one call', () => {
    document.body.innerHTML = `
      <button data-aaron-button>OK</button>
      <input type="checkbox" data-aaron-checkbox>
      <input type="radio" data-aaron-radio name="r">
      <input type="text" data-aaron-field value="hello">
      <button data-aaron-disclosure>Show</button>
    `;
    const result = scanAll(document);
    expect(result).toMatchObject({
      buttons: 1,
      checkboxes: 1,
      radios: 1,
      fields: 1,
      disclosures: 1,
    });
    expect(document.body.querySelectorAll('[data-aaron-promoted]').length).toBeGreaterThanOrEqual(3);
  });

  it('is idempotent — second call returns zero counts', () => {
    document.body.innerHTML = `<button data-aaron-button>OK</button>`;
    expect(scanAll(document).buttons).toBe(1);
    expect(scanAll(document).buttons).toBe(0);
  });

  it('returns zero counts on an empty subtree', () => {
    const result = scanAll(document);
    expect(result).toEqual({
      windows: 0,
      buttons: 0,
      bevelButtons: 0,
      checkboxes: 0,
      radios: 0,
      fields: 0,
      disclosures: 0,
      placards: 0,
      windowHeaders: 0,
      progressBars: 0,
    });
  });

  it('scopes promotion to the provided root', () => {
    document.body.innerHTML = `
      <div id="outside"><button data-aaron-button>Outer</button></div>
      <div id="inside"><button data-aaron-button>Inner</button></div>
    `;
    const root = document.getElementById('inside')!;
    const result = scanAll(root);
    expect(result.buttons).toBe(1);
    // The outside button stays un-promoted (no data-aaron-promoted).
    const outsideBtn = document.querySelector('#outside button')!;
    expect(outsideBtn.hasAttribute('data-aaron-promoted')).toBe(false);
  });
});

describe('startUnifiedScanner / MutationObserver', () => {
  afterEach(() => {
    stopUnifiedScanner();
    document.body.innerHTML = '';
  });

  it('promotes elements added after start via MutationObserver', async () => {
    startUnifiedScanner();
    // Add an element after start
    const btn = document.createElement('button');
    btn.setAttribute('data-aaron-button', '');
    btn.textContent = 'Late';
    document.body.appendChild(btn);
    // MutationObserver fires asynchronously — flush a microtask.
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(btn.hasAttribute('data-aaron-promoted')).toBe(true);
  });

  it('promotes descendants of added subtrees', async () => {
    startUnifiedScanner();
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <input type="checkbox" data-aaron-checkbox>
      <button data-aaron-disclosure>Toggle</button>
    `;
    document.body.appendChild(wrap);
    await new Promise((r) => setTimeout(r, 0));
    expect(wrap.querySelector('input[data-aaron-promoted-input]')).not.toBeNull();
    expect(wrap.querySelector('button[data-aaron-promoted]')).not.toBeNull();
  });

  it('stopUnifiedScanner halts further promotion of dynamic additions', async () => {
    startUnifiedScanner();
    stopUnifiedScanner();
    const btn = document.createElement('button');
    btn.setAttribute('data-aaron-button', '');
    document.body.appendChild(btn);
    await new Promise((r) => setTimeout(r, 0));
    expect(btn.hasAttribute('data-aaron-promoted')).toBe(false);
  });

  it('startUnifiedScanner is idempotent', () => {
    startUnifiedScanner();
    expect(() => startUnifiedScanner()).not.toThrow();
  });
});
