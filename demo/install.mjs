import themes from './themes-manifest.json';

// The guide follows the scheme carried over from the showcase.
const requestedTheme = new URL(location.href).searchParams.get('theme');
const slug = themes.some(theme => theme.slug === requestedTheme) ? requestedTheme : '1138';
document.getElementById('install-scheme-name').textContent = slug;
for (const snippet of document.querySelectorAll('[data-install-default]')) {
  snippet.textContent = snippet.textContent.replace("pageThemeDefault: '1138'", `pageThemeDefault: '${slug}'`);
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-copy-snippet]');
  if (!button) return;
  const snippet = document.getElementById(button.dataset.copySnippet);
  const status = document.getElementById('install-copy-status');
  if (!snippet) return;
  try {
    await navigator.clipboard.writeText(snippet.textContent.trim());
    button.textContent = 'Copied';
    status.textContent = 'Example copied. Paste it into your HTML or module as described above.';
    setTimeout(() => { button.textContent = 'Copy'; }, 1600);
  } catch {
    status.textContent = 'Clipboard unavailable. Select the example text to copy it.';
    const selection = getSelection();
    const range = document.createRange();
    range.selectNodeContents(snippet);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
});
