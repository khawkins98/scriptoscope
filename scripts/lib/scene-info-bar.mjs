// Pure Scene policy shared by the browser diagnostic and its coverage audit.
// This preserves the existing tier order; preview thumbnails are not an oracle
// for changing scheme-author resource precedence.
export function resolveSceneInfoBar(manifest = {}) {
  const header = Object.values(manifest.chromeElements ?? {}).find(e => e.sourceCicnId === -9567);
  const headerPattern = header?.bgPattern && manifest.patterns?.[header.bgPattern]?.asset;
  const bodyPattern = manifest.bodyBackground?.pattern;
  const pattern = headerPattern || bodyPattern || null;
  const backgroundTier = headerPattern ? 1 : bodyPattern ? 2 : manifest.headerColors?.active?.fill ? 3 : 4;
  const fill = manifest.headerColors?.active?.fill ?? '#e6e6e6';
  let textColor = '#000', textTier = 2, luminance = null;
  if (!pattern) {
    const hex = fill.replace('#', '');
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
      luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luminance < 128) { textColor = '#fff'; textTier = 1; }
    } else textTier = 3;
  }
  return { backgroundTier, pattern, fill, textColor, textTier, luminance, patternKey: headerPattern ? header.bgPattern : null };
}
