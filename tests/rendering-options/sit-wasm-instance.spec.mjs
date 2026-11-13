import { test, expect, openHarness } from './fixtures.mjs';

// The StuffIt wrapper (tools/sit-wasm/index.mjs) replaces its WebAssembly instance in some
// cases, and builds the replacement from the module compiled for the first instance so that
// no second request for the .wasm is made. Its Node tests use a stand-in for the Emscripten
// glue, because in Node the real glue does not compile by streaming. This is the same check
// against the real glue and binary: the wrapper and its .wasm are served as separate files.
test('StuffIt decoder replaces its instance without requesting the wasm again', async ({ page, servers }) => {
  const wasmRequests = [];
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('.wasm')) wasmRequests.push(request.url()); });
  await openHarness(page, servers, 'built');
  const result = await page.evaluate(async () => {
    const streaming = WebAssembly.instantiateStreaming;
    // A replacement built from the kept module goes through WebAssembly.instantiate; the
    // first load goes through instantiateStreaming and is not counted here.
    let replacements = 0;
    const instantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = function (...args) { replacements++; return instantiate.apply(this, args); };
    try {
      const { decodeArchive } = await import('/tools/sit-wasm/index.mjs');
      const archive = new Uint8Array(await (await fetch('/themes/windows-95/scheme.sit')).arrayBuffer());
      const digest = async bytes => {
        const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
        let text = '';
        for (const entry of await decodeArchive(bytes)) text += JSON.stringify([entry.name, entry.type, entry.creator, entry.forkType, entry.bytes.length]) + hex(await crypto.subtle.digest('SHA-256', entry.bytes));
        return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
      };
      const before = await digest(archive);
      const sameAfterFirstLoad = WebAssembly.instantiateStreaming === streaming;
      // An 8 MB input that is not an archive passes through and leaves the instance's memory
      // above the limit for a small input. The first small decode finds that; the second
      // starts the replacement and is still served by the old instance.
      const large = await decodeArchive(new Uint8Array(8 * 1024 * 1024));
      const small = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      await decodeArchive(small);
      await decodeArchive(small);
      for (let i = 0; i < 500 && replacements === 0; i++) await new Promise(resolve => setTimeout(resolve, 10));
      await new Promise(resolve => setTimeout(resolve, 0));
      const after = await digest(archive);
      await new Promise(resolve => setTimeout(resolve, 50));
      return { before, after, replacements, sameAfterFirstLoad, sameAtEnd: WebAssembly.instantiateStreaming === streaming,
        largeEntries: large.length, largeBytes: large[0].bytes.length };
    } finally { WebAssembly.instantiate = instantiate; }
  });
  expect([result.largeEntries, result.largeBytes], 'the large input passed through').toEqual([1, 8 * 1024 * 1024]);
  expect(result.replacements, 'one replacement, built from the kept module').toBe(1);
  expect(wasmRequests, 'the .wasm was requested once, for the first instance').toHaveLength(1);
  expect(result.after, 'the replacement decodes the archive to the same bytes').toBe(result.before);
  expect(result.sameAfterFirstLoad, 'WebAssembly.instantiateStreaming is the same function after the first load').toBe(true);
  expect(result.sameAtEnd, 'and after the replacement').toBe(true);
});
