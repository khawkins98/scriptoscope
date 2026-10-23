// Read-only module mutation: registerTs supplies compiled source, this hook
// perturbs it in memory. No runtime/loader file is changed on disk.
import '../helpers/registerTs.mjs';
import { registerHooks } from 'node:module';
const mutations = {
  ellipsis: ['src/titleFont.ts', "return '…';", "return '';"],
  booleanize: ['src/engine/families/progress.ts', '(data[0] ?? record.indeterminate) & PROGRESS_IDLE.byteMask', 'data[0] ? 1 : 0'],
  popup: ['tools/theme-loader/buildThemeJson.js', 'popupFamily ? body[3] - 1 : body[1]', 'body[1]'],
  background: ['tools/theme-loader/buildThemeJson.js', 'title[3] - 4', 'title[3] - 3'],
  phase: ['src/interactive.ts', '!Number.isInteger(phase) || phase < 0 || phase > 255', 'false'],
};
const [path, from, to] = mutations[process.env.FOLLOWUP_MUTATION];
let hit = false;
registerHooks({ load(url, context, next) {
  const result = next(url, context);
  if (!url.endsWith('/' + path)) return result;
  const source = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
  if (!source.includes(from)) throw new Error(`Mutation needle absent: ${path}`);
  hit = true;
  return { ...result, source: source.replace(from, to) };
} });
process.on('exit', () => { if (!hit) { process.stderr.write('Mutation was never applied\n'); process.exitCode = 2; } });
