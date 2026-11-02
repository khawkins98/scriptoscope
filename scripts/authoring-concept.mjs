#!/usr/bin/env node
// Geometry reference and matched-width concept review; no image-generation dependency.
// node scripts/authoring-concept.mjs <scheme dir> --out /tmp/review.html
//   [--render /tmp/document.png --crop x,y,w,h] [--concept path] [--scale 2]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { parseResourceFork } from '../tools/theme-loader/resource-fork.js';
import { decodeWnd } from '../tools/theme-loader/decoders/wnd.js';
import { readCicnIndexed } from '../tools/theme-loader/decoders/cicn.js';
import { decodePng } from './lib/png-decode.mjs';

const [dir, ...args] = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
if (!dir || dir.startsWith('--') || !opt('out')) {
  console.error('Usage: node scripts/authoring-concept.mjs <scheme dir> --out /tmp/review.html [--render /tmp/document.png --crop x,y,w,h] [--concept path] [--scale 2]');
  process.exit(2);
}
const scale = Number(opt('scale', '2'));
if (!Number.isFinite(scale) || scale < 1 || scale > 8) throw new Error('--scale must be from 1 to 8');
const out = resolve(opt('out'));
const resources = parseResourceFork(readFileSync(resolve(dir, 'scheme.rsrc')));
const find = (type, id) => resources.find((r) => r.type === type && r.id === id)?.data;
if (!find('wnd#', -14336) || !find('cicn', -14335)) throw new Error('Build a document frame (wnd# -14336, active cicn -14335) first');
const wnd = decodeWnd(find('wnd#', -14336));
const { width: w, height: h } = readCicnIndexed(find('cicn', -14335)).pmap;
const rect = (part) => wnd.rectangles.filter((r) => r.part === part).at(-1)?.rect;
const body = rect(0);
if (!body) throw new Error('Document frame needs a content rectangle');
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const roles = { 0: ['skip', '#edf0f3'], 1: ['fixed', '#b9d5f3'], 5: ['title plate', '#e7c8ed'], 6: ['title cap', '#d7bce6'], 8: ['grow / tile', '#bce4d3'], 10: ['droppable ornament', '#f6d19c'], 11: ['grow / tile', '#bce4d3'], 12: ['tile', '#bce4d3'], 13: ['filler', '#dbe7dd'] };
const boxes = [], rows = [];
for (const [edge, side] of Object.entries({ top: wnd.topSide, bottom: wnd.bottomSide, left: wnd.leftSide, right: wnd.rightSide })) {
  for (let i = 1; i < side.length; i++) {
    const from = side[i - 1].border, size = side[i].border - from, code = side[i].part;
    if (size <= 0) continue;
    const [role, fill] = roles[code] ?? [`code ${code}`, '#e4e7eb'];
    const [x, y, bw, bh] = edge === 'top' ? [from, 0, size, body.top]
      : edge === 'bottom' ? [from, body.bottom, size, h - body.bottom]
      : edge === 'left' ? [0, from, body.left, size] : [body.right, from, w - body.right, size];
    boxes.push(`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${fill}" stroke="#fff" stroke-width=".5"><title>${edge}: ${role}, code ${code}, ${size}px</title></rect>`);
    rows.push(`<tr><td>${edge}</td><td>${from}–${from + size}</td><td>${size}px</td><td>${code}: ${role}</td></tr>`);
  }
}
const overlays = [1, 2, 3, 4].map((part) => {
  const r = rect(part);
  if (!r || r.right <= r.left || r.bottom <= r.top) return '';
  return `<rect x="${r.left}" y="${r.top}" width="${r.right - r.left}" height="${r.bottom - r.top}" fill="none" stroke="${part === 4 ? '#8e276c' : '#173e69'}" stroke-width=".8" stroke-dasharray="2 1"><title>${['', 'close', 'zoom', 'collapse', 'title text'][part]}</title></rect>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 3}" height="${h * 3}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Document frame geometry"><rect width="${w}" height="${h}" fill="#fff"/>${boxes.join('')}${overlays}<rect x="${body.left}" y="${body.top}" width="${body.right - body.left}" height="${body.bottom - body.top}" fill="#f7f7f7" stroke="#888" stroke-width=".5"/></svg>`;
const svgPath = join(dirname(out), basename(out, extname(out)) + '-template.svg');
const embed = (path) => `data:image/${/\.png$/i.test(path) ? 'png' : 'jpeg'};base64,${readFileSync(path).toString('base64')}`;
let comparison = '<p>Capture a document and supply <code>--render</code> and <code>--crop</code> to compare it with the concept.</p>';
if (opt('render')) {
  const render = resolve(opt('render'));
  const concept = resolve(opt('concept', resolve(dir, 'concept/concept.jpg')));
  if (!existsSync(concept)) throw new Error(`No concept image at ${concept}; use --concept`);
  const crop = opt('crop', '').split(',').map(Number);
  if (crop.length !== 4 || !crop.every(Number.isFinite) || crop[0] < 0 || crop[1] < 0 || crop[2] <= 0 || crop[3] <= 0) throw new Error('--crop needs x,y,width,height in concept-image pixels');
  const image = decodePng(readFileSync(render));
  const width = image.width * scale;
  comparison = `<p>Both windows are displayed ${width}px wide (${scale}× the rendered outer width). Heights retain each image’s aspect ratio; a differing height exposes a proportion mismatch.</p><div class="pair"><figure><figcaption>Concept crop · ${crop.join(', ')}</figcaption><div class="crop" style="width:${width}px;height:${width * crop[3] / crop[2]}px"><img alt="Selected concept window" src="${embed(concept)}" data-crop='${JSON.stringify(crop)}' data-width="${width}"></div></figure><figure><figcaption>Rendered outer frame · ${image.width} × ${image.height} @1×<br>Content · ${image.width - w + body.right - body.left} × ${image.height - h + body.bottom - body.top}</figcaption><img alt="Rendered document window" style="width:${width}px;height:auto" src="${embed(render)}"></figure></div>`;
}
writeFileSync(svgPath, svg);
writeFileSync(out, `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(basename(resolve(dir)))} concept review</title><style>body{margin:32px;background:#e7ebef;color:#18212a;font:15px/1.5 system-ui,sans-serif}h1,h2{line-height:1.2}p{max-width:85ch}.pair{display:flex;gap:32px;align-items:flex-start}figure{margin:0}figcaption{margin:12px 0;font-weight:600}.crop{overflow:hidden;position:relative}.crop img{position:absolute;max-width:none}img,svg{image-rendering:pixelated}table{border-collapse:collapse;margin:20px 0}td,th{text-align:left;padding:5px 16px 5px 0;border-bottom:1px solid #c7ced5}.template{overflow:auto;background:white;padding:16px}</style><h1>${escape(basename(resolve(dir)))} · concept review</h1>${comparison}<h2>Geometry reference · source template ${w} × ${h}</h2><p>This is the recipe’s source-art template, enlarged 3×, before window stretching. Blue cells stay fixed; orange ornaments may drop on narrow windows; green cells repeat or grow. Purple marks the title plate and its caps. Dashed boxes reserve widget and title rectangles. Keep distinctive silhouettes inside fixed cells and keep growing cells seamless. Use this sheet with the art brief before generating a concept.</p><div class="template">${svg}</div><table><thead><tr><th>Edge</th><th>Source range</th><th>Size</th><th>Recipe role</th></tr></thead><tbody>${rows.join('')}</tbody></table><script>for(const img of document.querySelectorAll('[data-crop]')){const fit=()=>{const [x,y,w,h]=JSON.parse(img.dataset.crop),s=Number(img.dataset.width)/w;if(x+w>img.naturalWidth||y+h>img.naturalHeight){img.parentElement.textContent='Crop exceeds concept image bounds';return;}img.style.width=img.naturalWidth*s+'px';img.style.left=-x*s+'px';img.style.top=-y*s+'px';};img.onload=fit;if(img.complete)fit();}</script></html>`);
console.log(`Wrote ${out}\nWrote ${svgPath}`);
