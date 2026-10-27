import { test } from './demo-fixtures.mjs';
import { expect } from '@playwright/test';

for (const populated of [false, true]) for (const edited of [false, true]) test(`explicit page rollback preserves ${edited ? 'later application edits' : 'authored baseline'} (${populated ? 'populated' : 'empty'} picker)`, async ({ page, demo }) => {
  await page.goto(`${demo}/install.html`);
  const result = await page.evaluate(async ({ edited, populated }) => {
    const { mountExplicitPage } = await import('/explicit-host.mjs');
    const root = document.createElement('section');
    root.style.minHeight = '20px'; root.style.position = 'static';
    root.innerHTML = '<div data-scriptoscope-theme-picker aria-label="Authored picker"><button type="button">Authored button</button></div><article data-scriptoscope-window data-scriptoscope-width="240" data-scriptoscope-height="90">Native content</article>';
    document.body.append(root); const picker = root.firstElementChild, authored = picker.firstElementChild;
    let clicks = 0; authored.addEventListener('click', () => clicks++);
    const handle = await mountExplicitPage({ root, themeBaseUrl: '/themes', pageThemeDefault: 'windows-95', themes: populated ? [{ slug: 'windows-95', name: 'Windows 95' }, { slug: 'windows-31', name: 'Windows 3.1' }] : [], bootAffordance: false });
    const promotedTabs = picker.querySelectorAll('[role=tab]').length;
    const input = document.createElement('input'); input.value = 'Live app text';
    if (edited) { picker.setAttribute('aria-label', 'Later app label'); picker.append(input); root.style.minHeight = '777px'; root.style.position = 'sticky'; root.inert = true; }
    handle.disconnect(); handle.disconnect(); authored.click();
    const result = { promotedTabs, authored: picker.contains(authored), clicks, label: picker.getAttribute('aria-label'),
      input: picker.contains(input), value: input.value, minHeight: root.style.minHeight, position: root.style.position, inert: root.inert,
      generated: picker.querySelectorAll('[data-scriptoscope-theme]').length };
    root.remove(); return result;
  }, { edited, populated });
  expect(result).toEqual({ promotedTabs: populated ? 2 : 0, authored: true, clicks: 1, label: edited ? 'Later app label' : 'Authored picker', input: edited,
    value: 'Live app text', minHeight: edited ? '777px' : '20px', position: edited ? 'sticky' : 'static', inert: edited, generated: 0 });
});
