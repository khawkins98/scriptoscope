import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AaronProgress, promoteProgressBars } from './AaronProgress.js';
import { themeRegistry } from '../themes/runtime/ThemeRegistry.js';

beforeEach(() => themeRegistry.reset());
afterEach(() => themeRegistry.reset());

describe('AaronProgress', () => {
  it('mounts with role=progressbar + initial value=0', () => {
    const p = new AaronProgress();
    expect(p.element.getAttribute('role')).toBe('progressbar');
    expect(p.element.getAttribute('aria-valuenow')).toBe('0');
    expect(p.element.getAttribute('aria-valuemin')).toBe('0');
    expect(p.element.getAttribute('aria-valuemax')).toBe('100');
    expect(p.value).toBe(0);
  });

  it('creates the three painted child divs', () => {
    const p = new AaronProgress();
    expect(p.element.querySelector('.aaron-progress__frame')).not.toBeNull();
    expect(p.element.querySelector('.aaron-progress__track')).not.toBeNull();
    expect(p.element.querySelector('.aaron-progress__track .aaron-progress__fill')).not.toBeNull();
  });

  it('initial value/min/max are clamped + reflected', () => {
    const p = new AaronProgress({ value: 50, min: 0, max: 200 });
    expect(p.value).toBe(50);
    expect(p.element.getAttribute('aria-valuenow')).toBe('50');
    expect(p.element.getAttribute('aria-valuemax')).toBe('200');
  });

  it('initial out-of-range value clamps to bounds', () => {
    const p1 = new AaronProgress({ value: 200, max: 100 });
    expect(p1.value).toBe(100);
    const p2 = new AaronProgress({ value: -5, min: 0 });
    expect(p2.value).toBe(0);
  });

  it('setValue clamps + updates aria-valuenow + fill width', () => {
    const p = new AaronProgress({ max: 100 });
    p.setValue(42);
    expect(p.value).toBe(42);
    expect(p.element.getAttribute('aria-valuenow')).toBe('42');
    expect(p.fill.style.width).toBe('42%');
    expect(p.element.style.getPropertyValue('--progress')).toBe('0.42');
  });

  it('setValue clamps above max', () => {
    const p = new AaronProgress({ max: 100 });
    p.setValue(200);
    expect(p.value).toBe(100);
    expect(p.fill.style.width).toBe('100%');
  });

  it('respects min offset for --progress calculation', () => {
    const p = new AaronProgress({ value: 30, min: 20, max: 40 });
    // (30 - 20) / (40 - 20) = 0.5
    expect(p.element.style.getPropertyValue('--progress')).toBe('0.5');
    expect(p.fill.style.width).toBe('50%');
  });

  it('setDisabled flips data-state + aria-disabled', () => {
    const p = new AaronProgress();
    p.setDisabled(true);
    expect(p.element.getAttribute('data-state')).toBe('disabled');
    expect(p.element.getAttribute('aria-disabled')).toBe('true');
    p.setDisabled(false);
    expect(p.element.getAttribute('data-state')).toBe('normal');
    expect(p.element.hasAttribute('aria-disabled')).toBe(false);
  });

  it('setMode toggles data-mode', () => {
    const p = new AaronProgress();
    expect(p.element.getAttribute('data-mode')).toBe('determinate');
    p.setMode('indeterminate');
    expect(p.element.getAttribute('data-mode')).toBe('indeterminate');
  });

  it('unmount removes promotion + class', () => {
    const p = new AaronProgress();
    p.unmount();
    expect(p.element.classList.contains('aaron-progress')).toBe(false);
    expect(p.element.hasAttribute('role')).toBe(false);
  });

  it('promoteProgressBars wraps existing divs + reads data-value/min/max', () => {
    document.body.innerHTML = `
      <div data-aaron-progress data-value="60" data-min="0" data-max="100"></div>
      <div data-aaron-progress data-value="3" data-max="10"></div>
      <div>Untouched</div>
    `;
    const promoted = promoteProgressBars(document.body);
    expect(promoted.length).toBe(2);
    expect(promoted[0]!.value).toBe(60);
    expect(promoted[0]!.max).toBe(100);
    expect(promoted[1]!.value).toBe(3);
    expect(promoted[1]!.max).toBe(10);
    // Idempotent
    expect(promoteProgressBars(document.body).length).toBe(0);
    document.body.innerHTML = '';
  });

  it('promoteProgressBars honors disabled attribute', () => {
    document.body.innerHTML = `<div data-aaron-progress disabled></div>`;
    const promoted = promoteProgressBars(document.body);
    expect(promoted[0]!.element.getAttribute('data-state')).toBe('disabled');
    document.body.innerHTML = '';
  });
});
