import { createThemeResolver, ScriptoscopeWindow, WindowManager } from 'scriptoscope';
import themes from './themes-manifest.json';

// Keep existing shared demo links working after moving the showcase.
const params = new URLSearchParams(location.search);
if (params.has('theme')) {
  location.replace(`./showcase.html${location.search}${location.hash}`);
} else {
  const collage = document.getElementById('collage');
  const space = collage.parentElement;
  const reset = document.getElementById('reset-collage');
  const retry = document.getElementById('retry-collage');
  const status = document.getElementById('collage-status');
  const errorMessage = document.getElementById('collage-error');
  const caption = document.querySelector('figcaption > .art-caption');
  const schemeButtons = [...document.querySelectorAll('[data-portrait-theme]')];
  const manager = new WindowManager();
  const resolver = createThemeResolver({
    themeBaseUrl: `${import.meta.env.BASE_URL}themes`,
    themes,
  });
  const panels = [...collage.querySelectorAll('[data-scriptoscope-window]')].map(el => ({
    el,
    theme: el.dataset.scriptoscopeTheme,
    x: Number(el.dataset.scriptoscopeX),
    y: Number(el.dataset.scriptoscopeY),
    width: Number(el.dataset.scriptoscopeWidth),
    height: Number(el.dataset.scriptoscopeHeight),
  }));
  let windows = [];
  const initialPositions = new Map();
  let hasMoved = false;

  manager.setChangeListener(host => {
    if (rebuilding) return;
    const position = initialPositions.get(host);
    if (position && (host.style.left !== position.left || host.style.top !== position.top)) {
      hasMoved = true;
      reset.hidden = false;
    }
  });
  let selectedTheme = null;
  let rebuilding = false;
  let lastWidth = space.clientWidth;
  let pending = Promise.resolve();

  // Serialize rethemes, reset and responsive layout so an async theme load
  // never repaints a host while reassembly is replacing it.
  function run(update) {
    pending = pending.then(async () => {
      const focusedControl = [reset, retry, ...schemeButtons].includes(document.activeElement)
        ? document.activeElement : null;
      reset.disabled = true;
      retry.disabled = true;
      collage.inert = true;
      collage.setAttribute('aria-busy', 'true');
      errorMessage.hidden = true;
      for (const button of schemeButtons) button.disabled = true;
      try {
        await update();
      } catch (error) {
        status.textContent = 'Could not update the windows. Please try again.';
        errorMessage.hidden = false;
        console.warn('[scriptoscope] Advertisement chrome unavailable:', error);
      } finally {
        reset.disabled = false;
        retry.disabled = false;
        collage.inert = false;
        collage.removeAttribute('aria-busy');
        for (const button of schemeButtons) button.disabled = false;
        if (focusedControl && document.activeElement === document.body) {
          focusedControl.focus({ preventScroll: true });
        }
      }
    });
    return pending;
  }

  function syncSelection() {
    for (const button of schemeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.portraitTheme === (selectedTheme ?? 'mix')));
    }
    const name = themes.find(theme => theme.slug === selectedTheme)?.name;
    caption.textContent = selectedTheme
      ? `${name}. One very expressive face.`
      : 'Five original schemes. One very expressive face.';
  }

  // Reuse decoded themes on reset. Unmount restores even closed/shaded panels'
  // source elements; promotion restores geometry while keeping the chosen scheme.
  async function reassemble(nextTheme = selectedTheme) {
    lastWidth = space.clientWidth;
    const scale = lastWidth / 500;
    collage.style.setProperty('--portrait-scale', String(scale));
    // Prepare the source HTML too, so a failed initial request still leaves a
    // complete, responsive photographic composition behind the retry control.
    for (const panel of panels) {
      const { el } = panel;
      const x = Math.round(panel.x * scale), y = Math.round(panel.y * scale);
      const width = Math.max(80, Math.round(panel.width * scale));
      const height = Math.max(40, Math.round(panel.height * scale));
      Object.assign(el.dataset, {
        scriptoscopeX: String(x), scriptoscopeY: String(y),
        scriptoscopeWidth: String(width), scriptoscopeHeight: String(height),
      });
      Object.assign(el.style, {
        left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`,
      });
    }
    // Resolve before teardown: a failed fetch must leave the current face intact.
    const resolved = await Promise.all(panels.map(panel => resolver.load(nextTheme ?? panel.theme)));
    rebuilding = true;
    try {
      for (const window of windows) window.unmount();
      windows = [];
      initialPositions.clear();
      for (const [index, panel] of panels.entries()) {
        const theme = nextTheme ?? panel.theme;
        const window = await ScriptoscopeWindow.promote(panel.el, {
          manager, theme: resolved[index],
        });
        window.host.dataset.scriptoscopeTheme = theme;
        windows.push(window);
        initialPositions.set(window.host, { left: window.host.style.left, top: window.host.style.top });
      }
      collage.dataset.interactive = '';
      selectedTheme = nextTheme;
      hasMoved = false;
      reset.hidden = true;
      syncSelection();
    } catch (error) {
      // If painting fails after teardown, restore the complete HTML collage
      // rather than leave hidden source panels behind a partial composition.
      for (const window of windows) window.unmount();
      windows = [];
      delete collage.dataset.interactive;
      throw error;
    } finally {
      rebuilding = false;
    }
  }

  await run(async () => {
    await resolver.preloadFonts();
    await reassemble();
  });
  collage.addEventListener('scriptoscope:close', (event) => {
    if (rebuilding) return;
    status.textContent = hasMoved
      ? `${event.target.dataset.scriptoscopeTheme} closed. Reassemble the face to restore it.`
      : `${event.target.dataset.scriptoscopeTheme} closed. Choose Original mix below to restore all five windows.`;
    const nextMove = windows.find(window => window.host !== event.target && window.host.isConnected)?.host.shadowRoot
      ?.querySelector('[aria-label="Move window"]');
    if (hasMoved) reset.focus({ preventScroll: true });
    else if (nextMove) nextMove.focus({ preventScroll: true });
    else schemeButtons.find(button => button.dataset.portraitTheme === 'mix')?.focus();
  });
  const restore = async () => {
    await run(async () => {
      await reassemble();
      status.textContent = 'Portrait reassembled. All five windows restored.';
    });
    if (errorMessage.hidden) {
      windows[0]?.host.shadowRoot?.querySelector('[aria-label="Move window"]')?.focus({ preventScroll: true });
    } else retry.focus({ preventScroll: true });
  };
  reset.addEventListener('click', restore);
  retry.addEventListener('click', restore);

  for (const button of schemeButtons) {
    button.addEventListener('click', async (event) => {
      await run(async () => {
        const slug = button.dataset.portraitTheme;
        if (slug === 'mix') {
          await reassemble(null);
          status.textContent = 'Original mix restored.';
        } else {
          // The window manager preserves positions, user sizes, shading and
          // closed windows. Only the chrome changes; the portrait stays live.
          await manager.retheme(await resolver.load(slug));
          selectedTheme = slug;
          for (const window of windows) window.host.dataset.scriptoscopeTheme = slug;
          syncSelection();
          status.textContent = `Portrait windows now wear ${button.textContent}.`;
        }
        if (event.detail !== 0) document.querySelector('.portrait').scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
          block: 'start',
        });
      });
    });
  }

  // Native-size windows keep pointer movement accurate at phone widths.
  let resizeTimer;
  new ResizeObserver(() => {
    if (space.clientWidth === lastWidth) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { void run(reassemble); }, 120);
  }).observe(space);
}
