// Application-owned drop lifecycle; registered themes are borrowed by the host.
import { attachThemeDropZone } from '../src/declarative/index.ts';
import { loadOwnedKaleidoscopeScheme } from '../src/loadKaleidoscopeScheme.ts';

const REF_PREFIX = 'dropped:';

/**
 * Wire a drop affordance to: (a) decode the dropped file in-browser, (b) register it under a
 * synthetic ref so the resolver knows about it, (c) append it as an <option> in the page's
 * theme switcher, (d) flip the switcher to it (which fires the existing retheme flow).
 *
 * Returns the detach handle so callers can tear down — useful for hot-reload or page-leave.
 */
export function wireSchemeDrop({ handle, dropTarget, switcher, statusEl }) {
  if (!dropTarget) throw new Error('wireSchemeDrop: dropTarget is required');
  if (!handle?.registerTheme) throw new Error('wireSchemeDrop: handle.registerTheme is required (call mountExplicitPage first)');

  const setStatus = (kind, text) => {
    if (!statusEl) return;
    statusEl.dataset.kind = kind; // 'idle' | 'busy' | 'ok' | 'err'
    statusEl.textContent = text ?? '';
  };

  let active = true;
  let generation = 0;
  const owners = new Set();
  const zone = attachThemeDropZone(dropTarget, {
    onFile: async (file) => {
      const token = ++generation;
      const name = file.name.replace(/\.[^.]+$/, '') || file.name;
      setStatus('busy', `Decoding ${file.name}…`);
      let theme;
      try {
        theme = await loadOwnedKaleidoscopeScheme(file, { meta: { name }, source: file.name });
      } catch (err) {
        if (!active || token !== generation) return;
        setStatus('err', `Couldn't read “${file.name}” — ${err?.message ?? err}`);
        console.error('[demo] decode failed:', err);
        return;
      }

      if (!active || token !== generation) { theme.dispose(); return; }
      owners.add(theme);
      const ref = `${REF_PREFIX}${file.name}`;
      handle.registerTheme(ref, theme);

      if (switcher) {
        // Drop newer wins: if the same file was dropped before, replace the old option's label
        // rather than appending a duplicate. The resolver cache was overwritten by registerTheme.
        let opt = switcher.querySelector(`option[value="${CSS.escape(ref)}"]`);
        if (!opt) {
          opt = document.createElement('option');
          opt.value = ref;
          switcher.appendChild(opt);
        }
        opt.textContent = `📂 ${file.name}`;
        switcher.value = ref;
        switcher.dispatchEvent(new Event('change', { bubbles:true }));
        await handle.whenReady();
      } else {
        // No switcher in this page — apply directly via the handle's retheme.
        await handle.retheme(ref);
      }

      if (!active || token !== generation) return;
      setStatus('ok', `✓ ${file.name} loaded`);
    },
    onError: (err) => {
      if (!active) return;
      setStatus('err', `Drop failed: ${err?.message ?? err}`);
    },
  });
  return {
    detach() { active=false; ++generation; zone.detach(); },
    // Call only after the host has released its dependent faces.
    disposeThemes() { for(const theme of owners)theme.dispose(); owners.clear(); },
  };
}
