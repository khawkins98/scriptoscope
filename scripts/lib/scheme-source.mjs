// Shared source selection for the local extractors. Match the runtime's
// archive preference without changing the convertChrome/convertIcons paths.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function schemeSource(themeDir) {
  return ['scheme.sit', 'scheme.rsrc'].find((name) => existsSync(resolve(themeDir, name))) ?? null;
}

export async function readSchemeFork(themeDir) {
  const source = schemeSource(themeDir);
  if (!source) throw new Error(`no scheme.sit or scheme.rsrc in ${themeDir}`);
  const bytes = new Uint8Array(readFileSync(resolve(themeDir, source)));
  if (source === 'scheme.rsrc') return { source, fork: bytes };
  const { stuffItResourceFork } = await import('../../tools/sit-wasm/index.mjs');
  return { source, fork: await stuffItResourceFork(bytes) };
}
