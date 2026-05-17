import { describe, it, expect } from 'vitest';
import { VERSION, __aaronUiToolchainCheck } from './index.js';

describe('aaron-ui toolchain smoke', () => {
  it('exports a string VERSION', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('exports a callable toolchain check', () => {
    expect(__aaronUiToolchainCheck()).toBe(true);
  });
});
