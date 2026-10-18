// Exercise runtime TypeScript with its production .js import specifiers, without
// depending on stale dist output or replacing runtime dependencies with mocks.
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
      const path = fileURLToPath(new URL(specifier, context.parentURL)).replace(/\.js$/, '.ts');
      if (existsSync(path)) return { url: pathToFileURL(path).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
    return next(url, context);
  },
});
