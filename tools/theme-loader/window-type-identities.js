// Portable identity authority shared by manifest generation and runtime lookup.
// preferredManifestSlug preserves shipped keys; aliases are equivalent names,
// not historical wnd# fallback steps. No asset URL participates in identity.
export const WINDOW_TYPE_IDENTITIES = [
  { id: -14336, alternateIds: [-14335], canonicalSlug: 'document-window', preferredManifestSlug: 'document-window', legacySlugs: [], collapsedId: -14332 },
  { id: -14332, canonicalSlug: 'collapsed-document-window', preferredManifestSlug: 'collapsed-document-window', legacySlugs: [] },
  { id: -14328, canonicalSlug: 'dialog', preferredManifestSlug: 'dialog', legacySlugs: [] },
  { id: -14326, canonicalSlug: 'alert', preferredManifestSlug: 'alert', legacySlugs: [] },
  { id: -14324, canonicalSlug: 'movable-modal', preferredManifestSlug: 'movable-modal', legacySlugs: [] },
  { id: -14322, canonicalSlug: 'movable-alert', preferredManifestSlug: 'movable-alert', legacySlugs: [] },
  { id: -14304, canonicalSlug: 'titled-utility-window', preferredManifestSlug: 'titled-utility-window', legacySlugs: [], collapsedId: -14300 },
  { id: -14300, canonicalSlug: 'collapsed-titled-utility-window', preferredManifestSlug: 'collapsed-titled-utility', legacySlugs: ['collapsed-titled-utility'] },
  { id: -14296, canonicalSlug: 'side-floating-utility-window', preferredManifestSlug: 'side-floating-utility-window', legacySlugs: [], collapsedId: -14292 },
  { id: -14292, canonicalSlug: 'collapsed-side-floating-utility-window', preferredManifestSlug: 'collapsed-side-utility', legacySlugs: ['collapsed-side-utility'] },
  { id: -14288, canonicalSlug: 'no-title-utility-window', preferredManifestSlug: 'no-title-utility-window', legacySlugs: [], collapsedId: -14284 },
  { id: -14284, canonicalSlug: 'collapsed-no-title-utility-window', preferredManifestSlug: 'collapsed-no-title-utility', legacySlugs: ['collapsed-no-title-utility'] },
  { id: -12320, canonicalSlug: 'popup-window', preferredManifestSlug: 'popup-window', legacySlugs: [] },
];
