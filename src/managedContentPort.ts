import type { ControlCompositionContext, ControlRect } from './controlComposition.js';

/** Browser-layout policy, not a reconstruction of an original GrafPort. */
export type ManagedPortMeasurement =
  | { readonly status: 'ready'; readonly portId: string; readonly scale: number; readonly context: ControlCompositionContext }
  | { readonly status: 'unsupported'; readonly portId: string; readonly reason:
    'uncommitted' | 'detached' | 'outside-port' | 'hidden' | 'transform' | 'canvas-box' | 'scale-mismatch' | 'fractional-coordinate' | 'coordinate-range' | 'face-layout' | 'document-mismatch' | 'state-layout-mismatch' | 'port-removed' };

type UnsupportedReason = Extract<ManagedPortMeasurement, { status: 'unsupported' }>['reason'];
type PortGeometry = { reason: UnsupportedReason } | { host: HTMLElement; left: number; top: number; width: number; height: number; unit: number };
/** Read-only consumer surface. Mutation of committed viewport authority remains
 * private to the WindowManager integration, not a caller-supplied callback. */
export interface ManagedControlPort {
  readonly id: string;
  readonly displayScale: number | null;
  readonly disposed: boolean;
  measure(canvas: HTMLCanvasElement, faceRect: ControlRect): ManagedPortMeasurement;
  observe(canvas: HTMLCanvasElement, faceRect: () => ControlRect, changed: (measurement: ManagedPortMeasurement) => void): { refresh(): void; dispose(): void };
  refresh(): void;
}

let nextPort = 0;
const EPSILON = 1e-6;
const near = (a: number, b: number): boolean => Math.abs(a - b) <= EPSILON;
const integer = (n: number): number | null => Number.isFinite(n) && near(n, Math.round(n)) ? Math.round(n) : null;

function visualParent(el: Element): Element | null {
  if (el.assignedSlot) return el.assignedSlot;
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return root.nodeType === 11 && 'host' in root ? (root as ShadowRoot).host : null;
}

function axisAligned(el: Element): boolean {
  for (let node: Element | null = el; node; node = visualParent(node)) {
    const view = node.ownerDocument.defaultView;
    if (!view) return false;
    const css = view.getComputedStyle(node);
    if (css.perspective !== 'none') return false;
    if (css.transform !== 'none') {
      const matrix = new (view as Window & typeof globalThis).DOMMatrixReadOnly(css.transform);
      if (!matrix.is2D || !near(matrix.b, 0) || !near(matrix.c, 0) || matrix.a <= 0 || !near(matrix.a, matrix.d)) return false;
    }
    // Individual transform properties do not appear in the transform matrix.
    const rotate = css.getPropertyValue('rotate');
    if (rotate && rotate !== 'none' && rotate !== '0deg') return false;
    const scale = css.getPropertyValue('scale');
    if (scale && scale !== 'none') {
      const parts = scale.split(/\s+/).map(Number);
      if (parts.length > 2 || !Number.isFinite(parts[0]) || parts[0]! <= 0 || !near(parts[0]!, parts[1] ?? parts[0]!)) return false;
    }
    if (css.getPropertyValue('zoom') && !['normal', '1'].includes(css.getPropertyValue('zoom'))) return false;
  }
  return true;
}

/** Browser-layout adapter. The manager must call commit only after mounting its new
 * viewport; preparing a theme must never update this coordinate authority. */
export class ManagedContentPort {
  readonly id = `managed-content-${++nextPort}`;
  readonly port: ManagedControlPort;
  private removed = false;

  constructor() {
    const authority = this;
    this.port = Object.freeze({
      get id() { return authority.id; },
      get displayScale() { return authority.committed?.scale ?? null; },
      get disposed() { return authority.removed; },
      measure: (canvas: HTMLCanvasElement, rect: ControlRect) => authority.measure(canvas, rect),
      observe: (canvas: HTMLCanvasElement, rect: () => ControlRect, changed: (measurement: ManagedPortMeasurement) => void) => trackManagedContent(authority, canvas, rect, changed),
      refresh: () => { for (const wake of authority.invalidated) wake(); },
    });
  }
  private committed: { viewport: HTMLElement; scale: number; host: HTMLElement } | null = null;
  private readonly invalidated = new Set<() => void>();
  private cached: { frame: object; geometry: PortGeometry } | null = null;

  commit(host: HTMLElement, viewport: HTMLElement, scale: number): void {
    if (this.removed) throw new Error('Removed content port cannot be recommitted');
    if (!Number.isInteger(scale) || scale < 1) throw new RangeError('Managed display scale must be a positive integer');
    this.committed = { host, viewport, scale };
    this.cached = null;
    for (const wake of this.invalidated) wake();
  }

  dispose(): void {
    if (this.removed) return;
    this.removed = true; this.committed = null; this.cached = null;
    for (const wake of this.invalidated) {
      try { wake(); } catch (error) { console.error('[scriptoscope] content-port subscriber threw during removal:', error); }
    }
    this.invalidated.clear();
  }

  clear(): void { this.committed = null; this.cached = null; for (const wake of this.invalidated) wake(); }

  /** @internal Commit invalidation schedules the shared pass, never paints inline. */
  onCommit(wake: () => void): () => void { this.invalidated.add(wake); return () => this.invalidated.delete(wake); }

  private geometry(frame: object): PortGeometry {
    if (this.cached?.frame === frame) return this.cached.geometry;
    const read = (): PortGeometry => {
      if (this.removed) return { reason: 'port-removed' };
      const current = this.committed;
      if (!current) return { reason: 'uncommitted' };
      const { host, viewport, scale } = current;
      if (!host.isConnected || !viewport.isConnected) return { reason: 'detached' };
      const box = viewport.getBoundingClientRect(), css = viewport.ownerDocument.defaultView!.getComputedStyle(viewport);
      const width = parseFloat(css.width), height = parseFloat(css.height);
      if (!(box.width > 0 && box.height > 0 && width > 0 && height > 0)) return { reason: 'hidden' };
      if (!axisAligned(viewport)) return { reason: 'transform' };
      const unit = box.width / width * scale;
      if (!(unit > 0) || !near(unit, box.height / height * scale)) return { reason: 'transform' };
      return { host, left: box.left, top: box.top, width: box.width, height: box.height, unit };
    };
    const geometry = read(); this.cached = { frame, geometry }; return geometry;
  }

  /** The caller supplies the actual compositor faceRect, never a guessed ring inset. */
  measure(canvas: HTMLCanvasElement, faceRect: ControlRect): ManagedPortMeasurement {
    return this.measureInFrame(canvas, faceRect, {});
  }

  /** @internal One shared pass token caches each committed viewport measurement. */
  measureInFrame(canvas: HTMLCanvasElement, faceRect: ControlRect, frame: object): ManagedPortMeasurement {
    const unsupported = (reason: UnsupportedReason): ManagedPortMeasurement => Object.freeze({ status: 'unsupported', portId: this.id, reason });
    if (![faceRect.x, faceRect.y, faceRect.w, faceRect.h].every(Number.isInteger) || faceRect.x < 0 || faceRect.y < 0 || faceRect.w <= 0 || faceRect.h <= 0 || faceRect.x + faceRect.w > canvas.width || faceRect.y + faceRect.h > canvas.height) return unsupported('face-layout');
    if (this.committed && this.committed.host.ownerDocument !== canvas.ownerDocument) return unsupported('document-mismatch');
    const geometry = this.geometry(frame);
    if ('reason' in geometry) return unsupported(geometry.reason);
    const { host, left, top, width, height, unit } = geometry;
    if (!canvas.isConnected) return unsupported('detached');
    if (!host.contains(canvas) || canvas.closest('[data-scriptoscope-window-host]') !== host) return unsupported('outside-port');
    if (!axisAligned(canvas)) return unsupported('transform');
    const css = canvas.ownerDocument.defaultView!.getComputedStyle(canvas);
    for (const name of ['border-left-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'padding-left', 'padding-top', 'padding-right', 'padding-bottom']) {
      if (parseFloat(css.getPropertyValue(name)) !== 0) return unsupported('canvas-box');
    }
    const box = canvas.getBoundingClientRect();
    if (!(box.width > 0 && box.height > 0 && canvas.width > 0 && canvas.height > 0)) return unsupported('hidden');
    if (!near(box.width / canvas.width, unit) || !near(box.height / canvas.height, unit)) return unsupported('scale-mismatch');
    const x = integer((box.left - left) / unit + faceRect.x);
    const y = integer((box.top - top) / unit + faceRect.y);
    const w = integer(width / unit), h = integer(height / unit);
    if (x === null || y === null || w === null || h === null) return unsupported('fractional-coordinate');
    if (x < -32768 || y < -32768 || x + faceRect.w > 32767 || y + faceRect.h > 32767 || w > 32767 || h > 32767) return unsupported('coordinate-range');
    return Object.freeze({ status: 'ready', portId: this.id, scale: unit, context: Object.freeze({
      basis: 'managed-content-port', controlOrigin: Object.freeze([x, y]) as readonly [number, number], portOrigin: Object.freeze([0, 0]) as readonly [number, number],
      patternOrigin: Object.freeze({ status: 'unknown' }), clip: Object.freeze({ kind: 'rect', rect: Object.freeze({ x: 0, y: 0, w, h }) }),
    }) });
  }
}

interface PortBinding {
  canvas: HTMLCanvasElement;
  active: boolean;
  refresh(frame?: object): void;
}
interface PortTracker {
  bindings: Set<PortBinding>;
  frame: number | null;
  wake: MutationObserver | null;
  wakeFromResize: (() => void) | null;
}
const trackers = new WeakMap<Window, PortTracker>();

/** One finite bound set per browsing context. The dormant observer only wakes
 * tracking after reconnect; it does not scan descendants or compose pixels. */
function scheduleTracker(view: Window, tracker: PortTracker): void {
  if (tracker.frame !== null || tracker.bindings.size === 0) return;
  const active = [...tracker.bindings].some(binding => binding.active && binding.canvas.isConnected);
  if (!active) {
    if (!tracker.wake) {
      const wake = () => {
        for (const binding of tracker.bindings) binding.active = binding.canvas.isConnected;
        scheduleTracker(view, tracker);
      };
      tracker.wake = new (view as Window & typeof globalThis).MutationObserver(wake);
      tracker.wake.observe(view.document, { childList: true, subtree: true, attributes: true });
      tracker.wakeFromResize = wake; view.addEventListener('resize', wake);
    }
    return;
  }
  tracker.wake?.disconnect(); tracker.wake = null;
  if (tracker.wakeFromResize) view.removeEventListener('resize', tracker.wakeFromResize);
  tracker.wakeFromResize = null;
  tracker.frame = view.requestAnimationFrame(() => {
    tracker.frame = null;
    try {
      // Include a just-detached binding once, so it clears stale managed context.
      const frame = {};
      for (const binding of tracker.bindings) binding.refresh(frame);
    } finally { scheduleTracker(view, tracker); }
  });
}

/** Internal subscription; public button binding owns scale and paints.
 * A change callback must reset to explicit compatibility-default on unsupported
 * measurements. Retaining an old managed D would incorrectly imply valid state. */
export function trackManagedContent(
  port: ManagedContentPort,
  canvas: HTMLCanvasElement,
  faceRect: () => ControlRect,
  changed: (measurement: ManagedPortMeasurement) => void,
): { refresh(): void; dispose(): void } {
  const view = canvas.ownerDocument.defaultView;
  if (!view) throw new Error('Managed content requires an owner window');
  let tracker = trackers.get(view);
  if (!tracker) {
    tracker = { bindings: new Set(), frame: null, wake: null, wakeFromResize: null };
    trackers.set(view, tracker);
  }
  let live = true, previous = '';
  const binding: PortBinding = { canvas, active: true, refresh(frame = {}) {
    if (!live) return;
    const measurement = port.measureInFrame(canvas, faceRect(), frame);
    binding.active = measurement.status === 'ready' || !['uncommitted', 'hidden', 'detached', 'outside-port', 'port-removed'].includes(measurement.reason);
    const signature = JSON.stringify(measurement);
    if (signature === previous) return;
    previous = signature;
    changed(measurement);
  } };
  tracker.bindings.add(binding);
  const unobserveCommit = port.onCommit(() => {
    if (port.port.disposed) { try { binding.refresh(); } finally { dispose(); } }
    else { binding.active = true; scheduleTracker(view, tracker); }
  });
  const dispose = () => {
    if (!live) return;
    live = false; unobserveCommit(); tracker.bindings.delete(binding);
    if (tracker.bindings.size === 0) {
      if (tracker.frame !== null) view.cancelAnimationFrame(tracker.frame);
      tracker.frame = null; tracker.wake?.disconnect(); tracker.wake = null;
      if (tracker.wakeFromResize) view.removeEventListener('resize', tracker.wakeFromResize);
      tracker.wakeFromResize = null; trackers.delete(view);
    }
  };
  // A throwing initial consumer must not leave a registration without a disposer.
  try { binding.refresh(); if (port.port.disposed) dispose(); else scheduleTracker(view, tracker); }
  catch (error) { dispose(); throw error; }
  return { refresh() { binding.refresh(); scheduleTracker(view, tracker); }, dispose };
}
