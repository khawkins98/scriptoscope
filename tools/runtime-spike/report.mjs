// Keep generated diagnostics outside the reviewed source tree.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function writeReport(name, report) {
  const directory = resolve(process.env.SCRIPTOSCOPE_ARTIFACT_DIR ?? fileURLToPath(new URL('./.artifacts/', import.meta.url)));
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, name), JSON.stringify(report, null, 2) + '\n');
}
