import type { DisplayProfile, Rgb16 } from './display-profile.js';
export type TransferRect = readonly [number, number, number, number];
export interface CicnTransferSource {
  readonly payloadSha256: string;
  readonly byteLength: number;
  readonly indexedRepresentationSha256: string;
}
export interface CicnTransferOperation {
  readonly name: 'GetCIcon-CopyBits'; readonly mode: 'srcCopy'; readonly masked: false;
  readonly foregroundRGB16: readonly [0, 0, 0]; readonly backgroundRGB16: readonly [65535, 65535, 65535];
  /** Rectangles use left, top, right, bottom. */
  readonly sourceRect: TransferRect; readonly destinationRect: TransferRect; readonly clipRect: TransferRect;
  readonly portRect: TransferRect; readonly localZeroGlobal: readonly [number, number];
}
export interface CicnTransferData {
  readonly version: 1; readonly scope: 'finite-raster-preparation';
  readonly environment: {
    readonly deviceEvidenceSha256: string; readonly engineEvidenceSha256: string;
    readonly devicePalette: readonly { readonly index: number; readonly rgb16: Rgb16 }[];
    readonly producer: { readonly model: 'rgb16-high-byte-table'; readonly channels: readonly [readonly number[], readonly number[], readonly number[]] };
  };
  readonly records: readonly {
    readonly source: CicnTransferSource; readonly operation: CicnTransferOperation;
    readonly preparationEvidenceSha256: string;
    readonly evidence: readonly { readonly sha256: string; readonly description: string }[];
    readonly destinationIndices: readonly number[];
  }[];
}
export interface PreparedCicnTransfers {
  readonly id: `cicn-transfer-results:${string}`;
  readonly contractId: `cicn-transfer-context:${string}`;
  readonly data: CicnTransferData;
}
export interface CicnTransferOption {
  readonly results: PreparedCicnTransfers;
  /** Explicitly authorizes these recorded preparation contexts, not a later paint operation. */
  readonly contractId: PreparedCicnTransfers['contractId'];
  readonly maskPolicy: 'source-mask-alpha';
}
export interface CicnTransferProvenance {
  readonly model: 'finite-cicn-transfer-v1'; readonly scope: 'finite-raster-preparation';
  readonly resultsId: PreparedCicnTransfers['id']; readonly contractId: PreparedCicnTransfers['contractId'];
  readonly maskPolicy: 'source-mask-alpha'; readonly forkSha256: string; readonly source: CicnTransferSource;
  readonly resource: { readonly type: 'cicn'; readonly signedId: number; readonly resourceIndex: number };
  readonly operation: CicnTransferOperation; readonly destinationPlaneSha256: string;
  readonly preparationEvidenceSha256: string;
  readonly evidence: readonly { readonly sha256: string; readonly description: string }[];
}
export class CicnTransferError extends Error { readonly code: string; }
export function prepareCicnTransferResults(data: CicnTransferData): Promise<PreparedCicnTransfers>;
/** Internal loader seam; not re-exported by the package. */
export function snapshotCicnTransfer(option: CicnTransferOption | undefined, profile: DisplayProfile | undefined): CicnTransferOption | undefined;
