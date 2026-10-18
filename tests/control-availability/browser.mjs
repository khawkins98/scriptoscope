/** Build declared input graphs only; selection belongs exclusively to the runtime. */
function fixtureTheme(api, fixture) {
  const themes = new Map(fixture.themes.map(def => [def.id, {
    baseUrl: `${location.origin}/availability-fixture/${encodeURIComponent(fixture.id)}/${encodeURIComponent(def.id)}`,
    manifest: { chromeElements: {} },
  }]));
  for (const def of fixture.themes) {
    const theme = themes.get(def.id);
    if (def.base !== null) theme.base = themes.get(def.base);
    for (const resource of def.resources) {
      const buffer = api.PixelBuffer.alloc(resource.art.width, resource.art.height);
      for (let y = 0; y < buffer.height; y++) for (let x = 0; x < buffer.width; x++) buffer.setPixel(x, y, ...resource.art.rgba);
      theme.manifest.chromeElements[resource.manifestKey] = {
        asset: api.bufferToCanvas(buffer).toDataURL(), width: buffer.width, height: buffer.height,
        sourceCicnId: resource.signedId, sourceCinfId: resource.sourceCinfId,
        authorLabel: resource.authorLabel, slice: resource.slice, bgAnchor: resource.bgAnchor,
      };
    }
  }
  return { theme: themes.get('child'), owners: Object.fromEntries([...themes].map(([id, theme]) => [id, theme.baseUrl])) };
}

export async function runAvailabilityCase(api, c, fixture, sourceChoice) {
  document.querySelector('#availability-case')?.remove();
  const host = document.createElement('section'); host.id = 'availability-case'; document.body.append(host);
  const observed = { caseId: c.id, options: structuredClone(c.options), owners: {}, traces: [], result: { kind: 'error' } };
  let loaded;
  try {
    let theme;
    if (fixture) ({ theme, owners: observed.owners } = fixtureTheme(api, fixture));
    else {
      loaded = await api.loadTheme(`/themes/${sourceChoice.slug}`, { source: sourceChoice.path.split('/').at(-1) });
      theme = loaded; observed.owners[c.input] = theme.baseUrl;
    }
    const options = { ...c.options, diagnostics: { correlationId: c.id, onComplete: trace => observed.traces.push(trace) } };
    if (c.mode === 'interactive') {
      let activationCount = 0;
      const element = await api.interactiveButton(theme, { ...options, onClick: () => { activationCount++; } });
      element.id = 'availability-native';
      const before = document.createElement('button'), after = document.createElement('button');
      before.id = 'availability-before'; before.textContent = 'Before'; after.id = 'availability-after'; after.textContent = 'After';
      host.append(before, element, after); before.focus();
      observed.result = { kind: element.tagName === 'BUTTON' ? 'native-procedural' : 'themed' };
      observed.native = { element: element.tagName.toLowerCase(), disabled: element.disabled === true,
        // Accessibility-tree name is measured by Playwright in the caller.
        accessibleName: null, keyboard: {}, activationCount: 0 };
      window.availabilityInteraction = { observed, activationCount: () => activationCount };
    } else {
      const render = c.family === 'push-button' ? api.composeButton : api.composeBevelButton;
      const output = await render(theme, options);
      observed.result = output ? { kind: 'themed', width: output.width, height: output.height } : { kind: 'unavailable' };
      if (output) host.append(api.bufferToCanvas(output));
    }
  } catch (error) { observed.result = { kind: 'error' }; observed.error = error?.stack ?? String(error); }
  finally { loaded?.dispose?.(); }
  return observed;
}
