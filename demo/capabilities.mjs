import { mountExplicitPage } from './explicit-host.mjs';
import {
  createOwnedThemeResolver, renderWindow, bufferToCanvas,
  composeButton, composeBevelButton, composeCheckable, composeTab,
  composeSlider, composeScrollbar, composeDisclosure, composeProgressFrame,
  composeHeaderSurface, composeListHeader, platinumListHeader,
  platinumMenuBar, platinumMenu, platinumPopupMenu, rasterizeText, themeImageUrl,
} from 'scriptoscope';
import themes from './themes-manifest.json';

const $ = id => document.getElementById(id);
const json = value => JSON.stringify(value, null, 2);
const baseUrl = `${import.meta.env.BASE_URL}themes`;
const resolver = createOwnedThemeResolver({ themeBaseUrl: baseUrl, themes });
const initial = new URL(location.href).searchParams.get('theme');
let slug = themes.some(t => t.slug === initial) ? initial : '1138';
let theme;
let source;
let mount;
let disposed = false;
let work = Promise.resolve();
let promotionFailures = [];

function updateOverflowFocus() {
  for (const element of document.querySelectorAll('.cap-sample-visual, .cap-raster')) {
    if (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight) {
      element.tabIndex = 0;
      element.setAttribute('role', 'group');
      if (!element.hasAttribute('aria-label')) element.setAttribute('aria-label', `${element.id.replaceAll('-', ' ')} (scrollable)`);
    } else element.removeAttribute('tabindex');
  }
}

for (const entry of themes) {
  const option = new Option(entry.name ?? entry.slug, entry.slug);
  $('scheme').add(option);
}
$('scheme').value = slug;

// Serialize async paints: changing a selector quickly cannot commit an old theme
// after a newer choice. Errors remain visible; controls are re-enabled to retry.
function schedule(action) {
  work = work.then(async () => {
    if (disposed) return;
    $('load-status').textContent = 'Updating examples…';
    $('main').setAttribute('aria-busy', 'true');
    try {
      await action();
      $('load-status').textContent = promotionFailures.length
        ? `Partial results · ${promotionFailures.map(error => `${error.kind}: ${error.message}`).join('; ')}`
        : `Ready · ${themes.find(t => t.slug === slug)?.name ?? slug} · standalone theme, no base scheme`;
    } catch (error) {
      $('load-status').textContent = `Could not finish these examples: ${error.message ?? error}. Choose a scheme to retry.`;
      console.error('[capabilities]', error);
    } finally {
      $('main').removeAttribute('aria-busy');
      updateOverflowFocus();
    }
  });
  return work;
}

function canvas(buffer, label) {
  const element = bufferToCanvas(buffer, 1);
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', label);
  return element;
}

function sample(label, buffer, result = buffer ? 'Rendered by public API' : 'Unavailable: no usable themed output') {
  const figure = document.createElement('figure');
  figure.className = 'cap-sample';
  const visual = document.createElement('div');
  visual.className = 'cap-sample-visual';
  visual.tabIndex = 0;
  visual.setAttribute('role', 'group');
  visual.setAttribute('aria-label', `${label} sample`);
  if (buffer) visual.append(canvas(buffer, label));
  else visual.textContent = 'No themed output';
  const caption = document.createElement('figcaption');
  caption.append(label);
  const status = document.createElement('span');
  status.textContent = result;
  caption.append(status);
  figure.append(visual, caption);
  return figure;
}

async function states() {
  const fragment = document.createDocumentFragment();
  const evidence = [];
  async function draw(label, api, options, call, traced = false) {
    let trace;
    const diagnostics = { onComplete: value => { trace = value; } };
    try {
      const buffer = await call({ ...options, ...(traced ? { diagnostics } : {}) });
      const result = trace ? trace.outcome.status === 'unavailable'
        ? `Unavailable · ${trace.tabBody?.reason ?? 'see resource decisions'}`
        : `${trace.outcome.status} · see resource decisions`
        : buffer ? 'Rendered · no per-call resource trace exposed' : 'Unavailable · themed art not usable';
      fragment.append(sample(label, trace?.outcome.status === 'unavailable' ? null : buffer, result));
      evidence.push({ label, api, options, result: buffer ? { width: buffer.width, height: buffer.height } : null, ...(trace ? { trace } : {}) });
    } catch (error) {
      fragment.append(sample(label, null, `Error: ${error.message}`));
      evidence.push({ label, api, options, error: String(error) });
      // A single bad request should not hide the other families.
    }
  }
  await draw('Push · normal', 'composeButton', { label: 'Continue', minWidth: 96, height: 22 }, o => composeButton(theme, o), true);
  await draw('Push · default ring', 'composeButton', { label: 'Continue', default: true, minWidth: 96, height: 22 }, o => composeButton(theme, o), true);
  await draw('Push · pressed', 'composeButton', { label: 'Continue', pressed: true, minWidth: 96, height: 22 }, o => composeButton(theme, o), true);
  await draw('Push · disabled', 'composeButton', { label: 'Continue', disabled: true, minWidth: 96, height: 22 }, o => composeButton(theme, o), true);
  await draw('Bevel · latched on', 'composeBevelButton', { label: 'On', on: true, minWidth: 70, height: 22 }, o => composeBevelButton(theme, o), true);
  await draw('Bevel · small', 'composeBevelButton', { label: 'Aa', small: true }, o => composeBevelButton(theme, o), true);
  for (const kind of ['checkbox', 'radio']) {
    await draw(`${kind} · selected`, `composeCheckable(theme, '${kind}', options)`, { checked: true }, o => composeCheckable(theme, kind, o));
    await draw(`${kind} · disabled`, `composeCheckable(theme, '${kind}', options)`, { checked: true, disabled: true }, o => composeCheckable(theme, kind, o));
  }
  await draw('Tab · selected', 'composeTab', { label: 'Preview', selected: true }, o => composeTab(theme, o), true);
  await draw('Tab · unselected', 'composeTab', { label: 'Preview', selected: false }, o => composeTab(theme, o), true);
  await draw('Slider · horizontal', 'composeSlider', { length: 140, value: .4 }, o => composeSlider(theme, o));
  await draw('Slider · ticks / directional', 'composeSlider', { length: 140, value: .65, variant: 'pointsDownOrRight', tickMarks: 6 }, o => composeSlider(theme, o));
  await draw('Slider · vertical', 'composeSlider', { orientation: 'vertical', length: 84, value: .4 }, o => composeSlider(theme, o));
  await draw('Scrollbar · horizontal', 'composeScrollbar', { orientation: 'horizontal', length: 150, value: .35 }, o => composeScrollbar(theme, o));
  await draw('Scrollbar · pressed arrow', 'composeScrollbar', { orientation: 'horizontal', length: 150, value: .35, state: 'pressed', pressedPart: 'down' }, o => composeScrollbar(theme, o));
  await draw('Scrollbar · inactive / vertical', 'composeScrollbar', { orientation: 'vertical', length: 84, value: .5, state: 'inactive' }, o => composeScrollbar(theme, o));
  for (const direction of ['right', 'down']) await draw(`Disclosure · ${direction}`, 'composeDisclosure', { direction }, o => composeDisclosure(theme, o));
  for (const options of [{ length: 150, value: .6 }, { length: 150, indeterminate: true, phase: 24 }]) {
    const frame = await composeProgressFrame(theme, options);
    const label = options.indeterminate ? 'Progress · indeterminate phase 24' : 'Progress · 60%';
    fragment.append(sample(label, frame.buffer, `${frame.path} path · phase after draw: ${frame.phase}`));
    evidence.push({ label, api: 'composeProgressFrame', options, path: frame.path, phaseAfter: frame.phase });
  }
  $('state-samples').replaceChildren(fragment);
  $('control-evidence').textContent = json(evidence);
}

async function windowPreview() {
  const options = { windowType: $('window-kind').value, state: $('window-state').value,
    width: Number($('window-width').value), height: 90, title: 'Window preview' };
  const element = await renderWindow(theme, options);
  // This is an appearance preview, including when a modal kind is selected;
  // it must not announce an active application dialog to assistive technology.
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', `${options.windowType}, ${options.state}, ${options.width} pixel content width`);
  element.removeAttribute('aria-modal');
  element.style.touchAction = 'auto';
  $('window-preview').replaceChildren(element);
  $('window-config').textContent = `await renderWindow(theme, ${json(options)})`;
}

async function headers() {
  const options = {
    kind: $('header-kind').value, width: Number($('header-width').value), height: 22,
    drawState: Number($('header-state').value),
    compositionContext: { controlOrigin: [0, 0], portOrigin: [0, 0],
      patternOrigin: { status: 'known', offset: [0, 0] }, clip: { kind: $('header-clip').value }, basis: 'caller-declared' },
  };
  let trace;
  const result = await composeHeaderSurface(theme, { ...options, diagnostics: { onComplete: value => { trace = value; } } });
  $('header-preview').replaceChildren();
  if (result.status === 'rendered') $('header-preview').append(canvas(result.buffer, `${options.kind}, draw state ${options.drawState}`));
  else $('header-preview').textContent = 'No admitted whole-header output';
  $('header-result').textContent = result.status === 'rendered' ? 'Rendered · whole surface, no labels' : `${result.status}: ${result.reason}`;
  const columns = { columns: [{ label: 'Name', width: 135 }, { label: 'Size', width: 65 }], height: 22, inactive: options.drawState === 0 };
  const composed = await composeListHeader(theme, columns);
  $('columns-preview').replaceChildren(canvas(composed ?? platinumListHeader(columns), 'Name and Size column headers'));
  $('columns-result').textContent = composed ? 'Rendered · compatibility column helper' : 'Procedural Platinum fallback · no themed column face';
  $('header-evidence').textContent = json({ api: 'composeHeaderSurface', options,
    result: result.status === 'rendered' ? { status: result.status, width: result.buffer.width, height: result.buffer.height } : result,
    trace, columns: { api: 'composeListHeader', options: columns, fallback: composed ? null : 'platinumListHeader' } });
}

async function assets() {
  $('type-samples').replaceChildren(...[10, 12, 16].map(size => sample(`${size} CSS px`, rasterizeText('Hello, Kaleidoscope', size, '#28251f'), 'rasterizeText · browser font policy')));
  const icons = source.inspector?.iconIndex;
  $('icon-count').textContent = icons ? `${icons.length} decoded entries · showing up to 8. A catalog entry is an asset, not an implemented control.` : 'Inspector icon catalog unavailable; absence is unknown.';
  $('icons').replaceChildren();
  for (const entry of (icons ?? []).slice(0, 8)) {
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    image.src = await themeImageUrl(theme, entry.url ?? `icons/${entry.file}`);
    if (disposed) return;
    image.alt = `${entry.type} icon ${entry.id}`;
    const caption = document.createElement('figcaption');
    caption.textContent = `${entry.type} ${entry.id}`;
    figure.append(image, caption);
    $('icons').append(figure);
  }
  const patterns = Object.entries(source.manifest.patterns ?? {});
  $('pattern-count').textContent = `${patterns.length} decoded patterns · showing up to 6, tiled as provided.`;
  $('patterns').replaceChildren();
  for (const [name, entry] of patterns.slice(0, 6)) {
    const figure = document.createElement('figure');
    const swatch = document.createElement('div');
    swatch.className = 'cap-pattern';
    swatch.setAttribute('role', 'img');
    swatch.setAttribute('aria-label', `Tiled pattern: ${name}`);
    const url = await themeImageUrl(theme, entry.asset);
    if (disposed) return;
    swatch.style.backgroundImage = `url(${JSON.stringify(url)})`;
    const caption = document.createElement('figcaption');
    caption.textContent = name;
    figure.append(swatch, caption);
    $('patterns').append(figure);
  }
  $('asset-evidence').textContent = json({ source: themes.find(t => t.slug === slug)?.source,
    baseChain: theme.base ? 'Present' : 'None', displayPolicy: source.manifest.displayProfile?.policy ?? 'Default loader policy (no explicit displayProfile supplied)',
    windowKinds: Object.keys(source.manifest.windowTypes), chromeCatalogEntries: Object.keys(source.manifest.chromeElements).length,
    decodedIcons: icons?.length ?? 'unknown', decodedPatterns: patterns.map(([key]) => key),
    note: 'Catalog counts are availability observations, not implemented-family or native-fidelity counts.' });
}

function mountOptions() {
  return { root: $('live-root'), themeBaseUrl: baseUrl, themes, pageThemeDefault: slug,
    bootAffordance: 'none', rejectOnEmptyMount: true,
    onPromoteError: error => { promotionFailures.push({ kind: error.kind, message: String(error.cause) }); } };
}

async function selectTheme(next) {
  promotionFailures = [];
  const loaded = await resolver.load(next);
  if (disposed) return;
  theme = loaded;
  source = loaded.source ?? loaded;
  slug = next;
  if (!mount) mount = await mountExplicitPage(mountOptions());
  else await mount.retheme(slug);
  const url = new URL(location.href);
  url.searchParams.set('theme', slug);
  history.replaceState(null, '', url);
  const entry = themes.find(t => t.slug === slug);
  $('credit').textContent = [entry.name, entry.author ? `by ${entry.author}` : '', entry.year].filter(Boolean).join(' · ');
  const previousKind = $('window-kind').value;
  $('window-kind').replaceChildren(...Object.keys(source.manifest.windowTypes).map(kind => new Option(kind.replaceAll('-', ' '), kind)));
  if ([...$('window-kind').options].some(o => o.value === previousKind)) $('window-kind').value = previousKind;
  else if ([...$('window-kind').options].some(o => o.value === 'document-window')) $('window-kind').value = 'document-window';
  await windowPreview();
  await states();
  await headers();
  await assets();
  $('integration-config').textContent = `const handle = await mountExplicitPage({\n  themeBaseUrl: ${JSON.stringify(baseUrl)},\n  pageThemeDefault: ${JSON.stringify(slug)},\n  themes, // Your catalog, including source filenames\n  root: document.querySelector('#your-content'),\n});\nawait handle.retheme(${JSON.stringify(slug)});\n// After the last consumer unmounts:\nhandle.disconnect();`;
}

$('scheme').addEventListener('change', event => { const next = event.target.value; void schedule(() => selectTheme(next)); });
for (const id of ['window-kind', 'window-state', 'window-width']) $(id).addEventListener('change', () => void schedule(windowPreview));
for (const id of ['header-kind', 'header-state', 'header-width', 'header-clip']) $(id).addEventListener('change', () => void schedule(headers));
$('reset-examples').addEventListener('click', () => location.reload());
$('volume').addEventListener('input', event => { $('volume-value').value = event.target.value; });
$('example-form').addEventListener('submit', event => {
  event.preventDefault();
  const values = new FormData(event.target);
  $('form-feedback').textContent = `Applied “${values.get('project')}” · ${values.get('layout')} layout · level ${values.get('level')} · notifications ${$('notifications').checked ? 'on' : 'off'}.`;
});

$('menu-samples').replaceChildren(
  sample('Mac OS menu bar · procedural', platinumMenuBar({ titles: ['File', 'Edit', 'View'], activeIdx: 0, width: 280 }), 'Raster only · no scheme lookup or interaction'),
  sample('Dropdown panel · procedural', platinumMenu({ items: ['New', 'Open…', '-', 'Close'], highlightIdx: 1, width: 140 }), 'Raster only · no command dispatch'),
  sample('Closed popup face · procedural', platinumPopupMenu({ label: 'Choose a view', minWidth: 160 }), 'Raster only · does not open a menu'),
);

// Bound the live example before promotion rather than scaling pixel art.
$('desktop').querySelector('[data-scriptoscope-window]').dataset.scriptoscopeWidth = String(Math.min(260, Math.max(120, $('desktop').clientWidth - 70)));
void schedule(() => selectTheme(slug));
window.addEventListener('resize', updateOverflowFocus);
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  disposed = true;
  window.removeEventListener('resize', updateOverflowFocus);
  mount?.disconnect();
  resolver.dispose();
});
