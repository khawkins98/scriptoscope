import { useEffect, useRef, useState } from "react";
import { composeButton, bufferToCanvas } from "../../src/controls.js";
import { renderWindow } from "../../src/renderWindow.js";
import type { LoadedTheme } from "../../src/types.js";

export const buttonStates = ["normal", "pressed", "disabled"] as const;
export type ButtonState = (typeof buttonStates)[number];
export const stateLabel = (state: string) =>
  state[0]!.toUpperCase() + state.slice(1);

function GalleryButton({
  theme,
  state,
  wide,
  selected,
  onSelect,
}: {
  theme: LoadedTheme | null;
  state: ButtonState;
  wide: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    host.current?.replaceChildren();
    setUnavailable(false);
    if (!theme) return;
    void composeButton(theme, {
      label: "Continue",
      minWidth: wide ? 132 : 100,
      pressed: state === "pressed",
      disabled: state === "disabled",
    })
      .then((buffer) => {
        if (cancelled) return;
        if (buffer) host.current?.replaceChildren(bufferToCanvas(buffer, 2));
        else setUnavailable(true);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [theme, state, wide]);
  return (
    <button
      className="gallery-state"
      aria-label={`Edit ${stateLabel(state)} button properties`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="gallery-state-label">
        {stateLabel(state)}
        <span aria-hidden="true">↗</span>
      </span>
      <span className="gallery-control" ref={host} />
      {unavailable && <small>No supported button preview</small>}
      {!theme && <small>Updating preview…</small>}
    </button>
  );
}

function RetainedWindow({ theme }: { theme: LoadedTheme | null }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    host.current?.replaceChildren();
    if (!theme) return;
    void renderWindow(theme, {
      title: "Document",
      width: 220,
      height: 66,
      scale: 1,
      state: "active",
    })
      .then((win) => {
        const content = win.querySelector(".scriptoscope-content");
        if (content) {
          const label = document.createElement("p");
          label.className = "retained-window-label";
          label.textContent = "Your imported window artwork is retained.";
          content.replaceChildren(label);
        }
        if (!cancelled) host.current?.replaceChildren(win);
      })
      .catch(() => {
        if (!cancelled && host.current)
          host.current.textContent = "Window preview unavailable";
      });
    return () => {
      cancelled = true;
    };
  }, [theme]);
  return <div className="retained-window" ref={host} />;
}

export function AuthoringGallery({
  theme,
  scope,
  original,
  compiling,
  onScope,
  onCompare,
}: {
  theme: LoadedTheme | null;
  scope: string;
  original: boolean;
  compiling: boolean;
  onScope: (scope: ButtonState) => void;
  onCompare: (original: boolean) => void;
}) {
  const [wide, setWide] = useState(false);
  return (
    <aside className="authoring-gallery" aria-label="Theme preview gallery">
      <div className="gallery-heading">
        <div>
          <span className="eyebrow">LIVE GALLERY</span>
          <h2>See every state</h2>
        </div>
        <span className="live-dot" title="Live renderer preview" />
      </div>
      <div className="gallery-options">
        <div className="segmented" role="group" aria-label="Theme comparison">
          <button aria-pressed={!original} onClick={() => onCompare(false)}>
            Working
          </button>
          <button aria-pressed={original} onClick={() => onCompare(true)}>
            Original
          </button>
        </div>
        <label>
          Width
          <select
            aria-label="Gallery button width"
            value={wide ? "wide" : "compact"}
            onChange={(event) => setWide(event.target.value === "wide")}
          >
            <option value="compact">Compact</option>
            <option value="wide">Wide</option>
          </select>
        </label>
      </div>
      {original && (
        <p className="gallery-original-note">
          Imported original · editing paused
        </p>
      )}
      <div className="gallery-states" aria-busy={compiling}>
        {buttonStates.map((state) => (
          <GalleryButton
            key={state}
            theme={theme}
            state={state}
            wide={wide}
            selected={scope === state}
            onSelect={() => onScope(state)}
          />
        ))}
      </div>
      <p className="gallery-help">
        Select a preview to edit that state. All three update from the same
        source-backed project.
      </p>
      <details className="retained-preview">
        <summary>
          Window preview <span>Retained only</span>
        </summary>
        <RetainedWindow theme={theme} />
      </details>
      <div className="gallery-output">
        <strong>Your output</strong>
        <p>
          A local authoring project containing the original scheme and your
          edits. Reopen it in Studio to continue.
        </p>
        <span>
          Web theme / classic export / Linux installation are not available.
        </span>
      </div>
    </aside>
  );
}
