/** Document-window roles follow the renderer's selected template and TC samples.
 * These are derived bindings to retained ColorSpecs, never replacement artwork.
 */
import type { LoadedTheme } from "../../src/types.js";
import { resolveWindowSelection } from "../../src/resolveWindowType.js";
import { indexedArtwork } from "./source-picking.js";
import { sampledRecord } from "./profile.js";
import {
  inventory,
  paletteFor,
  setPalette,
  workingFork,
  type Project,
  type Rgb16,
} from "./project.js";
import { parseResourceFork } from "../theme-loader/resource-fork.js";

export const WINDOW_STATES = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
] as const;
export type WindowState = (typeof WINDOW_STATES)[number]["id"];
export const WINDOW_ROLES = [
  {
    id: "background",
    label: "Title bar color",
    description:
      "The declared title plate color. Frame details sharing its source palette entry change too; patterned artwork remains.",
  },
  {
    id: "text",
    label: "Window title text",
    description:
      "The title's declared text color, including artwork sharing that source color.",
  },
  {
    id: "shadow",
    label: "Title shadow color",
    description:
      "The title's existing shadow sample. Matching text and shadow colors suppress the shadow.",
  },
] as const;
export type WindowRole = (typeof WINDOW_ROLES)[number]["id"];
type Binding = {
  state: WindowState;
  role: WindowRole;
  occurrence: number;
  sourceId: number;
  record: number;
  original: Rgb16;
  current: Rgb16;
  coupledRoles: WindowRole[];
};
export type WindowProfile = {
  forkSha256: string;
  bindings: Binding[];
  unavailable: { state: WindowState; role: WindowRole; reason: string }[];
};
const equal = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export function getWindowProfile(
  project: Project,
  theme: LoadedTheme | null,
): WindowProfile {
  const profile: WindowProfile = {
    forkSha256: project.source.forkSha256,
    bindings: [],
    unavailable: [],
  };
  const source = inventory(project),
    working = parseResourceFork(workingFork(project));
  for (const { id: state } of WINDOW_STATES) {
    const selected = theme
      ? resolveWindowSelection(theme, "document-window", state)
      : undefined;
    const elements = Object.values(theme?.manifest.chromeElements ?? {}).filter(
      (e) => e.asset === selected?.cicnPath,
    );
    const identity =
      elements.length === 1 ? elements[0]!.cicnSource : undefined;
    const resource = identity ? source[identity.resourceIndex] : undefined;
    const wt = selected?.wt;
    const sampleState = wt?.chrome[state] ? state : "active";
    const samples = wt?.titleSamples?.[sampleState];
    const body = wt?.parts["part-0"]?.rect,
      title = wt?.parts["part-4"]?.rect;
    for (const { id: role } of WINDOW_ROLES) {
      const reject = (reason: string) =>
        profile.unavailable.push({ state, role, reason });
      if (!theme) {
        reject("Loading source window declarations.");
        continue;
      }
      if (
        !selected ||
        selected.owner !== theme ||
        wt?.model === "corner-sprite" ||
        !identity ||
        elements[0]?.sourceCicnId !== identity.id ||
        !resource ||
        resource.type !== "cicn" ||
        resource.id !== identity.id ||
        resource.data.length !== identity.byteLength
      ) {
        reject(
          "No unique source-backed document-window template for this state.",
        );
        continue;
      }
      const popup = wt === theme.manifest.windowTypes?.["popup-window"];
      const point =
        role === "background"
          ? title && [title[0], title[3] - 4]
          : body && [
              body[0] + (role === "shadow" ? 1 : 0),
              popup ? body[3] - 1 : body[1],
            ];
      const sample = samples?.[role];
      if (!point || !sample) {
        reject("This window has no declared sample for this title property.");
        continue;
      }
      try {
        const image = indexedArtwork(resource.data);
        const record = image
          ? sampledRecord(image, point[0]!, point[1]!)
          : null;
        const original =
          record === null
            ? undefined
            : paletteFor(resource)?.entries[record]?.rgb;
        const current =
          record === null
            ? undefined
            : paletteFor(working[identity.resourceIndex]!)?.entries[record]
                ?.rgb;
        if (
          record === null ||
          !original ||
          !current ||
          !equal(sample.rgb16, original)
        ) {
          reject(
            "The renderer's title sample has no unambiguous matching source palette entry.",
          );
          continue;
        }
        profile.bindings.push({
          state,
          role,
          occurrence: identity.resourceIndex,
          sourceId: resource.id,
          record,
          original: [...original],
          current: [...current],
          coupledRoles: [],
        });
      } catch {
        reject("This title sample cannot be safely parameterized.");
      }
    }
  }
  for (const binding of profile.bindings)
    binding.coupledRoles = [
      ...new Set(
        profile.bindings
          .filter(
            (b) =>
              b.role !== binding.role &&
              b.occurrence === binding.occurrence &&
              b.record === binding.record,
          )
          .map((b) => b.role),
      ),
    ];
  return profile;
}

function assign(
  project: Project,
  profile: WindowProfile,
  role: WindowRole,
  states: readonly WindowState[],
  rgb?: Rgb16,
): Project {
  if (profile.forkSha256 !== project.source.forkSha256)
    throw new Error("The window profile belongs to a different source.");
  if (
    !WINDOW_ROLES.some((r) => r.id === role) ||
    !states.length ||
    states.some((s) => !WINDOW_STATES.some((v) => v.id === s))
  )
    throw new Error("Choose a supported window role and state.");
  if (
    rgb &&
    (rgb.length !== 3 ||
      rgb.some((v) => !Number.isInteger(v) || v < 0 || v > 65535))
  )
    throw new Error("Color channels must be exact RGB16 values.");
  const source = inventory(project),
    planned = new Map<string, { binding: Binding; value: Rgb16 }>();
  for (const state of new Set(states)) {
    const binding = profile.bindings.find(
      (b) => b.state === state && b.role === role,
    );
    if (!binding)
      throw new Error(`${state}: ${role} has no verified source binding.`);
    const resource = source[binding.occurrence];
    if (
      !resource ||
      resource.type !== "cicn" ||
      resource.id !== binding.sourceId ||
      !equal(
        paletteFor(resource)?.entries[binding.record]?.rgb ?? [],
        binding.original,
      )
    )
      throw new Error("Stale window role binding.");
    const value = rgb ?? binding.original,
      key = `${binding.occurrence}:${binding.record}`;
    if (planned.has(key) && !equal(planned.get(key)!.value, value))
      throw new Error("Shared window roles require the same source color.");
    planned.set(key, { binding, value });
  }
  let result = project;
  for (const { binding, value } of planned.values())
    result = setPalette(result, binding.occurrence, binding.record, value);
  return result;
}
export function applyWindowColor(
  project: Project,
  profile: WindowProfile,
  role: WindowRole,
  states: readonly WindowState[],
  rgb: Rgb16,
): Project {
  return assign(project, profile, role, states, rgb);
}
export function resetWindowColor(
  project: Project,
  profile: WindowProfile,
  role: WindowRole,
  states: readonly WindowState[],
): Project {
  return assign(project, profile, role, states);
}
