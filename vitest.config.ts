import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      // Extractor is plain JS (browser-portable lib + Node CLI) — its tests
      // live alongside the lib files. The TS schema (#35) and JS validator
      // mirror (#36) are exercised against the same fixtures from here.
      'tools/scheme-extractor/lib/**/*.test.js',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**', 'tools/**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'tools/scheme-extractor/lib/**/*.js'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'tools/scheme-extractor/lib/**/*.test.js',
      ],
    },
  },
});
