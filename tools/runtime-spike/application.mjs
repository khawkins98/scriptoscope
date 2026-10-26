// Real advertisement app, unchanged UI actions, current eager vs owned APIs.
// Telemetry and teardown hooks are injected by this local-only server plugin.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
const exec = promisify(execFile), root = resolve(import.meta.dirname, '../..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fingerprint() {
  const { stdout } = await exec('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src', 'tools/theme-loader', 'demo', 'themes'], { cwd: root });
  const paths = stdout.trim().split('\n').filter(p => !/\.test\.|\.d\.ts$/.test(p) && (/\.(ts|js|mjs|html|css|json)$/.test(p) || p.startsWith('demo/assets/') || /^themes\/[^/]+\/scheme\.(sit|rsrc)$/.test(p)));
  paths.push('tools/runtime-spike/application.mjs', ...(await readdir(resolve(root, 'dist'))).filter(p => p.endsWith('.js')).map(p => `dist/${p}`));
  const digest = createHash('sha256');
  for (const path of paths.sort()) digest.update(path).update(await readFile(resolve(root, path)));
  return digest.digest('hex');
}
const diagnostic = process.argv.includes('--diagnostic');
const initial = await fingerprint();
const telemetry = `(() => {
  const live = new Map(), create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  let created = 0, revoked = 0;
  URL.createObjectURL = blob => { const url = create(blob); created++; live.set(url, blob.size ?? 0); return url; };
  URL.revokeObjectURL = url => { revoked++; live.delete(url); return revoke(url); };
  window.__urls = () => ({ created, revoked, live: live.size, blobBytes: [...live.values()].reduce((a,b)=>a+b,0) });
})();`;
const diagnosticTelemetry = `(() => {
  const phases = [], longTasks = [];
  const supported = PerformanceObserver.supportedEntryTypes.includes('longtask');
  const observe = entries => { for (const e of entries) longTasks.push({start:e.startTime,duration:e.duration,name:e.name}); };
  const observer = supported ? new PerformanceObserver(list => observe(list.getEntries())) : null;
  observer?.observe({type:'longtask',buffered:true});
  performance.setResourceTimingBufferSize(5000);
  window.__recordPhase = async (name, work) => {
    const start = performance.now();
    try { return await work(); } finally { phases.push({name,start,duration:performance.now()-start}); }
  };
  window.__trace = () => {
    if (observer) observe(observer.takeRecords());
    return {longTasksSupported:supported,phases:[...phases],longTasks:[...longTasks],
      navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),
      resources:performance.getEntriesByType('resource').filter(e=>/^https?:/.test(e.name)).map(e=>({
        path:new URL(e.name).pathname,start:e.startTime,duration:e.duration,transferSize:e.transferSize,initiatorType:e.initiatorType,
      }))};
  };
})();`;
const probe = `
  const themeRefs = [], seenThemes = new WeakSet(), originalLoad = resolver.load;
  resolver.load = (...args) => { const promise = ${diagnostic ? 'window.__recordPhase(\'load:\'+args[0], () => originalLoad(...args))' : 'originalLoad(...args)'}; promise.then(theme => { if (!seenThemes.has(theme)) { seenThemes.add(theme); themeRefs.push(new WeakRef(theme)); } }, () => {}); return promise; };
`;
const hooks = `
  window.__appProbe = {
    runtime,
    settled: () => pending,
    check: (requested = selectedTheme ?? 'mix') => {
      if (!errorMessage.hidden || windows.length !== 5 || selectedTheme !== (requested === 'mix' ? null : requested)
        || windows.some((window, i) => window.host.dataset.scriptoscopeTheme !== (requested === 'mix' ? panels[i].theme : requested)))
        throw new Error(JSON.stringify({requested,selectedTheme,error:errorMessage.textContent,errorHidden:errorMessage.hidden,windows:windows.map(w=>w.host.dataset.scriptoscopeTheme),expected:panels.map(p=>p.theme)}));
    },
    usage() {
      const seen = new Set(), owners = new Set();
      for (const weak of themeRefs) { const theme = weak.deref(); if (theme && !seen.has(theme)) {
        seen.add(theme); const owner = globalThis[Symbol.for('scriptoscope.rasterAssets.v3')]?.owners.get(theme.source ?? theme); if (owner) owners.add(owner);
      } }
      return [...owners].reduce((sum, owner) => { const u = owner.usage(); for (const k of Object.keys(sum)) sum[k] += u[k]; return sum; }, {rasters:0,pixelBytes:0,images:0,pending:0});
    },
    cleanup() {
      resizeObserver.disconnect(); clearTimeout(resizeTimer);
      for (const window of windows) window.unmount(); windows = [];
      initialPositions.clear(); resolver.dispose();
    },
  };
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__appProbe.readyMs = performance.now(); }));
`;
function replaceOne(source, needle, replacement) {
  if (source.split(needle).length !== 2) throw new Error(`App instrumentation drift: ${needle}`);
  return source.replace(needle, replacement);
}
function instrument(mode) {
  return {
    name: 'owned-app-measurement', enforce: 'pre',
    transformIndexHtml: { order: 'pre', handler: () => [{ tag: 'script', children: telemetry + (diagnostic ? diagnosticTelemetry : ''), injectTo: 'head-prepend' }] },
    transform(source, id) {
      if (!id.split('?')[0].endsWith('/demo/advertisement.mjs')) return;
      if (mode === 'eager') {
        source = replaceOne(source, 'import { createOwnedThemeResolver,', 'import { createThemeResolver,');
        source = replaceOne(source, 'const resolver = createOwnedThemeResolver(', 'const resolver = createThemeResolver(');
      }
      source = `import * as runtime from 'scriptoscope';\n` + source;
      if (diagnostic) {
        source = replaceOne(source, '    await resolver.preloadFonts();', "    await window.__recordPhase('fonts', () => resolver.preloadFonts());");
        source = replaceOne(source, `const window = await ScriptoscopeWindow.promote(panel.el, {
          manager, theme: resolved[index],
        });`, `const window = await windowGlobal.__recordPhase('promote:'+index, () => ScriptoscopeWindow.promote(panel.el, {
          manager, theme: resolved[index],
        }));`);
        source = 'const windowGlobal = window;\n' + source;
        source = replaceOne(source, 'await manager.retheme(await resolver.load(slug));', "await window.__recordPhase('retheme:'+slug, async () => manager.retheme(await resolver.load(slug)));");
      }

      source = replaceOne(source, '  const panels =', probe + '  const panels =');
      source = replaceOne(source, '  new ResizeObserver(', '  const resizeObserver = new ResizeObserver(');
      source = replaceOne(source, '  }).observe(space);', '  });\n  resizeObserver.observe(space);');
      if (!source.endsWith('\n}\n')) throw new Error('Advertisement module ending changed');
      const end = source.lastIndexOf('\n}');
      return source.slice(0, end) + hooks + source.slice(end);
    },
  };
}
class Cdp {
  constructor(socket) {
    this.socket = socket; this.next = 0; this.pending = new Map();
    socket.addEventListener('message', event => {
      const response = JSON.parse(event.data), pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id); clearTimeout(pending.timer);
      response.error ? pending.reject(new Error(JSON.stringify(response.error))) : pending.resolve(response.result);
    });
  }
  static async open(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP connection timed out')), 10_000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', error => { clearTimeout(timer); reject(error); }, { once: true });
    });
    return new Cdp(socket);
  }
  call(method, params = {}, sessionId) {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP ${method} timed out`)); }, 30_000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
}
async function trial(serverUrl, mode, repetition) {
  let profile, browserPid, cdp;
  const session = `owned-app-${process.pid}-${mode}-${repetition}`;
  const browser = async (...args) => {
    let output;
    try { output = (await exec('agent-browser', ['--session', session, '--json', ...args], { timeout: 60_000, maxBuffer: 8 << 20 })).stdout; }
    catch (error) { throw new Error(JSON.stringify({command:args[0],message:error.message,stdout:error.stdout,stderr:error.stderr})); }
    const result = JSON.parse(output);
    if (!result.success) throw new Error(JSON.stringify(result.error));
    return result.data.result ?? result.data;
  };
  let port;
  try {
    const opened = await browser('open', 'about:blank');
    const info = JSON.parse((await exec('agent-browser', ['--session', session, 'session', 'info', '--json'])).stdout);
    const children = (await exec('pgrep', ['-P', String(info.data.pid)])).stdout.trim().split('\n');
    for (const child of children) {
      const command = (await exec('ps', ['-o', 'command=', '-p', child])).stdout;
      const match = command.match(/--user-data-dir=(\S+)/);
      if (match) { profile = match[1]; browserPid = Number(child); break; }
    }
    if (!profile) throw new Error('Owned browser profile not found in its process metadata');
    port = (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
    const version = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json());
    cdp = await Cdp.open(version.webSocketDebuggerUrl);
    const sessions = new Map();
    const currentSession = async () => {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
      const page = pages.find(page => page.type === 'page' && page.url.startsWith(serverUrl))
        ?? pages.find(page => page.id === opened.targetId);
      if (!page) throw new Error('Current measurement page is missing');
      if (!sessions.has(page.id)) sessions.set(page.id, (await cdp.call('Target.attachToTarget', { targetId: page.id, flatten: true })).sessionId);
      return sessions.get(page.id);
    };
    const memory = async label => {
      await browser('eval', 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,0))))');
      const sessionId = await currentSession();
      await cdp.call('HeapProfiler.collectGarbage', {}, sessionId);
      await cdp.call('HeapProfiler.collectGarbage', {}, sessionId);
      const heap = await cdp.call('Runtime.getHeapUsage', {}, sessionId);
      const dom = await cdp.call('Memory.getDOMCounters', {}, sessionId);
      const { processInfo } = await cdp.call('SystemInfo.getProcessInfo');
      const { stdout } = await exec('ps', ['-o', 'rss=', '-p', processInfo.map(p => p.id).join(',')]);
      const rssBytes = stdout.trim().split(/\s+/).reduce((sum, value) => sum + Number(value) * 1024, 0);
      const counters = await browser('eval', '({urls:typeof __urls === \"function\"?__urls():null,ownedAdvertisementStore:window.__appProbe?.usage() ?? null})');
      if (counters.ownedAdvertisementStore?.pending) throw new Error('App encoding did not settle before sample');
      return { label, heap, dom, rssBytes, processCount: processInfo.length, counters };
    };
    const baseline = await memory('blank');
    console.log(JSON.stringify({mode,repetition,phase:'opening-app'}));
    try { await browser('open', serverUrl); }
    catch (error) {
      const diagnostic = await cdp.call('Runtime.evaluate', { expression: 'JSON.stringify({url:location.href,title:document.title,text:document.body?.innerText.slice(0,1200)})', returnByValue: true }, await currentSession()).catch(e => String(e));
      throw new Error(JSON.stringify({message:error.message,stdout:error.stdout,stderr:error.stderr,diagnostic}));
    }
    await browser('wait', '--fn', 'window.__appProbe?.readyMs > 0');
    const startup = await browser('eval', '({readyMs:__appProbe.readyMs,urls:__urls(),usage:__appProbe.usage(),windows:document.querySelectorAll("[data-scriptoscope-window-host]").length})');
    console.log(JSON.stringify({mode,repetition,phase:'startup',startup}));
    await browser('eval', '__appProbe.check()');
    const startupTrace = diagnostic ? await browser('eval', '__trace()') : undefined;
    const samples = [baseline, await memory('ready')];
    console.log(JSON.stringify({mode,repetition,phase:'ready',startup}));
    const switches = [];
    for (let round = 0; round < 3; round++) {
      const timing = await browser('eval', `(async () => {
        const times = [];
        for (const slug of ['1138','crayon-os','beos-r503','windows-95','1984','mix']) {
          const start=performance.now(); document.querySelector('[data-portrait-theme="'+slug+'"]').click();
          await __appProbe.settled(); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); __appProbe.check(slug);
          times.push({slug,ms:performance.now()-start});
        }
        return times;
      })()`);
      switches.push(timing);
      samples.push(await memory(`switch-round-${round + 1}`));
    }
    await browser('eval', '__appProbe.cleanup()');
    samples.push(await memory('disposed'));
    console.log(JSON.stringify({mode,repetition,phase:'disposed'}));
    for (let batch = 0; batch < 4; batch++) {
      await browser('eval', `(async () => {
        for (let i=0;i<5;i++) {
          const root=document.createElement('section');root.innerHTML='<article data-scriptoscope-window data-scriptoscope-width="180" data-scriptoscope-height="90"><button data-scriptoscope-button>Commit</button><input type="checkbox" checked><input type="range" min="0" max="10" value="4"></article>';document.body.append(root);
          const handle=await __appProbe.runtime.${mode === 'owned' ? 'mountOwnedDeclarative' : 'mountDeclarative'}({root,themeBaseUrl:'/themes',pageThemeDefault:'1138',themes:[{slug:'1138',source:'scheme.rsrc'}],bootAffordance:'none',rejectOnEmptyMount:true});
          handle.disconnect();root.remove();
        }
      })()`);
      const sample = await memory(`five-cycle-batch-${batch + 1}`);
      if (sample.counters.urls.live) throw new Error('Mount/disconnect retained blob URLs');
      samples.push(sample);
    }
    return { mode, repetition, browser: version.Browser, startup, switches, samples, ...(diagnostic ? {startupTrace, trace:await browser('eval', '__trace()')} : {}) };
  } finally {
    if (cdp) cdp.socket.close();
    await exec('agent-browser', ['--session', session, 'close'], { timeout: 15_000 }).catch(() => {});
    if (browserPid) {
      try { process.kill(browserPid, 0); process.kill(browserPid, 'SIGTERM'); await sleep(500); process.kill(browserPid, 'SIGKILL'); } catch {}
    }
    if (profile) await rm(profile, { recursive: true, force: true });
  }
}
const servers = new Map();
const report = { context: process.env.SCRIPTOSCOPE_APPLICATION_NOTE ?? null, recordedAt: new Date().toISOString(), status: 'running', methodology: 'Real advertisement app and UI switch buttons, built library, fresh Chromium profile per trial. Current eager compatibility API versus owned API; not a historical executable. Loopback network/module/font startup included. Owned-store counters observe only advertisement themes (eager results are not bound to that registry), not mount-cycle owners. Blob counters are global to the page. Two frame boundaries and one task precede consistent post-GC sampling. Post-GC CDP heap/backing-storage and sum of browser-process RSS are recorded separately from asset counters. Twenty public mount/disconnect cycles follow app teardown. Telemetry and hooks exist only in this local server.', trials: [] };
if (diagnostic) report.methodology += ' Diagnostic run adds phase wrappers and long-task/resource observers. Phase durations overlap and must not be summed; retheme includes load. Retained trace arrays and resource buffers make its heap figures incomparable with normal-mode results. Long tasks cover the main thread only. This run is recorded separately.';
try {
  for (const mode of ['eager', 'owned']) {
    const server = await createServer({ configFile: resolve(root, 'vite.config.js'), root: resolve(root, 'demo'), plugins: [instrument(mode)], server: { host: '127.0.0.1', port: 0, open: false, hmr: false }, resolve: { alias: { scriptoscope: resolve(root, 'dist/scriptoscope.js') } } });
    await server.listen(); servers.set(mode, server);
    const response = await fetch(server.resolvedUrls.local[0], { signal: AbortSignal.timeout(10_000) });
    const html = await response.text();
    if (!response.ok || !html.includes('advertisement.mjs')) throw new Error('Measurement server did not serve the real app');
  }
  for (let repetition = 0; repetition < (process.argv.includes('--smoke') ? 1 : 3); repetition++) for (const mode of repetition % 2 ? ['owned', 'eager'] : ['eager', 'owned']) {
    const server = servers.get(mode);
    report.trials.push(await trial(server.resolvedUrls.local[0], mode, repetition));
    console.log(JSON.stringify({ mode, repetition, readyMs: report.trials.at(-1).startup.readyMs }));
  }
  report.provenance = { revision: (await exec('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim(), inputs: initial };
  report.status = await fingerprint() === initial ? 'pass' : 'unstable-inputs';
} catch (error) { report.status = 'error'; report.error = String(error.stack ?? error); console.log(JSON.stringify({status:'error',error:report.error})); process.exitCode = 1; }
finally {
  for (const server of servers.values()) await server.close();
  await writeFile(resolve(import.meta.dirname, diagnostic ? 'application-diagnostic-results.json' : process.argv.includes('--smoke') ? 'application-smoke-results.json' : 'application-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, trials: report.trials.length, error: report.error }));
  if (report.status !== 'pass') process.exitCode = 1;
}
