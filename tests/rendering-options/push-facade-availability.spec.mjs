// Independent #608 facade hooks PF-H1..PF-H4 (docs/spec/engine/push-button.md,
// "Facade test hooks"). Expectations are the spec's literal rows; no runtime
// source, tables or goldens are imported. Standalone loads unless a row says so.
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { PF_SCHEMES, PF_POSITIVE, PF_STATES, checkPf3Unavailable, checkPf2Themed, checkPf2FromBase } from './controls459/push-facade-rules.mjs';

// Runs composeButton for each slug x state and returns literal observations.
async function probe(page, mode, slugs, base = null) {
  return page.evaluate(async ({ mode, slugs, states, base }) => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const rows = [];
    for (const slug of slugs) {
      const baseTheme = base ? await api.loadTheme('/themes/' + base) : null;
      const theme = await api.loadTheme('/themes/' + slug, baseTheme ? { base: baseTheme } : {});
      try {
        for (const [state, { options, faceId }] of Object.entries(states)) {
          let trace;
          const out = await api.composeButton(theme, { label: 'OK', ...options, diagnostics: { onComplete: t => { trace = t; } } });
          const opaque = out ? Array.from({ length: out.width * out.height }, (_, i) => out.data[i * 4 + 3]).filter(Boolean).length : 0;
          rows.push({ slug, base, state, faceId, size: out ? [out.width, out.height] : null, opaque, trace });
        }
      } finally { theme.dispose(); baseTheme?.dispose(); }
    }
    return rows;
  }, { mode, slugs, states: PF_STATES, base });
}
const failures = (rows, check) => rows.flatMap(r => check(r).map(error => `${r.slug}${r.base ? '+' + r.base : ''}:${r.state}: ${error}`));

for (const mode of ['source', 'built']) {
  test(`${mode}: PF-H1 the five no-cinf schemes return null/unavailable in every state with the PB9 face step`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await probe(page, mode, PF_SCHEMES);
    await attachObservations(info, 'pf608-h1', mode, { mode, rows, unknown: ['original pixels', 'reviewed default-cinf environment'] });
    expect(rows).toHaveLength(5 * 4);
    expect(failures(rows, checkPf3Unavailable)).toEqual([]);
  });

  test(`${mode}: PF-H2 positive controls 1138 and windows-95 stay themed with a completed face paint`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await probe(page, mode, PF_POSITIVE);
    await attachObservations(info, 'pf608-h2', mode, { mode, rows });
    expect(rows).toHaveLength(2 * 4);
    expect(failures(rows, checkPf2Themed)).toEqual([]);
  });

  test(`${mode}: PF-H3 slimes with declared base 1138 reaches PF2 with the face cinf at chainDepth 1`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await probe(page, mode, ['slimes'], '1138');
    await attachObservations(info, 'pf608-h3', mode, { mode, rows });
    expect(rows).toHaveLength(4);
    expect(failures(rows, checkPf2FromBase)).toEqual([]);
  });

  // PF-H4 black-box half (PF5): every consumer path shows the native baseline.
  // While PF3 holds this cannot detect removal of the internal face-stage gate;
  // src/pushFacadeGate.test.mjs is the detecting check for mutation 6.
  test(`${mode}: PF-H4 interactiveButton and promoteButton show the native baseline button for the five schemes`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, slugs }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const declarative = await import(mode === 'built' ? '/dist/declarative.js' : '/src/declarative/index.ts');
      const out = [];
      for (const slug of [...slugs, '1138']) {
        const theme = await api.loadTheme('/themes/' + slug);
        try {
          for (const opts of [{}, { default: true }, { disabled: true }]) {
            const el = await api.interactiveButton(theme, { label: 'OK', ...opts });
            document.body.append(el);
            out.push({ slug, path: 'interactiveButton', opts, tag: el.tagName, canvases: el.querySelectorAll('canvas').length, text: el.textContent.trim(), disabled: el.disabled === true });
            el.remove();
            const host = document.createElement('div'), source = document.createElement('button');
            source.type = 'button'; source.textContent = 'OK'; source.dataset.scriptoscopeButton = '';
            if (opts.default) source.dataset.scriptoscopeDefault = 'true';
            source.disabled = !!opts.disabled; host.append(source); document.body.append(host);
            const face = await declarative.promoteButton(source, theme);
            out.push({ slug, path: 'promoteButton', opts, tag: face.tagName, canvases: face.querySelectorAll('canvas').length, text: face.textContent.trim(), disabled: face.disabled === true });
            host.remove();
          }
        } finally { theme.dispose(); }
      }
      return out;
    }, { mode, slugs: PF_SCHEMES });
    await attachObservations(info, 'pf608-h4', mode, { mode, rows });
    expect(rows).toHaveLength(6 * 3 * 2);
    for (const r of rows) {
      const name = `${r.slug}:${r.path}:${JSON.stringify(r.opts)}`;
      if (r.slug === '1138') { expect(r.canvases, name + ' positive control keeps its themed canvas').toBe(1); continue; }
      expect({ tag: r.tag, canvases: r.canvases, text: r.text, disabled: r.disabled }, name)
        .toEqual({ tag: 'BUTTON', canvases: 0, text: 'OK', disabled: !!r.opts.disabled });
    }
  });
}
