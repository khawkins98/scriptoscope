// A caller supplies every source. No discovery, move observer or retry service.
export async function attachNativeSources(api, { root, theme, buttons = [], controls = [] }) {
  const lifetime = new AbortController();
  const canCommit = source => !lifetime.signal.aborted && root.contains(source);
  const faces = [], sourceFaces = new Map();
  try {
    for (const source of buttons) {
      const face = await api.promoteGuardedButton(source, theme, lifetime.signal, () => canCommit(source));
      if (face) { faces.push(face); sourceFaces.set(source, face); }
    }
    for (const source of controls) {
      const face = await api.promoteGuardedControl(source, theme, lifetime.signal, () => canCommit(source));
      if (face) { faces.push(face); sourceFaces.set(source, face); }
    }
  } catch (error) {
    lifetime.abort(); buttons.forEach(api.restoreButton); controls.forEach(api.restoreControl);
    throw error;
  }
  return { faces, async replace(nextTheme) {
    for (const source of buttons) {
      const old = sourceFaces.get(source);
      const focused = old?.contains(document.activeElement);
      const face = await api.promoteGuardedButton(source, nextTheme, lifetime.signal, () => canCommit(source));
      if (face) { if (focused) face.focus(); if (old) api.disposePromotedButtonFace(source, old); faces.push(face); sourceFaces.set(source, face); }
    }
    for (const source of controls) {
      const face = await api.promoteGuardedControl(source, nextTheme, lifetime.signal, () => canCommit(source));
      if (face) { faces.push(face); sourceFaces.set(source, face); }
    }
  }, disconnect() {
    lifetime.abort(); buttons.forEach(api.restoreButton); controls.forEach(api.restoreControl);
  } };
}
