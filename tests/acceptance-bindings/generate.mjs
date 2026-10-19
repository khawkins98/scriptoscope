import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { sha256, enumerateForks, selectFork, describeFork } from '../control-availability/source.mjs';
import { parseResourceFork } from '../../tools/theme-loader/resource-fork.js';
import { convertScheme } from '../../tools/theme-loader/convert.js';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { canonicalWindowTypeSlug, equivalentWindowTypeKeys } from '../../src/wndCascade.ts';
import { WINDOW_TYPE_IDENTITIES } from '../../tools/theme-loader/window-type-identities.js';
import '../helpers/registerTs.mjs';
const { resolveWindowSelection } = await import('../../src/resolveWindowType.ts');

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const OUTPUT = 'tests/acceptance-bindings/bindings.json';
const registryPath = 'tests/control-availability/source-choices.json';
const envelopePath = 'docs/spec/acceptance-envelope-proposal.json';
const hashObject = value => sha256(JSON.stringify(value));
const check = (condition, message) => { if (!condition) throw new Error(message); };
const withoutReferences = value => {
  if (Array.isArray(value)) return value.map(withoutReferences);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'byteProvenance').map(([key, child]) => [key, withoutReferences(child)]));
};
function assetPaths(value, paths, at = '') {
  if (typeof value === 'string') return paths.has(value) ? [{ field: at, path: value }] : [];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => assetPaths(child, paths, at ? `${at}.${key}` : key));
}

/** Same portable converter used by the loader. References are local occurrence IDs,
 * never filenames guessed to be unique or claims of historical resource lookup. */
export function describeConversion(bytes, meta = {}, source = 'scheme.rsrc') {
  const raw = parseResourceFork(bytes), pathsByOccurrence = new Map();
  const observer = {
    begin: (_entry, resourceIndex) => ({ loadId: 'inventory', resourceIndex }),
    end() {},
    bindAsset(reference, path) {
      if (reference) pathsByOccurrence.set(reference.resourceIndex, [...(pathsByOccurrence.get(reference.resourceIndex) ?? []), path]);
    },
  };
  let converted;
  try { converted = convertScheme(bytes, { meta, source, resourceObserver: observer }); }
  catch (error) {
    return { status: 'error', error: String(error.message), resources: raw.map((e, resourceIndex) => ({
      resourceIndex, type: e.type, signedId: e.id, name: e.name, attributes: e.attributes,
      byteLength: e.data.length, sha256: sha256(e.data), conversion: { status: 'unknown-conversion-aborted' }, emittedKeys: [],
    })), manifest: null };
  }
  const { theme, manifest, assets, iconIndex } = converted;
  check(manifest.assets.length === raw.length, 'Converter occurrence inventory length changed');
  const resources = raw.map((e, resourceIndex) => {
    const actual = manifest.assets[resourceIndex];
    check(actual.type === e.type && actual.id === e.id && actual.name === (e.name || null), 'Converter occurrence order changed');
    return { resourceIndex, type: e.type, signedId: e.id, name: e.name, attributes: e.attributes,
      byteLength: e.data.length, sha256: sha256(e.data),
      duplicateOccurrences: raw.flatMap((other, index) => other.type === e.type && other.id === e.id ? [index] : []),
      conversion: { status: actual.status, ...(actual.reason ? { reason: actual.reason } : {}), ...(actual.error ? { error: actual.error } : {}) },
      assetPaths: [...new Set(pathsByOccurrence.get(resourceIndex) ?? [])], emittedKeys: [] };
  });
  // convertIcons has no observer. Record its actual returned index plus the exact
  // first sufficiently long occurrence policy in that helper, separately labeled.
  const icons = iconIndex.map(icon => {
    const matches = raw.flatMap((e, i) => e.type === icon.type && e.id === icon.id ? [i] : []);
    const required = icon.size * icon.size * icon.depth / 8;
    const resourceIndex = matches.find(i => raw[i].data.length >= required);
    check(resourceIndex !== undefined, 'Emitted icon has no eligible occurrence');
    const path = `icons/${icon.file}`;
    resources[resourceIndex].assetPaths.push(path);
    resources[resourceIndex].emittedKeys.push(`icons/${icon.type}/${icon.id}`);
    for (const i of matches) resources[i].iconConversion = i === resourceIndex
      ? { status: 'emitted', association: 'convertIcons-first-sufficient-occurrence-policy' }
      : { status: i < resourceIndex ? 'skipped-short-payload' : 'skipped-duplicate-after-emission' };
    const maskType = icon.size === 32 ? 'ICN#' : 'ics#';
    const maskIndex = raw.findIndex(e => e.type === maskType && e.id === icon.id);
    return { key: `${icon.type}/${icon.id}`, path, resourceIndex, maskResourceIndex: icon.masked ? maskIndex : null,
      maskPolicy: icon.masked ? 'first-matching-mask' : 'corner-flood-without-usable-mask', width: icon.size, height: icon.size };
  });
  for (const record of resources) if (['icl8', 'ics8', 'icl4', 'ics4'].includes(record.type) && !record.iconConversion)
    record.iconConversion = { status: 'skipped-short-payload' };
  const catalogs = {};
  for (const name of ['chromeElements', 'patterns']) catalogs[name] = Object.entries(theme[name] ?? {}).map(([key, entry]) => {
    const ref = entry.byteProvenance;
    const occurrences = ref ? Object.entries(ref).filter(([field]) => field.endsWith('ResourceIndex')).map(([role, resourceIndex]) => ({ role, resourceIndex })) : [];
    for (const { resourceIndex } of occurrences) if (resourceIndex !== null) resources[resourceIndex].emittedKeys.push(`${name}/${key}`);
    return { key, valueSha256: hashObject(withoutReferences(entry)), occurrences, asset: entry.asset };
  });
  const paths = new Set(assets.map(a => a.path));
  const windows = Object.entries(theme.windowTypes ?? {}).map(([key, value]) => ({
    key, canonicalIdentity: canonicalWindowTypeSlug(key), equivalentKeys: equivalentWindowTypeKeys(key),
    model: value.model ?? 'sliced', valueSha256: hashObject(value),
    recipeOccurrence: { status: 'OPEN', reason: 'buildThemeJson-does-not-return-window-recipe-occurrence' },
    assets: assetPaths(value, paths).map(ref => ({ ...ref, candidateOccurrences: resources.filter(r => r.assetPaths.includes(ref.path)).map(r => r.resourceIndex) })),
  }));
  const requests = [...new Set([...Object.keys(theme.windowTypes ?? {}), ...WINDOW_TYPE_IDENTITIES.flatMap(i => equivalentWindowTypeKeys(i.canonicalSlug))])];
  const loaded = { manifest: theme, baseUrl: '' };
  const windowSelections = requests.flatMap(request => ['active', 'inactive', 'collapsed-active', 'collapsed-inactive'].map(state => {
    const selected = resolveWindowSelection(loaded, request, state);
    const selectedKey = selected ? Object.entries(theme.windowTypes ?? {}).find(([, value]) => value === selected.wt)?.[0] : null;
    check(!selected || (selected.owner === loaded && selectedKey), 'Unexpected standalone window owner or key');
    return [request, state, selectedKey ?? null, selected?.cicnPath ?? null, selected ? 'self' : null];
  }));
  return { status: 'converted', resources, catalogs, icons, windows, windowSelections,
    assets: assets.map(a => ({ path: a.path, width: a.width, height: a.height, rgbaSha256: sha256(a.rgba) })),
    manifestSha256: hashObject(withoutReferences(theme)), manifest: withoutReferences(theme) };
}

// Compact column tables retain every occurrence without repeating field names.
export const RESOURCE_COLUMNS = ['type', 'signedId', 'name', 'attributes', 'byteLength', 'sha256', 'chromeStatus', 'detail', 'iconStatus', 'emittedKeys'];
function compactInventory(inventory) {
  inventory.resources = inventory.resources.map(r => [r.type, r.signedId, r.name, r.attributes, r.byteLength, r.sha256,
    r.conversion.status, r.conversion.error ?? r.conversion.reason ?? null, r.iconConversion?.status ?? null, r.emittedKeys]);
  if (inventory.assets) {
    inventory.assetCount = inventory.assets.length;
    inventory.assetPlanesSha256 = hashObject(inventory.assets);
    delete inventory.assets;
  }
  if (inventory.icons) inventory.icons = inventory.icons.map(i => [i.key, i.path, i.resourceIndex, i.maskResourceIndex, i.maskPolicy, i.width, i.height]);
  for (const name of Object.keys(inventory.catalogs ?? {})) inventory.catalogs[name] = inventory.catalogs[name].map(c => [c.key, c.asset, c.valueSha256, c.occurrences]);
}

function sourceFiles(root, directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? sourceFiles(root, `${directory}/${e.name}`) : !e.name.endsWith('.test.mjs') && /\.(js|mjs)$/.test(e.name) ? [`${directory}/${e.name}`] : []);
}
export async function generate(root = ROOT) {
  const read = path => readFileSync(resolve(root, path));
  const choices = JSON.parse(read(registryPath)), envelope = JSON.parse(read(envelopePath));
  check(sha256(read(registryPath)) === envelope.sourceRegistry.sha256, 'Envelope registry hash drift');
  const sources = [];
  for (const choice of choices.sources) {
    const bytes = read(choice.path), metaPath = `themes/${choice.slug}/meta.json`, meta = JSON.parse(read(metaPath));
    const selected = selectFork(bytes, await enumerateForks(bytes, choice.format), choice);
    const actual = choice.format === 'sit' ? await stuffItResourceForkWithSelection(bytes) : { bytes, selection: {
      policy: 'raw-resource-fork', entryIndex: null, entryName: null, forkType: 1, fileType: null, creator: null } };
    const source = `${choice.slug}/${choice.path.split('/').at(-1)}`;
    const canonical = describeConversion(selected.bytes, meta, source);
    const matches = sha256(actual.bytes) === choice.forkSha256 && actual.selection.entryIndex === choice.entryIndex && actual.selection.entryName === choice.entryName;
    const loader = matches ? canonical : describeConversion(actual.bytes, meta, source);
    let loaded, loadError;
    try { loaded = await loadKaleidoscopeScheme(bytes, { meta, source, encodeAssets: false }); }
    catch (error) { loadError = error; }
    let publicLoad;
    if (loadError) {
      check(loader.status === 'error', `${choice.slug}: public loader rejected a successful conversion: ${loadError.message}`);
      publicLoad = { status: 'error', error: String(loadError.message) };
    } else {
      check(loader.status === 'converted' && isDeepStrictEqual(loaded.manifest, loader.manifest), `${choice.slug}: actual loader manifest differs`);
      check(isDeepStrictEqual(loaded.assets.map(a => ({ path: a.path, width: a.width, height: a.height, rgbaSha256: sha256(a.rgba) })), loader.assets), `${choice.slug}: actual loader assets differ`);
      publicLoad = { status: 'converted', manifestSha256: hashObject(loaded.manifest), assetPlaneParity: true };
    }
    delete canonical.manifest; if (!matches) delete loader.manifest;
    compactInventory(canonical); if (!matches) compactInventory(loader);
    sources.push({ id: choice.slug, registryRecordSha256: hashObject(choice), input: { path: choice.path, byteLength: bytes.length, sha256: sha256(bytes) },
      meta: { path: metaPath, sha256: sha256(read(metaPath)) }, canonicalFork: describeFork(selected),
      actualLoader: { selection: actual.selection, forkSha256: sha256(actual.bytes), agreement: matches ? 'agrees' : 'DISAGREES', ...publicLoad },
      canonical, ...(matches ? { loaderInventoryRef: 'canonical' } : { loaderInventory: loader }) });
  }
  const cells = envelope.requiredEnvelope.map(row => ({ sourceRef: row.sourceRef, bindingRef: row.sourceRef, familyPathRefs: row.familyPathRefs }));
  check(cells.length === sources.length && cells.every(c => sources.some(s => s.id === c.sourceRef)), 'Envelope source coverage mismatch');
  const paths = [...new Set([...sourceFiles(root, 'tools/theme-loader'), 'tools/sit-wasm/index.mjs', 'tools/sit-wasm/dist/munbox.mjs', 'tools/sit-wasm/dist/munbox.wasm',
    'tests/control-availability/source.mjs', 'tests/helpers/registerTs.mjs', 'src/wndCascade.ts', 'src/resolveWindowType.ts', 'src/baseChain.ts', 'src/loadTheme.ts', 'tests/acceptance-bindings/generate.mjs'])].sort();
  return { schemaVersion: 1, status: 'OBSERVED_MODERN_INPUT_BINDINGS', closure: 'OPEN',
    registry: { path: registryPath, sha256: sha256(read(registryPath)) }, envelope: { path: envelopePath, sha256: sha256(read(envelopePath)) },
    toolchain: paths.map(path => ({ path, sha256: sha256(read(path)) })),
    recipe: { id: 'standalone-default-display', baseChain: [], baseMeaning: 'declared-modern-recipe-not-historical-selection',
      displayProfile: { status: 'omitted', policy: 'mac-1.8-to-2.2-high-byte' }, bitmapFont: { status: 'not-supplied-no-text-rendered' },
      originalEnvironment: { status: 'UNKNOWN' }, arbitraryBaseChainsAndSettings: 'OPEN' },
    limitations: ['Shared parsers/decoder outputs are observations, not independent decoding or historical fidelity.',
      'A cell references available input bindings, not a claim that its family consumes all resources or that it rendered.',
      'Window asset path joins list all candidates; duplicate paths are not resolved into invented unique owners.',
      'Raw resources outside converter support remain explicit skipped entries; parser-level corruption fails generation.',
      'No browser encoding, font rasterization, device realization or original provider/selection is established.'],
    tables: { resources: RESOURCE_COLUMNS, resourceIndex: 'zero-based row position, preserving parser order and duplicates',
      icons: ['key', 'path', 'resourceIndex', 'maskResourceIndex', 'maskPolicy', 'width', 'height'],
      catalogs: ['key', 'asset', 'valueSha256', 'occurrences'],
      windowSelections: ['requestedKey', 'state', 'selectedKey', 'selectedAsset', 'owner'],
      windowSelectionScope: 'finite emitted/identity-alias names, four states, standalone modern recipe; not arbitrary names or collapsed resolver execution' },
    sources, cells };
}
export function serialize(value) {
  const format = (item, depth = 0) => {
    if (!item || typeof item !== 'object') return JSON.stringify(item);
    const pad = '  '.repeat(depth), next = pad + '  ';
    if (Array.isArray(item)) {
      if (!item.length || typeof item[0] !== 'object' || item[0] === null) return JSON.stringify(item);
      return '[\n' + item.map(v => next + format(v, depth + 1)).join(',\n') + '\n' + pad + ']';
    }
    const entries = Object.entries(item);
    return entries.length ? '{\n' + entries.map(([k, v]) => next + JSON.stringify(k) + ': ' + format(v, depth + 1)).join(',\n') + '\n' + pad + '}' : '{}';
  };
  return format(value) + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const actual = serialize(await generate());
  if (process.argv.includes('--write')) writeFileSync(resolve(ROOT, OUTPUT), actual);
  else check(readFileSync(resolve(ROOT, OUTPUT), 'utf8') === actual, 'Binding artifact drift; regenerate and review');
  console.log(`18 source bindings; 594 envelope cells; ${process.argv.includes('--write') ? 'written' : 'verified'}`);
}
