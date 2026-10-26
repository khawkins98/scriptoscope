import '../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRasterAssetOwner, bindRasterOwner } from '../../tools/theme-loader/rasterAssets.js';
const { promoteIcon, promoteIconAsync } = await import('./icon.ts');
const element = () => ({ tagName: 'IMG', dataset: { scriptoscopeIcon: 'folder' }, src: 'initial', hasAttribute() { return true; } });
function owned(encode) {
  const owner = createRasterAssetOwner([{ path: 'folder', width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) }], encode);
  const source = { manifest: {}, inspector: { iconIndex: [{ id: -3999, size: 32, url: 'folder' }] } };
  bindRasterOwner(source, owner);
  return { theme: { kind: 'owned-theme', source, origin: '', imageUrl: owner.imageUrl, dispose: owner.dispose }, owner };
}
for (const cancel of ['signal', 'superseded', 'legacy', 'removed', 'attributes']) {
  test(`pending icon export cannot publish after ${cancel}`, async t => {
    let finish, started;
    const entered = new Promise(resolve => { started = resolve; });
    const { theme, owner } = owned(() => { started(); return new Promise(resolve => { finish = resolve; }); });
    t.after(owner.dispose);
    const el = element(), signal = new AbortController();
    let current = true;
    const pending = promoteIconAsync(el, theme, signal.signal, () => current);
    await entered;
    if (cancel === 'signal') signal.abort();
    if (cancel === 'removed') current = false;
    if (cancel === 'attributes') el.dataset.scriptoscopeIcon = 'trash';
    if (cancel === 'superseded') {
      const replacement = owned(() => 'blob:new'); t.after(replacement.owner.dispose);
      assert.equal(await promoteIconAsync(el, replacement.theme), true);
    }
    if (cancel === 'legacy') assert.equal(promoteIcon(el, { inspector: { iconIndex: [{ id: -3999, size: 32, url: 'blob:legacy' }] } }), true);
    finish('blob:old');
    assert.equal(await pending, false);
    assert.equal(el.src, cancel === 'superseded' ? 'blob:new' : cancel === 'legacy' ? 'blob:legacy' : 'initial');
  });
}
