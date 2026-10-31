import { test, expect, openHarness, attachCase } from './fixtures.mjs';

// #595: Windows95 ships six distinct disclosure cicns, right/down × normal/pressed/
// inactive, under the canonical signed ids (author labels in 1138/animals/beos-r503/
// 1990 name the same ids). Each state must paint its own source cicn 1:1, so the
// outputs are distinct exactly where the source cicns are. Windows95's author drew
// the three states of each direction identically (a plus box right, a minus box
// down), so the six states show two images, and right never equals down.
const CASES = [
  ['right', 'normal', -10111], ['right', 'pressed', -10110], ['right', 'inactive', -10112],
  ['down', 'normal', -10103], ['down', 'pressed', -10102], ['down', 'inactive', -10104],
];

for (const mode of ['source', 'built']) test(`${mode}: Windows95 disclosure states paint their own canonical cicns`, async ({ page, servers }, testInfo) => {
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async ({ mode, cases }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const pixels = buffer => { const out = []; for (let y = 0; y < buffer.height; y++) for (let x = 0; x < buffer.width; x++) out.push(...buffer.getPixel(x, y)); return `${buffer.width}x${buffer.height}:${out.join(',')}`; };
      const theme = await api.loadTheme('/themes/windows-95', { source: 'scheme.sit' });
      try {
        const rows = [];
        for (const [direction, state, id] of cases) {
          const element = Object.values(theme.manifest.chromeElements).find(el => el.sourceCicnId === id);
          if (!element) throw new Error(`Missing Windows95 cicn ${id}`);
          const source = pixels(await api.loadCicnBuffer(api.assetUrl(theme, element.asset)));
          const output = await api.composeDisclosure(theme, { direction, state });
          rows.push({ direction, state, id, source, output: output ? pixels(output) : null });
        }
        return rows;
      } finally { theme.dispose?.(); }
    }, { mode, cases: CASES });
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row.output, `${row.direction}/${row.state} paints cicn ${row.id} 1:1`).toBe(row.source);
    const groups = rows.map(row => rows.findIndex(other => other.source === row.source));
    expect(groups, 'source cicns: one image per direction').toEqual([0, 0, 0, 3, 3, 3]);
    expect(rows.map(row => rows.findIndex(other => other.output === row.output)), 'outputs follow the source images').toEqual(groups);
  } catch (error) {
    await attachCase(page, testInfo, { mode, oracle: 'disclosure-canonical-state-ids',
      rows: rows?.map(({ source, output, ...rest }) => ({ ...rest, matches: source === output })) }, error);
    throw error;
  }
});
