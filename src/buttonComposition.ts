import { composeButtonWithLayout, bufferToCanvas, type ButtonOptions } from './controls.js';
import { snapshotControlComposition, buttonFaceStageUnavailable, type ButtonComposition, type ControlCompositionContext, type ControlCompositionSnapshot } from './controlComposition.js';
import type { LoadedTheme } from './types.js';
import type { ManagedControlPort, ManagedPortMeasurement } from './managedContentPort.js';

interface Pair { normal: ButtonComposition; pressed: ButtonComposition; }
export interface ButtonBindingState {
  readonly disposed: boolean;
  /** Requested browser mapping, not proof that its pixels have committed. */
  readonly measurement: ManagedPortMeasurement | null;
  readonly committedContext: ControlCompositionSnapshot;
  readonly pending: boolean;
  readonly error: string | null;
}
export interface ButtonCompositionBinding {
  readonly state: ButtonBindingState;
  refresh(): Promise<void>;
  /** Unsubscribe and invalidate synchronously, then restore the pre-binding context. */
  dispose(): Promise<void>;
}
const painters = new WeakMap<HTMLElement, ButtonPainter>();
const alive = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new DOMException('Button composition aborted', 'AbortError');
};

/** Internal preparation seam; public detached interactiveButton remains supported. */
export async function prepareButtonPainter(theme: LoadedTheme, options: ButtonOptions, scale: number, signal?: AbortSignal): Promise<ButtonPainter | null> {
  const initial = snapshotControlComposition(options.compositionContext);
  const prepare = async (context: ControlCompositionSnapshot, lifetime?: AbortSignal): Promise<Pair | null> => {
    alive(lifetime);
    const normal = await composeButtonWithLayout(theme, { ...options, pressed: false }, lifetime, context);
    alive(lifetime);
    if (!normal || buttonFaceStageUnavailable(normal)) return null;
    const pressed = options.disabled ? null : await composeButtonWithLayout(theme, { ...options, pressed: true }, lifetime, context);
    alive(lifetime);
    if (!options.disabled && (!pressed || buttonFaceStageUnavailable(pressed))) return null;
    return { normal, pressed: pressed ?? normal };
  };
  const pair = await prepare(initial, signal);
  alive(signal);
  return pair ? new ButtonPainter(pair, initial, scale, prepare) : null;
}

/** Internal scanner integration skips native baseline fallbacks. */
export function bindOwnedButtonToContentPort(el: HTMLElement, port: ManagedControlPort): ButtonCompositionBinding | null {
  const painter = painters.get(el);
  return painter?.automaticAllowed ? painter.bind(port, 'managed') : null;
}

export function registerButtonPainter(el: HTMLElement, painter: ButtonPainter): void { painters.set(el, painter); }
export function unregisterButtonPainter(el: HTMLElement): void { painters.delete(el); }

/** Bind an interactive themed button to an explicitly managed browser port.
 * Default adoption changes its CSS size to the window's committed integer scale. */
export function bindButtonToContentPort(el: HTMLElement, port: ManagedControlPort,
  options: { scale?: 'managed' | 'preserve' } = {}): ButtonCompositionBinding {
  const painter = painters.get(el);
  if (!painter || painter.disposed) throw new Error('Button has no live themed canvas to bind');
  painter.automaticAllowed = false;
  return painter.bind(port, options.scale ?? 'managed');
}

/** A caller declaration takes ownership from a provider before asynchronous paint.
 * Invalid declarations reject without changing the current binding or pixels. */
export async function setButtonCompositionContext(el: HTMLElement, context?: ControlCompositionContext): Promise<void> {
  const snapshot = snapshotControlComposition(context);
  const painter = painters.get(el);
  if (!painter || painter.disposed) return Promise.reject(new Error('Button has no live themed canvas to update'));
  painter.automaticAllowed = false;
  painter.releaseBinding(false);
  return painter.declare(snapshot);
}

/** The paired state buffers and their context commit together. The visible canvas
 * remains stable so focus, native forwarding and bound measurement survive. */
export class ButtonPainter {
  readonly canvas: HTMLCanvasElement;
  disposed = false;
  automaticAllowed = true;
  private pair: Pair;
  private context: ControlCompositionSnapshot;
  private unboundContext: ControlCompositionSnapshot;
  private down = false;
  private epoch = 0;
  private abort: AbortController | null = null;
  private pending = false;
  private task: Promise<void> = Promise.resolve();
  private binding: { release(restore: boolean): Promise<void>; adopt(): void } | null = null;

  constructor(pair: Pair, context: ControlCompositionSnapshot, private readonly scale: number,
    private prepare: ((context: ControlCompositionSnapshot, signal: AbortSignal) => Promise<Pair | null>) | null) {
    this.pair = pair; this.context = context; this.unboundContext = context;
    this.canvas = bufferToCanvas(pair.normal.buffer, scale);
  }
  get layout() { return (this.down ? this.pair.pressed : this.pair.normal).layout; }
  press(down: boolean): void { if (!this.disposed) { this.down = down; this.paint(); } }
  private paint(): void {
    const buffer = (this.down ? this.pair.pressed : this.pair.normal).buffer;
    const oldW = this.canvas.width, oldH = this.canvas.height;
    this.canvas.width = buffer.width; this.canvas.height = buffer.height;
    this.canvas.getContext('2d')!.putImageData(buffer.toImageData(), 0, 0);
    if (this.binding) this.binding.adopt();
    else {
      if (this.canvas.style.width === `${oldW * this.scale}px`) this.canvas.style.width = `${buffer.width * this.scale}px`;
      if (this.canvas.style.height === `${oldH * this.scale}px`) this.canvas.style.height = `${buffer.height * this.scale}px`;
    }
  }
  async declare(context: ControlCompositionSnapshot): Promise<void> {
    await this.update(context);
    if (this.context === context) this.unboundContext = context;
  }
  update(context: ControlCompositionSnapshot): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.abort?.abort();
    const epoch = ++this.epoch;
    if (JSON.stringify(context) === JSON.stringify(this.context)) {
      this.pending = false; this.abort = null; this.task = Promise.resolve(); return this.task;
    }
    const abort = new AbortController();
    this.abort = abort; this.pending = true;
    const prepare = this.prepare!;
    const task = (async () => {
      try {
        const pair = await prepare(context, abort.signal);
        if (this.disposed || abort.signal.aborted || epoch !== this.epoch) return;
        if (!pair) throw new Error('Themed button composition became unavailable');
        this.pair = pair; this.context = context; this.paint();
      } catch (error) {
        if (!abort.signal.aborted && epoch === this.epoch && !this.disposed) throw error;
      } finally {
        if (epoch === this.epoch) { this.pending = false; this.abort = null; }
      }
    })();
    this.task = task;
    return task;
  }
  releaseBinding(restore: boolean): Promise<void> { return this.binding?.release(restore) ?? Promise.resolve(); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; ++this.epoch; this.abort?.abort(); this.abort = null; this.pending = false;
    this.prepare = null; // Retained old faces/bindings must not retain their theme.
    void this.releaseBinding(false);
  }
  bind(port: ManagedControlPort, scalePolicy: 'managed' | 'preserve'): ButtonCompositionBinding {
    void this.releaseBinding(false);
    const previousContext = this.unboundContext;
    let terminal = false;
    let request = 0;
    let live = true, measurement: ManagedPortMeasurement | null = null, error: string | null = null;
    let observer: { refresh(): void; dispose(): void } | null = null;
    const styles = (['width', 'height'] as const).map(name => ({ name, original: this.canvas.style.getPropertyValue(name),
      priority: this.canvas.style.getPropertyPriority(name), applied: this.canvas.style.getPropertyValue(name), appliedPriority: this.canvas.style.getPropertyPriority(name), owned: false }));
    const adopt = () => {
      if (!live || scalePolicy === 'preserve' || port.displayScale === null) return;
      for (const property of styles) {
        const value = this.canvas.style.getPropertyValue(property.name), priority = this.canvas.style.getPropertyPriority(property.name);
        if (property.owned && (value !== property.applied || priority !== property.appliedPriority)) continue;
        const desired = `${this.canvas[property.name] * port.displayScale}px`;
        this.canvas.style.setProperty(property.name, desired);
        property.owned = true; property.applied = desired; property.appliedPriority = '';
      }
    };
    const owned = { adopt, release: (restore: boolean): Promise<void> => {
      if (!live) return Promise.resolve();
      live = false; observer?.dispose(); observer = null;
      if (this.binding !== owned) return Promise.resolve();
      this.binding = null; ++this.epoch; this.abort?.abort(); this.abort = null; this.pending = false;
      for (const p of styles) if (p.owned && this.canvas.style.getPropertyValue(p.name) === p.applied && this.canvas.style.getPropertyPriority(p.name) === p.appliedPriority) {
        if (p.original) this.canvas.style.setProperty(p.name, p.original, p.priority); else this.canvas.style.removeProperty(p.name);
      }
      return restore && !this.disposed ? this.update(previousContext).catch(cause => {
        error = cause instanceof Error ? cause.message : String(cause); throw cause;
      }) : Promise.resolve();
    } };
    const requestPaint = (): void => {
      const current = ++request;
      error = null;
      const snapshot = snapshotControlComposition(measurement?.status === 'ready' ? measurement.context : undefined);
      void this.update(snapshot).catch(cause => {
        if ((live || terminal) && request === current) error = cause instanceof Error ? cause.message : String(cause);
      });
    };
    this.binding = owned;
    try {
      adopt();
      observer = port.observe(this.canvas, () => { adopt(); return this.layout.faceRect; }, observed => {
        const sameLayout = this.pair.normal.buffer.width === this.pair.pressed.buffer.width && this.pair.normal.buffer.height === this.pair.pressed.buffer.height
          && JSON.stringify(this.pair.normal.layout.faceRect) === JSON.stringify(this.pair.pressed.layout.faceRect);
        measurement = sameLayout || observed.status === 'unsupported' ? observed : Object.freeze({ status: 'unsupported', portId: port.id, reason: 'state-layout-mismatch' });
        if (observed.status === 'unsupported' && observed.reason === 'port-removed') { terminal = true; void owned.release(false); }
        requestPaint();
      });
    } catch (cause) { void owned.release(false); throw cause; }
    const painter = this;
    return {
      get state() { return Object.freeze({ disposed: !live, measurement, committedContext: painter.context, pending: painter.pending, error }); },
      refresh: async () => {
        if (!live) return;
        observer?.refresh();
        // A failed decode leaves the last committed pixels intact. Explicit
        // refresh retries that same mapping; unchanged healthy mappings do not.
        if (error !== null) requestPaint();
        await this.task;
      },
      dispose: () => owned.release(true),
    };
  }
}
