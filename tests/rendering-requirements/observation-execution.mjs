import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gitIdentity } from './execution.mjs';

/** Writer identity, not historical fidelity or authentication of caller assertions. */
export function observationExecution(root, runtime, supplied = {}, runtimeModes) {
  const hash = path => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
  const declaredModes = runtimeModes ?? (supplied.mode ? [supplied.mode] : []);
  if (!Array.isArray(declaredModes) || declaredModes.some(mode => !['source', 'built'].includes(mode)))
    throw new TypeError('Observation runtime modes must be explicitly source/built');
  const observed = { ...runtime, ...gitIdentity(root),
    builtBundleSha256: hash('dist/scriptoscope.js'), builtStylesheetSha256: hash('dist/scriptoscope.css'),
    packageLockSha256: hash('package-lock.json'),
    playwrightVersion: JSON.parse(readFileSync(resolve(root, 'node_modules/@playwright/test/package.json'))).version,
    platform: process.platform, arch: process.arch,
    declaredRuntimeModes: [...new Set(declaredModes)] };
  const disagreements = Object.keys(observed).filter(key => Object.hasOwn(supplied, key)
    && JSON.stringify(supplied[key]) !== JSON.stringify(observed[key]));
  return { ...supplied, ...observed, suppliedExecutionDisagreements: disagreements };
}

/** Metadata failures must not replace the contract failure already in flight. */
export async function preservePrimaryFailure(hasPrimaryFailure, write, reportMetadataError) {
  try { return await write(); }
  catch (error) {
    if (!hasPrimaryFailure) throw error;
    try { reportMetadataError(`Observation metadata unavailable (${error.code ?? error.name ?? 'Error'})`); }
    catch { /* Reporting instrumentation must not replace the primary failure either. */ }
  }
}
