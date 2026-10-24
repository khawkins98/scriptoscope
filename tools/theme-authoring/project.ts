// Source-backed experiment: rebuild runtime handles from a fresh edited fork.
// Only fixed-size, typed palette/geometry edits are admitted; originals stay exact.
import { parseResourceFork } from "../theme-loader/resource-fork.js";
import { readCicnIndexed } from "../theme-loader/decoders/cicn.js";
import {
  detectContainer,
  unwrapToResourceFork,
} from "../theme-loader/containers.js";

export type Rgb16 = [number, number, number];
type Resource = ReturnType<typeof parseResourceFork>[number];
type Selection = {
  policy: string;
  entryIndex: number | null;
  entryName: string | null;
};
export type PaletteEdit = {
  kind: "palette";
  occurrence: number;
  id: number;
  record: number;
  before: Rgb16;
  after: Rgb16;
};
export type GeometryEdit = {
  kind: "geometry";
  occurrence: number;
  id: number;
  before: [number, number];
  after: [number, number];
};
export type Edit = PaletteEdit | GeometryEdit;
export type Project = {
  format: "scriptoscope-authoring-experiment";
  version: 0;
  requiredProfiles: ["kaleidoscope-source-edits/0"];
  name: string;
  source: {
    filename: string;
    original: string;
    originalSha256: string;
    fork: string;
    forkSha256: string;
    container: string;
    selection: Selection;
    meta: Record<string, unknown>;
  };
  edits: Edit[];
};

export const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
export const MAX_PROJECT_BYTES = 48 * 1024 * 1024;
const PROFILE = "kaleidoscope-source-edits/0";
const error = (message: string): never => {
  throw new Error(message);
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, max: number): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= max;

export async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function encodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function decodeBytes(encoded: string): Uint8Array {
  if (
    typeof encoded !== "string" ||
    encoded.length > Math.ceil(MAX_SOURCE_BYTES / 3) * 4 ||
    encoded.length % 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
  ) {
    return error("Invalid or oversized embedded source.");
  }
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  if (!bytes.length || bytes.length > MAX_SOURCE_BYTES)
    error("Source must be between 1 byte and 16 MiB.");
  return bytes;
}

async function selectFork(
  bytes: Uint8Array,
): Promise<{ fork: Uint8Array; container: string; selection: Selection }> {
  const container = detectContainer(bytes);
  if (container === "stuffit") {
    const { stuffItResourceForkWithSelection } =
      await import("../sit-wasm/index.mjs");
    const result = await stuffItResourceForkWithSelection(bytes);
    if (result.bytes.length > MAX_SOURCE_BYTES)
      error("Selected resource fork exceeds 16 MiB.");
    return { fork: result.bytes, container, selection: result.selection };
  }
  return {
    fork: unwrapToResourceFork(bytes),
    container,
    selection: {
      policy:
        container === "raw" ? "raw-resource-fork" : "container-unwrapping",
      entryIndex: null,
      entryName: null,
    },
  };
}

export async function importSource(
  bytes: Uint8Array,
  filename: string,
  meta: Record<string, unknown> = {},
): Promise<Project> {
  if (
    typeof filename !== "string" ||
    !filename.length ||
    filename.length > 1024
  ) {
    error("Invalid source filename.");
  }
  if (!bytes.length || bytes.length > MAX_SOURCE_BYTES)
    error("Source must be between 1 byte and 16 MiB.");
  const original = new Uint8Array(bytes);
  const { fork, container, selection } = await selectFork(original);
  const resources = parseResourceFork(fork);
  if (!resources.some((r) => r.type === "cicn"))
    error("No color-icon artwork found in this resource fork.");
  return {
    format: "scriptoscope-authoring-experiment",
    version: 0,
    requiredProfiles: [PROFILE],
    name: (typeof meta.name === "string"
      ? meta.name
      : filename.replace(/\.[^.]+$/, "")
    ).slice(0, 240),
    source: {
      filename,
      original: encodeBytes(original),
      originalSha256: await sha256(original),
      fork: encodeBytes(fork),
      forkSha256: await sha256(fork),
      container,
      selection,
      meta,
    },
    edits: [],
  };
}

type Palette = {
  width: number;
  height: number;
  offset: number;
  entries: Array<{ value: number; rgb: Rgb16 }>;
};
export function paletteFor(resource: Resource): Palette | null {
  if (resource.type !== "cicn") return null;
  // The legacy JS function's JSDoc describes decodeCicn, not its indexed result.
  const parsed = readCicnIndexed(resource.data) as unknown as {
    pmap: { width: number; height: number };
    mask: { rowBytes: number; height: number };
    bmap: { rowBytes: number; height: number };
    colorTable: {
      entries: Array<{ value: number; r: number; g: number; b: number }>;
    };
  } | null;
  if (!parsed) return null;
  const offset =
    82 +
    parsed.mask.rowBytes * parsed.mask.height +
    parsed.bmap.rowBytes * parsed.bmap.height +
    8;
  return {
    width: parsed.pmap.width,
    height: parsed.pmap.height,
    offset,
    entries: parsed.colorTable.entries.map((e) => ({
      value: e.value,
      rgb: [e.r, e.g, e.b] as Rgb16,
    })),
  };
}

export function inventory(project: Project) {
  return parseResourceFork(decodeBytes(project.source.fork)).map(
    (r, occurrence) => ({ ...r, occurrence }),
  );
}

const editKey = (edit: Edit) =>
  `${edit.kind}:${edit.occurrence}:${edit.kind === "palette" ? edit.record : ""}`;
const equal = (a: number[], b: number[]) =>
  a.length === b.length && a.every((n, i) => n === b[i]);

/** Validate and apply edits to a private copy, preserving all other fork bytes. */
export function workingFork(project: Project): Uint8Array {
  const fork = decodeBytes(project.source.fork);
  const resources = parseResourceFork(fork);
  const seen = new Set<string>();
  if (!Array.isArray(project.edits) || project.edits.length > 2048)
    error("Too many or invalid edits.");
  for (const edit of project.edits) {
    if (
      !isRecord(edit) ||
      !["palette", "geometry"].includes(edit.kind) ||
      !integer(edit.occurrence, resources.length - 1)
    )
      error("Unsupported edit operation.");
    const resource = resources[edit.occurrence]!;
    if (resource.id !== edit.id)
      error("Edited resource identity does not match the original.");
    const key = editKey(edit);
    if (seen.has(key)) error("Duplicate edit operation.");
    seen.add(key);
    if (edit.kind === "palette") {
      const palette = paletteFor(resource);
      if (!palette || !integer(edit.record, palette.entries.length - 1))
        error("Unsupported palette record.");
      const before = palette!.entries[edit.record]!.rgb;
      if (
        !Array.isArray(edit.before) ||
        !equal(before, edit.before) ||
        !Array.isArray(edit.after) ||
        edit.after.length !== 3 ||
        !edit.after.every((n) => integer(n, 65535))
      ) {
        error("Invalid RGB16 edit or stale source palette.");
      }
      const view = new DataView(
        resource.data.buffer,
        resource.data.byteOffset,
        resource.data.byteLength,
      );
      edit.after.forEach((n, channel) =>
        view.setUint16(
          palette!.offset + edit.record * 8 + 2 + channel * 2,
          n,
          false,
        ),
      );
    } else {
      if (
        resource.type !== "cinf" ||
        resource.data.length < 18 ||
        !Array.isArray(edit.before) ||
        !equal([resource.data[0]!, resource.data[1]!], edit.before) ||
        !Array.isArray(edit.after) ||
        edit.after.length !== 2 ||
        !edit.after.every((n) => integer(n, 255))
      ) {
        error("Invalid geometry edit or stale source geometry.");
      }
      resource.data.set(edit.after, 0);
    }
  }
  return fork;
}

export function setPalette(
  project: Project,
  occurrence: number,
  record: number,
  rgb: Rgb16,
): Project {
  const resource =
    inventory(project)[occurrence] ?? error("Missing source resource.");
  const palette = paletteFor(resource) ?? error("Unsupported artwork.");
  const before = palette.entries[record]?.rgb ?? error("Missing source color.");
  const edit: PaletteEdit = {
    kind: "palette",
    occurrence,
    id: resource.id,
    record,
    before,
    after: rgb,
  };
  const result = {
    ...project,
    edits: project.edits.filter((e) => editKey(e) !== editKey(edit)),
  };
  if (!equal(before, rgb)) result.edits.push(edit);
  workingFork(result);
  return result;
}

export function setGeometry(
  project: Project,
  occurrence: number,
  after: [number, number],
): Project {
  const resource =
    inventory(project)[occurrence] ?? error("Missing source geometry.");
  const edit: GeometryEdit = {
    kind: "geometry",
    occurrence,
    id: resource.id,
    before: [resource.data[0]!, resource.data[1]!],
    after,
  };
  const result = {
    ...project,
    edits: project.edits.filter((e) => editKey(e) !== editKey(edit)),
  };
  if (!equal(edit.before, after)) result.edits.push(edit);
  workingFork(result);
  return result;
}

export function serializeProject(project: Project): string {
  workingFork(project);
  return JSON.stringify(project, null, 2) + "\n";
}

export async function openProject(text: string): Promise<Project> {
  if (text.length > MAX_PROJECT_BYTES) error("Project exceeds 48 MiB.");
  const value: unknown = JSON.parse(text);
  if (
    !isRecord(value) ||
    value.format !== "scriptoscope-authoring-experiment" ||
    value.version !== 0 ||
    !Array.isArray(value.requiredProfiles) ||
    value.requiredProfiles.length !== 1 ||
    value.requiredProfiles[0] !== PROFILE ||
    typeof value.name !== "string" ||
    value.name.length > 240 ||
    !isRecord(value.source) ||
    !Array.isArray(value.edits)
  ) {
    return error("Unsupported project format or required profile.");
  }
  const source = value.source;
  if (
    typeof source.filename !== "string" ||
    source.filename.length > 1024 ||
    typeof source.original !== "string" ||
    typeof source.fork !== "string" ||
    !isRecord(source.meta)
  )
    error("Invalid project source.");
  const original = decodeBytes(source.original as string),
    fork = decodeBytes(source.fork as string);
  if (
    (await sha256(original)) !== source.originalSha256 ||
    (await sha256(fork)) !== source.forkSha256
  ) {
    error("Source hash mismatch. The saved original has changed.");
  }
  const selected = await selectFork(original);
  const selection = source.selection;
  const sameSelection =
    isRecord(selection) &&
    Object.keys(selected.selection).length === Object.keys(selection).length &&
    Object.entries(selected.selection).every(
      ([key, value]) => selection[key] === value,
    );
  if (
    (await sha256(selected.fork)) !== source.forkSha256 ||
    selected.container !== source.container ||
    !sameSelection
  ) {
    error("Selected resource fork does not match the original archive.");
  }
  const project = value as Project;
  workingFork(project);
  return project;
}
