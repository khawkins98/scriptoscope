import { mountDeclarative } from 'scriptoscope';

// The renderer's width is its content width: real scheme borders add to it.
// Re-measure the authored example layout when its viewport changes, reserving
// the actual painted border rather than scaling or clipping native pixels.
export async function mountResponsiveExample(options, prepare = () => {}) {
  const facade = new EventTarget();
  const sources = [...document.querySelectorAll('.page [data-scriptoscope-window]')];
  sources.forEach((source, index) => { source.dataset.exampleResponsiveId = String(index); });
  const authoredWidths = new Map(sources.map(el => [el, el.getAttribute('data-scriptoscope-width')]));
  const authoredTitles = new Map(sources.map(el => [el, el.getAttribute('data-scriptoscope-title')]));
  const borders = new Map();
  let handle;
  let running = false;
  let pending = false;
  let disposed = false;
  let viewportWidth = innerWidth;
  let timer;

  const restoreWidths = () => {
    for (const [el, width] of authoredWidths) {
      if (width === null) el.removeAttribute('data-scriptoscope-width');
      else el.setAttribute('data-scriptoscope-width', width);
    }
  };
  const measureBorders = () => {
    for (const host of document.querySelectorAll('.page [data-scriptoscope-window-host]')) {
      const frame = host.shadowRoot?.querySelector('.scriptoscope-window');
      const content = host.shadowRoot?.querySelector('.scriptoscope-content');
      if (!frame || !content) continue;
      const source = sources[Number(host.dataset.exampleResponsiveId)];
      if (source) borders.set(source, Math.max(0, parseFloat(frame.style.width) - parseFloat(content.style.width)));
    }
  };
  const fitWidths = () => {
    restoreWidths();
    prepare();
    for (const source of sources) {
      if (!source.isConnected) continue;
      const title = innerWidth < 480 && source.dataset.exampleCompactTitle
        ? source.dataset.exampleCompactTitle : authoredTitles.get(source);
      if (title !== null) source.setAttribute('data-scriptoscope-title', title);
      const border = borders.get(source) ?? 0;
      const cascade = source.closest('[data-scriptoscope-cascade]');
      const index = cascade ? [...cascade.querySelectorAll('[data-scriptoscope-window]')].indexOf(source) : 0;
      const offset = cascade ? index * Number(cascade.dataset.scriptoscopeCascadeStepX || 0) : 0;
      const available = Math.floor(source.getBoundingClientRect().width - border - offset);
      const declared = Number(source.getAttribute('data-scriptoscope-width')) || Infinity;
      source.dataset.scriptoscopeWidth = String(Math.max(80, Math.min(declared, available)));
    }
  };
  const overflows = () => [...document.querySelectorAll('.page [data-scriptoscope-window-host]')].some(host => {
    const frame = host.shadowRoot?.querySelector('.scriptoscope-window');
    return frame && frame.getBoundingClientRect().right > innerWidth - 4;
  });
  const wire = () => {
    handle.addEventListener('retheme', event => {
      measureBorders();
      facade.dispatchEvent(new CustomEvent('retheme', { detail: event.detail }));
      if (overflows()) schedule();
    });
  };
  async function reflow() {
    if (disposed) return;
    if (running) { pending = true; return; }
    running = true;
    const focused = document.activeElement;
    try {
      measureBorders();
      handle.disconnect();
      fitWidths();
      handle = await mountDeclarative(options);
      wire();
      if (focused instanceof HTMLElement && focused.isConnected) focused.focus({ preventScroll: true });
    } catch (error) {
      // Teardown restores real HTML; keep it usable if a reload fails.
      console.error('[examples] Could not reflow native windows:', error);
    } finally {
      running = false;
      if (pending) { pending = false; schedule(); }
    }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => void reflow(), 160);
  }
  const resize = () => {
    if (innerWidth === viewportWidth) return; // mobile browser toolbar height changes
    viewportWidth = innerWidth;
    schedule();
  };
  // Promotion is asynchronous: a viewport change can arrive after the first
  // host appears but before the initial mount has finished. Listen before
  // awaiting it, and serialize that early resize with the initial mount.
  running = true;
  window.addEventListener('resize', resize);
  prepare();
  try {
    handle = await mountDeclarative(options);
  } catch (error) {
    disposed = true;
    clearTimeout(timer);
    window.removeEventListener('resize', resize);
    throw error;
  } finally {
    running = false;
  }
  wire();
  measureBorders();
  if (pending || overflows()) {
    pending = false;
    clearTimeout(timer);
    await reflow();
  }
  return Object.assign(facade, {
    retheme: ref => handle.retheme(ref),
    disconnect: () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener('resize', resize);
      handle.disconnect();
      restoreWidths();
      for (const [source, title] of authoredTitles) {
        if (title === null) source.removeAttribute('data-scriptoscope-title');
        else source.setAttribute('data-scriptoscope-title', title);
      }
    },
  });
}
