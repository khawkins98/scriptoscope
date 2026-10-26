export type Rgb16 = readonly [number, number, number];
export type Rgb8 = readonly [number, number, number];
interface DisplayProfileCommon {
  readonly conditions: Readonly<Record<string, unknown>>;
  readonly evidence: readonly { readonly sha256: string; readonly description: string }[];
  readonly devicePalette: readonly { readonly index: number; readonly rgb16: Rgb16 }[];
  readonly mappings: readonly { readonly rgb16: Rgb16; readonly deviceIndex: number; readonly deviceRgb16: Rgb16 }[];
  readonly producer: { readonly model: 'rgb16-high-byte-table'; readonly channels: readonly [readonly number[], readonly number[], readonly number[]] };
}
/** Finite declared operation inputs. Does not validate a consumer's drawing context. */
export interface DirectRgb8Preparation {
  readonly operation: 'GetPixPat-FillCRect-patCopy';
  readonly context: 'declared-context0';
  readonly scope: 'preparation-only';
  readonly evidence: readonly { readonly sha256: string; readonly description: string }[];
  readonly mappings: readonly { readonly rgb8: Rgb8; readonly deviceIndex: number; readonly deviceRgb16: Rgb16 }[];
}
export type DisplayProfileData = DisplayProfileCommon & (
  | { readonly version: 1; readonly directRgb8?: never }
  | { readonly version: 2; readonly directRgb8: DirectRgb8Preparation }
);
export interface DisplayProfile { readonly id: `display-profile:${string}`; readonly data: DisplayProfileData; }
export type DisplayPolicy = 'mac-1.8-to-2.2-high-byte' | DisplayProfile['id'];
export const LEGACY_DISPLAY_POLICY: 'mac-1.8-to-2.2-high-byte';
export class DisplayProfileError extends Error { readonly code: string; }
export function prepareDisplayProfile(data: DisplayProfileData): Promise<DisplayProfile>;
export function displayRealizer(profile?: DisplayProfile): ((rgb16: readonly number[]) => number[]) | undefined;
/** Internal loader/decoder seam; not re-exported by the package entrypoint. */
export function directRgb8Realizer(profile?: DisplayProfile): ((rgb8: readonly number[]) => number[]) | undefined;
export function displayPolicy(profile?: DisplayProfile): DisplayPolicy;
export function realizeRgb16(rgb16: readonly number[], profile?: DisplayProfile): number[];
export function ownerDisplayPolicyMatches(owner: { readonly displayProfile?: DisplayProfile } | undefined, policy: unknown): boolean;
interface ProfileChain { readonly manifest: { displayProfile?: DisplayProfile }; readonly base?: ProfileChain | undefined }
export function assertDisplayProfileChain(theme: ProfileChain | undefined, profile?: DisplayProfile): void;
