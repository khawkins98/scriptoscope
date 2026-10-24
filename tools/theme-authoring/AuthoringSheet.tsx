import { useEffect, useState } from "react";
import type { Project, Rgb16 } from "./project.js";
import {
  AUTHORING_ROLES,
  AUTHORING_STATES,
  type AuthoringProfile,
  type AuthoringRole,
  type AuthoringState,
} from "./profile.js";
import {
  WINDOW_ROLES,
  WINDOW_STATES,
  type WindowProfile,
  type WindowRole,
  type WindowState,
} from "./window-profile.js";
import { displayHex, sourceFromDisplayHex } from "./colors.js";
import type { LoadedTheme } from "../../src/types.js";
import { AuthoringGallery, stateLabel } from "./AuthoringGallery.js";

const sameColor = (a: Rgb16, b: Rgb16) => a.every((v, i) => v === b[i]);

function RoleColorInput({
  label,
  color,
  mixed,
  disabled,
  onChange,
}: {
  label: string;
  color: Rgb16;
  mixed: boolean;
  disabled: boolean;
  onChange: (rgb: Rgb16) => void;
}) {
  const value = displayHex(color);
  const [draft, setDraft] = useState(mixed ? "" : value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(mixed ? "" : value);
    setInvalid(false);
  }, [value, mixed]);
  const apply = (hex: string) => {
    if (!/^#[\da-f]{6}$/i.test(hex)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (!mixed && hex.toLowerCase() === value.toLowerCase()) return;
    const source = sourceFromDisplayHex(hex);
    onChange(source);
    setDraft(displayHex(source));
  };
  return (
    <div className="role-color-input">
      <input
        type="color"
        aria-label={`${label} color picker`}
        value={value}
        disabled={disabled}
        onChange={(event) => apply(event.target.value)}
      />
      <input
        type="text"
        aria-label={`${label} hex color`}
        aria-invalid={invalid}
        value={draft}
        placeholder={mixed ? "Mixed" : "#000000"}
        spellCheck={false}
        maxLength={7}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft && (mixed || draft.toLowerCase() !== value.toLowerCase()))
            apply(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(mixed ? "" : value);
            setInvalid(false);
          }
        }}
      />
      {invalid && (
        <small role="alert">Use a six-digit hex color, such as #D59A3A.</small>
      )}
    </div>
  );
}

type NamedBinding<S extends string, R extends string> = {
  state: S;
  role: R;
  occurrence: number;
  record: number;
  current: Rgb16;
  original: Rgb16;
  coupledRoles: R[];
};
function NamedColors<S extends string, R extends string>({
  roles,
  profile,
  states,
  original,
  disabled,
  checkingCoverage,
  onColor,
  onReset,
  onScope,
}: {
  roles: readonly { id: R; label: string; description: string }[];
  profile: {
    bindings: NamedBinding<S, R>[];
    unavailable: { state: S; role: R; reason: string }[];
  } | null;
  states: S[];
  original: boolean;
  disabled: boolean;
  checkingCoverage: boolean;
  onColor: (role: R, states: S[], rgb: Rgb16) => void;
  onReset: (role: R, states: S[]) => void;
  onScope: (state: S) => void;
}) {
  const bindings = profile?.bindings ?? [];
  return (
    <div className="named-properties">
      {roles.map((role) => {
        const targets = bindings.filter(
          (binding) =>
            binding.role === role.id && states.includes(binding.state),
        );
        const shown = original
          ? targets.map((binding) => ({
              ...binding,
              current: binding.original,
            }))
          : targets;
        const color = shown[0]?.current;
        const mixed =
          !!color &&
          shown.some(
            (binding) => displayHex(binding.current) !== displayHex(color),
          );
        const edited = targets.some(
          (binding) => !sameColor(binding.current, binding.original),
        );
        const otherStates = [
          ...new Set(
            bindings
              .filter(
                (binding) =>
                  !states.includes(binding.state) &&
                  targets.some(
                    (target) =>
                      target.occurrence === binding.occurrence &&
                      target.record === binding.record,
                  ),
              )
              .map((binding) => binding.state),
          ),
        ];
        const coupled = [
          ...new Set(
            targets
              .flatMap((binding) => binding.coupledRoles)
              .filter((id) => id !== role.id),
          ),
        ];
        return (
          <section
            className="named-property"
            key={role.id}
            aria-label={role.label}
          >
            <div className="role-heading">
              <div>
                <h3>
                  {role.label}
                  {edited && <span className="role-edited">Edited</span>}
                </h3>
                <p>{role.description}</p>
              </div>
              <button
                aria-label={`Reset ${role.label}`}
                disabled={disabled || !edited}
                onClick={() =>
                  onReset(
                    role.id,
                    targets.map((binding) => binding.state),
                  )
                }
              >
                Reset
              </button>
            </div>
            {targets.length > 0 && targets.length < states.length && (
              <p className="scope-limitation">
                Applies only to{" "}
                {targets.map((binding) => stateLabel(binding.state)).join(", ")}
                .{" "}
                {states
                  .filter(
                    (state) =>
                      !targets.some((binding) => binding.state === state),
                  )
                  .map(stateLabel)
                  .join(", ")}
                : retained without a verified binding.
              </p>
            )}
            {color ? (
              <>
                <div className="role-edit-row">
                  <RoleColorInput
                    key={targets.map((binding) => binding.state).join(",")}
                    label={role.label}
                    color={color}
                    mixed={mixed}
                    disabled={disabled}
                    onChange={(rgb) =>
                      onColor(
                        role.id,
                        targets.map((binding) => binding.state),
                        rgb,
                      )
                    }
                  />
                  <span className="role-scope-summary">
                    {targets.length === 1
                      ? "State color"
                      : mixed
                        ? "Varies by state"
                        : "Same across selected states"}
                    <small>
                      {targets
                        .map((binding) => stateLabel(binding.state))
                        .join(" · ")}
                    </small>
                  </span>
                </div>
                <div
                  className="state-color-values"
                  role="group"
                  aria-label={`${role.label} state colors`}
                >
                  {shown.map((binding) => (
                    <button
                      key={binding.state}
                      onClick={() => onScope(binding.state)}
                      aria-label={`Edit ${stateLabel(binding.state)} ${role.label}`}
                    >
                      <span
                        style={{ background: displayHex(binding.current) }}
                      />
                      <small>{stateLabel(binding.state)}</small>
                      <code>{displayHex(binding.current).toUpperCase()}</code>
                    </button>
                  ))}
                </div>
                <p className="coupled-note">
                  {targets.length > 1
                    ? "Picking a color applies it to every state listed above. "
                    : ""}
                  {role.id === "face"
                    ? "Also recolors artwork pixels sharing this color, including outlines or details."
                    : "Changes every source pixel sharing the bound color."}
                  {otherStates.length
                    ? ` Also changes ${otherStates.map(stateLabel).join(", ")} through shared source colors.`
                    : ""}
                  {coupled.length
                    ? ` Coupled with ${coupled.map((id) => roles.find((item) => item.id === id)?.label ?? id).join(", ")}.`
                    : ""}
                </p>
              </>
            ) : (
              <p className="unavailable-role">
                {checkingCoverage
                  ? "Checking source role coverage…"
                  : "No verified binding for the selected state scope."}
              </p>
            )}
            {profile &&
              !checkingCoverage &&
              states.some(
                (state) => !targets.some((binding) => binding.state === state),
              ) && (
                <div className="role-coverage">
                  {profile.unavailable
                    .filter(
                      (item) =>
                        item.role === role.id && states.includes(item.state),
                    )
                    .map((item) => (
                      <p key={item.state}>
                        <strong>{stateLabel(item.state)}:</strong> {item.reason}
                      </p>
                    ))}
                </div>
              )}
          </section>
        );
      })}
    </div>
  );
}

export function AuthoringSheet({
  project,
  profile,
  windowProfile,
  onWindowColor,
  onWindowReset,
  onWindowResetGroup,
  theme,
  original,
  compiling,
  checkingCoverage,
  busy,
  scope,
  onScope,
  onCompare,
  onColor,
  onReset,
  onResetGroup,
  onAmber,
  onAdvanced,
  onSample,
}: {
  project: Project | null;
  profile: AuthoringProfile | null;
  windowProfile: WindowProfile | null;
  onWindowColor: (role: WindowRole, states: WindowState[], rgb: Rgb16) => void;
  onWindowReset: (role: WindowRole, states: WindowState[]) => void;
  onWindowResetGroup: (states: WindowState[]) => void;
  theme: LoadedTheme | null;
  original: boolean;
  compiling: boolean;
  checkingCoverage: boolean;
  busy: boolean;
  scope: "all" | AuthoringState;
  onScope: (scope: "all" | AuthoringState) => void;
  onCompare: (original: boolean) => void;
  onColor: (role: AuthoringRole, states: AuthoringState[], rgb: Rgb16) => void;
  onReset: (role: AuthoringRole, states: AuthoringState[]) => void;
  onResetGroup: (states: AuthoringState[]) => void;
  onAmber: (states: AuthoringState[]) => void;
  onAdvanced: () => void;
  onSample: (index: number) => void;
}) {
  const [mobileView, setMobileView] = useState<
    "bases" | "properties" | "preview"
  >("properties");
  const [section, setSection] = useState<
    "overview" | "windows" | "text" | "controls"
  >("overview");
  const [windowScope, setWindowScope] = useState<"all" | WindowState>("all");
  const windowStates =
    windowScope === "all" ? WINDOW_STATES.map((s) => s.id) : [windowScope];
  const windowsSupported = WINDOW_STATES.filter((s) =>
    windowProfile?.bindings.some((b) => b.state === s.id),
  );
  const sections = [
    { id: "overview", label: "Overview" },
    { id: "windows", label: "Windows" },
    { id: "text", label: "Text & selection" },
    { id: "controls", label: "Controls" },
  ] as const;
  const navigate = (next: typeof section) => {
    setSection(next);
    setMobileView("properties");
  };
  const coverage = (count: number, total: number) =>
    checkingCoverage ? "Checking coverage…" : `${count}/${total} states mapped`;
  const states =
    scope === "all" ? AUTHORING_STATES.map((state) => state.id) : [scope];
  const bindings = profile?.bindings ?? [];
  const supportedStates = AUTHORING_STATES.filter((state) =>
    bindings.some((b) => b.state === state.id),
  );
  const amberStates = states.filter((state) =>
    ["face", "text"].every((role) =>
      bindings.some(
        (binding) => binding.state === state && binding.role === role,
      ),
    ),
  );
  const disabled = busy || original || !profile;
  return (
    <div className={`authoring-workspace authoring-mobile-${mobileView}`}>
      <div
        className="authoring-panel-navigation segmented"
        role="group"
        aria-label="Authoring panels"
      >
        {(["bases", "properties", "preview"] as const).map((panel) => (
          <button
            key={panel}
            aria-pressed={mobileView === panel}
            onClick={() => setMobileView(panel)}
          >
            {stateLabel(panel)}
          </button>
        ))}
      </div>
      <aside className="starter-library" aria-label="Starting themes">
        <span className="eyebrow">START WITH A THEME</span>
        <h2>Your base</h2>
        <p>Keep its character. Make it yours.</p>
        <div className="starter-list">
          {["1138", "Animals"].map((name, index) => (
            <button
              key={name}
              aria-label={`Start with ${name}`}
              aria-pressed={
                project?.source.filename ===
                (index ? "animals.sit" : "1138.rsrc")
              }
              disabled={busy}
              onClick={() => {
                onSample(index);
                setMobileView("properties");
              }}
            >
              <span className="starter-monogram" aria-hidden="true">
                {index ? "A" : "11"}
              </span>
              <span>
                <strong>{name}</strong>
                <small>Included starter</small>
              </span>
              <span className="starter-check" aria-hidden="true">
                {project?.source.filename ===
                (index ? "animals.sit" : "1138.rsrc")
                  ? "✓"
                  : ""}
              </span>
            </button>
          ))}
        </div>
        {project &&
          !["1138.rsrc", "animals.sit"].includes(project.source.filename) && (
            <div className="imported-base">
              <strong>{project.name}</strong>
              <span>Imported base · original retained</span>
            </div>
          )}
        <div className="base-details">
          <span className="eyebrow">EDITING COVERAGE</span>
          <h3>This scheme’s coverage</h3>
          <dl>
            <div>
              <dt>Button colors</dt>
              <dd>
                {checkingCoverage
                  ? "Checking coverage…"
                  : `${supportedStates.length}/3 states mapped`}
              </dd>
            </div>
            <div>
              <dt>Window title colors</dt>
              <dd>{coverage(windowsSupported.length, 2)}</dd>
            </div>
            <div>
              <dt>Global accent</dt>
              <dd>No verified binding</dd>
            </div>
          </dl>
          <p>
            Only verified design roles appear as controls. The rest of your
            imported theme is retained.
          </p>
        </div>
        <button className="advanced-entry" onClick={onAdvanced}>
          Open advanced source <span aria-hidden="true">↗</span>
        </button>
        <small className="base-preservation">
          Original bytes preserved. Edits stay local.
        </small>
      </aside>
      <main className="property-sheet" aria-label="Theme properties">
        <nav className="property-navigation" aria-label="Property groups">
          {sections.map((item) => (
            <button
              key={item.id}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {original && (
          <div className="authoring-comparison" role="note">
            <strong>Viewing the imported original</strong>
            <p>Editing is paused. Your working changes are preserved.</p>
            <button onClick={() => onCompare(false)}>Return to working</button>
          </div>
        )}
        {section === "overview" && (
          <>
            <div className="sheet-heading">
              <span className="eyebrow">YOUR THEME AT A GLANCE</span>
              <h2>Shape the whole scene</h2>
              <p>
                Start with a property group, or select a window or button in the
                preview. Each named color edits a verified part of{" "}
                {project?.name || "your imported scheme"}.
              </p>
            </div>
            <div className="overview-groups">
              <button onClick={() => navigate("windows")}>
                <span className="overview-number">01</span>
                <span>
                  <strong>Windows</strong>
                  <small>Title bar, title text and shadow</small>
                  <em>{coverage(windowsSupported.length, 2)}</em>
                </span>
                <span aria-hidden="true">→</span>
              </button>
              <button onClick={() => navigate("controls")}>
                <span className="overview-number">02</span>
                <span>
                  <strong>Controls</strong>
                  <small>
                    Button colors across Normal, Pressed and Disabled
                  </small>
                  <em>{coverage(supportedStates.length, 3)}</em>
                </span>
                <span aria-hidden="true">→</span>
              </button>
              <button onClick={() => navigate("text")}>
                <span className="overview-number">03</span>
                <span>
                  <strong>Text &amp; selection</strong>
                  <small>
                    Document content and selection are preview examples
                  </small>
                  <em>No verified authoring bindings</em>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="coverage-explanation">
              <h3>Named colors, shared source effects</h3>
              <p>
                A color may also appear in frame details or another state. Each
                property shows those links before you edit; selecting a state
                does not duplicate its source colors.
              </p>
              <p>
                Other artwork stays in your project. Use Advanced source for
                exact palette values and geometry.
              </p>
              <button onClick={onAdvanced}>Inspect source artwork ↗</button>
            </div>
          </>
        )}
        {section === "text" && (
          <>
            <div className="sheet-heading">
              <span className="eyebrow">TEXT &amp; SELECTION</span>
              <h2>Content in context</h2>
              <p>
                The document sample helps you judge your window and control
                colors together. Its content and highlighting are preview-only
                and are not saved.
              </p>
            </div>
            <div className="unsupported-properties">
              <section>
                <h3>Document text</h3>
                <span>Unavailable</span>
                <p>
                  No verified source binding for document text color or font.
                  The preview uses neutral sample typography.
                </p>
              </section>
              <section>
                <h3>Selection color</h3>
                <span>Unavailable</span>
                <p>
                  No verified source binding for document selection. The sample
                  highlight is fixed preview content.
                </p>
              </section>
              <section>
                <h3>Global accent</h3>
                <span>Unavailable</span>
                <p>
                  No single verified color controls this entire scheme. Edit the
                  supported window and button roles separately.
                </p>
              </section>
            </div>
            <div className="coverage-explanation">
              <h3>Editable text colors</h3>
              <p>
                Window titles and button labels have their own verified roles.
              </p>
              <div className="coverage-links">
                <button onClick={() => navigate("windows")}>
                  Window title colors →
                </button>
                <button onClick={() => navigate("controls")}>
                  Button label colors →
                </button>
              </div>
            </div>
          </>
        )}
        {section === "windows" && (
          <>
            <div className="sheet-heading">
              <span className="eyebrow">WINDOW APPEARANCE</span>
              <h2>Windows</h2>
              <p>
                Coordinate the title colors of active and inactive document
                windows. Patterned frame artwork keeps its original structure.
              </p>
            </div>
            <div className="scope-section">
              <div>
                <h3>Apply changes to</h3>
                <span>
                  {windowScope === "all"
                    ? "Coordinate both windows"
                    : "Selected window state"}
                </span>
              </div>
              <div
                className="state-scope segmented"
                role="group"
                aria-label="Window state scope"
              >
                <button
                  aria-pressed={windowScope === "all"}
                  onClick={() => setWindowScope("all")}
                >
                  Both states
                </button>
                {WINDOW_STATES.map((state) => (
                  <button
                    key={state.id}
                    aria-pressed={windowScope === state.id}
                    onClick={() => setWindowScope(state.id)}
                  >
                    {state.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="property-group-heading">
              <h3>Title colors</h3>
              <button
                disabled={
                  busy ||
                  original ||
                  !windowProfile?.bindings.some(
                    (b) =>
                      windowStates.includes(b.state) &&
                      !sameColor(b.current, b.original),
                  )
                }
                onClick={() => onWindowResetGroup(windowStates)}
              >
                {windowScope === "all"
                  ? "Reset all window colors"
                  : `Reset ${stateLabel(windowScope)} window colors`}
              </button>
            </div>
            <NamedColors
              roles={WINDOW_ROLES}
              profile={windowProfile}
              states={windowStates}
              original={original}
              disabled={busy || original || !windowProfile}
              checkingCoverage={checkingCoverage}
              onColor={onWindowColor}
              onReset={onWindowReset}
              onScope={setWindowScope}
            />
            <div className="unsupported-properties">
              <section>
                <h3>Window border</h3>
                <span>Advanced source only</span>
                <p>
                  No independent border color is verified. Borders are patterned
                  source artwork and may share colors with the title roles
                  above.
                </p>
              </section>
              <section>
                <h3>Document surface</h3>
                <span>Unavailable</span>
                <p>
                  No verified authoring binding for the document background. The
                  neutral sample surface is preview-only.
                </p>
              </section>
            </div>
          </>
        )}
        {section === "controls" && (
          <>
            <div className="sheet-heading">
              <span className="eyebrow">THEME PROPERTIES</span>
              <h2>Button appearance</h2>
              <p>
                Edit named colors across related states. Preview every change as
                you work.
              </p>
            </div>
            <details className="mobile-authoring-coverage">
              <summary>
                Editing coverage ·{" "}
                {checkingCoverage
                  ? "Checking…"
                  : `${supportedStates.length}/3 button states`}
              </summary>
              <p>
                Verified button and window title colors are editable. Other
                artwork remains available in Advanced source. There is no
                verified global accent binding, and the output is a Studio
                project.
              </p>
            </details>
            <div className="scope-section">
              <div>
                <h3>Apply changes to</h3>
                <span>
                  {scope === "all"
                    ? "Coordinate the family"
                    : "Independent state override"}
                </span>
              </div>
              <div
                className="state-scope segmented"
                role="group"
                aria-label="Property state scope"
              >
                <button
                  aria-pressed={scope === "all"}
                  onClick={() => onScope("all")}
                >
                  All states
                </button>
                {AUTHORING_STATES.map((state) => (
                  <button
                    key={state.id}
                    aria-pressed={scope === state.id}
                    onClick={() => onScope(state.id)}
                  >
                    {state.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="variation-card">
              <div className="amber-chip" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <div>
                <strong>Try an amber variation</strong>
                <p>
                  Distinct warm faces and coordinated label colors for{" "}
                  {scope === "all" ? "supported states" : stateLabel(scope)}.
                </p>
              </div>
              <button
                disabled={disabled || amberStates.length === 0}
                onClick={() => onAmber(amberStates)}
              >
                {amberStates.length < states.length
                  ? "Apply amber to supported states"
                  : "Apply amber variation"}
              </button>
            </div>
            {amberStates.length < states.length &&
              profile &&
              !checkingCoverage && (
                <p className="scope-limitation">
                  Amber can apply to{" "}
                  {amberStates.map(stateLabel).join(", ") ||
                    "none of the selected states"}
                  . Other states lack a verified face or text binding and are
                  retained.
                </p>
              )}
            <div className="property-group-heading">
              <h3>Color properties</h3>
              <button
                disabled={
                  disabled ||
                  !bindings.some(
                    (binding) =>
                      states.includes(binding.state) &&
                      !sameColor(binding.current, binding.original),
                  )
                }
                onClick={() => onResetGroup(states)}
              >
                {scope === "all"
                  ? "Reset all button colors"
                  : `Reset ${stateLabel(scope)} colors`}
              </button>
            </div>
            <NamedColors
              roles={AUTHORING_ROLES}
              profile={profile}
              states={states}
              original={original}
              disabled={disabled}
              checkingCoverage={checkingCoverage}
              onColor={onColor}
              onReset={onReset}
              onScope={onScope}
            />
          </>
        )}
        {section !== "overview" && section !== "text" && (
          <details className="color-policy-note">
            <summary>Color values and source effects</summary>
            <p>
              These controls use preview RGB colors. New choices use the source
              8-bit value that gives the nearest preview color, expanded to
              16-bit channels. The quantized result appears in the preview.
              Untouched source values keep their exact precision. Advanced
              source exposes exact RGB16 values. Shared bindings remain shared;
              state scope does not create independent copies.
            </p>
            <button onClick={onAdvanced}>Inspect exact source values ↗</button>
          </details>
        )}
      </main>
      <AuthoringGallery
        theme={theme}
        scope={section === "controls" ? scope : "all"}
        windowScope={section === "windows" ? windowScope : "all"}
        onWindowScope={(state) => {
          setWindowScope(state);
          navigate("windows");
        }}
        onText={() => navigate("text")}
        original={original}
        compiling={compiling}
        onScope={(state) => {
          onScope(state);
          navigate("controls");
        }}
        onCompare={onCompare}
      />
    </div>
  );
}
