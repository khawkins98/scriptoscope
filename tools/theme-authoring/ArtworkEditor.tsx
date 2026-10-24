import { useEffect, useRef, useState, type PointerEvent } from "react";
import { decodeCicn } from "../theme-loader/decoders/cicn.js";
import { gammaCorrectRgba } from "../theme-loader/mac-gamma.js";

type Geometry = [number, number];
export function ArtworkEditor({
  data,
  geometry,
  editable = false,
  onGeometry,
  compact = false,
}: {
  data: Uint8Array;
  geometry?: Geometry | undefined;
  editable?: boolean;
  onGeometry?: (next: Geometry) => void;
  compact?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bounds = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    field: 0 | 1;
    original: Geometry;
    draft: Geometry;
  } | null>(null);
  const [zoom, setZoom] = useState(8);
  const [size, setSize] = useState<[number, number]>([1, 1]);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Geometry | null>(null);
  const shown = draft ?? geometry;

  useEffect(() => {
    drag.current = null;
    setDraft(null);
    try {
      const image = decodeCicn(data);
      if (!image)
        throw new Error(
          "This palette variant is retained but cannot be displayed here.",
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
      setSize([image.width, image.height]);
      setError("");
    } catch (e) {
      if (canvas.current) {
        canvas.current.width = 1;
        canvas.current.height = 1;
      }
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [data, editable]);

  const cancel = () => {
    drag.current = null;
    setDraft(null);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current,
      rect = bounds.current?.getBoundingClientRect();
    if (!active || !rect) return;
    const value =
      active.field === 0
        ? ((event.clientX - rect.left) / rect.width) * size[0]
        : ((event.clientY - rect.top) / rect.height) * size[1];
    const next: Geometry = [...active.draft];
    next[active.field] = Math.max(0, Math.min(255, Math.round(value)));
    active.draft = next;
    setDraft(next);
  };
  const finish = () => {
    const active = drag.current;
    cancel();
    if (active && active.draft.some((value, i) => value !== active.original[i]))
      onGeometry?.(active.draft);
  };
  const sourceWidth = size[0] * (compact ? Math.min(10, 220 / size[0]) : zoom);
  const sourceHeight = size[1] * (compact ? Math.min(10, 220 / size[0]) : zoom);

  return (
    <div className={compact ? "artwork-editor compact" : "artwork-editor"}>
      {!compact && (
        <div className="artwork-toolbar">
          <span>
            Source artwork · {size[0]} × {size[1]} px
          </span>
          <label>
            Zoom{" "}
            <select
              aria-label="Artwork zoom"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            >
              {[4, 8, 12, 16, 24].map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="artboard">
        <div
          className="artwork-wrap"
          ref={bounds}
          style={{ width: sourceWidth, height: sourceHeight }}
        >
          <canvas
            ref={canvas}
            aria-label="Selected source artwork"
            style={{ width: sourceWidth, height: sourceHeight }}
          />
          {shown && !error && (
            <>
              <div
                className="geometry-guide corner"
                style={{
                  inset: `${Math.min(100, (shown[0] / size[1]) * 100)}% ${Math.min(100, (shown[0] / size[0]) * 100)}%`,
                }}
              />
              <div
                className="geometry-guide side"
                style={{
                  inset: `${Math.min(100, (shown[1] / size[1]) * 100)}% ${Math.min(100, (shown[1] / size[0]) * 100)}%`,
                }}
              />
              {!compact &&
                editable &&
                ([0, 1] as const).map((field) => (
                  <div
                    key={field}
                    role="slider"
                    tabIndex={0}
                    aria-label={field === 0 ? "Corner guide" : "Side guide"}
                    aria-orientation={field === 0 ? "horizontal" : "vertical"}
                    aria-valuemin={0}
                    aria-valuemax={255}
                    aria-valuenow={shown[field]}
                    className={`guide-handle ${field === 0 ? "corner" : "side"}`}
                    style={
                      field === 0
                        ? {
                            left: `${Math.min(100, (shown[field] / size[0]) * 100)}%`,
                          }
                        : {
                            top: `${Math.min(100, (shown[field] / size[1]) * 100)}%`,
                          }
                    }
                    onPointerDown={(event) => {
                      if (event.button !== 0 || !geometry) return;
                      event.preventDefault();
                      event.currentTarget.focus();
                      drag.current = {
                        field,
                        original: [...geometry],
                        draft: [...geometry],
                      };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={move}
                    onPointerUp={finish}
                    onPointerCancel={cancel}
                    onLostPointerCapture={cancel}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancel();
                        return;
                      }
                      if (
                        !geometry ||
                        ![
                          "ArrowLeft",
                          "ArrowRight",
                          "ArrowUp",
                          "ArrowDown",
                          "Home",
                          "End",
                        ].includes(event.key)
                      )
                        return;
                      event.preventDefault();
                      const next: Geometry = [...geometry];
                      next[field] =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? 255
                            : Math.max(
                                0,
                                Math.min(
                                  255,
                                  geometry[field] +
                                    (["ArrowRight", "ArrowDown"].includes(
                                      event.key,
                                    )
                                      ? 1
                                      : -1),
                                ),
                              );
                      onGeometry?.(next);
                    }}
                  >
                    <span>{field === 0 ? "C" : "S"}</span>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
      <p className="artwork-caption">
        {error ||
          `${size[0]} × ${size[1]} px · ${compact ? "source preview, nearest neighbor" : "pixel-aligned display"}`}
      </p>
      {!compact && (
        <div className="guide-legend">
          <span className="corner">Corner size {shown?.[0] ?? "—"}</span>
          <span className="side">Side thickness {shown?.[1] ?? "—"}</span>
          <p>
            {editable
              ? "Drag C horizontally or S vertically. Arrow keys adjust one pixel; Escape cancels a drag."
              : "Choose an editable control state to adjust its geometry."}
          </p>
          {shown && shown.some((value) => value > Math.min(...size) / 2) && (
            <p>
              Insets extend beyond half the template. Guides are bounded to the
              image; values and renderer behavior are retained.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
