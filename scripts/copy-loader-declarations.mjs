// tsc preserves the public re-export's ../tools path but does not copy input
// declaration files. Keep the authoritative browser-loader shim in the tarball
// and rebase its single source-type import to the emitted public declarations.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const declaration = await readFile(resolve(root, 'tools/theme-loader/loadKaleidoscopeScheme.d.ts'), 'utf8');
const sourceImport = "from '../../src/types.js'";
if (declaration.split(sourceImport).length !== 2) throw new Error('Loader declaration import changed; review its packed type dependencies');
const target = resolve(root, 'dist/tools/theme-loader/loadKaleidoscopeScheme.d.ts');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, declaration.replace(sourceImport, "from '../../types/types.js'"));
console.log('copied browser-loader declaration into packed public type graph');
// The additive profile factory/types share one authoritative declaration with
// the portable converter. Preserve its reference back to public LoadedTheme.
const profile = await readFile(resolve(root, 'tools/theme-loader/display-profile.d.ts'), 'utf8');
const profileImport = "import('../../src/types.js')";
if (profile.split(profileImport).length !== 2) throw new Error('Profile declaration dependencies changed');
await writeFile(resolve(root, 'dist/tools/theme-loader/display-profile.d.ts'),
  profile.replace(profileImport, "import('../../types/types.js')"));
