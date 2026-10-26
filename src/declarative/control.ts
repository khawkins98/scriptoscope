import { prepareButtonPainter } from '../buttonComposition.js';
// A mount owns each replacement face and only the native properties it changes.
// Prepare off-DOM; commit only while the source location and mount are still valid.
import { listenUntilAborted } from '../listenUntilAborted.js';
import { composeCheckable, bufferToCanvas, baselineCheckable, baselineButton } from '../controls.js';
import type { ThemeInput } from '../ownedTheme.js';
import { interactiveNativeSlider, disposeInteractiveControl } from '../interactive.js';

type Promotable = HTMLInputElement | HTMLSelectElement;
type Kind = 'checkbox' | 'radio' | 'range' | 'select';
const INPUT_KIND_RE = /^(checkbox|radio|range)$/;
let nextControlId = 0;
const hiddenStyle = {
  position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0', border: '0',
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap',
};
interface Promotion {
  face: HTMLElement;
  disposeFace(): void;
  location?: { parent: ParentNode; next: ChildNode | null };
  positionChanged?: () => boolean;
  moved?: boolean;
  updateLabelFor?: (id: string) => void;
  restore: (() => void)[];
}
const promotions = new WeakMap<Promotable, Promotion>();
const pending = new WeakMap<Promotable, AbortController>();

// Restore the attributes/properties we own, preserving unrelated consumer edits.
// If the consumer changes an owned property after promotion, their newer value wins.
function setAttributeOwned(el: HTMLElement, name: string, value: string, restore: (() => void)[]): (next: string) => void {
  const before = el.getAttribute(name);
  let applied = value;
  el.setAttribute(name, applied);
  restore.push(() => {
    if (el.getAttribute(name) !== applied) return;
    if (before === null) el.removeAttribute(name); else el.setAttribute(name, before);
  });
  return next => {
    if (next !== applied && el.getAttribute(name) === applied) { el.setAttribute(name, next); applied = next; }
  };
}
function setStyleOwned(el: HTMLElement, values: Partial<CSSStyleDeclaration>, restore: (() => void)[]): void {
  const before = el.getAttribute('style');
  const original = document.createElement('span').style;
  original.cssText = before ?? '';
  Object.assign(el.style, values);
  const applied = el.getAttribute('style');
  const changed = [...new Set([...Array.from(original), ...Array.from(el.style)])]
    .filter(p => original.getPropertyValue(p) !== el.style.getPropertyValue(p)
      || original.getPropertyPriority(p) !== el.style.getPropertyPriority(p))
    .map(p => ({ p, value: original.getPropertyValue(p), priority: original.getPropertyPriority(p),
      applied: el.style.getPropertyValue(p), appliedPriority: el.style.getPropertyPriority(p) }));
  restore.push(() => {
    if (el.getAttribute('style') === applied) {
      if (before === null) el.removeAttribute('style'); else el.setAttribute('style', before);
    } else for (const p of changed) {
      if (el.style.getPropertyValue(p.p) !== p.applied || el.style.getPropertyPriority(p.p) !== p.appliedPriority) continue;
      if (p.value) el.style.setProperty(p.p, p.value, p.priority); else el.style.removeProperty(p.p);
    }
  });
}

// Observe removals of this carrier, not changes to its neighbors. Flush before
// owned replacement/teardown so synchronous caller moves are preserved too.
function watchPosition(face: HTMLElement): () => boolean {
  let moved = false;
  const record = (records: MutationRecord[]): void => { moved ||= records.some(r => Array.from(r.removedNodes).includes(face)); };
  const observer = new MutationObserver(record);
  if (face.parentNode) observer.observe(face.parentNode, { childList: true });
  return () => { record(observer.takeRecords()); observer.disconnect(); return moved; };
}

/** Release this mount's form-control face and restore only its native mutations. */
export function restoreControl(el: Promotable): void {
  pending.get(el)?.abort();
  pending.delete(el);
  const promotion = promotions.get(el);
  if (!promotion) return;
  promotions.delete(el);
  const moved = promotion.positionChanged?.() || promotion.moved;
  promotion.disposeFace();
  // Only unwrap a source still inside our carrier. Never steal a source
  // that the consumer removed or reparented while it was mounted.
  if (el.parentNode === promotion.face) {
    const location = promotion.location;
    if (location && !moved && (location.parent as Node).isConnected === el.isConnected) {
      location.parent.insertBefore(el, location.next?.parentNode === location.parent ? location.next : null);
    } else if (promotion.face.parentNode) promotion.face.replaceWith(el); else el.remove();
  }
  promotion.face.remove();
  for (const restore of promotion.restore.reverse()) restore();
}

/** Prepare and atomically replace a checkbox/radio/range/select face. */
export async function promoteControl(el: Promotable, theme: ThemeInput, signal?: AbortSignal): Promise<HTMLElement | null> {
  const previous = promotions.get(el);
  if (signal?.aborted || (el.dataset.scriptoscopePromoted != null && !previous)) return null;
  const kind: Kind | undefined = el.tagName === 'SELECT' ? 'select'
    : INPUT_KIND_RE.test((el as HTMLInputElement).type) ? (el as HTMLInputElement).type as Kind : undefined;
  if (!kind || !el.parentNode) return null;
  pending.get(el)?.abort();
  const events = new AbortController();
  pending.set(el, events);
  const abort = (): void => events.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const parent = el.parentNode, connected = el.isConnected;
  const label = kind === 'checkbox' || kind === 'radio' ? associatedLabel(el) : null;
  const labelParent = label?.parentNode;
  const checkable = kind === 'checkbox' || kind === 'radio';
  const location: Promotion['location'] = previous?.location ?? (checkable ? { parent, next: el.nextSibling } : undefined);
  let committed = false;
  const active = (): boolean => committed && !events.signal.aborted;
  let face: HTMLElement | undefined;
  try {
    face = kind === 'select'
      ? await prepareSelect(el as HTMLSelectElement, theme, events)
      : kind === 'range' ? await interactiveNativeSlider(theme, el as HTMLInputElement, active)
        : await prepareCheckable(el as HTMLInputElement, kind, theme, events);
    if (events.signal.aborted || el.parentNode !== parent || el.isConnected !== connected
      || (label && label.parentNode !== labelParent)) return null;
    const restore = previous?.restore ?? [];
    let updateLabelFor = previous?.updateLabelFor;
    if (!previous) {
      setAttributeOwned(el, 'data-scriptoscope-promoted', '', restore);
      if ((kind === 'checkbox' || kind === 'radio') && !el.id) {
        let id: string;
        do { id = `scriptoscope-native-${++nextControlId}`; } while ((el.getRootNode() as ParentNode).querySelector(`#${id}`));
        setAttributeOwned(el, 'id', id, restore);
      }
      if (!el.hasAttribute('autocomplete')) setAttributeOwned(el, 'autocomplete', 'off', restore);
      if (kind === 'select' || checkable) {
        setStyleOwned(el, {
          position: 'absolute', inset: '0', opacity: '0', cursor: el.disabled ? 'default' : 'pointer',
          zIndex: '2', width: '100%', height: '100%', font: 'inherit', margin: '0', padding: '0',
          border: '0', appearance: 'none',
        }, restore);
      } else setStyleOwned(el, hiddenStyle, restore);
      if (label?.textContent?.trim()) {
        setStyleOwned(label, hiddenStyle, restore);
        if (label.contains(el)) updateLabelFor = setAttributeOwned(label, 'for', el.id, restore);
      }
    }
    if (kind === 'checkbox' || kind === 'radio') (face as HTMLLabelElement).htmlFor = el.id;
    const focusedNative = document.activeElement === el;
    const focusedFace = !!previous?.face.contains(document.activeElement);
    if (kind === 'select' || checkable) {
      const anchor = previous?.face === parent ? previous.face : el;
      if (checkable && label?.contains(el)) label.after(face); else anchor.before(face);
      face.prepend(el);
    } else if (label?.contains(el)) label.after(face);
    else el.after(face);
    const moved = previous?.positionChanged?.() || previous?.moved;
    previous?.disposeFace();
    previous?.face.remove();
    const currentFace = face;
    promotions.set(el, { face, restore, ...(location ? { location, positionChanged: watchPosition(face), moved: !!moved } : {}), ...(updateLabelFor ? { updateLabelFor } : {}), disposeFace: () => {
      events.abort(); disposeInteractiveControl(currentFace);
    } });
    committed = true;
    face.dataset.scriptoscopePromoted = '';
    if (focusedNative) el.focus({ preventScroll: true });
    else if (focusedFace) face.focus({ preventScroll: true });
    if (kind === 'range') {
      const input = el as HTMLInputElement;
      const sync = (): void => {
        const min = numOr(input.min, 0), max = numOr(input.max, 100);
        (currentFace as HTMLElement & { _scriptoscopeSetValue?: (v: number) => void })
          ._scriptoscopeSetValue?.(max > min ? clamp01((numOr(input.value, min) - min) / (max - min)) : 0);
      };
      // Native label clicks and consumer input/change events use the same
      // state path as bfcache restoration. All listeners end with this face.
      listenUntilAborted(events.signal, input, 'change', sync);
      listenUntilAborted(events.signal, input, 'input', sync);
      listenUntilAborted(events.signal, window, 'pageshow', e => { if (e.persisted) sync(); });
      sync();
    }
    return face;
  } catch (error) {
    if (events.signal.aborted) return null;
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort);
    if (pending.get(el) === events) pending.delete(el);
    if (!committed) { events.abort(); if (face) disposeInteractiveControl(face); }
  }
}

// Labels activate the original input through the browser. The face only reads
// native state: no synthetic clicks, keyboard handlers or radio selection model.
async function prepareCheckable(input: HTMLInputElement, kind: 'checkbox' | 'radio',
  theme: ThemeInput, events: AbortController): Promise<HTMLLabelElement> {
  const label = associatedLabel(input)?.textContent?.trim() ?? '';
  const face = document.createElement('label');
  face.className = `scriptoscope-${kind}`;
  Object.assign(face.style, { display: 'inline-flex', position: 'relative', lineHeight: '0', outlineOffset: '2px' });
  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  face.append(visual);
  const states = await Promise.all([false, true].flatMap(disabled => [false, true].map(async checked => {
    const buffer = await composeCheckable(theme, kind, { label, disabled, checked });
    if (buffer) return bufferToCanvas(buffer);
    // baselineCheckable's label is presentation here, not a nested label.
    const baseline = baselineCheckable(kind, label, { checked, disabled });
    const span = document.createElement('span'); span.style.cssText = baseline.style.cssText;
    span.append(...Array.from(baseline.childNodes)); return span;
  })));
  let painted = -1;
  const sync = (): void => {
    if (events.signal.aborted) return;
    face.htmlFor = input.id;
    promotions.get(input)?.updateLabelFor?.(input.id);
    const disabled = input.matches(':disabled');
    const state = Number(disabled) * 2 + Number(input.checked);
    if (state !== painted) { visual.replaceChildren(states[state]!); painted = state; }
    face.style.cursor = disabled ? 'default' : 'pointer';
    face.style.outline = input.matches(':focus') ? '2px solid currentColor' : '';
  };
  let root: Node | undefined;
  let unlisten: (() => void)[] = [];
  listenUntilAborted(events.signal, input, 'focus', sync);
  listenUntilAborted(events.signal, input, 'blur', sync);
  listenUntilAborted(events.signal, window, 'pageshow', sync);
  const observer = new MutationObserver(() => {
    if (face.isConnected && input.parentNode !== face) { restoreControl(input); return; }
    observe(); sync();
  });
  const observe = (): void => {
    if (root !== input.getRootNode()) {
      unlisten.forEach(remove => remove()); root = input.getRootNode();
      unlisten = [listenUntilAborted(events.signal, root, 'input', sync, true),
        listenUntilAborted(events.signal, root, 'change', sync, true),
        listenUntilAborted(events.signal, root, 'reset', () => queueMicrotask(sync), true)];
    }
    observer.disconnect(); observer.observe(input, { attributes: true, attributeFilter: ['checked', 'disabled', 'id'] });
    for (let parent = input.parentElement; parent; parent = parent.parentElement) {
      observer.observe(parent, { childList: true,
        ...(parent instanceof HTMLFieldSetElement ? { attributes: true, attributeFilter: ['disabled'] } : {}) });
    }
  };
  if (!events.signal.aborted) { observe(); sync(); }
  events.signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  return face;
}

// The native select remains the sole keyboard/AT target. Prepare its decorative
// button before moving the source; refreshes are scoped to this face's lifetime.
async function prepareSelect(el: HTMLSelectElement, theme: ThemeInput, events: AbortController): Promise<HTMLElement> {
  const wrap = document.createElement('span');
  wrap.className = 'scriptoscope-select';
  Object.assign(wrap.style, { position: 'relative', display: 'inline-block', verticalAlign: 'middle',
    cursor: el.disabled ? 'default' : 'pointer' });
  let version = 0;
  let displayed: HTMLElement | undefined;
  const render = async (): Promise<void> => {
    const request = ++version;
    while (!events.signal.aborted) {
      const text = (el.selectedOptions[0]?.textContent ?? '').trim();
      const disabled = el.disabled;
      let button: HTMLElement;
      try {
        const painter = await prepareButtonPainter(theme, { label: `${text}  ▾`, disabled }, 1, events.signal);
        if (painter) {
          button = document.createElement('span');
          button.className = 'scriptoscope-button';
          Object.assign(button.style, { display: 'inline-block', lineHeight: '0', userSelect: 'none', outlineOffset: '2px' });
          button.append(painter.canvas);
        } else button = baselineButton(`${text}  ▾`, { disabled });
        painter?.dispose(); // The closed select owns a static face, not a second interactive button.
        if (button instanceof HTMLButtonElement) button.type = 'button';
      } catch (error) {
        if (events.signal.aborted || request !== version) return;
        throw error;
      }
      if (events.signal.aborted || request !== version) return;
      // Native state can change while the first face is preparing, before
      // listeners are installed. Commit only a face for the current selection.
      if (text !== (el.selectedOptions[0]?.textContent ?? '').trim() || disabled !== el.disabled) {
        continue;
      }
      button.setAttribute('aria-label', `${text}  ▾`);
      button.tabIndex = -1;
      button.setAttribute('aria-hidden', 'true');
      button.style.pointerEvents = 'none';
      if (displayed) displayed.replaceWith(button); else wrap.append(button);
      displayed = button;
      return;
    }
  };
  await render();
  if (!events.signal.aborted) {
    listenUntilAborted(events.signal, el, 'change', () => { void render(); });
    listenUntilAborted(events.signal, window, 'pageshow', e => { if (e.persisted) void render(); });
  }
  return wrap;
}

function associatedLabel(el: Promotable): HTMLLabelElement | null {
  return el instanceof HTMLInputElement ? Array.from(el.labels ?? []).find(label => label !== promotions.get(el)?.face) ?? null : null;
}

function numOr(s: string, fallback: number): number {
  const n = parseFloat(s); return Number.isFinite(n) ? n : fallback;
}
function clamp01(n: number): number { return n < 0 ? 0 : n > 1 ? 1 : n; }
