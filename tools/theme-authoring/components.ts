import type { LoadedTheme } from "../../src/types.js";
import { PUSH_BUTTON } from "../../src/engine/tables/pushButton.js";
import type { inventory, Project } from "./project.js";

export type ComponentId = "push-button" | "document-window";
export type ComponentSelection = { component: ComponentId; variant: string };
export type SourceResource = ReturnType<typeof inventory>[number];
export type Variant = {
  key: string;
  label: string;
  occurrence: number | null;
  asset?: string;
  unavailable?: string;
};
export type AuthoringComponent = {
  id: ComponentId;
  label: string;
  group: string;
  variants: Variant[];
};

/** Resolve only admitted decoder occurrences, never an author's label or filename. */
export function componentsFor(
  theme: LoadedTheme | null,
  resources: SourceResource[],
  windowAssets: Partial<Record<"active" | "inactive", string>> = {},
): AuthoringComponent[] {
  const elements = Object.values(theme?.manifest.chromeElements ?? {});
  const fromAsset = (
    key: string,
    label: string,
    asset: string | undefined,
  ): Variant => {
    const element = asset ? elements.find((e) => e.asset === asset) : undefined;
    const source = element?.cicnSource;
    const record = source ? resources[source.resourceIndex] : undefined;
    if (
      !source ||
      !record ||
      record.type !== "cicn" ||
      record.id !== source.id
    ) {
      return {
        key,
        label,
        occurrence: null,
        unavailable:
          "No single editable source artwork is available for this state.",
      };
    }
    return {
      key,
      label,
      occurrence: source.resourceIndex,
      asset: element!.asset,
    };
  };
  const buttons = [
    { key: "normal", label: "Normal", id: PUSH_BUTTON.PB7.resource },
    { key: "pressed", label: "Pressed", id: PUSH_BUTTON.PB6.resource },
    { key: "disabled", label: "Disabled", id: PUSH_BUTTON.PB5.resource },
  ].map((state) =>
    fromAsset(
      state.key,
      state.label,
      elements.find((e) => e.sourceCicnId === state.id && e.asset)?.asset,
    ),
  );
  return [
    {
      id: "document-window",
      label: "Document window",
      group: "Windows",
      variants: [
        fromAsset("active", "Active", windowAssets.active),
        fromAsset("inactive", "Inactive", windowAssets.inactive),
      ],
    },
    {
      id: "push-button",
      label: "Push button",
      group: "Controls",
      variants: buttons,
    },
  ];
}

export function resetArtwork(
  project: Project,
  occurrence: number,
  geometryOccurrence?: number,
): Project {
  return {
    ...project,
    edits: project.edits.filter(
      (edit) =>
        !(edit.kind === "palette" && edit.occurrence === occurrence) &&
        !(edit.kind === "geometry" && edit.occurrence === geometryOccurrence),
    ),
  };
}

export function editedVariant(
  project: Project | null,
  variant: Variant,
  resources: SourceResource[],
): boolean {
  if (variant.occurrence === null) return false;
  const id = resources[variant.occurrence]?.id;
  const geometry = resources.filter(
    (r) => r.type === "cinf" && r.id === id && r.data.length >= 18,
  );
  return !!project?.edits.some((edit) =>
    edit.kind === "palette"
      ? edit.occurrence === variant.occurrence
      : geometry.length === 1 && edit.occurrence === geometry[0]!.occurrence,
  );
}
