import { useEffect, useRef, useState } from "react";
import { composeButton, bufferToCanvas } from "../../src/controls.js";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import type { WindowState } from "./window-profile.js";
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
        if (buffer) host.current?.replaceChildren(bufferToCanvas(buffer, 1));
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
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
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

function SceneWindow({
  theme,
  state,
  selected,
  onSelect,
  children,
}: {
  theme: LoadedTheme | null;
  state: WindowState;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<Element | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setUnavailable(false);
    host.current?.replaceChildren();
    if (!theme) return;
    void renderWindow(theme, {
      title: state === "active" ? "Field notes" : "Reference",
      width: 272,
      height: state === "active" ? 252 : 84,
      scale: 1,
      state,
    })
      .then((win) => {
        if (cancelled) return;
        host.current?.replaceChildren(win);
        setContent(win.querySelector(".scriptoscope-content"));
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [theme, state]);
  return (
    <section
      className="scene-window"
      data-state={state}
      data-selected={selected}
      aria-label={`${stateLabel(state)} document window`}
    >
      <button
        className="scene-window-label"
        aria-label={`Edit ${stateLabel(state)} window properties`}
        aria-pressed={selected}
        onClick={onSelect}
      >
        {stateLabel(state)} window <span aria-hidden="true">↗</span>
      </button>
      <div className="scene-frame" ref={host} onClick={onSelect} />
      {!content && !unavailable && (
        <p className="scene-loading" role="status">
          Rendering {stateLabel(state)} window…
        </p>
      )}
      {unavailable && <p>Window preview unavailable for this scheme.</p>}
      {content &&
        createPortal(
          <div
            className="scene-document"
            onClick={(event) => event.stopPropagation()}
          >
            {children}
          </div>,
          content,
        )}
    </section>
  );
}

export function AuthoringGallery({
  theme,
  scope,
  windowScope,
  onWindowScope,
  onText,
  original,
  compiling,
  onScope,
  onCompare,
}: {
  theme: LoadedTheme | null;
  scope: string;
  windowScope: string;
  onWindowScope: (state: WindowState) => void;
  onText: () => void;
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
          <span className="eyebrow">LIVE DOCUMENT SCENE</span>
          <h2>See it together</h2>
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
      <div className="document-scene" aria-busy={compiling}>
        <SceneWindow
          theme={theme}
          state="active"
          selected={windowScope === "active"}
          onSelect={() => onWindowScope("active")}
        >
          <div className="scene-document-copy">
            <strong>Field notes</strong>
            <p>A small detail can change how the whole theme feels.</p>
          </div>
          <div className="gallery-states">
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
        </SceneWindow>
        <SceneWindow
          theme={theme}
          state="inactive"
          selected={windowScope === "inactive"}
          onSelect={() => onWindowScope("inactive")}
        >
          <div className="scene-document-copy">
            <strong>Keep a reference nearby</strong>
            <p>
              Compare <mark>selected words</mark> with the surrounding text.
            </p>
            <button className="sample-content-link" onClick={onText}>
              About sample text &amp; selection →
            </button>
          </div>
        </SceneWindow>
      </div>
      <p className="gallery-help">
        Select a window frame or button to edit its state. Original compares the
        whole scene. Document content is a fixed preview example.
      </p>
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
