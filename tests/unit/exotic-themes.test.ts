import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTheme } from '../../src/themes/schema/index.js';

const slugs = ['acid','1138','big-blue','1990','evolution'];

describe('exotic theme bundles', () => {
  for (const slug of slugs) {
    it(`themes/${slug}/theme.json validates`, () => {
      const t = JSON.parse(readFileSync(`themes/${slug}/theme.json`, 'utf8'));
      expect(() => parseTheme(t)).not.toThrow();
    });
  }
});
