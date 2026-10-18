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
  const status = document.getElementById('collage-status');
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
  let selectedTheme = null;
  let rebuilding = false;
  let lastWidth = space.clientWidth;
  let pending = Promise.resolve();

  // Serialize rethemes, reset and responsive layout so an async theme load
  // never repaints a host while reassembly is replacing it.
  function run(update) {
    pending = pending.then(async () => {
      reset.disabled = true;
      for (const button of schemeButtons) button.disabled = true;
      try {
        await update();
      } catch (error) {
        status.textContent = 'Could not update the windows. Please try again.';
        console.warn('[scriptoscope] Advertisement chrome unavailable:', error);
      } finally {
        reset.disabled = false;
        for (const button of schemeButtons) button.disabled = false;
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
  async function reassemble() {
    rebuilding = true;
    try {
      lastWidth = space.clientWidth;
      const scale = lastWidth / 500;
      collage.style.setProperty('--portrait-scale', String(scale));
      for (const window of windows) window.unmount();
      windows = [];
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
        const theme = selectedTheme ?? panel.theme;
        const window = await ScriptoscopeWindow.promote(el, {
          manager, theme: await resolver.load(theme),
        });
        window.host.dataset.scriptoscopeTheme = theme;
        windows.push(window);
      }
      collage.dataset.interactive = '';
      reset.hidden = false;
      syncSelection();
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
    status.textContent = `${event.target.dataset.scriptoscopeTheme} closed. Reassemble the face to restore it.`;
    reset.focus({ preventScroll: true });
  });
  reset.addEventListener('click', async () => {
    await run(async () => {
      await reassemble();
      status.textContent = 'Portrait reassembled. All five windows restored.';
    });
    reset.focus({ preventScroll: true });
  });

  for (const button of schemeButtons) {
    button.addEventListener('click', async () => {
      await run(async () => {
        const slug = button.dataset.portraitTheme;
        if (slug === 'mix') {
          selectedTheme = null;
          await reassemble();
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
        document.querySelector('.portrait').scrollIntoView({
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
