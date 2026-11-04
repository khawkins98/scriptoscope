import { loadOwnedTheme, WindowManager, type OwnedTheme } from 'scriptoscope';
import { ScriptoscopeWindow, promoteControl, restoreControl } from 'scriptoscope/declarative';
import 'scriptoscope/scriptoscope.css';

const source = document.querySelector<HTMLElement>('#window')!;
const input = document.querySelector<HTMLInputElement>('#check')!;
const status = document.querySelector<HTMLOutputElement>('#status')!;
const teardown = document.querySelector<HTMLButtonElement>('#teardown')!;

// Owned loaders need an owned manager: the default generic is LoadedTheme.
const manager = new WindowManager<OwnedTheme>();
let theme: OwnedTheme | undefined;
let promoted: ScriptoscopeWindow<OwnedTheme> | undefined;
let stopped = false;

function disconnect() {
  if (stopped) return;
  stopped = true;
  // Restore dependents before releasing the theme they borrow.
  restoreControl(input);
  promoted?.unmount();
  manager.dispose();
  theme?.dispose();
  teardown.disabled = true;
  status.value = 'Native HTML restored. Your checkbox value is preserved.';
}

teardown.addEventListener('click', disconnect);
// Keep the mounted UI intact when the browser caches the page for Back/Forward.
addEventListener('pagehide', event => { if (!event.persisted) disconnect(); });

async function mount() {
  try {
    const loaded = await loadOwnedTheme(`${import.meta.env.BASE_URL}themes/scriptoscope`, {
      source: 'scheme.rsrc',
    });
    if (stopped) { loaded.dispose(); return; }
    theme = loaded;
    promoted = await ScriptoscopeWindow.promote(source, { manager, theme });
    if (stopped) { promoted.unmount(); return; }
    await promoteControl(input, theme);
    if (stopped) { restoreControl(input); return; }
    status.value = 'Ready';
    teardown.disabled = false;
  } catch (error) {
    disconnect();
    status.value = `Could not load Scriptoscope: ${error instanceof Error ? error.message : String(error)}. Run npm run theme and check the theme URL.`;
    // Preserve a useful error for application diagnostics.
    console.error(error);
  }
}

void mount();
