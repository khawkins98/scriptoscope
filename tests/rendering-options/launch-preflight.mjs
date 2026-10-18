import { chromium, firefox, webkit } from '@playwright/test';

/** Fail before the matrix if any requested engine cannot start in this runner. */
export default async function launchPreflight(config) {
  const engines = { chromium, firefox, webkit };
  const checked = new Set();
  for (const project of config.projects) {
    const name = project.use.browserName ?? 'chromium';
    if (checked.has(name)) continue;
    const engine = engines[name];
    if (!engine) throw new Error(`Unsupported rendering browser: ${name}`);
    let browser;
    try {
      browser = await engine.launch({ ...project.use.launchOptions,
        headless: project.use.headless ?? true });
      const page = await browser.newPage();
      await page.setContent('<title>Rendering browser preflight</title>');
      if (await page.title() !== 'Rendering browser preflight') throw new Error('Page execution failed');
      console.log(`Rendering browser ready: ${name} ${browser.version()}`);
      checked.add(name);
    } catch (error) {
      throw new Error(`Rendering browser preflight failed for ${name}; no matrix cases have run.`, { cause: error });
    } finally {
      await browser?.close();
    }
  }
}
