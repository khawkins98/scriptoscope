import { test, expect, openHarness } from './fixtures.mjs';
import { SLUGS } from './progress-rules.mjs';
for (const mode of ['source', 'built']) test(`${mode}: ProgressIdle public compose preserves the frame phase invariant`, async ({ page, servers }) => {
  await openHarness(page, servers, mode);
  const result = await page.evaluate(async ({ mode, slugs }) => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const failures = [];
    for (const phase of [-1, 256, 1.5, NaN, Infinity]) {
      try { new api.ProgressIdle({ phase }); failures.push(`accepted phase ${phase}`); } catch (e) { if (!(e instanceof RangeError)) throw e; }
    }
    for (const slug of slugs) {
      const theme = await api.loadTheme(`/themes/${slug}`);
      for (const phase of [0, 2, 7, 255]) {
        const idle = new api.ProgressIdle({ phase, indeterminate: true });
        const frame = await api.composeProgressFrame(theme, { length: 100, phase, indeterminate: true });
        if (!['kaleidoscope', 'procedural'].includes(frame.path)) failures.push(`${slug}/${phase}/invalid public path ${frame.path}`);
        const actual = await idle.compose(theme, { length: 100 });
        if (idle.phase !== frame.phase || actual.data.some((n, i) => n !== frame.buffer.data[i])) failures.push(`${slug}/${phase}`);
        idle.indeterminate = false;
        if (idle.phase !== frame.phase || idle.idle(3)) failures.push(`${slug}/${phase}/IDLE4`);
      }
      theme.dispose?.();
    }
    return failures;
  }, { mode, slugs: SLUGS });
  expect(result).toEqual([]);
});
