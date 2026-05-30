// Promote `<img data-scriptoscope-icon="folder">` (or `<span data-scriptoscope-icon>`) into
// a scheme-resolved Finder-icon thumbnail. The runtime looks up the active scheme's
// iconIndex, finds the icon by canonical Apple resource id (mapped from the named key
// or a raw `data-scriptoscope-icon-id`), and sets `img.src` to the decoded blob URL.
// On retheme, the same resolution runs again so the icon swaps with the scheme.
//
// Replaces the hand-rolled `refreshCardGlyphs` helper every consumer was writing —
// see the 2026-05-30 demo-reviewer audit. The previous pattern required the consumer
// to know that "folder" maps to id -3999 (Apple's `kGenericFolderIconResource`), to
// prefer 32px and fall back, and to re-run the lookup on every retheme. The library
// owns all of that now.
//
// Canonical name → id mapping pulled from `docs/spec/apple-primary-source.md` — the
// Apple `Appearance.h` / `IconsCore.h` enum tables. Add more as schemes ship them.

import type { LoadedTheme } from '../types.js';

/** Named-key → Apple Finder icon resource id. The keys are the consumer-facing
 *  vocabulary; the ids are what gets looked up in the scheme's iconIndex.
 *  Mirrors the canonical IDs Mac Themes Garden + the Kaleidoscope corpus use.
 *  Power users can bypass this with `data-scriptoscope-icon-id="-3999"`. */
export const ICON_NAMES: Readonly<Record<string, number>> = {
  // Folders
  'folder':          -3999, // kGenericFolderIconResource — the bread-and-butter folder
  'system-folder':   -3983, // System Folder (the warm-beige one)
  'open-folder':     -3997, // Open Folder
  'private-folder':  -3994, // Private/Generic Folder
  'preferences':     -3974, // Preferences Folder (Apple System Preferences icon)
  'prefs':           -3974, // alias
  'control-panels':  -3976, // Control Panels Folder
  'shared-folder':   -3978, // Shared Folder
  // Documents + apps
  'document':        -4000, // Generic Document
  'application':     -3996, // Generic Application
  'app':             -3996, // alias
  // System things
  'trash':           -3993, // Trash (empty)
  'trash-full':      -3984, // Trash (full)
  'suitcase':        -3970, // Font Suitcase (also: scheme/font containers)
  'note':            -3990, // Note pad
  // Disks
  'hard-disk':       -3995, // Generic Hard Disk
  'floppy':          -3998, // Generic 1.44MB Floppy
  'cdrom':           -3987, // Generic CD-ROM
};

/** Promote an icon element. Idempotent (stamped via data-scriptoscope-icon-promoted).
 *  Returns true if a src was set (icon found); false otherwise so the consumer's
 *  fallback (img's existing src or alt text) stays visible. */
export function promoteIcon(el: HTMLImageElement | HTMLElement, theme: LoadedTheme): boolean {
  // Resolve the requested id: explicit data-scriptoscope-icon-id wins, else the named key.
  const rawId = el.dataset.scriptoscopeIconId;
  const id = rawId != null
    ? parseInt(rawId, 10)
    : (el.dataset.scriptoscopeIcon ? ICON_NAMES[el.dataset.scriptoscopeIcon] : undefined);
  if (id == null || Number.isNaN(id)) return false;
  // Preferred size: explicit data-scriptoscope-icon-size, default 32 (the
  // canonical Finder thumbnail size). Falls back through to any size if the
  // exact one isn't shipped — better a 16px icon than a missing one.
  const wantSize = el.dataset.scriptoscopeIconSize ? parseInt(el.dataset.scriptoscopeIconSize, 10) : 32;
  const idx = theme.inspector?.iconIndex ?? [];
  const hit = idx.find((i) => i.id === id && i.size === wantSize) ?? idx.find((i) => i.id === id);
  if (!hit?.url) return false;
  const url = hit.url;
  // Render: <img> gets src directly; other elements get an inner <img> created/replaced.
  if (el.tagName === 'IMG') {
    (el as HTMLImageElement).src = url;
    if (!el.hasAttribute('alt')) el.setAttribute('alt', '');
  } else {
    let inner = el.querySelector('img');
    if (!inner) { inner = document.createElement('img'); inner.alt = ''; el.replaceChildren(inner); }
    inner.src = url;
  }
  el.dataset.scriptoscopeIconPromoted = '';
  return true;
}
