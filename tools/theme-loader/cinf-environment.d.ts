import type { ChromeElement } from '../../src/types.js';
export interface CinfEnvironmentInput {
  readonly version: 1; readonly complete: boolean;
  readonly providers: readonly (
    { readonly kind: 'theme-fork'; readonly id: string; readonly complete: boolean } |
    { readonly kind: 'raw-fork'; readonly id: string; readonly complete: boolean; readonly bytes: Uint8Array | ArrayBuffer }
  )[];
}
export interface PreparedCinfEnvironment { readonly id: `cinf-environment:${string}`; readonly data: Readonly<Record<string, unknown>>; }
export interface CinfBindingSummary {
  readonly environmentId: string; readonly bindingId: string; readonly themeForkSha256: string;
  readonly policy: 'caller-declared-ordered-cinf-only'; readonly scope: 'standalone-push-bevel-body';
}
export interface CinfProviderReference {
  readonly providerId: string; readonly providerKind: 'theme-fork' | 'raw-fork'; readonly forkSha256: string;
  readonly occurrence: number; readonly signedId: number; readonly byteLength: number; readonly sha256: string;
}
export interface CinfLookupView extends CinfBindingSummary {
  readonly requestedId: number; readonly body: true; readonly displayPolicy: string;
  readonly status: 'ready' | 'unsupported' | 'no-body-or-border'; readonly reason?: string;
  readonly attempts: readonly { readonly id: number; readonly outcome: 'found' | 'missing' | 'unknown' | 'ambiguous' | 'invalid'; readonly resource?: CinfProviderReference; readonly reason?: string; readonly providerId?: string }[];
  readonly selected?: CinfProviderReference;
}
export interface BodyCinfView extends CinfLookupView {
  readonly metadata?: Readonly<Pick<ChromeElement, 'slice' | 'bodyRequest' | 'bodyPattern' | 'bgPattern' | 'bgAnchor' | 'textAnchor' | 'embossAnchor' | 'colorSamples'>>;
}
export class CinfEnvironmentError extends Error { readonly code: string; constructor(message: string, code?: string); }
export function prepareCinfEnvironment(input: CinfEnvironmentInput): Promise<PreparedCinfEnvironment>;
export function assertCinfEnvironment(value?: PreparedCinfEnvironment): void;

/** Internal role-view admission; serialized declarations are not prepared inputs. */
export function isBoundBodyCinfView(summary: CinfBindingSummary, view: BodyCinfView | undefined): boolean;
