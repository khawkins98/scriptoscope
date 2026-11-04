// An original first-party sample, separate from the installed runtime.
// Pin the inputs so changes on main cannot change an existing consumer's theme.
import { mkdir, writeFile } from 'node:fs/promises';

const revision = '8f5635699fd7a5fe666187b1af87bd9ae4b5000c';
const repository = `https://raw.githubusercontent.com/khawkins98/scriptoscope/${revision}`;
const inputs = [
  ['scheme.rsrc', 'authoring/schemes/scriptoscope/scheme.rsrc'],
  ['meta.json', 'authoring/schemes/scriptoscope/meta.json'],
  ['LICENSE', 'LICENSE'],
];
const files = await Promise.all(inputs.map(async ([name, path]) => {
  const response = await fetch(`${repository}/${path}`);
  if (!response.ok) throw new Error(`Sample theme download failed: ${response.status} ${response.url}`);
  return [name, new Uint8Array(await response.arrayBuffer())];
}));
const target = new URL('./public/themes/scriptoscope/', import.meta.url);
await mkdir(target, { recursive: true });
for (const [name, bytes] of files) await writeFile(new URL(name, target), bytes);
await writeFile(new URL('PROVENANCE.md', target),
  `# Scriptoscope Reference\n\nOriginal design by Scriptoscope contributors, MIT licensed.\nSource: ${repository}/authoring/schemes/scriptoscope/\nPinned repository revision: ${revision}\nSee meta.json and LICENSE alongside this archive.\n`);
console.log('Downloaded the first-party sample to public/themes/scriptoscope/');
