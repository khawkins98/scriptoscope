// tsc preserves the public re-export's ../tools path but does not copy input
// declaration files. Keep the authoritative browser-loader shim in the tarball
// and rebase its source-type imports to the emitted public declarations.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
let declaration = await readFile(resolve(root, 'tools/theme-loader/loadKaleidoscopeScheme.d.ts'), 'utf8');
for (const name of ['types', 'ownedTheme']) {
  const sourceImport = `from '../../src/${name}.js'`;
  if (declaration.split(sourceImport).length !== 2) throw new Error('Loader declaration import changed; review its packed type dependencies');
  declaration = declaration.replace(sourceImport, `from '../../types/${name}.js'`);
}
const target = resolve(root, 'dist/tools/theme-loader/loadKaleidoscopeScheme.d.ts');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, declaration);
console.log('copied browser-loader declaration into packed public type graph');
// Profile validation consumes only a structural manifest/base chain.
const profile = await readFile(resolve(root, 'tools/theme-loader/display-profile.d.ts'), 'utf8');
if (profile.includes('../../src/')) throw new Error('Profile declaration gained an unpacked source dependency');
await writeFile(resolve(root, 'dist/tools/theme-loader/display-profile.d.ts'), profile);

const cinf = await readFile(resolve(root, 'tools/theme-loader/cinf-environment.d.ts'), 'utf8');
await writeFile(resolve(root, 'dist/tools/theme-loader/cinf-environment.d.ts'),
  cinf.replace("from '../../src/types.js'", "from '../../types/types.js'"));
const cicnTransfer = await readFile(resolve(root, 'tools/theme-loader/cicn-transfer-results.d.ts'), 'utf8');
await writeFile(resolve(root, 'dist/tools/theme-loader/cicn-transfer-results.d.ts'), cicnTransfer);
