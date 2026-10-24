/** Named authoring roles admitted through the renderer's declared source samples.
 * Profiles are derived, never persisted as a replacement for original bytes.
 */
import type { LoadedTheme } from "../../src/types.js";
import { PUSH_BUTTON } from "../../src/engine/tables/pushButton.js";
import { decodeCinf } from "../theme-loader/decoders/cinf.js";
import { indexedArtwork } from "./source-picking.js";
import {
  inventory,
  paletteFor,
  setPalette,
  workingFork,
  type Project,
  type Rgb16,
} from "./project.js";
import { parseResourceFork } from "../theme-loader/resource-fork.js";

export const AUTHORING_STATES = [
  { id: "normal", label: "Normal", resource: PUSH_BUTTON.PB7.resource },
  { id: "pressed", label: "Pressed", resource: PUSH_BUTTON.PB6.resource },
  { id: "disabled", label: "Disabled", resource: PUSH_BUTTON.PB5.resource },
] as const;
export type AuthoringState = (typeof AUTHORING_STATES)[number]["id"];
export const AUTHORING_ROLES = [
  {
    id: "face",
    label: "Button face color",
    description:
      "Declared background color; artwork using the same palette entry changes too. Body patterns remain separate.",
  },
  {
    id: "text",
    label: "Button label color",
    description:
      "Declared text color; highlights or other artwork sharing this entry change with it.",
  },
  {
    id: "emboss",
    label: "Label emboss color",
    description:
      "An existing label highlight or shadow. This does not create an emboss effect.",
  },
] as const;
export type AuthoringRole = (typeof AUTHORING_ROLES)[number]["id"];
export type RoleBinding = {
  state: AuthoringState;
  role: AuthoringRole;
  occurrence: number;
  record: number;
  original: Rgb16;
  current: Rgb16;
  pixelCount: number;
  coupledRoles: AuthoringRole[];
};
export type AuthoringProfile = {
  forkSha256: string;
  label: string;
  bindings: RoleBinding[];
  unavailable: Array<{
    state: AuthoringState;
    role: AuthoringRole;
    reason: string;
  }>;
};
const equal = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((n, i) => n === b[i]);

/** Mirrors the admitted engine sampler selection, not display-color matching.
 * Reject ambiguous/missing indices instead of adopting a compatibility fallback.
 * The engine's color sampler ignores the source mask and ctFlags.
 */
export function sampledRecord(
  image: NonNullable<ReturnType<typeof indexedArtwork>>,
  x: number,
  y: number,
): number | null {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= image.pmap.width ||
    y >= image.pmap.height
  )
    return null;
  const index = image.indices[y * image.pmap.width + x]!;
  const entries = image.colorTable.entries;
  const matches = entries.flatMap((entry, i) =>
    entry.value === index ? [i] : [],
  );
  if (matches.length > 1) return null;
  let position = index;
  if (
    !(index < entries.length && entries[index]!.value === index) &&
    entries.at(-1)?.value !== 0
  ) {
    if (matches.length !== 1) return null;
    position = matches[0]!;
  }
  return entries[position] ? position : null;
}

export function getAuthoringProfile(
  project: Project,
  originalTheme: LoadedTheme | null,
): AuthoringProfile {
  const profile: AuthoringProfile = {
    forkSha256: project.source.forkSha256,
    label: "Source-bound button colors",
    bindings: [],
    unavailable: [],
  };
  const original = inventory(project);
  const working = parseResourceFork(workingFork(project));
  for (const state of AUTHORING_STATES) {
    const element = Object.values(
      originalTheme?.manifest.chromeElements ?? {},
    ).find((e) => e.sourceCicnId === state.resource && e.asset);
    const identity = element?.cicnSource;
    const source = identity ? original[identity.resourceIndex] : undefined;
    const geometries = original.filter(
      (r) =>
        r.type === "cinf" && r.id === state.resource && r.data.length >= 18,
    );
    for (const role of AUTHORING_ROLES) {
      const reject = (reason: string) =>
        profile.unavailable.push({ state: state.id, role: role.id, reason });
      if (!originalTheme) {
        reject("Loading source role declarations.");
        continue;
      }
      if (
        !element ||
        !identity ||
        !source ||
        source.type !== "cicn" ||
        identity.id !== state.resource ||
        source.id !== state.resource ||
        identity.byteLength !== source.data.length
      ) {
        reject("No verified source artwork for this state.");
        continue;
      }
      if (
        geometries.length !== 1 ||
        element.sourceCinfId !== state.resource ||
        element.colorSamples?.model !== "kdef-2.3.1-color"
      ) {
        reject("A unique matching source color declaration is required.");
        continue;
      }
      try {
        const geometry = decodeCinf(geometries[0]!.data);
        const point =
          role.id === "face"
            ? geometry.bgPixel
            : role.id === "text"
              ? geometry.textPixel
              : geometry.embossPixel;
        const anchor =
          role.id === "face"
            ? element.bgAnchor
            : role.id === "text"
              ? element.textAnchor
              : element.embossAnchor;
        const sample =
          role.id === "face"
            ? element.colorSamples.background
            : role.id === "text"
              ? element.colorSamples.text
              : element.colorSamples.emboss;
        if (
          role.id === "emboss" &&
          element.colorSamples.embossDecision !== "present"
        ) {
          reject("This state has no independently active emboss color.");
          continue;
        }
        if (!anchor || !equal(anchor, [point.x, point.y]) || !sample) {
          reject("The renderer and source color declaration do not agree.");
          continue;
        }
        const image = indexedArtwork(source.data);
        const record = image ? sampledRecord(image, point.x, point.y) : null;
        const palette = paletteFor(source);
        const originalColor =
          record !== null ? palette?.entries[record]?.rgb : undefined;
        const current =
          record !== null
            ? paletteFor(working[identity.resourceIndex]!)?.entries[record]?.rgb
            : undefined;
        if (
          !image ||
          record === null ||
          !originalColor ||
          !current ||
          !equal(sample.rgb16, originalColor)
        ) {
          reject(
            "No unambiguous exact palette binding for this declared color.",
          );
          continue;
        }
        // Raster uses ctFlags; the semantic sampler does not. Count only uniquely
        // resolved source pixels actually referencing this editable ColorSpec.
        const rasterIndex =
          image.colorTable.flags & 0x8000
            ? record
            : image.colorTable.entries[record]!.value;
        const uniqueRaster =
          !!(image.colorTable.flags & 0x8000) ||
          image.colorTable.entries.filter((e) => e.value === rasterIndex)
            .length === 1;
        const pixelCount = uniqueRaster
          ? image.indices.filter((index) => index === rasterIndex).length
          : 0;
        profile.bindings.push({
          state: state.id,
          role: role.id,
          occurrence: identity.resourceIndex,
          record,
          original: [...originalColor],
          current: [...current],
          pixelCount,
          coupledRoles: [],
        });
      } catch {
        reject("This source color cannot be safely parameterized.");
      }
    }
  }
  for (const binding of profile.bindings)
    binding.coupledRoles = [
      ...new Set(
        profile.bindings
          .filter(
            (other) =>
              other.role !== binding.role &&
              other.occurrence === binding.occurrence &&
              other.record === binding.record,
          )
          .map((other) => other.role),
      ),
    ];
  return profile;
}

function applyAssignments(
  project: Project,
  profile: AuthoringProfile,
  assignments: Array<{ binding: RoleBinding; value: Rgb16 }>,
): Project {
  if (profile.forkSha256 !== project.source.forkSha256)
    throw new Error("The authoring profile belongs to a different source.");
  const original = inventory(project);
  const planned = new Map<string, { binding: RoleBinding; value: Rgb16 }>();
  for (const assignment of assignments) {
    const { binding, value } = assignment;
    const source = original[binding.occurrence];
    const expectedId = AUTHORING_STATES.find(
      (s) => s.id === binding.state,
    )?.resource;
    if (
      !source ||
      source.type !== "cicn" ||
      source.id !== expectedId ||
      !equal(
        paletteFor(source)?.entries[binding.record]?.rgb ?? [],
        binding.original,
      )
    )
      throw new Error("Stale authoring role binding.");
    if (
      value.some(
        (channel) =>
          !Number.isInteger(channel) || channel < 0 || channel > 65535,
      )
    )
      throw new Error("Color channels must be exact RGB16 values.");
    const key = `${binding.occurrence}:${binding.record}`;
    const previous = planned.get(key);
    if (previous && !equal(previous.value, value))
      throw new Error(
        "Linked source roles require different colors. Choose individual state/role edits instead.",
      );
    planned.set(key, assignment);
  }
  let result = project;
  for (const { binding, value } of planned.values()) {
    const current = project.edits.find(
      (e) =>
        e.kind === "palette" &&
        e.occurrence === binding.occurrence &&
        e.record === binding.record,
    );
    if (!equal(current?.after ?? binding.original, value))
      result = setPalette(result, binding.occurrence, binding.record, value);
  }
  return result;
}
function selectedBindings(
  profile: AuthoringProfile,
  role: AuthoringRole,
  states: readonly AuthoringState[],
): RoleBinding[] {
  if (
    !states.length ||
    states.some((state) => !AUTHORING_STATES.some((s) => s.id === state))
  )
    throw new Error("Choose at least one supported button state.");
  return [...new Set(states)].map((state) => {
    const binding = profile.bindings.find(
      (b) => b.state === state && b.role === role,
    );
    if (!binding)
      throw new Error(
        `${AUTHORING_STATES.find((s) => s.id === state)?.label}: ${AUTHORING_ROLES.find((r) => r.id === role)?.label ?? role} is not safely editable.`,
      );
    return binding;
  });
}
export function applyRoleColor(
  project: Project,
  profile: AuthoringProfile,
  role: AuthoringRole,
  states: readonly AuthoringState[],
  rgb: Rgb16,
): Project {
  return applyAssignments(
    project,
    profile,
    selectedBindings(profile, role, states).map((binding) => ({
      binding,
      value: rgb,
    })),
  );
}
export function resetRoleColor(
  project: Project,
  profile: AuthoringProfile,
  role: AuthoringRole,
  states: readonly AuthoringState[],
): Project {
  return applyAssignments(
    project,
    profile,
    selectedBindings(profile, role, states).map((binding) => ({
      binding,
      value: binding.original,
    })),
  );
}
export function applyAmberVariation(
  project: Project,
  profile: AuthoringProfile,
  states: readonly AuthoringState[],
): Project {
  const colors: Record<AuthoringState, { face: Rgb16; text: Rgb16 }> = {
    normal: { face: [32896, 19275, 3084], text: [65535, 65535, 65535] },
    pressed: { face: [24415, 13107, 1542], text: [65535, 65535, 65535] },
    disabled: { face: [38550, 34952, 27756], text: [10023, 8224, 5911] },
  };
  const assignments = (["face", "text"] as const).flatMap((role) =>
    selectedBindings(profile, role, states).map((binding) => ({
      binding,
      value: colors[binding.state][role],
    })),
  );
  return applyAssignments(project, profile, assignments);
}
