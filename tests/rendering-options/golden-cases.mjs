import { listCases } from './cases.mjs';
/** Preserve the full bounded inventory, split into independently rendered pages
 * so a screenshot never retains the whole per-theme DOM at once. */
export function goldenCasePages() {
  const cases = listCases({ profile: 'smoke' }), pages = [];
  for (let start = 0; start < cases.length; start += 35) pages.push(cases.slice(start, start + 35));
  // Keep the two existing control pages stable; managed collapsed windows get
  // a separate contact sheet. These are regression candidates, not native oracles.
  pages.push(['document-window', 'side-floating-utility-window'].map(windowType => ({
    id: `managed/window/${windowType}/collapsed`, group: 'managed/window/collapsed',
    family: 'window', mode: 'managed', state: 'collapsed',
    options: { windowType, title: 'Collapsed inspector', width: 180, height: 100 },
  })));
  return pages;
}
