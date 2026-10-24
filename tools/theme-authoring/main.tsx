import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { loadKaleidoscopeScheme } from "../../src/loadKaleidoscopeScheme.js";
import { renderWindow } from "../../src/renderWindow.js";
import { composeButton, bufferToCanvas } from "../../src/controls.js";
import type { LoadedTheme } from "../../src/types.js";
import { PUSH_BUTTON } from "../../src/engine/tables/pushButton.js";
import { parseResourceFork } from "../theme-loader/resource-fork.js";
import { decodeCicn } from "../theme-loader/decoders/cicn.js";
import { gammaCorrectRgba, macRgbToSrgb } from "../theme-loader/mac-gamma.js";
import {
  decodeBytes,
  importSource,
  inventory,
  MAX_PROJECT_BYTES,
  MAX_SOURCE_BYTES,
  openProject,
  paletteFor,
  serializeProject,
  setGeometry,
  setPalette,
  workingFork,
  type Project,
  type Rgb16,
} from "./project.js";
import sample1138 from "../../themes/1138/scheme.rsrc?url";
import sampleAnimals from "../../themes/animals/scheme.sit?url";
import meta1138 from "../../themes/1138/meta.json";
import metaAnimals from "../../themes/animals/meta.json";
import "./style.css";

const samples = [
  { label: "1138", url: sample1138, filename: "1138.rsrc", meta: meta1138 },
  {
    label: "Animals",
    url: sampleAnimals,
    filename: "animals.sit",
    meta: metaAnimals,
  },
];
const buttonStates = [
  { label: "Normal", id: PUSH_BUTTON.PB7.resource },
  { label: "Pressed", id: PUSH_BUTTON.PB6.resource },
  { label: "Disabled", id: PUSH_BUTTON.PB5.resource },
];
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const hex = (rgb: number[]) =>
  "#" + rgb.map((n) => n.toString(16).padStart(2, "0")).join("");
const displayColor = (rgb: Rgb16) =>
  hex(macRgbToSrgb(rgb.map((n) => n >> 8)).map((n) => n!));

function download(data: string | Uint8Array, filename: string, type: string) {
  const blob = new Blob(
    [typeof data === "string" ? data : new Uint8Array(data)],
    { type },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[\\/]/g, "_");
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Specimen({
  theme,
  width,
  inactive,
}: {
  theme: LoadedTheme;
  width: number;
  inactive: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setError("");
    void (async () => {
      const win = await renderWindow(theme, {
        title: "A new life for old themes",
        width,
        height: 190,
        scale: 2,
        state: inactive ? "inactive" : "active",
      });
      const content = win.querySelector(".scriptoscope-content");
      if (!content) throw new Error("Window preview has no content area.");
      const body = document.createElement("div");
      body.className = "specimen-body";
      const heading = document.createElement("h3");
      heading.textContent = "Make something wonderfully yours.";
      const subtitle = document.createElement("p");
      subtitle.textContent = "Original artwork. New possibilities.";
      body.append(heading, subtitle);
      for (const state of ["Normal", "Pressed", "Disabled"] as const) {
        const row = document.createElement("div");
        row.className = "specimen-row";
        const label = document.createElement("span");
        label.textContent = state;
        const button = await composeButton(theme, {
          label: "Hello, world",
          minWidth: 100,
          pressed: state === "Pressed",
          disabled: state === "Disabled",
        });
        row.append(label);
        if (button) row.append(bufferToCanvas(button, 2));
        else row.append(document.createTextNode("No supported face"));
        body.append(row);
      }
      content.replaceChildren(body);
      if (!cancelled) host.current?.replaceChildren(win);
    })().catch((e) => {
      if (!cancelled) setError(message(e));
    });
    return () => {
      cancelled = true;
    };
  }, [theme, width, inactive]);
  return (
    <>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div ref={host} className="specimen" />
    </>
  );
}

function Artwork({
  data,
  corner,
}: {
  data: Uint8Array;
  corner: number | undefined;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const image = decodeCicn(data);
      if (!image)
        throw new Error(
          "This palette variant is preserved but cannot be edited here.",
        );
      const rgba = new Uint8Array(image.rgba);
      gammaCorrectRgba(rgba);
      const el = canvas.current!;
      el.width = image.width;
      el.height = image.height;
      el.getContext("2d")!.putImageData(
        new ImageData(new Uint8ClampedArray(rgba), image.width, image.height),
        0,
        0,
      );
      el.style.width = `${Math.min(240, image.width * 10)}px`;
      el.style.height = `${(Math.min(240, image.width * 10) * image.height) / image.width}px`;
      setDimensions(`${image.width} × ${image.height} px`);
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }, [data]);
  return (
    <>
      <div className="artboard">
        <div className="artwork-wrap">
          <canvas ref={canvas} aria-label="Selected source artwork" />
          {corner !== undefined && canvas.current && (
            <div
              className="slice-guides"
              style={{
                inset: `${(corner / canvas.current.height) * 100}% ${(corner / canvas.current.width) * 100}%`,
              }}
            />
          )}
        </div>
      </div>
      <p className="artwork-caption">
        {error || `${dimensions} · enlarged, nearest neighbor`}
      </p>
    </>
  );
}

type History = { past: Project[]; present: Project | null; future: Project[] };

function App() {
  const [history, setHistory] = useState<History>({
    past: [],
    present: null,
    future: [],
  });
  const project = history.present;
  const [loaded, setLoaded] = useState<LoadedTheme | null>(null);
  const [busy, setBusy] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Choose a scheme to begin.");
  const [savedText, setSavedText] = useState("");
  const [selected, setSelected] = useState(-1);
  const [record, setRecord] = useState(0);
  const [search, setSearch] = useState("");
  const [width, setWidth] = useState(240);
  const [inactive, setInactive] = useState(false);
  const sourceInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const request = useRef(0);

  const fork = useMemo(
    () => (project ? workingFork(project) : null),
    [project],
  );
  const resources = useMemo(
    () =>
      fork
        ? parseResourceFork(fork).map((r, occurrence) => ({ ...r, occurrence }))
        : [],
    [fork],
  );
  const selectedResource = resources[selected];
  const palette = useMemo(() => {
    try {
      return selectedResource ? paletteFor(selectedResource) : null;
    } catch {
      return null;
    }
  }, [selectedResource]);
  const geometry = useMemo(() => {
    const candidates = resources.filter(
      (r) =>
        r.type === "cinf" &&
        r.id === selectedResource?.id &&
        r.data.length >= 18,
    );
    return candidates.length === 1 ? candidates[0] : undefined;
  }, [resources, selectedResource]);
  const color = palette?.entries[record]?.rgb;
  const serialized = useMemo(
    () => (project ? serializeProject(project) : ""),
    [project],
  );
  const unsaved =
    !!project &&
    (savedText ? serialized !== savedText : project.edits.length > 0);

  useEffect(() => {
    if (!project) return;
    const list = inventory(project);
    setSelected(
      list.find((r) => r.type === "cicn" && r.id === PUSH_BUTTON.PB7.resource)
        ?.occurrence ??
        list.find((r) => r.type === "cicn")?.occurrence ??
        -1,
    );
    setRecord(0);
    setSearch("");
  }, [project?.source.forkSha256]); // Selection survives edits and undo.

  useEffect(() => {
    if (!project || !fork) return;
    let cancelled = false;
    let owned: LoadedTheme | null = null;
    setCompiling(true);
    setLoaded(null);
    const timer = setTimeout(() => {
      void loadKaleidoscopeScheme(fork, {
        meta: { ...project.source.meta, name: project.name },
      })
        .then((theme) => {
          if (cancelled) {
            theme.dispose?.();
            return;
          }
          owned = theme;
          setLoaded(theme);
          setCompiling(false);
        })
        .catch((e) => {
          if (!cancelled) {
            setError(message(e));
            setCompiling(false);
          }
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      owned?.dispose?.();
    };
  }, [fork, project]);

  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (unsaved) event.preventDefault();
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [unsaved]);

  function change(next: Project) {
    setHistory((h) => ({
      past: h.present ? [...h.past.slice(-29), h.present] : [],
      present: next,
      future: [],
    }));
    setError("");
    setNotice("Edit applied. Your original source is unchanged.");
  }

  async function replace(
    load: () => Promise<{ project: Project; saved: boolean }>,
  ) {
    if (
      unsaved &&
      !window.confirm(
        "Open another project and discard unsaved edits? Save your project first to keep them.",
      )
    )
      return;
    const token = ++request.current;
    setBusy(true);
    setError("");
    try {
      const result = await load();
      if (token !== request.current) return;
      setHistory({ past: [], present: result.project, future: [] });
      setSavedText(result.saved ? serializeProject(result.project) : "");
      setNotice(
        result.saved
          ? "Project reopened. Source hashes and edits verified."
          : "Scheme imported. Original source preserved.",
      );
    } catch (e) {
      if (token === request.current) setError(message(e));
    } finally {
      if (token === request.current) setBusy(false);
    }
  }

  async function loadSample(index: number) {
    const sample = samples[index]!;
    await replace(async () => {
      const response = await fetch(sample.url);
      if (!response.ok) throw new Error("Could not load the sample scheme.");
      return {
        project: await importSource(
          new Uint8Array(await response.arrayBuffer()),
          sample.filename,
          sample.meta,
        ),
        saved: false,
      };
    });
  }

  useEffect(() => {
    void loadSample(0);
  }, []);

  async function openFile(file: File | undefined, isProject: boolean) {
    if (!file) return;
    await replace(async () => {
      if (file.size > (isProject ? MAX_PROJECT_BYTES : MAX_SOURCE_BYTES))
        throw new Error("File is too large for this prototype.");
      return {
        project: isProject
          ? await openProject(await file.text())
          : await importSource(
              new Uint8Array(await file.arrayBuffer()),
              file.name,
            ),
        saved: isProject,
      };
    });
  }

  function save() {
    if (!project) return;
    download(
      serialized,
      `${project.name}.scriptoscope-project.json`,
      "application/json",
    );
    setSavedText(serialized);
    setNotice("Project downloaded with original bytes, metadata, and edits.");
  }

  function applyColor(next: Rgb16) {
    if (!project) return;
    try {
      change(setPalette(project, selected, record, next));
    } catch (e) {
      setError(message(e));
    }
  }

  const editedOccurrences = new Set(project?.edits.map((e) => e.occurrence));
  const icons = resources.filter(
    (r) =>
      r.type === "cicn" &&
      `${r.name} ${r.id}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="studio">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ✳
          </span>
          <span>
            Scriptoscope <strong>Studio</strong>
          </span>
          <span className="prototype">Prototype</span>
        </div>
        <a
          href="https://github.com/khawkins98/scriptoscope/issues/472"
          target="_blank"
          rel="noreferrer"
        >
          The authoring experiment ↗
        </a>
      </header>
      <div className="document-bar">
        <div>
          <p className="eyebrow">THEME WORKSPACE</p>
          <h1>
            {project?.name ?? "Your next theme"}{" "}
            <span className={unsaved ? "status-dot changed" : "status-dot"} />
          </h1>
        </div>
        <div className="document-actions">
          <button disabled={busy} onClick={() => sourceInput.current?.click()}>
            Import scheme
          </button>
          <button disabled={busy} onClick={() => projectInput.current?.click()}>
            Open project
          </button>
          <button
            className="primary"
            disabled={!project || busy}
            onClick={save}
          >
            Save project <span aria-hidden="true">↓</span>
          </button>
        </div>
        <input
          hidden
          ref={sourceInput}
          type="file"
          aria-label="Import scheme file"
          accept=".sit,.rsrc,.ksc,.bin,.hqx"
          onChange={(e) => {
            void openFile(e.target.files?.[0], false);
            e.target.value = "";
          }}
        />
        <input
          hidden
          ref={projectInput}
          type="file"
          aria-label="Open project file"
          accept=".json"
          onChange={(e) => {
            void openFile(e.target.files?.[0], true);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      <div className="workspace">
        <aside className="library" aria-label="Source artwork library">
          <div className="panel-heading">
            <h2>Theme library</h2>
            <span className="small-badge">LOCAL</span>
          </div>
          <label className="field-label" htmlFor="sample">
            Start with a scheme
          </label>
          <select
            id="sample"
            disabled={busy}
            value={
              project?.source.filename === "animals.sit"
                ? "1"
                : project?.source.filename === "1138.rsrc"
                  ? "0"
                  : ""
            }
            onChange={(e) => {
              if (e.target.value !== "")
                void loadSample(Number(e.target.value));
            }}
          >
            <option value="" disabled>
              Imported scheme
            </option>
            {samples.map((sample, i) => (
              <option key={sample.label} value={i}>
                {sample.label}
              </option>
            ))}
          </select>
          <h3 className="section-label">PUSH BUTTON</h3>
          <div className="component-list">
            {buttonStates.map((state) => {
              const resource = resources.find(
                (r) => r.type === "cicn" && r.id === state.id,
              );
              return (
                <button
                  key={state.label}
                  disabled={!resource || busy}
                  className={
                    selected === resource?.occurrence ? "selected" : ""
                  }
                  onClick={() => {
                    setSelected(resource!.occurrence);
                    setRecord(0);
                  }}
                >
                  <span className="component-symbol" aria-hidden="true">
                    ▱
                  </span>
                  {state.label}
                  <span className="resource-id">{state.id}</span>
                </button>
              );
            })}
          </div>
          <div className="inventory-heading">
            <h3 className="section-label">ALL COLOR ICONS</h3>
            <span>{resources.filter((r) => r.type === "cicn").length}</span>
          </div>
          <input
            className="search"
            aria-label="Search source artwork"
            placeholder="Search artwork or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="resource-list">
            {icons.map((resource) => (
              <button
                key={resource.occurrence}
                disabled={busy}
                className={selected === resource.occurrence ? "selected" : ""}
                onClick={() => {
                  setSelected(resource.occurrence);
                  setRecord(0);
                }}
              >
                <span>{resource.name || "Untitled color icon"}</span>
                <small>
                  {resource.id} · #{resource.occurrence}
                  {editedOccurrences.has(resource.occurrence)
                    ? " · edited"
                    : ""}
                </small>
              </button>
            ))}
          </div>
          <div className="library-footnote">
            <span className="preserved-mark">✓</span>
            <div>
              Originals stay original.
              <small>Every source record is retained.</small>
            </div>
          </div>
        </aside>
        <main className="canvas-panel">
          <div className="canvas-toolbar">
            <div className="segmented" role="group" aria-label="Window state">
              {["Active", "Inactive"].map((state, i) => (
                <button
                  key={state}
                  aria-pressed={inactive === !!i}
                  onClick={() => setInactive(!!i)}
                >
                  {state}
                </button>
              ))}
            </div>
            <div className="toolbar-right">
              <label htmlFor="preview-size">Size</label>
              <select
                id="preview-size"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              >
                <option value={240}>Compact</option>
                <option value={320}>Wide</option>
              </select>
              <span className="zoom-label">2×</span>
            </div>
          </div>
          <div className="preview-stage" aria-busy={compiling || busy}>
            <div className="stage-heading">
              <span className="eyebrow">LIVE SPECIMEN</span>
              <span>
                {compiling
                  ? "Rebuilding preview…"
                  : loaded
                    ? "Scriptoscope renderer"
                    : "Waiting for a theme"}
              </span>
            </div>
            <div className="preview-scroll">
              {loaded ? (
                <Specimen theme={loaded} width={width} inactive={inactive} />
              ) : (
                <div className="preview-placeholder">
                  {busy || compiling
                    ? "Preparing your theme…"
                    : "Import a scheme to begin."}
                </div>
              )}
            </div>
            <p className="stage-caption">
              A real window. Three button states. Your edits, in context.
            </p>
          </div>
          <div className="preservation-card">
            <div className="preservation-icon" aria-hidden="true">
              ↺
            </div>
            <div>
              <h3>A project you can come back to.</h3>
              <p>
                Save the original scheme together with your edits. Reopen it
                here and keep exploring.
              </p>
            </div>
            <button
              disabled={!project || busy}
              onClick={() =>
                project &&
                download(
                  decodeBytes(project.source.original),
                  project.source.filename,
                  "application/octet-stream",
                )
              }
            >
              Recover original ↓
            </button>
          </div>
          <div className="prototype-note">
            <strong>First experiment</strong>
            <span>
              Palette + geometry editing · source-backed project files.
              Web-runtime and Linux exports come later.
            </span>
          </div>
        </main>
        <aside className="inspector" aria-label="Artwork inspector">
          <div className="panel-heading">
            <h2>Artwork inspector</h2>
            <span className="small-badge">cicn</span>
          </div>
          <h3 className="asset-title">
            {selectedResource?.name || "Source artwork"}
          </h3>
          <p className="asset-subtitle">
            {selectedResource
              ? `Resource ${selectedResource.id} · occurrence ${selected}`
              : "Select a color icon"}
          </p>
          {selectedResource && (
            <Artwork data={selectedResource.data} corner={geometry?.data[0]} />
          )}
          <div className="inventory-heading">
            <h3 className="section-label">PALETTE</h3>
            <span>{palette?.entries.length ?? 0} colors</span>
          </div>
          {palette ? (
            <>
              <div className="swatches">
                {palette.entries.map((entry, i) => (
                  <button
                    key={i}
                    aria-label={`Palette record ${i}`}
                    aria-pressed={record === i}
                    title={`Record ${i} · index ${entry.value}`}
                    style={
                      {
                        "--swatch": displayColor(entry.rgb),
                      } as React.CSSProperties
                    }
                    onClick={() => setRecord(i)}
                  />
                ))}
              </div>
              {color && (
                <div className="color-editor">
                  <div className="color-summary">
                    <span style={{ background: displayColor(color) }} />
                    <div>
                      Color record {record}
                      <small>
                        Palette index {palette.entries[record]!.value}
                      </small>
                    </div>
                  </div>
                  <label className="field-label" htmlFor="source-color">
                    Source RGB color
                  </label>
                  <input
                    id="source-color"
                    type="color"
                    disabled={busy}
                    value={hex(color.map((n) => n >> 8))}
                    onChange={(e) => {
                      const next = [1, 3, 5].map(
                        (offset) =>
                          parseInt(
                            e.target.value.slice(offset, offset + 2),
                            16,
                          ) * 257,
                      ) as Rgb16;
                      applyColor(next);
                    }}
                  />
                  <div className="channel-fields">
                    {["Red", "Green", "Blue"].map((channel, i) => (
                      <label key={channel}>
                        {channel}
                        <input
                          aria-label={`${channel} (RGB16)`}
                          type="number"
                          min={0}
                          max={65535}
                          value={color[i]}
                          disabled={busy}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const next: Rgb16 = [...color];
                            next[i] = Number(e.target.value);
                            applyColor(next);
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <p className="field-help">
                    RGB16 fields retain exact source values. The color picker
                    writes an 8-bit source color; the preview applies the
                    runtime display policy.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="field-help">
              This artwork is retained, but its palette is not supported by this
              editor.
            </p>
          )}
          <h3 className="section-label">MATCHING GEOMETRY</h3>
          {geometry && project ? (
            <>
              <div className="channel-fields geometry-fields">
                {["Corner size", "Side thickness"].map((label, i) => (
                  <label key={label}>
                    {label}
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={geometry.data[i]}
                      disabled={busy}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const next: [number, number] = [
                          geometry.data[0]!,
                          geometry.data[1]!,
                        ];
                        next[i] = Number(e.target.value);
                        try {
                          change(
                            setGeometry(project, geometry.occurrence, next),
                          );
                        } catch (err) {
                          setError(message(err));
                        }
                      }}
                    />
                  </label>
                ))}
              </div>
              <p className="field-help">
                Edits the unique same-ID cinf record. No missing records are
                synthesized.
              </p>
            </>
          ) : (
            <p className="field-help">
              No unique matching cinf record. Palette edits are still available.
            </p>
          )}
          {project && (
            <details className="source-details">
              <summary>Source preservation</summary>
              <p>
                {resources.length} records retained · {project.edits.length}{" "}
                edit operations
              </p>
              <p>SHA-256 of original</p>
              <code>{project.source.originalSha256}</code>
              <p>
                {project.source.container} · {project.source.selection.policy}
              </p>
              <p>
                Experimental project format v0. Not a compiled web theme or
                edited classic export.
              </p>
            </details>
          )}
        </aside>
      </div>
      <footer className="status-bar">
        <div className="history-actions">
          <button
            aria-label="Undo edit"
            disabled={!history.past.length || busy}
            onClick={() =>
              setHistory((h) => ({
                past: h.past.slice(0, -1),
                present: h.past.at(-1)!,
                future: [h.present!, ...h.future],
              }))
            }
          >
            ↶
          </button>
          <button
            aria-label="Redo edit"
            disabled={!history.future.length || busy}
            onClick={() =>
              setHistory((h) => ({
                past: [...h.past, h.present!],
                present: h.future[0]!,
                future: h.future.slice(1),
              }))
            }
          >
            ↷
          </button>
          <span>{project?.edits.length ?? 0} edits</span>
        </div>
        <p role="status">{busy ? "Reading source…" : notice}</p>
        <span className="local-label">● Everything stays in your browser</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
