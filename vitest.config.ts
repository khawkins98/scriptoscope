import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      // Loader decoders are plain browser-portable JS — they live in
      // src/themes/loader/ and their tests live alongside. The CLI in
      // tools/scheme-extractor/bin/ is a thin Node wrapper around them.
      'src/themes/loader/**/*.test.js',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**', 'tools/**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'src/themes/loader/**/*.js'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/themes/loader/**/*.test.js',
      ],
    },
  },
});
