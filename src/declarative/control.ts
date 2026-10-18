// A mount owns each replacement face and only the native properties it changes.
// Prepare off-DOM; commit only while the source location and mount are still valid.
import { listenUntilAborted } from '../listenUntilAborted.js';
import type { LoadedTheme } from '../types.js';
import { interactiveCheckbox, interactiveRadio, interactiveNativeSlider, interactiveButton, disposeInteractiveControl } from '../interactive.js';

type Promotable = HTMLInputElement | HTMLSelectElement;
type Kind = 'checkbox' | 'radio' | 'range' | 'select';
const INPUT_KIND_RE = /^(checkbox|radio|range)$/;
const SETTER = '_scriptoscopeSetChecked';
const hiddenStyle = {
  position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0', border: '0',
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap',
};
interface Promotion {
  face: HTMLElement;
  disposeFace(): void;
  restore: (() => void)[];
}
const promotions = new WeakMap<Promotable, Promotion>();
const pending = new WeakMap<Promotable, AbortController>();

// Restore the attributes/properties we own, preserving unrelated consumer edits.
// If the consumer changes an owned property after promotion, their newer value wins.
function setAttributeOwned(el: HTMLElement, name: string, value: string, restore: (() => void)[]): void {
  const before = el.getAttribute(name);
  el.setAttribute(name, value);
  restore.push(() => {
    if (el.getAttribute(name) !== value) return;
    if (before === null) el.removeAttribute(name); else el.setAttribute(name, before);
  });
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

function disposeFace(face: HTMLElement): void {
  disposeInteractiveControl(face);
}

/** Release this mount's form-control face and restore only its native mutations. */
export function restoreControl(el: Promotable): void {
  pending.get(el)?.abort();
  pending.delete(el);
  const promotion = promotions.get(el);
  if (!promotion) return;
  promotions.delete(el);
  promotion.disposeFace();
  // Only unwrap a native select still inside our wrapper. Never steal a source
  // that the consumer removed or reparented while it was mounted.
  if (el.parentNode === promotion.face) {
    if (promotion.face.parentNode) promotion.face.replaceWith(el); else el.remove();
  }
  promotion.face.remove();
  for (const restore of promotion.restore.reverse()) restore();
}

/** Prepare and atomically replace a checkbox/radio/range/select face. */
export async function promoteControl(el: Promotable, theme: LoadedTheme, signal?: AbortSignal): Promise<HTMLElement | null> {
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
  let committed = false;
  const active = (): boolean => committed && !events.signal.aborted;
  let face: HTMLElement | undefined;
  try {
    face = kind === 'select'
      ? await prepareSelect(el as HTMLSelectElement, theme, events)
      : await prepareInput(el as HTMLInputElement, kind, theme, active);
    if (events.signal.aborted || el.parentNode !== parent || el.isConnected !== connected
      || (label && label.parentNode !== labelParent)) return null;
    const restore = previous?.restore ?? [];
    if (!previous) {
      setAttributeOwned(el, 'data-scriptoscope-promoted', '', restore);
      if (!el.hasAttribute('autocomplete')) setAttributeOwned(el, 'autocomplete', 'off', restore);
      if (kind === 'select') {
        setStyleOwned(el, {
          position: 'absolute', inset: '0', opacity: '0', cursor: el.disabled ? 'default' : 'pointer',
          zIndex: '2', width: '100%', height: '100%', font: 'inherit', margin: '0', padding: '0',
          border: '0', appearance: 'none',
        }, restore);
      } else {
        setStyleOwned(el, hiddenStyle, restore);
        if (kind !== 'range') {
          setAttributeOwned(el, 'tabindex', '-1', restore);
          setAttributeOwned(el, 'aria-hidden', 'true', restore);
        }
        if (label?.textContent?.trim()) setStyleOwned(label, hiddenStyle, restore);
      }
    }
    const focusedNative = document.activeElement === el;
    const focusedFace = !!previous?.face.contains(document.activeElement);
    if (kind === 'select') {
      const anchor = previous?.face === parent ? previous.face : el;
      anchor.before(face);
      face.prepend(el);
    } else if (label?.contains(el)) label.after(face);
    else el.after(face);
    previous?.disposeFace();
    previous?.face.remove();
    const currentFace = face;
    promotions.set(el, { face, restore, disposeFace: () => {
      events.abort(); disposeFace(currentFace);
    } });
    committed = true;
    face.dataset.scriptoscopePromoted = '';
    if (focusedNative) el.focus({ preventScroll: true });
    else if (focusedFace) face.focus({ preventScroll: true });
    if (kind !== 'select') {
      const input = el as HTMLInputElement;
      const sync = (): void => syncInput(input, kind, currentFace);
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
    if (!committed) { events.abort(); if (face) disposeFace(face); }
  }
}

async function prepareInput(input: HTMLInputElement, kind: Exclude<Kind, 'select'>, theme: LoadedTheme,
  active: () => boolean): Promise<HTMLElement> {
  const label = labelTextFor(input);
  let skinned: HTMLElement;
  if (kind === 'checkbox') {
    skinned = await interactiveCheckbox(theme, {
      checked: input.checked,
      disabled: input.disabled,
      ...(label ? { label } : {}),
      onChange: (checked) => {
        if (!active()) return;
        input.checked = checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
  } else if (kind === 'radio') {
    skinned = await interactiveRadio(theme, {
      checked: input.checked,
      disabled: input.disabled,
      ...(label ? { label } : {}),
      onChange: () => {
        if (!active()) return;
        if (!input.checked) input.click();
        syncRadioGroup(input.name);
      },
    });
    if (input.name) skinned.dataset.scriptoscopeRadioGroup = input.name;
    (skinned as unknown as { _scriptoscopeNative: HTMLInputElement })._scriptoscopeNative = input;
  } else {
    // Keep the native range as the sole keyboard/AT surface. Its browser-owned
    // steps, names, numeric bounds and effective disabled state remain live.
    skinned = await interactiveNativeSlider(theme, input, active);
  }

  return skinned;
}

function syncInput(input: HTMLInputElement, kind: Exclude<Kind, 'select'>, face: HTMLElement): void {
  const setters = face as unknown as { _scriptoscopeSetChecked?: (v: boolean) => void; _scriptoscopeSetValue?: (v: number) => void };
  if (kind !== 'range') {
    setters._scriptoscopeSetChecked?.(input.checked);
    if (kind === 'radio') syncRadioGroup(input.name);
  } else {
    const min = numOr(input.min, 0), max = numOr(input.max, 100);
    setters._scriptoscopeSetValue?.(max > min ? clamp01((numOr(input.value, min) - min) / (max - min)) : 0);
  }
}

// The native select remains the sole keyboard/AT target. Prepare its decorative
// button before moving the source; refreshes are scoped to this face's lifetime.
async function prepareSelect(el: HTMLSelectElement, theme: LoadedTheme, events: AbortController): Promise<HTMLElement> {
  const wrap = document.createElement('span');
  wrap.className = 'scriptoscope-select';
  Object.assign(wrap.style, { position: 'relative', display: 'inline-block', verticalAlign: 'middle',
    cursor: el.disabled ? 'default' : 'pointer' });
  let version = 0;
  let displayed: HTMLElement | undefined;
  events.signal.addEventListener('abort', () => { if (displayed) disposeInteractiveControl(displayed); }, { once: true });
  const render = async (): Promise<void> => {
    const request = ++version;
    while (!events.signal.aborted) {
      const text = (el.selectedOptions[0]?.textContent ?? '').trim();
      const disabled = el.disabled;
      let button: HTMLElement;
      try { button = await interactiveButton(theme, { label: `${text}  ▾`, disabled }, events.signal); }
      catch (error) {
        if (events.signal.aborted || request !== version) return;
        throw error;
      }
      if (events.signal.aborted || request !== version) { disposeInteractiveControl(button); return; }
      // Native state can change while the first face is preparing, before
      // listeners are installed. Commit only a face for the current selection.
      if (text !== (el.selectedOptions[0]?.textContent ?? '').trim() || disabled !== el.disabled) {
        disposeInteractiveControl(button); continue;
      }
      button.tabIndex = -1;
      button.setAttribute('aria-hidden', 'true');
      button.style.pointerEvents = 'none';
      if (displayed) { disposeInteractiveControl(displayed); displayed.replaceWith(button); } else wrap.append(button);
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

function labelTextFor(el: Promotable): string | undefined {
  const lbl = associatedLabel(el);
  return lbl?.textContent?.trim() || undefined;
}

function associatedLabel(el: Promotable): HTMLLabelElement | null {
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl instanceof HTMLLabelElement) return lbl;
  }
  const wrap = el.closest('label');
  return wrap instanceof HTMLLabelElement ? wrap : null;
}

function numOr(s: string, fallback: number): number {
  const n = parseFloat(s); return Number.isFinite(n) ? n : fallback;
}
function clamp01(n: number): number { return n < 0 ? 0 : n > 1 ? 1 : n; }

/** Re-paint every themed radio in `name` to match its native input's current `.checked` state.
 *  Used after a click flips one — the browser updates siblings' `.checked` natively, but we own
 *  their themed visuals. */
function syncRadioGroup(name: string): void {
  if (!name) return;
  const sel = `.scriptoscope-radio[data-scriptoscope-radio-group="${CSS.escape(name)}"]`;
  for (const node of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
    const native = (node as unknown as { _scriptoscopeNative?: HTMLInputElement })._scriptoscopeNative;
    const setVisual = (node as unknown as Record<string, ((v: boolean) => void) | undefined>)[SETTER];
    if (native && setVisual) setVisual(native.checked);
  }
}
