import { listCases } from './cases.mjs';
/** Preserve the full bounded inventory, split into independently rendered pages
 * so a screenshot never retains the whole per-theme DOM at once. */
export function goldenCasePages() {
  const cases = listCases({ profile: 'smoke' }), pages = [];
  for (let start = 0; start < cases.length; start += 35) pages.push(cases.slice(start, start + 35));
  return pages;
}
