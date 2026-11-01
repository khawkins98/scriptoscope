// Independent synthetic inputs for #624/#625. No corpus/native captures or engine oracle.
export function widgetFamilyTheme(keys, ids = [-14330, -14338, -14298, -14290], base) {
  const image = (w, h, paint) => {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'); paint(ctx); return canvas.toDataURL();
  };
  const colors = { '-14330': '#d02030', '-14338': '#c04090', '-14298': '#20a050', '-14290': '#3050d0' };
  const art = image(64, 64, ctx => { ctx.fillStyle = '#a0a0a0'; ctx.fillRect(0, 0, 64, 64); });
  const chromeElements = Object.fromEntries(ids.map(id => [String(id), { sourceCicnId: id, asset: image(12, 8, ctx => {
    ctx.fillStyle = colors[id]; ctx.fillRect(0, 0, 12, 4);
    ctx.fillStyle = '#e0b010'; ctx.fillRect(0, 4, 12, 4);
    ctx.clearRect(0, 0, 1, 1); ctx.clearRect(1, 4, 1, 1);
  }) }]));
  const edge = [{ part: 'part-7', at: 0 }, { part: 'part-7', at: 24 }, { part: 'part-8', at: 64 }];
  const titleEdge = [{ part: 'part-7', at: 0 }, { part: 'part-7', at: 24 }, { part: 'part-5', at: 48 }, { part: 'part-8', at: 64 }];
  const windowTypes = Object.fromEntries(keys.map(key => {
    const side = /side/.test(key);
    const sample = { text: { rgb16: [0, 0, 0], displayRgb: [0, 0, 0] }, shadow: { rgb16: [0, 0, 0], displayRgb: [0, 0, 0] } };
    return [key, { chrome: { active: art, inactive: art }, titleSamples: { active: sample, inactive: sample },
      parts: Object.fromEntries([
        [0, side ? [20, 4, 60, 60] : [4, 20, 60, 60]],
        [1, side ? [4, 6, 8, 10] : [6, 4, 10, 8]],
        [2, side ? [4, 12, 8, 16] : [12, 4, 16, 8]],
        [3, side ? [4, 18, 8, 22] : [18, 4, 22, 8]],
        [4, [24, 3, 48, 16]],
      ].map(([n, rect]) => [`part-${n}`, { rect }])),
      edges: { top: side ? edge : titleEdge, bottom: edge, left: edge, right: edge } }];
  }));
  return { baseUrl: '', manifest: { name: 'Independent widget family fixture', windowTypes, chromeElements, patterns: {} }, ...(base ? { base } : {}) };
}
