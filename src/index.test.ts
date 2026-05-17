import { describe, it, expect } from 'vitest';
import { VERSION, AaronWindow } from './index.js';

describe('aaron-ui index exports', () => {
  it('exports a string VERSION', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('exports AaronWindow', () => {
    expect(typeof AaronWindow).toBe('function');
    expect(new AaronWindow().options.width).toBe(320);
  });
});
