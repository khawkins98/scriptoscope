import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { loadKaleidoscopeScheme } from "../../src/loadKaleidoscopeScheme.js";
import { renderWindow } from "../../src/renderWindow.js";
import { composeButton, bufferToCanvas } from "../../src/controls.js";
import type { LoadedTheme } from "../../src/types.js";
import { parseResourceFork } from "../theme-loader/resource-fork.js";
import { macRgbToSrgb } from "../theme-loader/mac-gamma.js";
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
import { resolveWindowSelection } from "../../src/resolveWindowType.js";
import { ArtworkEditor } from "./ArtworkEditor.js";
import {
  componentsFor,
  editedVariant,
  resetArtwork,
  type ComponentSelection,
} from "./components.js";
import { AuthoringSheet } from "./AuthoringSheet.js";
import {
  AUTHORING_ROLES,
  getAuthoringProfile,
  applyRoleColor,
  resetRoleColor,
  applyAmberVariation,
  type AuthoringState,
  type AuthoringRole,
} from "./profile.js";
import {
  WINDOW_ROLES,
  getWindowProfile,
  applyWindowColor,
  resetWindowColor,
} from "./window-profile.js";
import { StudioMenu, StudioHelp } from "./StudioMenu.js";
import "./style.css";
import "./workbench.css";

const samples = [
  { label: "1138", url: sample1138, filename: "1138.rsrc", meta: meta1138 },
  {
    label: "Animals",
    url: sampleAnimals,
    filename: "animals.sit",
    meta: metaAnimals,
  },
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
  selection,
  onSelect,
}: {
  theme: LoadedTheme;
  width: number;
  inactive: boolean;
  selection: ComponentSelection | null;
  onSelect: (selection: ComponentSelection) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setError("");
    void (async () => {
      const win = await renderWindow(theme, {
        title: "Document preview",
        width,
        height: 128,
        scale: 2,
        state: inactive ? "inactive" : "active",
      });
      const content = win.querySelector(".scriptoscope-content");
      if (!content) throw new Error("Window preview has no content area.");
      const pickWindow = document.createElement("button");
      pickWindow.className = "window-pick";
      pickWindow.type = "button";
      pickWindow.setAttribute(
        "aria-label",
        `Edit document window: ${inactive ? "Inactive" : "Active"}`,
      );
      pickWindow.setAttribute(
        "aria-pressed",
        String(selection?.component === "document-window"),
      );
      pickWindow.style.height = `${Math.max(32, parseFloat((content as HTMLElement).style.top) || 32)}px`;
      pickWindow.addEventListener("click", () =>
        onSelect({
          component: "document-window",
          variant: inactive ? "inactive" : "active",
        }),
      );
      win.append(pickWindow);
      const body = document.createElement("div");
      body.className = "specimen-body";
      const heading = document.createElement("h3");
      heading.textContent = "Document preview";
      const subtitle = document.createElement("p");
      subtitle.textContent =
        "Inspect each control state, then edit its appearance.";
      body.append(heading, subtitle);
      for (const state of ["Normal", "Pressed", "Disabled"] as const) {
        const row = document.createElement("div");
        row.className = "specimen-row";
        const label = document.createElement("span");
        label.textContent = state;
        const button = await composeButton(theme, {
          label: "Button label",
          minWidth: 100,
          pressed: state === "Pressed",
          disabled: state === "Disabled",
        });
        row.append(label);
        if (button) {
          const picker = document.createElement("button");
          picker.type = "button";
          picker.className = "specimen-pick";
          picker.setAttribute("aria-label", `Edit push button: ${state}`);
          picker.setAttribute(
            "aria-pressed",
            String(
              selection?.component === "push-button" &&
                selection.variant === state.toLowerCase(),
            ),
          );
          picker.addEventListener("click", () =>
            onSelect({
              component: "push-button",
              variant: state.toLowerCase(),
            }),
          );
          picker.append(bufferToCanvas(button, 2));
          row.append(picker);
        } else row.append(document.createTextNode("No supported face"));
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
  }, [theme, width, inactive, selection, onSelect]);
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

function StateThumbnail({
  theme,
  component,
  state,
  asset,
}: {
  theme: LoadedTheme | null;
  component: string;
  state: string;
  asset?: string;
}) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let cancelled = false;
    if (component !== "push-button") return;
    host.current?.replaceChildren();
    if (!theme) return;
    void composeButton(theme, {
      label: "Button",
      minWidth: 68,
      pressed: state === "pressed",
      disabled: state === "disabled",
    })
      .then((button) => {
        if (!cancelled && button)
          host.current?.replaceChildren(bufferToCanvas(button, 1));
      })
      .catch(() => {
        if (!cancelled) host.current?.replaceChildren();
      });
    return () => {
      cancelled = true;
    };
  }, [theme, component, state]);
  return (
    <span className="state-thumbnail" ref={host} aria-hidden="true">
      {component !== "push-button" && asset ? <img src={asset} alt="" /> : null}
    </span>
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
  const [advanced, setAdvanced] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveRequested, setSaveRequested] = useState(false);
  const [authoringScope, setAuthoringScope] = useState<"all" | AuthoringState>(
    "all",
  );
  const [loaded, setLoaded] = useState<LoadedTheme | null>(null);
  const [originalTheme, setOriginalTheme] = useState<LoadedTheme | null>(null);
  const authoringProfile = useMemo(
    () => (project ? getAuthoringProfile(project, originalTheme) : null),
    [project, originalTheme],
  );
  const windowProfile = useMemo(
    () => (project ? getWindowProfile(project, originalTheme) : null),
    [project, originalTheme],
  );
  const [focus, setFocus] = useState<ComponentSelection | null>({
    component: "push-button",
    variant: "normal",
  });
  const [navigation, setNavigation] = useState<
    "components" | "resources" | "changes"
  >("components");
  const [surface, setSurface] = useState<"split" | "preview" | "artwork">(
    "split",
  );
  const [inspectorTab, setInspectorTab] = useState<"appearance" | "overrides">(
    "appearance",
  );
  const [compareOriginal, setCompareOriginal] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<
    "explorer" | "workspace" | "properties"
  >("workspace");
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
  const originalResources = useMemo(
    () => (project ? inventory(project) : []),
    [project?.source],
  );
  const originalPalette = useMemo(() => {
    try {
      return originalResources[selected]
        ? paletteFor(originalResources[selected]!)
        : null;
    } catch {
      return null;
    }
  }, [originalResources, selected]);
  const displayedPalette = compareOriginal ? originalPalette : palette;
  const workingColor = palette?.entries[record]?.rgb;
  const color = displayedPalette?.entries[record]?.rgb;
  const originalColor = originalPalette?.entries[record]?.rgb;
  const colorEdited =
    !!workingColor &&
    !!originalColor &&
    workingColor.some((n, i) => n !== originalColor[i]);
  const originalGeometry = geometry
    ? originalResources[geometry.occurrence]
    : undefined;
  const canEdit = !busy && !compareOriginal;
  const components = useMemo(() => {
    const theme = compareOriginal ? originalTheme : (loaded ?? originalTheme);
    const windowAssets: Partial<Record<"active" | "inactive", string>> = {};
    if (theme)
      for (const state of ["active", "inactive"] as const) {
        const selectedWindow = resolveWindowSelection(
          theme,
          "document-window",
          state,
        );
        if (
          selectedWindow?.owner === theme &&
          selectedWindow.wt.model !== "corner-sprite"
        )
          windowAssets[state] = selectedWindow.cicnPath;
      }
    return componentsFor(theme, resources, windowAssets);
  }, [loaded, originalTheme, resources, compareOriginal]);
  const loadingSource = busy || (!loaded && !originalTheme && !error);
  const component = components.find((c) => c.id === focus?.component);
  const variant = component?.variants.find((v) => v.key === focus?.variant);
  const selectComponent = useCallback((next: ComponentSelection) => {
    setFocus(next);
    setMobilePanel("workspace");
    setNavigation("components");
    setRecord(0);
    if (next.component === "document-window")
      setInactive(next.variant === "inactive");
  }, []);
  useEffect(() => {
    if (focus) setSelected(variant?.occurrence ?? -1);
  }, [focus, variant?.occurrence]);
  const source = project?.source;
  useEffect(() => {
    setOriginalTheme(null);
    if (!source) return;
    let cancelled = false;
    let owned: LoadedTheme | null = null;
    void loadKaleidoscopeScheme(decodeBytes(source.fork), { meta: source.meta })
      .then((theme) => {
        if (cancelled) {
          theme.dispose?.();
          return;
        }
        owned = theme;
        setOriginalTheme(theme);
      })
      .catch((e) => {
        if (!cancelled)
          setError(`Original comparison unavailable: ${message(e)}`);
      });
    return () => {
      cancelled = true;
      owned?.dispose?.();
    };
  }, [source]);
  const serialized = useMemo(
    () => (project ? serializeProject(project) : ""),
    [project],
  );
  const unsaved =
    !!project &&
    (savedText ? serialized !== savedText : project.edits.length > 0);

  useEffect(() => {
    if (!project) return;
    setSelected(-1);
    setRecord(0);
    setFocus({ component: "push-button", variant: "normal" });
    setNavigation("components");
    setCompareOriginal(false);
    setSearch("");
    setAuthoringScope("all");
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

  const undo = useCallback(
    () =>
      setHistory((h) =>
        h.past.length
          ? {
              past: h.past.slice(0, -1),
              present: h.past.at(-1)!,
              future: [h.present!, ...h.future],
            }
          : h,
      ),
    [],
  );
  const redo = useCallback(
    () =>
      setHistory((h) =>
        h.future.length
          ? {
              past: [...h.past, h.present!],
              present: h.future[0]!,
              future: h.future.slice(1),
            }
          : h,
      ),
    [],
  );
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        busy ||
        !(event.metaKey || event.ctrlKey) ||
        !["z", "y"].includes(event.key.toLowerCase()) ||
        (target instanceof HTMLElement &&
          (target.matches("input, textarea, select") ||
            target.isContentEditable))
      )
        return;
      event.preventDefault();
      if (event.shiftKey || event.key.toLowerCase() === "y") redo();
      else undo();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [busy, undo, redo]);

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

  useEffect(() => {
    const saveKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s")
        return;
      event.preventDefault();
      if (!project || busy) return;
      if (document.activeElement instanceof HTMLInputElement)
        document.activeElement.blur();
      setSaveRequested(true);
    };
    window.addEventListener("keydown", saveKey);
    return () => window.removeEventListener("keydown", saveKey);
  }, [project, busy]);
  useEffect(() => {
    if (!saveRequested) return;
    save();
    setSaveRequested(false);
  }, [saveRequested, serialized]);

  function applyColor(next: Rgb16) {
    if (!project || !canEdit || color?.every((n, i) => n === next[i])) return;
    try {
      change(setPalette(project, selected, record, next));
    } catch (e) {
      setError(message(e));
    }
  }

  const applyGeometry = (next: [number, number]) => {
    if (
      !project ||
      !geometry ||
      !canEdit ||
      next.every((n, i) => n === geometry.data[i])
    )
      return;
    try {
      change(setGeometry(project, geometry.occurrence, next));
    } catch (e) {
      setError(message(e));
    }
  };
  const selectionEdited = !!project?.edits.some((edit) =>
    edit.kind === "palette"
      ? edit.occurrence === selected
      : edit.occurrence === geometry?.occurrence,
  );
  const displayTheme = compareOriginal ? originalTheme : loaded;
  const selectionEdits =
    project?.edits.filter((edit) =>
      edit.kind === "palette"
        ? edit.occurrence === selected
        : edit.occurrence === geometry?.occurrence,
    ) ?? [];
  const usages = components.flatMap((c) =>
    c.variants
      .filter((v) => v.occurrence !== null && v.occurrence === selected)
      .map((v) => ({
        component: c.id,
        componentLabel: c.label,
        variant: v.key,
        label: v.label,
      })),
  );
  const visitResource = (occurrence: number, paletteRecord = 0) => {
    const match = components
      .flatMap((c) => c.variants.map((v) => ({ c, v })))
      .find(({ v }) => v.occurrence === occurrence);
    setFocus(match ? { component: match.c.id, variant: match.v.key } : null);
    setSelected(occurrence);
    setRecord(paletteRecord);
    setSurface("split");
    setMobilePanel("workspace");
    setInspectorTab("appearance");
    if (match?.c.id === "document-window")
      setInactive(match.v.key === "inactive");
  };
  const editedOccurrences = new Set(project?.edits.map((e) => e.occurrence));
  const icons = resources.filter(
    (r) =>
      r.type === "cicn" &&
      `${r.name} ${r.id} ${components.flatMap((component) => component.variants.filter((variant) => variant.occurrence === r.occurrence).map((variant) => `${component.label} ${variant.label}`)).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const semanticChange = (operation: () => Project) => {
    if (!canEdit) return;
    try {
      const next = operation();
      if (project && serializeProject(next) !== serialized) change(next);
    } catch (error) {
      setError(message(error));
    }
  };
  const editRole = (
    role: AuthoringRole,
    states: AuthoringState[],
    rgb: Rgb16,
  ) => {
    if (project && authoringProfile)
      semanticChange(() =>
        applyRoleColor(project, authoringProfile, role, states, rgb),
      );
  };
  return (
    <div
      className={`studio mobile-${mobilePanel} ${advanced ? "mode-source" : "mode-authoring"}`}
    >
      <a className="studio-skip" href="#studio-properties">
        Skip to workspace
      </a>
      <header className="studio-masthead">
        <a
          className="studio-wordmark"
          href="https://khawkins98.github.io/scriptoscope/"
          aria-label="Scriptoscope home"
        >
          <span className="spectrum-mark" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          Scriptoscope <span className="studio-edition">Studio</span>
        </a>
        <nav aria-label="Scriptoscope site">
          <a href="https://khawkins98.github.io/scriptoscope/showcase.html">
            Showcase ↗
          </a>
          <a href="https://khawkins98.github.io/scriptoscope/story.html">
            The story ↗
          </a>
          <button onClick={() => setHelpOpen(true)}>Field guide</button>
        </nav>
      </header>
      <StudioMenu
        groups={[
          {
            label: "File",
            commands: [
              {
                label: "Import Kaleidoscope scheme…",
                action: () => sourceInput.current?.click(),
                disabled: busy,
              },
              {
                label: "Open Studio project…",
                action: () => projectInput.current?.click(),
                disabled: busy,
              },
              null,
              {
                label: "Download project…",
                action: save,
                disabled: !project || busy,
                shortcut: "⌘S / Ctrl+S",
              },
              {
                label: "Recover original…",
                action: () => {
                  if (project)
                    download(
                      decodeBytes(project.source.original),
                      project.source.filename,
                      "application/octet-stream",
                    );
                },
                disabled: !project || busy,
              },
            ],
          },
          {
            label: "Edit",
            commands: [
              {
                label: "Undo theme edit",
                action: undo,
                disabled: !history.past.length || busy,
                shortcut: "⌘Z / Ctrl+Z",
              },
              {
                label: "Redo theme edit",
                action: redo,
                disabled: !history.future.length || busy,
                shortcut: "⇧⌘Z / Ctrl+Y",
              },
              null,
              {
                label: "Revert all edits",
                action: () => {
                  if (project) change({ ...project, edits: [] });
                },
                disabled: !project?.edits.length || busy || compareOriginal,
              },
            ],
          },
          {
            label: "View",
            commands: [
              {
                label: "Theme properties",
                action: () => setAdvanced(false),
                checked: !advanced,
              },
              {
                label: "Advanced source",
                action: () => setAdvanced(true),
                checked: advanced,
              },
              null,
              {
                label: "Working theme",
                action: () => setCompareOriginal(false),
                checked: !compareOriginal,
                disabled: !project,
              },
              {
                label: "Imported original",
                action: () => setCompareOriginal(true),
                checked: compareOriginal,
                disabled: !project,
              },
            ],
          },
          {
            label: "Help",
            commands: [
              {
                label: "Quick start & editing coverage",
                action: () => setHelpOpen(true),
              },
              {
                label: "Saving and export limitations",
                action: () => setHelpOpen(true),
              },
              {
                label: "About this working menu",
                action: () => setHelpOpen(true),
              },
            ],
          },
        ]}
      />
      <header className="app-header">
        <div className="project-heading">
          <h1>{project?.name ?? "Opening theme…"}</h1>
          <span
            className={unsaved ? "document-state unsaved" : "document-state"}
          >
            {unsaved
              ? "Unsaved changes"
              : savedText
                ? "Project saved"
                : "Original preserved"}
          </span>
        </div>
        <div className="document-actions">
          <button disabled={busy} onClick={() => sourceInput.current?.click()}>
            Import scheme
          </button>
          <button disabled={busy} onClick={() => projectInput.current?.click()}>
            Open project
          </button>
          <div className="save-action">
            <button
              className="primary"
              disabled={!project || busy}
              onClick={save}
            >
              Save project <span aria-hidden="true">↓</span>
            </button>
            <small>Project only · reopen in Studio</small>
          </div>
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
      </header>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      <div className="authoring-mode-bar" id="studio-properties" tabIndex={-1}>
        <div className="segmented" role="group" aria-label="Workspace mode">
          <button aria-pressed={!advanced} onClick={() => setAdvanced(false)}>
            Theme properties
          </button>
          <button aria-pressed={advanced} onClick={() => setAdvanced(true)}>
            Advanced source
          </button>
        </div>
        <p>
          {advanced
            ? "Exact source records, palette colors and geometry"
            : "Window titles and buttons · scheme-specific coverage"}
        </p>
        <span>Experimental · no installable export</span>
      </div>
      {!advanced && (
        <AuthoringSheet
          project={project}
          profile={authoringProfile}
          windowProfile={windowProfile}
          onWindowColor={(role, states, rgb) => {
            if (project && windowProfile)
              semanticChange(() =>
                applyWindowColor(project, windowProfile, role, states, rgb),
              );
          }}
          onWindowReset={(role, states) => {
            if (project && windowProfile)
              semanticChange(() =>
                resetWindowColor(project, windowProfile, role, states),
              );
          }}
          onWindowResetGroup={(states) => {
            if (project && windowProfile)
              semanticChange(() => {
                let next = project;
                for (const role of WINDOW_ROLES) {
                  const supported = states.filter((state) =>
                    windowProfile.bindings.some(
                      (b) => b.role === role.id && b.state === state,
                    ),
                  );
                  if (supported.length)
                    next = resetWindowColor(
                      next,
                      windowProfile,
                      role.id,
                      supported,
                    );
                }
                return next;
              });
          }}
          theme={displayTheme}
          original={compareOriginal}
          compiling={compiling}
          checkingCoverage={!originalTheme || busy}
          busy={busy}
          scope={authoringScope}
          onScope={setAuthoringScope}
          onCompare={setCompareOriginal}
          onColor={editRole}
          onReset={(role, states) => {
            if (project && authoringProfile)
              semanticChange(() =>
                resetRoleColor(project, authoringProfile, role, states),
              );
          }}
          onResetGroup={(states) => {
            if (project && authoringProfile)
              semanticChange(() => {
                let next = project;
                for (const role of AUTHORING_ROLES) {
                  const supported = states.filter((state) =>
                    authoringProfile.bindings.some(
                      (binding) =>
                        binding.role === role.id && binding.state === state,
                    ),
                  );
                  if (supported.length)
                    next = resetRoleColor(
                      next,
                      authoringProfile,
                      role.id,
                      supported,
                    );
                }
                return next;
              });
          }}
          onAmber={(states) => {
            if (project && authoringProfile)
              semanticChange(() =>
                applyAmberVariation(project, authoringProfile, states),
              );
          }}
          onAdvanced={() => setAdvanced(true)}
          onSample={(index) => void loadSample(index)}
        />
      )}
      <div className="advanced-workspace" hidden={!advanced}>
        <div
          className="mobile-navigation segmented"
          role="group"
          aria-label="Editor panels"
        >
          {(["explorer", "workspace", "properties"] as const).map((panel) => (
            <button
              key={panel}
              aria-pressed={mobilePanel === panel}
              onClick={() => setMobilePanel(panel)}
            >
              {panel === "explorer"
                ? "Explorer"
                : panel === "workspace"
                  ? "Workspace"
                  : "Properties"}
            </button>
          ))}
        </div>
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
            <div
              className="navigation-tabs segmented"
              role="group"
              aria-label="Library view"
            >
              <button
                aria-pressed={navigation === "components"}
                onClick={() => setNavigation("components")}
              >
                Components
              </button>
              <button
                aria-pressed={navigation === "resources"}
                onClick={() => setNavigation("resources")}
              >
                Resources
              </button>
              <button
                aria-pressed={navigation === "changes"}
                onClick={() => setNavigation("changes")}
              >
                Changes
                {project?.edits.length ? (
                  <span className="count-badge">{project.edits.length}</span>
                ) : null}
              </button>
            </div>
            {navigation === "components" ? (
              <div className="component-tree">
                {components.map((c) => (
                  <section key={c.id}>
                    <h3 className="section-label">{c.group}</h3>
                    <button
                      className={`component-family ${focus?.component === c.id ? "selected" : ""}`}
                      aria-pressed={focus?.component === c.id}
                      disabled={busy}
                      onClick={() =>
                        selectComponent({
                          component: c.id,
                          variant: c.variants[0]!.key,
                        })
                      }
                    >
                      <span aria-hidden="true">
                        {c.id === "document-window" ? "▣" : "▱"}
                      </span>
                      {c.label}
                    </button>
                    <div className="component-states">
                      {c.variants.map((v) => (
                        <button
                          key={v.key}
                          aria-label={`${c.label}: ${v.label}`}
                          aria-pressed={
                            focus?.component === c.id && focus.variant === v.key
                          }
                          disabled={busy}
                          className={
                            focus?.component === c.id && focus.variant === v.key
                              ? "selected"
                              : ""
                          }
                          onClick={() =>
                            selectComponent({ component: c.id, variant: v.key })
                          }
                        >
                          {v.label}
                          <span
                            className={
                              editedVariant(project, v, resources)
                                ? "edit-marker"
                                : ""
                            }
                          >
                            {editedVariant(project, v, resources)
                              ? "Edited"
                              : loadingSource
                                ? "Loading…"
                                : v.occurrence === null
                                  ? "Unavailable"
                                  : "Original"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
                <p className="field-help">
                  Two component families are mapped to source artwork. Use
                  Resources to inspect the full library.
                </p>
              </div>
            ) : navigation === "changes" ? (
              <div className="change-list">
                <h3 className="section-label">Working overrides</h3>
                {project?.edits.length ? (
                  project.edits.map((edit) => {
                    const candidates = resources.filter(
                      (r) => r.type === "cicn" && r.id === edit.id,
                    );
                    const occurrence =
                      edit.kind === "palette"
                        ? edit.occurrence
                        : candidates.length === 1
                          ? candidates[0]!.occurrence
                          : null;
                    return (
                      <button
                        key={`${edit.kind}:${edit.occurrence}:${edit.kind === "palette" ? edit.record : "geometry"}`}
                        disabled={busy || occurrence === null}
                        onClick={() => {
                          visitResource(
                            occurrence!,
                            edit.kind === "palette" ? edit.record : 0,
                          );
                        }}
                      >
                        <strong>
                          {components
                            .flatMap((c) =>
                              c.variants
                                .filter((v) => v.occurrence === occurrence)
                                .map((v) => `${c.label} · ${v.label}`),
                            )
                            .join(", ") ||
                            resources[occurrence ?? -1]?.name ||
                            "Source artwork"}
                        </strong>
                        <span>
                          {edit.kind === "palette"
                            ? `Color record ${edit.record}`
                            : "Corner / side geometry"}
                        </span>
                        <small>
                          Resource {edit.id} · #{edit.occurrence}
                        </small>
                        <code>
                          {edit.before.join(" / ")} → {edit.after.join(" / ")}
                        </code>
                      </button>
                    );
                  })
                ) : (
                  <div className="empty-changes">
                    <span aria-hidden="true">✓</span>
                    <p>No overrides yet</p>
                    <small>
                      Edit a color or geometry value to start shaping this
                      theme.
                    </small>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="inventory-heading">
                  <h3 className="section-label">SOURCE COLOR ICONS</h3>
                  <span>
                    {resources.filter((r) => r.type === "cicn").length}
                  </span>
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
                      className={
                        selected === resource.occurrence ? "selected" : ""
                      }
                      onClick={() => {
                        visitResource(resource.occurrence);
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
              </>
            )}
            <div className="library-footnote">
              <span className="preserved-mark">✓</span>
              <div>
                Source project
                <small>{resources.length} records · original retained</small>
                <a
                  href="https://github.com/khawkins98/scriptoscope/issues/472"
                  target="_blank"
                  rel="noreferrer"
                >
                  About this experiment ↗
                </a>
              </div>
            </div>
          </aside>
          <main className={`canvas-panel layout-${surface}`}>
            <div className="canvas-toolbar">
              <div
                className="segmented"
                role="group"
                aria-label="Workspace surface"
              >
                <button
                  aria-pressed={surface === "split"}
                  onClick={() => setSurface("split")}
                >
                  Preview + source
                </button>
                <button
                  aria-pressed={surface === "preview"}
                  onClick={() => setSurface("preview")}
                >
                  Preview only
                </button>
                <button
                  aria-pressed={surface === "artwork"}
                  disabled={!selectedResource}
                  onClick={() => setSurface("artwork")}
                >
                  Focus source
                </button>
              </div>
              <div
                className="segmented compare-toggle"
                role="group"
                aria-label="Theme comparison"
              >
                <button
                  aria-pressed={!compareOriginal}
                  onClick={() => setCompareOriginal(false)}
                >
                  Working
                </button>
                <button
                  aria-pressed={compareOriginal}
                  disabled={!originalTheme}
                  onClick={() => setCompareOriginal(true)}
                >
                  Original
                </button>
              </div>
            </div>
            <div className="selection-bar">
              <div>
                <span className="eyebrow">
                  {component?.group ?? "SOURCE RESOURCE"}
                </span>
                <h2>
                  {component
                    ? component.label
                    : (selectedResource?.name ?? "Source artwork")}
                </h2>
                {selectedResource && (
                  <p className="selection-source" title={selectedResource.name}>
                    {component ? "State artwork" : "Source artwork"}{" "}
                    <span aria-hidden="true">/</span>{" "}
                    {variant?.label ?? selectedResource.name}{" "}
                    <span aria-hidden="true">/</span> cicn {selectedResource.id}
                  </p>
                )}
              </div>

              <button
                className="quiet-button"
                aria-label="Reset selected artwork"
                title="Reset the selected source artwork wherever it is used; undo restores your edits."
                disabled={!selectionEdited || !canEdit || !project}
                onClick={() =>
                  project &&
                  change(resetArtwork(project, selected, geometry?.occurrence))
                }
              >
                <span aria-hidden="true">↶ </span>Reset selected artwork
              </button>
            </div>
            {compareOriginal && (
              <div className="comparison-banner" role="note">
                <strong>Viewing the imported original</strong>
                <span>
                  Read-only comparison. Your working edits are preserved.
                </span>
                <button onClick={() => setCompareOriginal(false)}>
                  Return to working
                </button>
              </div>
            )}
            {component && (
              <div
                className="variant-strip"
                role="group"
                aria-label={`${component.label} states`}
              >
                {component.variants.map((v) => (
                  <button
                    key={v.key}
                    aria-label={`State: ${v.label}`}
                    aria-pressed={focus?.variant === v.key}
                    disabled={busy}
                    onClick={() =>
                      selectComponent({
                        component: component.id,
                        variant: v.key,
                      })
                    }
                  >
                    <StateThumbnail
                      theme={displayTheme}
                      component={component.id}
                      state={v.key}
                      {...(v.asset ? { asset: v.asset } : {})}
                    />
                    <span>
                      {v.label}
                      <small>
                        {editedVariant(project, v, resources)
                          ? "Edited"
                          : loadingSource
                            ? "Loading…"
                            : v.occurrence === null
                              ? "Unavailable"
                              : "Original"}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {!loadingSource && variant?.unavailable && (
              <p className="selection-note" role="status">
                {variant.unavailable} Try Resources to inspect the retained
                records.
              </p>
            )}
            <div className="editing-surfaces">
              <section
                className="preview-stage"
                aria-label="Live theme preview"
                hidden={surface === "artwork"}
                aria-busy={compiling || busy}
              >
                <div className="stage-heading">
                  <span className="eyebrow">
                    <span className="live-dot" /> Live specimen
                  </span>
                  <span>
                    {compareOriginal
                      ? "Imported original"
                      : compiling
                        ? "Rebuilding preview…"
                        : "Scriptoscope renderer"}
                  </span>
                </div>
                <>
                  <div className="specimen-settings">
                    <div
                      className="segmented"
                      role="group"
                      aria-label="Window state"
                    >
                      {["Active", "Inactive"].map((state, i) => (
                        <button
                          key={state}
                          aria-pressed={inactive === !!i}
                          onClick={() => {
                            setInactive(!!i);
                            if (focus?.component === "document-window")
                              selectComponent({
                                component: "document-window",
                                variant: i ? "inactive" : "active",
                              });
                          }}
                        >
                          {state}
                        </button>
                      ))}
                    </div>
                    <label>
                      Size{" "}
                      <select
                        aria-label="Size"
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value))}
                      >
                        <option value={240}>Compact</option>
                        <option value={320}>Wide</option>
                      </select>
                    </label>
                    <span>2×</span>
                  </div>
                  <div className="preview-scroll">
                    {displayTheme ? (
                      <Specimen
                        theme={displayTheme}
                        width={width}
                        inactive={inactive}
                        selection={focus}
                        onSelect={selectComponent}
                      />
                    ) : (
                      <div className="preview-placeholder">
                        Preparing your theme…
                      </div>
                    )}
                  </div>
                  <p className="stage-caption">
                    Pick any button or the window title bar to inspect its
                    state. Rendered at 2×.
                  </p>
                </>
              </section>
              <section
                className="artwork-pane"
                aria-label="Source artwork editor"
                hidden={surface === "preview"}
              >
                <div className="stage-heading">
                  <span className="eyebrow">Source artwork</span>
                  <div className="source-heading-actions">
                    <span className="small-badge">
                      {selectedResource
                        ? `cicn ${selectedResource.id}`
                        : "NO SELECTION"}
                    </span>
                    <button
                      disabled={!selectedResource}
                      onClick={() =>
                        setSurface(surface === "artwork" ? "split" : "artwork")
                      }
                    >
                      {surface === "artwork"
                        ? "Back to specimen"
                        : "Expand source ↗"}
                    </button>
                  </div>
                </div>
                <div className="source-context">
                  <h3>
                    {loadingSource
                      ? "Preparing source…"
                      : selectedResource?.name || "Indexed source image"}
                  </h3>
                  <span>Pick a color · adjust source geometry</span>
                </div>
                {selectedResource ? (
                  <ArtworkEditor
                    data={
                      compareOriginal
                        ? originalResources[selected]!.data
                        : selectedResource.data
                    }
                    geometry={
                      geometry
                        ? compareOriginal && originalGeometry
                          ? [
                              originalGeometry.data[0]!,
                              originalGeometry.data[1]!,
                            ]
                          : [geometry.data[0]!, geometry.data[1]!]
                        : undefined
                    }
                    editable={canEdit && !!geometry}
                    onGeometry={applyGeometry}
                    selectedRecord={record}
                    onPickRecord={(next) => {
                      setRecord(next);
                      setInspectorTab("appearance");
                    }}
                  />
                ) : (
                  <div className="preview-placeholder">
                    {loadingSource
                      ? "Preparing source artwork…"
                      : "Choose supported artwork from the Explorer."}
                  </div>
                )}
                <button
                  className="mobile-edit-color"
                  disabled={!color}
                  onClick={() => {
                    setInspectorTab("appearance");
                    setMobilePanel("properties");
                  }}
                >
                  Edit color record {record} →
                </button>
              </section>
            </div>
          </main>
          <aside className="inspector" aria-label="Artwork inspector">
            <div className="panel-heading">
              <h2>Properties</h2>
              <span className="small-badge">
                {compareOriginal ? "READ ONLY" : "WORKING"}
              </span>
            </div>
            <h3 className="asset-title">
              {component
                ? `${component.label} · ${variant?.label ?? ""}`
                : selectedResource?.name || "Source artwork"}
            </h3>
            <p className="asset-subtitle">
              {selectedResource
                ? `Resource ${selectedResource.id} · occurrence ${selected}`
                : "Select a color icon"}
            </p>
            <div className="scope-card">
              <span className="eyebrow">
                {component?.id === "push-button"
                  ? "BUTTON FACE"
                  : component
                    ? "WINDOW ARTWORK"
                    : "SOURCE RECORD"}
              </span>
              <p>
                {usages.length
                  ? `Used by ${usages.length} mapped ${usages.length === 1 ? "state" : "states"}`
                  : "No mapped state in this specimen"}
              </p>
              <div className="usage-links">
                {usages.map((usage) => (
                  <button
                    key={`${usage.component}:${usage.variant}`}
                    onClick={() => selectComponent(usage)}
                  >
                    {usage.component === focus?.component
                      ? usage.label
                      : `${usage.componentLabel} · ${usage.label}`}
                  </button>
                ))}
              </div>
              <button
                className="open-source"
                disabled={!selectedResource}
                onClick={() => {
                  setSurface("artwork");
                  setMobilePanel("workspace");
                }}
              >
                Open source artwork <span aria-hidden="true">↗</span>
              </button>
              <details>
                <summary>What does this edit affect?</summary>
                <p>
                  Palette and geometry belong to this source occurrence. Every
                  use of that record changes together.{" "}
                  {component?.id === "push-button"
                    ? "Body patterns, rings and text are separate renderer dependencies; this edits the face artwork."
                    : "Other window recipe parts are not editable here."}{" "}
                  Mapped states above are not a complete dependency inventory.
                </p>
              </details>
            </div>
            <div
              className="inspector-tabs segmented"
              role="group"
              aria-label="Inspector view"
            >
              <button
                aria-pressed={inspectorTab === "appearance"}
                onClick={() => setInspectorTab("appearance")}
              >
                Appearance
              </button>
              <button
                aria-pressed={inspectorTab === "overrides"}
                onClick={() => setInspectorTab("overrides")}
              >
                Overrides{" "}
                <span className="count-badge">{selectionEdits.length}</span>
              </button>
            </div>
            {inspectorTab === "overrides" && (
              <section
                className="local-overrides"
                aria-label="Selected artwork overrides"
              >
                <h3>Changes to this artwork</h3>
                <p className="field-help">
                  Values are compared with the imported source. Each reset is
                  undoable.
                </p>
                {selectionEdits.length ? (
                  selectionEdits.map((edit) => (
                    <div
                      className="override-row"
                      key={`${edit.kind}:${edit.kind === "palette" ? edit.record : edit.occurrence}`}
                    >
                      <div>
                        <strong>
                          {edit.kind === "palette"
                            ? `Color record ${edit.record}`
                            : "Corner / side geometry"}
                        </strong>
                        <code>
                          {edit.before.join(" / ")}
                          <span>→ {edit.after.join(" / ")}</span>
                        </code>
                      </div>
                      <button
                        aria-label={
                          edit.kind === "palette"
                            ? `Reset color record ${edit.record}`
                            : "Reset geometry override"
                        }
                        disabled={!canEdit}
                        onClick={() =>
                          project &&
                          change({
                            ...project,
                            edits: project.edits.filter((e) => e !== edit),
                          })
                        }
                      >
                        Reset
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-changes">
                    <span aria-hidden="true">✓</span>
                    <p>Matches the original</p>
                    <small>Color and geometry edits will appear here.</small>
                  </div>
                )}
              </section>
            )}
            <div hidden={inspectorTab !== "appearance"}>
              <section
                className="inspector-section"
                aria-label="Palette properties"
              >
                <div className="inventory-heading">
                  <h3 className="section-label">PALETTE</h3>
                  <span>{displayedPalette?.entries.length ?? 0} colors</span>
                </div>
                {displayedPalette ? (
                  <>
                    <div className="swatches">
                      {displayedPalette.entries.map((entry, i) => (
                        <button
                          key={i}
                          aria-label={`Palette record ${i}`}
                          aria-pressed={record === i}
                          title={`Record ${i} · index ${entry.value}`}
                          className={
                            project?.edits.some(
                              (edit) =>
                                edit.kind === "palette" &&
                                edit.occurrence === selected &&
                                edit.record === i,
                            )
                              ? "swatch-edited"
                              : ""
                          }
                          style={
                            {
                              "--swatch": displayColor(entry.rgb),
                            } as React.CSSProperties
                          }
                          onClick={() => setRecord(i)}
                        >
                          <span>{i}</span>
                        </button>
                      ))}
                    </div>
                    {color && (
                      <div className="color-editor">
                        <div className="color-summary">
                          <span style={{ background: displayColor(color) }} />
                          <div>
                            Color record {record}{" "}
                            {colorEdited && (
                              <span className="edit-marker">Edited</span>
                            )}
                            <small>
                              Display {displayColor(color).toUpperCase()} ·
                              index {displayedPalette.entries[record]!.value}
                            </small>
                          </div>
                        </div>
                        <button
                          className="reset-property"
                          disabled={!colorEdited || !canEdit}
                          onClick={() =>
                            originalColor && applyColor(originalColor)
                          }
                        >
                          Reset color
                        </button>
                        {colorEdited && originalColor && (
                          <div className="color-comparison">
                            <span
                              style={{
                                background: displayColor(originalColor),
                              }}
                            />
                            <small>Original</small>
                            <span aria-hidden="true">→</span>
                            <span
                              style={{
                                background: displayColor(workingColor!),
                              }}
                            />
                            <small>Working</small>
                          </div>
                        )}
                        <label className="field-label" htmlFor="source-color">
                          Source RGB color
                        </label>
                        <input
                          id="source-color"
                          type="color"
                          disabled={!canEdit}
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
                        <details className="precise-color">
                          <summary>Precise source color (RGB16)</summary>
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
                                  disabled={!canEdit}
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
                            RGB16 fields retain exact source values. The color
                            picker writes an 8-bit source color; the preview
                            applies the runtime display policy.
                          </p>
                        </details>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="field-help">
                    {loadingSource
                      ? "Preparing palette…"
                      : "This artwork is retained, but its palette is not supported by this editor."}
                  </p>
                )}
              </section>
              <section
                className="inspector-section"
                aria-label="Geometry properties"
              >
                <h3 className="section-label">Geometry</h3>
                {geometry && project ? (
                  <>
                    <div className="channel-fields geometry-fields">
                      {["Corner size", "Side thickness"].map((label, i) => (
                        <div key={label}>
                          <span className="property-label">
                            <label
                              className={
                                i === 0 ? "corner-label" : "side-label"
                              }
                              htmlFor={`geometry-${i}`}
                            >
                              {label}
                            </label>
                            <button
                              className="reset-property"
                              aria-label={`Reset ${label.toLowerCase()}`}
                              disabled={
                                !canEdit ||
                                geometry.data[i] === originalGeometry?.data[i]
                              }
                              onClick={() => {
                                if (originalGeometry) {
                                  const next: [number, number] = [
                                    geometry.data[0]!,
                                    geometry.data[1]!,
                                  ];
                                  next[i] = originalGeometry.data[i]!;
                                  applyGeometry(next);
                                }
                              }}
                            >
                              Reset
                            </button>
                          </span>
                          <input
                            id={`geometry-${i}`}
                            type="number"
                            min={0}
                            max={255}
                            value={
                              compareOriginal && originalGeometry
                                ? originalGeometry.data[i]
                                : geometry.data[i]
                            }
                            disabled={!canEdit}
                            onChange={(e) => {
                              if (!e.target.value) return;
                              const next: [number, number] = [
                                geometry.data[0]!,
                                geometry.data[1]!,
                              ];
                              next[i] = Number(e.target.value);
                              applyGeometry(next);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="field-help">
                      Corner and side measurements are independent. Use the
                      fields or drag the C / S guides.
                    </p>
                    <button
                      className="edit-guides"
                      onClick={() => {
                        setSurface("artwork");
                        setMobilePanel("workspace");
                      }}
                    >
                      Adjust guides in source ↗
                    </button>
                  </>
                ) : (
                  <p className="field-help">
                    {loadingSource
                      ? "Preparing geometry…"
                      : "No unique matching cinf record. Palette edits are still available."}
                  </p>
                )}
              </section>
            </div>
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
            <button
              className="recover-source"
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
              Recover original <span aria-hidden="true">↓</span>
            </button>
          </aside>
        </div>
      </div>
      <StudioHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <footer className="status-bar">
        <div className="history-actions">
          <button
            aria-label="Undo edit"
            disabled={!history.past.length || busy}
            onClick={undo}
          >
            ↶
          </button>
          <button
            aria-label="Redo edit"
            disabled={!history.future.length || busy}
            onClick={redo}
          >
            ↷
          </button>
          <span>{project?.edits.length ?? 0} edits</span>
        </div>
        <p role="status">{busy ? "Reading source…" : notice}</p>
        <span className="local-label">
          ● Local workspace · source-backed v0
        </span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
