import { useEffect, useRef, useState } from "react";
import { platinumMenu, platinumMenuBar } from "../../src/platinum.js";
import { bufferToCanvas } from "../../src/controls.js";

export type StudioCommand = {
  label: string;
  action: () => void;
  disabled?: boolean;
  checked?: boolean;
  shortcut?: string;
};
export type StudioMenuGroup = {
  label: string;
  commands: (StudioCommand | null)[];
};

/** Scriptoscope draws the chrome; semantic DOM supplies keyboard and pointer interaction. */
export function StudioMenu({ groups }: { groups: StudioMenuGroup[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [tab, setTab] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titles = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const host = strip.current;
    if (!host) return;
    const paint = () =>
      host.replaceChildren(
        bufferToCanvas(
          platinumMenuBar({
            titles: [],
            width: Math.ceil(host.clientWidth / 2),
          }),
          2,
        ),
      );
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (open === null || !panel.current) return;
    const host = panel.current;
    // Empty rows leave command text in the accessibility tree and preserve native hit areas.
    host.replaceChildren(
      bufferToCanvas(
        platinumMenu({
          items: groups[open]!.commands.map(() => ""),
          width: 160,
        }),
        2,
      ),
    );
  }, [open, groups]);
  useEffect(() => {
    if (open !== null)
      root.current
        ?.querySelector<HTMLButtonElement>(
          '[role="menu"] button:not(:disabled)',
        )
        ?.focus();
  }, [open]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const close = () => {
    setOpen(null);
    titles.current[open ?? tab]?.focus();
  };
  const openMenu = (index: number) => {
    setTab(index);
    setOpen(index);
  };
  return (
    <div className="studio-menu" ref={root}>
      <div className="menu-chrome" ref={strip} aria-hidden="true" />
      <div
        className="studio-menubar"
        role="menubar"
        aria-label="Studio commands"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            const next =
              (tab + (event.key === "ArrowRight" ? 1 : -1) + groups.length) %
              groups.length;
            setTab(next);
            if (open !== null) setOpen(next);
            else titles.current[next]?.focus();
          } else if (event.key === "Escape") {
            event.preventDefault();
            close();
          } else if (event.key === "Tab") setOpen(null);
        }}
      >
        {groups.map((group, index) => (
          <div className="studio-menu-group" key={group.label}>
            <button
              ref={(element) => {
                titles.current[index] = element;
              }}
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open === index}
              aria-controls={
                open === index ? `studio-menu-${index}` : undefined
              }
              tabIndex={tab === index ? 0 : -1}
              onFocus={() => setTab(index)}
              onClick={() => (open === index ? setOpen(null) : openMenu(index))}
              onPointerEnter={() => {
                if (open !== null && open !== index) openMenu(index);
              }}
              onKeyDown={(event) => {
                if (["ArrowDown", "ArrowUp"].includes(event.key)) {
                  event.preventDefault();
                  openMenu(index);
                }
              }}
            >
              {group.label}
            </button>
            {open === index && (
              <div
                className="studio-menu-panel"
                role="menu"
                aria-label={group.label}
                id={`studio-menu-${index}`}
                onKeyDown={(event) => {
                  if (
                    !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
                  )
                    return;
                  event.preventDefault();
                  event.stopPropagation();
                  const items = [
                    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                      "button:not(:disabled)",
                    ),
                  ];
                  const current = items.indexOf(
                    document.activeElement as HTMLButtonElement,
                  );
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? items.length - 1
                        : (current +
                            (event.key === "ArrowDown" ? 1 : -1) +
                            items.length) %
                          items.length;
                  items[next]?.focus();
                }}
              >
                <div
                  className="menu-panel-chrome"
                  ref={panel}
                  aria-hidden="true"
                />
                {group.commands.map((command, item) =>
                  command ? (
                    <button
                      key={command.label}
                      role={
                        command.checked === undefined
                          ? "menuitem"
                          : "menuitemcheckbox"
                      }
                      aria-checked={command.checked}
                      disabled={command.disabled}
                      tabIndex={-1}
                      onClick={() => {
                        close();
                        command.action();
                      }}
                    >
                      <span className="menu-check" aria-hidden="true">
                        {command.checked ? "✓" : ""}
                      </span>
                      <span>{command.label}</span>
                      {command.shortcut && <kbd>{command.shortcut}</kbd>}
                    </button>
                  ) : (
                    <div role="separator" key={`separator-${item}`} />
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <span className="menu-workspace-label">
        Theme authoring <span> / </span> local workspace
      </span>
    </div>
  );
}

export function StudioHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLElement>("h2")?.focus();
      if (dialog.current) dialog.current.scrollTop = 0;
    } else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  return (
    <dialog
      className="studio-help"
      ref={dialog}
      onClose={onClose}
      aria-labelledby="studio-help-title"
    >
      <span className="eyebrow">SCRIPTOSCOPE / FIELD GUIDE</span>
      <h2 id="studio-help-title" tabIndex={-1}>
        Make a scheme your own.
      </h2>
      <ol>
        <li>
          <strong>Choose a base.</strong> Start with 1138 or Animals, or import
          a classic Kaleidoscope scheme.
        </li>
        <li>
          <strong>Edit in context.</strong> Select a window or button in the
          scene. Named colors show which states and source details change
          together.
        </li>
        <li>
          <strong>Compare and refine.</strong> View the original at any time.
          Undo, redo or reset a property to its imported value.
        </li>
        <li>
          <strong>Download your project.</strong> Save keeps the original source
          and your edits in a Studio project. Open that project to continue
          later.
        </li>
      </ol>
      <p>
        Window title colors and push-button colors are editable where source
        bindings are verified. Document text, selection and other controls are
        preview content or retained source artwork. Advanced source exposes
        exact palette and geometry edits.
      </p>
      <p>
        Nothing is installed or applied to your desktop. Web, classic scheme and
        Linux theme export are not available yet.
      </p>
      <p className="help-runtime">
        The working menu chrome uses Scriptoscope’s built-in Platinum renderer.
        It stays stable while you edit and compare the scheme in the scene.
      </p>
      <button onClick={onClose}>Back to the workbench</button>
    </dialog>
  );
}
