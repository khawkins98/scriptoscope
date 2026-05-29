// Shared demo wiring: connect attachThemeDropZone() + loadKaleidoscopeScheme + the page's
// [data-scriptoscope-theme-switcher] <select> + the mountDeclarative handle.
//
// Layer separation: this lives in demo/ on purpose. The runtime ships attachThemeDropZone (UX
// glue, no decoder dep) and handle.registerTheme (resolver-cache seed). The decoder
// (`loadKaleidoscopeScheme`) lives in tools/theme-loader/ and is imported here at the demo
// layer. Same pattern the main demo (demo/index.html #byo-drop) already uses.
//
// Usage:
//
//   import { wireSchemeDrop } from './_theme-drop.mjs';
//   const handle = await mountDeclarative({ ... });
//   wireSchemeDrop({
//     handle,
//     dropTarget: document.querySelector('#scheme-drop'),
//     switcher:   document.querySelector('[data-scriptoscope-theme-switcher]'),
//     statusEl:   document.querySelector('#scheme-drop-status'), // optional
//   });

import { attachThemeDropZone } from '../src/declarative/index.ts';
import { loadKaleidoscopeScheme } from '../tools/theme-loader/loadKaleidoscopeScheme.js';

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
  if (!handle?.registerTheme) throw new Error('wireSchemeDrop: handle.registerTheme is required (call mountDeclarative first)');

  const setStatus = (kind, text) => {
    if (!statusEl) return;
    statusEl.dataset.kind = kind; // 'idle' | 'busy' | 'ok' | 'err'
    statusEl.textContent = text ?? '';
  };

  return attachThemeDropZone(dropTarget, {
    onFile: async (file) => {
      const name = file.name.replace(/\.[^.]+$/, '') || file.name;
      setStatus('busy', `Decoding ${file.name}…`);
      let theme;
      try {
        theme = await loadKaleidoscopeScheme(file, { meta: { name }, source: file.name });
      } catch (err) {
        setStatus('err', `Couldn't read “${file.name}” — ${err?.message ?? err}`);
        console.error('[demo] decode failed:', err);
        return;
      }

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
        switcher.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // No switcher in this page — apply directly via the handle's retheme.
        await handle.retheme(ref);
      }

      setStatus('ok', `✓ ${file.name} loaded`);
    },
    onError: (err) => {
      setStatus('err', `Drop failed: ${err?.message ?? err}`);
    },
  });
}
