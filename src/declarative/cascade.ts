// `data-scriptoscope-cascade` — a container attribute that gives the
// descendant promoted windows a Mac-OS-classic cascade layout: each
// window is positioned absolutely at a cumulative offset from the
// container's natural top-left, with later windows on top in z-order.
//
// Why this exists. Consumers who want a desktop-scatter effect (windows
// overlapping a bit, looking like real Mac windows opened in sequence)
// used to have to hand-write `data-scriptoscope-x="..." data-scriptoscope-
// y="..."` on every single window, computing offsets in their head.
// The cascade attribute is the library answer: opt in at the container,
// let the runtime do the math.
//
// Defaults match the classic Mac OS "new window stagger" of 32px right,
// 28px down per window. Overrideable via `data-scriptoscope-cascade-step-x`
// / `-step-y` on the same container. Base offset (the position of the
// first window inside the container) defaults to (0, 0); override via
// `-base-x` / `-base-y`.
//
// Precedence rules:
//   1. Per-window `data-scriptoscope-x` / `-y` always wins. The cascade
//      skips windows that have either coordinate declared explicitly.
//   2. Cascade is one-shot at mount time. After the user drags or
//      resizes a window, that window owns its position; the cascade
//      doesn't re-apply on subsequent scans.
//   3. Nested cascade containers cascade independently — each container
//      iterates its own direct-or-descendant promoted windows.

import type { ScriptoscopeWindow } from './ScriptoscopeWindow.js';
import { debug } from '../debug.js';

const DEFAULT_STEP_X = 32;
const DEFAULT_STEP_Y = 28;

/** Read a positive-integer attribute; return fallback if missing / invalid. */
function intAttr(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Find the cascade containers in `within` and lay out their descendant
 *  windows. `mounted` is the full list of promoted ScriptoscopeWindow
 *  instances; we filter to those whose source element was inside a
 *  given cascade container. Idempotent: a window already cascaded in
 *  a prior call won't be re-cascaded (stamped via host dataset). */
export function applyCascadeLayout(within: Document | Element, mounted: ScriptoscopeWindow[]): void {
  const root: ParentNode = within instanceof Document ? within : within;
  const containers = Array.from(
    (root as Element).querySelectorAll?.('[data-scriptoscope-cascade]') ?? [],
  ) as HTMLElement[];
  if (!containers.length) return;
  for (const container of containers) {
    const stepX = intAttr(container, 'data-scriptoscope-cascade-step-x', DEFAULT_STEP_X);
    const stepY = intAttr(container, 'data-scriptoscope-cascade-step-y', DEFAULT_STEP_Y);
    const baseX = intAttr(container, 'data-scriptoscope-cascade-base-x', 0);
    const baseY = intAttr(container, 'data-scriptoscope-cascade-base-y', 0);
    // Pull the windows whose host is a descendant of THIS container.
    // mounted is ordered by promotion (DOM order in the WINDOW_SEL
    // querySelectorAll), which matches the desired cascade order.
    const myWindows = mounted.filter((w) => container.contains(w.host));
    if (!myWindows.length) continue;
    // Container becomes positioned ancestor so the absolute children
    // resolve against it. Only set if not already positioned — respect
    // consumer's `position: relative/absolute` if they set one.
    const containerCs = getComputedStyle(container);
    if (containerCs.position === 'static') container.style.position = 'relative';

    let idx = 0;
    for (const w of myWindows) {
      const host = w.host;
      // Skip if this window was cascaded in a prior scan pass (re-mount).
      if (host.dataset.scriptoscopeCascaded != null) { idx++; continue; }
      // Skip if the consumer declared explicit -x or -y on the source
      // element (precedence rule 1). After ScriptoscopeWindow.promote,
      // the absolute-opt-in path has set host.style.position = 'absolute'
      // with non-empty left/top. An in-flow Posture-B host has empty
      // inline position. We use that as the signal: if the host is
      // already absolute on entry, the consumer asked for explicit
      // positioning and the cascade defers.
      if (host.style.position === 'absolute' || host.style.position === 'fixed') {
        idx++;
        continue;
      }

      const x = baseX + idx * stepX;
      const y = baseY + idx * stepY;
      // Flip to absolute + position. Drop any inline static the host
      // may have inherited from Posture B's clear.
      host.style.position = 'absolute';
      host.style.left = `${x}px`;
      host.style.top = `${y}px`;
      // Later cascaded windows sit on top.
      host.style.zIndex = String(100 + idx);
      host.dataset.scriptoscopeCascaded = '';
      debug('cascade', `cascaded ${host.getAttribute('aria-label') ?? '(untitled)'} → (${x}, ${y}) z=${100 + idx}`);
      idx++;
    }

    // Reserve container min-height to span the cascade's vertical extent.
    // Without this, the cascade flows below the container's natural
    // bottom and overlaps any sibling content beneath. We measure the
    // tallest cascaded host + add (n-1)*stepY for the cumulative offset.
    let maxHostH = 0;
    for (const w of myWindows) {
      const h = w.host.getBoundingClientRect().height;
      if (h > maxHostH) maxHostH = h;
    }
    const minH = baseY + (myWindows.length - 1) * stepY + maxHostH + 8; // 8px breathing room
    if (minH > 0) container.style.minHeight = `${minH}px`;
  }
}
