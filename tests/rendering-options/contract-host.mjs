// Independent synthetic host. Tests explicitly pass a chosen subtree snapshot to
// attach(); this fixture never watches for discovery, movement or retry.
export async function createContractHost(api, options) {
  const built = new URL(location.href).searchParams.get('runtime') === '/dist/scriptoscope.js';
  api = { ...api, ...await (built ? import('/dist/declarative.js') : import('/src/declarative/index.ts')) };
  const { root } = options, resolver = api.createThemeResolver(options);
  const manager = new api.WindowManager(), events = new EventTarget(), records = new Map();
  let active = true, generation = 0, completed = options.pageThemeDefault ?? 'windows-95', requested = completed;
  const pending = new Set(), cleanups = [];
  const stats = { windows: 0, buttons: 0, controls: 0, tabs: 0, fields: 0 };
  const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail }));
  const ancestry = source => { const chain = []; for (let n = source; n && n !== root; n = n.parentElement) chain.push(n); return chain; };
  const reference = source => ancestry(source).map(n => n.dataset.scriptoscopeTheme).find(Boolean) ?? completed;
  const kindOf = source => source.matches('[data-scriptoscope-window]') ? 'windows'
    : source.matches('[data-scriptoscope-button]') ? 'buttons'
    : source.matches('input[type=checkbox],input[type=radio],input[type=range],select:not([data-scriptoscope-theme-switcher])') ? 'controls'
    : source.matches('[data-scriptoscope-tabs]') ? 'tabs'
    : source.matches('[data-scriptoscope-field]') ? 'fields'
    : source.matches('[data-scriptoscope-theme-picker]') ? 'picker'
    : source.matches('[data-scriptoscope-theme-switcher]') ? 'switcher' : 'icon';
  const selector = '[data-scriptoscope-window],[data-scriptoscope-button],input[type=checkbox],input[type=radio],input[type=range],select,[data-scriptoscope-tabs],[data-scriptoscope-field],[data-scriptoscope-icon],[data-scriptoscope-icon-id],[data-scriptoscope-theme-picker]';
  const settle = promise => { pending.add(promise); promise.finally(() => pending.delete(promise)).catch(() => {}); return promise; };
  const release = record => {
    const focused = record.face?.contains(document.activeElement);
    record.life.abort();
    if (record.kind === 'buttons') api.restoreButton(record.source);
    if (record.kind === 'controls') api.restoreControl(record.source);
    if (record.kind === 'tabs') api.restoreTabs(record.source);
    if (record.kind === 'fields') api.restoreField(record.source);
    void record.binding?.dispose(); record.window?.restoreOriginalElement(); record.picker?.teardown(); record.cleanup?.();
    if (record.committed && record.kind in stats) stats[record.kind]--;
    record.committed = false; records.delete(record.source);
    if (focused) record.source.focus();
  };
  async function prepare(record, ref, version, signal) {
    const { source, kind } = record, life = { signal }, chain = ancestry(source);
    const current = () => active && !life.signal.aborted && version === generation && root.contains(source)
      && chain.every((node, i) => ancestry(source)[i] === node);
    try {
      const theme = await resolver.load(ref);
      if (!current()) return;
      if (kind === 'windows') {
        if (!record.window) {
          const instance = await api.ScriptoscopeWindow.promote(source, { manager, theme, signal: life.signal });
          if (!active || life.signal.aborted || version !== generation) { instance.restoreOriginalElement(); return; }
          record.window = instance;
        }
        record.window.host.dataset.scriptoscopeTheme = ref;
      } else if (kind === 'buttons' || kind === 'controls') {
        const old = record.face, focused = old?.contains(document.activeElement);
        const face = await (kind === 'buttons' ? api.promoteGuardedButton : api.promoteGuardedControl)(source, theme, life.signal, current);
        if (!face) return;
        if (!active || life.signal.aborted) { (kind === 'buttons' ? api.restoreButton : api.restoreControl)(source); return; }
        if (kind === 'buttons' && old && face !== old) { if (focused) face.focus(); api.disposePromotedButtonFace(source, old); }
        record.face = face;
        if (kind === 'buttons') await handle.refreshContext(source);
      } else if (kind === 'tabs') await api.promoteTabs(source, theme, { signal: life.signal, forceRescan: true });
      else if (kind === 'fields') api.promoteField(source, theme);
      else if (kind === 'icon') { if (await api.promoteIconAsync(source, theme, life.signal, current)) source.setAttribute('data-scriptoscope-icon-promoted', ''); }
      else if (kind === 'picker') {
        record.picker ??= await api.promoteThemePicker(source, options.themes ?? [], { loadTheme: ref => resolver.load(ref), switchTheme: ref => handle.retheme(ref), initialSlug: completed });
      } else if (kind === 'switcher' && !source.hasAttribute('data-scriptoscope-switcher-wired')) {
        const change = () => { void handle.retheme(source.value); };
        source.addEventListener('change', change); source.setAttribute('data-scriptoscope-switcher-wired', '');
        record.cleanup = () => { source.removeEventListener('change', change); if (source.getAttribute('data-scriptoscope-switcher-wired') === '') source.removeAttribute('data-scriptoscope-switcher-wired'); };
      }
      if (active && !life.signal.aborted && version === generation && !record.committed) { record.committed = true; if (kind in stats) stats[kind]++; }
    } catch (error) {
      if (!active || life.signal.aborted || version !== generation) return;
      emit('promoteError', { kind, error }); options.onPromoteError?.({ kind, error });
    }
  }
  function prepareOnce(record, ref, version) {
    record.preparations ??= new Map();
    if (record.preparations.has(version)) return record.preparations.get(version).promise;
    for (const [oldVersion, preparation] of record.preparations) if (oldVersion !== version) preparation.controller.abort();
    const controller = new AbortController(), signal = AbortSignal.any([controller.signal, record.life.signal]);
    const promise = prepare(record, ref, version, signal).finally(() => record.preparations.delete(version));
    record.preparations.set(version, { promise, controller }); return promise;
  }
  const handle = {
    stats, manager, registerTheme: (ref, theme) => resolver.register(ref, theme),
    addEventListener: events.addEventListener.bind(events),
    async attach(scope, { includeSelf = true } = {}) {
      // A one-time caller-selected snapshot, never an observer callback.
      const sources = [...(includeSelf && scope.matches?.(selector) ? [scope] : []), ...scope.querySelectorAll(selector)]
        .filter(source => !source.matches('[data-scriptoscope-tab]'));
      const added = sources.filter(source => !records.has(source)).map(source => {
        const record = { source, kind: kindOf(source), life: new AbortController(), ref: reference(source) };
        records.set(source, record); return record;
      });
      const version = generation;
      return settle((async () => {
        for (const record of added.filter(r => r.kind === 'windows')) await prepareOnce(record, requested === completed ? record.ref : requested, version);
        for (const record of added.filter(r => r.kind !== 'windows')) await prepareOnce(record, requested === completed ? record.ref : requested, version);
      })());
    },
    detach(scope) { for (const record of [...records.values()].reverse()) if (scope === record.source || scope.contains(record.source) || record.window?.host === scope) release(record); },
    async refreshContext(source) {
      const record = records.get(source); if (!record?.face) return;
      void record.binding?.dispose(); record.binding = null;
      const host = source.closest('[data-scriptoscope-window-host]');
      const port = host && manager.contentPort(host);
      if (port && record.face.querySelector('canvas')) { record.binding = api.bindButtonToContentPort(record.face, port); await record.binding.refresh(); }
    },
    async retheme(ref) {
      const version = ++generation; requested = ref; cleanups.forEach(fn => fn()); cleanups.length = 0;
      let theme;
      try { theme = await resolver.load(ref); } catch (error) { if (!active || version !== generation) return; requested = completed; throw error; }
      if (!active || version !== generation) return;
      const life = new AbortController(); cleanups.push(() => life.abort());
      await manager.retheme(theme, life.signal, ref);
      if (!active || version !== generation) return;
      for (const record of records.values()) {
        if (!root.contains(record.source) && !record.window) continue;
        await prepareOnce(record, ref, version);
        if (!active || version !== generation) return;
      }
      completed = ref;
      for (const record of records.values()) {
        if (record.window) record.window.host.dataset.scriptoscopeTheme = ref;
        if (record.kind === 'picker') api.syncThemePickerActive(record.source, ref);
      }
      if (options.syncToUrlParam) { const url = new URL(location.href); url.searchParams.set(options.syncToUrlParam, ref); history.replaceState(null, '', url); }
      if (options.persistKey) localStorage.setItem(`scriptoscope:layout:${options.persistKey}`, JSON.stringify({ activeTheme: ref }));
      emit('retheme', { ref });
    },
    disconnect() { if (!active) return; active = false; generation++; cleanups.forEach(fn => fn()); for (const record of [...records.values()].reverse()) release(record); resolver.dispose(); },
    async settled() { await Promise.all([...pending]); },
  };
  await handle.attach(root, { includeSelf: false });
  return handle;
}
