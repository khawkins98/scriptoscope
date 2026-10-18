// Keep real in-page links usable when their destination is inside a disclosure.
export function revealHash() {
  if (!location.hash) return;
  let target;
  try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); }
  catch { return; }
  for (let parent = target?.parentElement; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
  target?.scrollIntoView({ block: 'start' });
}
requestAnimationFrame(revealHash);
window.addEventListener('hashchange', revealHash);

// Example products are fictional, but their controls still give real feedback.
document.addEventListener('click', event => {
  const button = event.target.closest('[data-example-action]');
  if (!button) return;
  const status = button.closest('.hero, .download')?.querySelector('[data-example-feedback]')
    ?? document.getElementById('example-feedback');
  if (status) status.textContent = button.dataset.exampleAction;
});

// Resolve links at click time: retheming updates the URL without replacing links.
document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  const theme = new URL(location.href).searchParams.get('theme');
  if (theme && /\/(showcase|install|personal|shareware|landing|docs|diagnostic|story|acknowledgements)\.html$/.test(url.pathname)) {
    url.searchParams.set('theme', theme);
    link.href = url.href;
  }
  if (url.pathname === location.pathname && url.hash) requestAnimationFrame(revealHash);
});

function updateNavigation() {
  if (!document.body.classList.contains('site-showcase')) return;
  for (const link of document.querySelectorAll('.site-primary-nav a')) {
    const active = location.hash === '#examples' ? link.hash === '#examples'
      : link.pathname.endsWith('/showcase.html') && !link.hash;
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
updateNavigation();
window.addEventListener('hashchange', updateNavigation);
