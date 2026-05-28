// attachThemeDropZone — wire click + drag-and-drop file input onto an arbitrary element so
// consumers can "drop a Kaleidoscope theme on the page and have it skin everything." Pure UX
// glue: NO decoder dependency (the decoder lives in `tools/theme-loader/`, kept out of the
// runtime per the layer-separation rule). The caller gets each picked/dropped File via
// `onFile(file)` and decides how to decode + apply it.
//
// Typical wiring (in a consumer page or demo):
//
//   const handle = await mountDeclarative({ themeBaseUrl: '/themes' });
//   const button = document.querySelector('#scheme-drop');
//   attachThemeDropZone(button, {
//     onFile: async (file) => {
//       const theme = await loadKaleidoscopeScheme(file, { source: file.name });
//       const ref = `dropped:${file.name}`;
//       handle.registerTheme(ref, theme);
//       // … add an <option> to your switcher / dispatch a change event / call handle.retheme(ref).
//     },
//   });
//
// Why this lives in the runtime even though it's UX-light: it's the natural shape of the
// drop-to-skin flow for any consumer, and the click + drag-event plumbing is finicky enough
// (drag-leave fires on every child enter; preventDefault on dragover is non-obvious; focus
// + keyboard activation needs care) that a documented helper saves re-derivation.

import { debug } from '../debug.js';

export interface ThemeDropZoneOptions {
  /** Called for each successfully picked / dropped file. Receives the raw File; you decide
   *  how to decode + apply (the runtime doesn't ship a decoder by design). */
  onFile: (file: File) => void | Promise<void>;
  /** Optional handler for picker / drop errors (NOT decode failures — those happen in your
   *  `onFile`). Picker can fail in restricted iframes; drop can fire with zero files. */
  onError?: (err: unknown) => void;
  /** File-picker `accept` string. Default covers everything `loadKaleidoscopeScheme` handles:
   *  StuffIt, MacBinary, HQX, AppleSingle / AppleDouble, raw resource forks, Compact Pro. */
  accept?: string;
  /** CSS class added to `target` during dragenter/dragover, removed on dragleave/drop. Default
   *  `aaron-drop-active`. Consumers style this however they like in their own stylesheet. */
  activeClass?: string;
}

export interface ThemeDropZoneHandle {
  /** Stop listening + remove the file input. Idempotent. */
  detach(): void;
}

const DEFAULT_ACCEPT = '.sit,.hqx,.bin,.rsrc,.as,.adf,.cpt';
const DEFAULT_ACTIVE_CLASS = 'aaron-drop-active';

/** Wire click + drag-and-drop on `target` so picking or dropping a file calls `opts.onFile`. */
export function attachThemeDropZone(
  target: HTMLElement, opts: ThemeDropZoneOptions,
): ThemeDropZoneHandle {
  const accept = opts.accept ?? DEFAULT_ACCEPT;
  const activeClass = opts.activeClass ?? DEFAULT_ACTIVE_CLASS;
  // Hidden file input — kept in the DOM so picker history works across pickers in the page.
  // Reuses a single input per target so repeated activations don't multiply state.
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';
  target.appendChild(input);

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    debug('promote', `themeDropZone: ${file.name} (${file.size} B)`);
    try { await opts.onFile(file); }
    catch (err) { if (opts.onError) opts.onError(err); else console.error('[aaron] themeDropZone onFile failed:', err); }
    finally { input.value = ''; } // allow re-picking the SAME file (browsers suppress duplicate change otherwise)
  };

  const onClick = (): void => { input.click(); };
  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  };
  const onChange = (): void => { void handleFile(input.files?.[0]); };

  // Drag-and-drop: must preventDefault on BOTH dragenter and dragover or the browser
  // navigates to the dropped file's URI. dragleave on a parent fires whenever a child is
  // entered, so we gate `activeClass` removal by checking the relatedTarget.
  const stop = (e: DragEvent): void => { e.preventDefault(); e.stopPropagation(); };
  const onDragEnter = (e: DragEvent): void => { stop(e); target.classList.add(activeClass); };
  const onDragOver = (e: DragEvent): void => { stop(e); };
  const onDragLeave = (e: DragEvent): void => {
    // Only clear active class when the drag actually leaves the target's subtree, not when
    // moving between its descendants. relatedTarget === null when the pointer leaves the window.
    if (!e.relatedTarget || !target.contains(e.relatedTarget as Node)) {
      target.classList.remove(activeClass);
    }
  };
  const onDrop = (e: DragEvent): void => {
    stop(e);
    target.classList.remove(activeClass);
    const file = e.dataTransfer?.files?.[0];
    if (!file) {
      if (opts.onError) opts.onError(new Error('drop fired with no files (likely a non-file drag, e.g. text)'));
      return;
    }
    void handleFile(file);
  };

  target.addEventListener('click', onClick);
  target.addEventListener('keydown', onKeydown);
  input.addEventListener('change', onChange);
  target.addEventListener('dragenter', onDragEnter);
  target.addEventListener('dragover', onDragOver);
  target.addEventListener('dragleave', onDragLeave);
  target.addEventListener('drop', onDrop);

  let detached = false;
  return {
    detach: () => {
      if (detached) return; detached = true;
      target.removeEventListener('click', onClick);
      target.removeEventListener('keydown', onKeydown);
      input.removeEventListener('change', onChange);
      target.removeEventListener('dragenter', onDragEnter);
      target.removeEventListener('dragover', onDragOver);
      target.removeEventListener('dragleave', onDragLeave);
      target.removeEventListener('drop', onDrop);
      target.classList.remove(activeClass);
      input.remove();
    },
  };
}
