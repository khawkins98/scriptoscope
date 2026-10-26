// Public scanner comparison, using the eager path as a transport regression harness.
import '../../src/scriptoscope.css';
import { rasterOwner } from '../theme-loader/rasterAssets.js';
const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
function fixture() {
  const root = document.createElement('section');
  root.innerHTML = `<article data-scriptoscope-window data-scriptoscope-title="Transport" data-scriptoscope-width="260" data-scriptoscope-height="160">
    <button data-scriptoscope-button>Commit</button><label><input type="checkbox" checked> Check</label>
    <label><input type="range" min="0" max="10" value="4"> Level</label>
    <select><option>One</option><option>Two</option></select><img data-scriptoscope-icon="folder" alt="Folder">
  </article><div data-scriptoscope-theme-picker></div>`;
  document.body.append(root);
  return root;
}
function canvases(root) {
  const all = [...root.querySelectorAll('canvas')];
  for (const el of root.querySelectorAll('*')) if (el.shadowRoot) all.push(...canvases(el.shadowRoot));
  return all;
}
function pendingScrollbars(root) {
  return [...root.querySelectorAll('*')].flatMap(el => [
    ...(el.matches('.scriptoscope-window-scrollbar') && !el.querySelector('canvas') ? [el.className] : []),
    ...el.shadowRoot ? pendingScrollbars(el.shadowRoot) : [],
  ]);
}
async function snapshot(runtime, root) {
  await nextFrame();
  // Window chrome commits before its asynchronous scrollbar paints. Observe
  // their actual canvas publication; a failed paint must fail this capture.
  const deadline = performance.now() + 10_000;
  while (pendingScrollbars(root).length) {
    if (performance.now() > deadline) throw new Error(`Mounted scrollbars did not paint: ${pendingScrollbars(root).join(', ')}`);
    await nextFrame();
  }
  const images = [...root.querySelectorAll('img')].filter(image => image.getAttribute('src'));
  const pixels = await Promise.all(images.map(image => runtime.loadCicnBuffer(image.src)));
  const backgrounds = [];
  for (const el of root.querySelectorAll('*')) {
    const elements = [el, ...el.shadowRoot?.querySelectorAll('*') ?? []];
    for (const inner of elements) {
      const match = /^url\(["']?(.*?)["']?\)$/.exec(inner.style.backgroundImage);
      if (match) backgrounds.push(await runtime.loadCicnBuffer(match[1]));
    }
  }
  const captured = canvases(root);
  return { canvases: captured.map(canvas => canvas.toDataURL()),
    canvasInfo: captured.map(canvas => ({ width: canvas.width, height: canvas.height, className: canvas.className, parent: canvas.parentElement?.className })), pixels, backgrounds,
    stats: [...root.querySelectorAll('input,select')].map(el => [el.type, el.value, el.checked, el.disabled]) };
}
export async function compareMounts(runtime, slugs, report, compare, transport) {
  window.spikeContext = { phase: 'mount-lifecycle', transport };
  report.mounts ??= 0;
  const guardRoot = fixture();
  const guardOptions = { root: guardRoot, themeBaseUrl: '/themes', pageThemeDefault: slugs[0], bootAffordance: 'none' };
  const pending = runtime.mountOwnedDeclarative(guardOptions);
  const same = runtime.mountOwnedDeclarative(guardOptions);
  let rejected = false;
  try { await runtime.mountDeclarative(guardOptions); } catch { rejected = true; }
  const handle = await pending;
  try {
    if (!rejected || await same !== handle) throw new Error('Pending mount reservation did not preserve one loading contract');
  } finally { handle.disconnect(); guardRoot.remove(); }
  // Decode a real dropped archive, register it as borrowed, then switch through
  // a legacy registration. Disconnect releases only internally loaded themes.
  const dropRoot = fixture();
  const dropped = await runtime.loadOwnedKaleidoscopeScheme(new File([
    await (await fetch('/themes/1138/scheme.rsrc')).arrayBuffer(),
  ], 'transport.rsrc'), { source: 'transport.rsrc' });
  const legacy = await runtime.loadTheme('/themes/1984');
  let dropHandle;
  try {
    dropHandle = await runtime.mountOwnedDeclarative({ root: dropRoot, themeBaseUrl: '/themes', pageThemeDefault: '1138', bootAffordance: 'none' });
    dropHandle.registerTheme('dropped:transport.rsrc', dropped);
    await dropHandle.retheme('dropped:transport.rsrc');
    await snapshot(runtime, dropRoot);
    dropHandle.registerTheme('legacy-registration', legacy);
    await dropHandle.retheme('legacy-registration');
    await snapshot(runtime, dropRoot);
    dropHandle.disconnect();
    if (rasterOwner(dropped.source).disposed) throw new Error('Owned mount disposed a registered drop');
    await runtime.composeButton(dropped, { minWidth: 80 });
    report.droppedMounts = (report.droppedMounts ?? 0) + 1;
    report.legacyRegistrations = (report.legacyRegistrations ?? 0) + 1;
  } finally {
    dropHandle?.disconnect(); dropRoot.remove(); dropped.dispose(); legacy.dispose();
  }
  for (const slug of slugs) {
    window.spikeContext = { phase: 'mount-comparison', transport, slug };
    const roots = [fixture(), fixture()], handles = [];
    try {
      const options = root => ({ root, themeBaseUrl: '/themes', pageThemeDefault: slug,
        themes: [{ slug }], bootAffordance: 'none', rejectOnEmptyMount: true });
      handles.push(await runtime.mountDeclarative(options(roots[0])));
      handles.push(await runtime.mountOwnedDeclarative(options(roots[1])));
      // Picker image export is progressive; wait for its declared busy lifecycle.
      const deadline = performance.now() + 10_000;
      while (roots.some(root => root.querySelector('[data-scriptoscope-theme-picker]').getAttribute('aria-busy') === 'true')) {
        if (performance.now() > deadline) throw new Error(`Mounted picker did not settle: ${slug}`);
        await nextFrame();
      }
      const [a, b] = await Promise.all(roots.map(root => snapshot(runtime, root)));
      if (JSON.stringify(handles[0].stats) !== JSON.stringify(handles[1].stats)
        || JSON.stringify(a.canvases) !== JSON.stringify(b.canvases) || JSON.stringify(a.stats) !== JSON.stringify(b.stats)
        || a.pixels.length !== b.pixels.length || a.backgrounds.length !== b.backgrounds.length
        || a.pixels.some((pixels, i) => compare(pixels, b.pixels[i]))
        || a.backgrounds.some((pixels, i) => compare(pixels, b.backgrounds[i]))) {
        const mismatch = { slug, stats: handles.map(handle => handle.stats), controls: [a.stats, b.stats],
          canvases: [a.canvases.length, b.canvases.length],
          canvasDifferences: Array.from({ length: Math.max(a.canvases.length, b.canvases.length) }, (_, i) => i)
            .filter(i => a.canvases[i] !== b.canvases[i]).map(index => ({ index, eager: a.canvasInfo[index], owned: b.canvasInfo[index] })),
          pixels: [a.pixels.length, b.pixels.length], backgrounds: [a.backgrounds.length, b.backgrounds.length],
          pixelDifferences: a.pixels.map((pixels, i) => compare(pixels, b.pixels[i])),
          backgroundDifferences: a.backgrounds.map((pixels, i) => compare(pixels, b.backgrounds[i])) };
        (report.mountMismatches ??= []).push(mismatch);
        throw new Error(`Mounted transport mismatch: ${JSON.stringify(mismatch)}`);
      }
      let clicks = 0;
      const sourceButton = roots[1].querySelector('[data-scriptoscope-button]');
      sourceButton.addEventListener('click', () => clicks++);
      const face = sourceButton.nextElementSibling;
      if (face.tagName === 'BUTTON') face.click();
      else {
        face.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        face.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      }
      if (clicks !== 1) throw new Error(`Owned mounted button did not activate: ${slug}`);
      await handles[1].retheme(slug);
      if (!sourceButton.isConnected) throw new Error(`Owned retheme lost its source content: ${slug}`);
      report.mounts++;
    } finally {
      handles.forEach(handle => handle.disconnect());
      for (const root of roots) {
        if (root.querySelector('.scriptoscope-window')) throw new Error(`Mounted window survived disconnect: ${slug}`);
        root.remove();
      }
    }
  }
}
